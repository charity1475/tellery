package io.tellery.services

import arrow.core.Either
import com.google.gson.GsonBuilder
import com.google.protobuf.ByteString
import com.google.protobuf.Empty
import io.grpc.Status
import io.grpc.Metadata
import io.grpc.StatusRuntimeException
import io.tellery.annotations.Config
import io.tellery.common.ConfigManager
import io.tellery.common.ConnectorManager
import io.tellery.entities.*
import io.tellery.grpc.*
import io.tellery.configs.*
import io.tellery.types.SQLType
import io.tellery.utils.DateAsTimestampSerializer
import io.tellery.utils.toDisplayType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.asContextElement
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.SendChannel
import kotlinx.coroutines.channels.consumeEach
import mu.KotlinLogging
import java.nio.charset.StandardCharsets.UTF_8
import java.sql.Date
import java.sql.SQLException
import java.sql.Timestamp
import kotlin.coroutines.CoroutineContext

class ConnectorService : ConnectorCoroutineGrpc.ConnectorImplBase() {

    private val logger = KotlinLogging.logger { }

    private val currThreadLocal = ThreadLocal<String>().asContextElement()

    override val initialContext: CoroutineContext
        get() = Dispatchers.Default + currThreadLocal

    private val serializer = GsonBuilder()
        .serializeSpecialFloatingPointValues()
        .registerTypeAdapter(Date::class.java, DateAsTimestampSerializer())
        .registerTypeAdapter(Timestamp::class.java, DateAsTimestampSerializer())
        .create()

    private val secretMask = "**TellerySecretField**"

    private fun errorWrapper(e: Exception, decoratedName: String): StatusRuntimeException {
        return when (e) {
            is StatusRuntimeException -> e
            is SQLException -> {
                StatusRuntimeException(Status.UNAVAILABLE.withCause(e).withDescription("SQL Error: ${e.message}"),
                    Metadata())
            }
            else -> {
                logger.error("Error when handling $decoratedName", e)
                StatusRuntimeException(Status.INTERNAL.withCause(e).withDescription("Internal Error: ${e.message}"),
                    Metadata())
            }
        }
    }

    private suspend fun <S, T> withErrorWrapper(request: S, handler: suspend (request: S) -> T): T {
        try {
            return handler(request)
        } catch (e: Exception) {
            throw errorWrapper(e, handler.javaClass.enclosingMethod.name)
        }
    }

    private fun buildConfigFieldFromAnnotation(confAnnotation: Config): ConfigField{
        return ConfigField {
            name = confAnnotation.name
            type = confAnnotation.type.name
            description = confAnnotation.description
            hint = confAnnotation.hint
            required = confAnnotation.required
            secret = confAnnotation.secret
        }
    }

    override suspend fun getAvailableConfigs(request: Empty): AvailableConfigs {
        return withErrorWrapper(request) {
            AvailableConfigs {
                addAllAvailableConfigs(ConnectorManager.getAvailableConfigs().map {
                    AvailableConfig {
                        type = it.type
                        addAllConfigs(it.jdbcConfigs.map(::buildConfigFieldFromAnnotation))
                        addAllOptionals(it.optionals.map(::buildConfigFieldFromAnnotation))
                    }
                })
            }
        }
    }

    private val loadedProfiles: Profiles
        get() = Profiles {
            addAllProfiles(ConnectorManager.getCurrentProfiles().values.map {
                val connectorMeta = ConnectorManager.getAvailableConfigs().find{cfg -> cfg.type == it.type}!!
                val secretConfigs = connectorMeta.jdbcConfigs.filter{it.secret}.map{it.name}.toSet()
                val secretOptionals = connectorMeta.optionals.filter{it.secret}.map{it.name}.toSet()
                ProfileBody {

                    type = it.type
                    name = it.name
                    it.auth?.let {
                        auth = Auth {
                            username = it.username
                            if (it.password != null) {
                                password = secretMask
                            }
                        }
                    }

                    putAllConfigs(it.configs.entries.associate{ (k, v) ->
                        if (secretConfigs.contains(k)){
                            k to secretMask
                        } else {
                            k to v
                        }
                    })

                    it.optionals?.let{
                        putAllOptionals(it.entries.associate{ (k, v) ->
                            if (secretOptionals.contains(k)){
                                k to secretMask
                            } else {
                                k to v
                            }
                        })
                    }
                }
            })
        }


    private fun handleSecretField(requestField: String, originalField: String?): String{
        return if (originalField != null && requestField == secretMask){
            originalField
        } else {
            requestField
        }
    }


    override suspend fun upsertProfile(request: UpsertProfileRequest): Profiles {
        return withErrorWrapper(request) { req ->
            if (req.name.isNullOrBlank() || req.type.isNullOrBlank()) {
                throw InvalidParamException()
            }
            val originalProfile = ConfigManager.profiles.find { it.name == req.name }

            val connectorMeta = ConnectorManager.getAvailableConfigs().find{cfg -> cfg.type == req.type} ?: throw CustomizedException("invalid db type or invalid params")
            val configFields = connectorMeta.jdbcConfigs.associateBy { it.name }
            val optionalFields = connectorMeta.optionals.associateBy { it.name }

            val optionals =
                req.optionalsList.filter { optionalFields.contains(it.key) }
                    .associate { it.key to it.value }

            val configs =
                req.configsList.filter { configFields.contains(it.key) }.associate { it.key to it.value }

            val requiredKeys = configFields.filterValues{it.required}.map{it.key}
            // check if required fields appears non-blank
            if (!configs.filterValues { it.isNotBlank() }.keys.containsAll(requiredKeys)){
                throw InvalidParamException()
            }

            val newProfile = Profile(
                req.type,
                req.name,
                if(req.hasAuth()) {
                    ConnectionAuth(
                        req.auth.username,
                        handleSecretField(req.auth.password, originalProfile?.auth?.password).ifBlank { null }
                    )
                } else null,
                null,
                configs.entries.associate{(k, v) ->
                    k to handleSecretField(v, originalProfile?.configs?.get(k))
                }.filterValues{it.isNotBlank()},
                optionals.entries.associate { (k, v)->
                    k to handleSecretField(v, originalProfile?.optionals?.get(k))
                }

            )

            val newProfiles = ConfigManager.profiles.filter { it.name != req.name } + newProfile
            ConfigManager.saveProfiles(newProfiles)
            ConnectorManager.initializeProfile(newProfile)
            loadedProfiles
        }
    }

    override suspend fun deleteProfile(request: DeleteProfileRequest): Profiles {
        return withErrorWrapper(request) { req ->
            ConfigManager.saveProfiles(ConfigManager.profiles.filter { it.name != req.name })
            ConnectorManager.offloadProfile(req.name)
            loadedProfiles
        }
    }

    override suspend fun getProfiles(request: Empty): Profiles {
        return withErrorWrapper(request) { loadedProfiles }
    }

    override suspend fun getDatabases(request: GetDatabaseRequest): Databases {
        return withErrorWrapper(request) { req ->
            Databases {
                addAllDatabase(
                    ConnectorManager.getDBConnector(req.profile).getCachedDatabases()
                )
            }
        }
    }

    override suspend fun getCollections(request: GetCollectionRequest): Collections {
        return withErrorWrapper(request) { req ->
            Collections {
                addAllCollections(
                    ConnectorManager.getDBConnector(req.profile).getCachedCollections(req.database).map {
                        CollectionField {
                            collection = it.collection
                            it.schema?.let {
                                schema = it
                            }
                        }
                    }
                )
            }
        }
    }

    override suspend fun getCollectionSchema(request: GetCollectionSchemaRequest): Schema {
        return withErrorWrapper(request) { req ->
            Schema {
                addAllFields(
                    ConnectorManager.getDBConnector(req.profile)
                        .getCachedCollectionSchema(req.database, req.collection, req.schema).map {
                            SchemaField {
                                name = it.name
                                displayType = toDisplayType(it.type)
                                sqlType = SQLType.forNumber(it.type)
                            }
                        }
                )
            }
        }
    }

    @OptIn(ExperimentalCoroutinesApi::class)
    override suspend fun query(request: SubmitQueryRequest, responseChannel: SendChannel<QueryResult>) {
        val currentQueryChannel = Channel<Either<Exception, QueryResultWrapper>>()
        val queryContext = QueryContext(request.sql, request.questionId, request.maxRow)
        val connector = ConnectorManager.getDBConnector(request.profile)
        connector.queryWithLimit(queryContext, currentQueryChannel)
        currentQueryChannel.consumeEach { cursor ->
            when (cursor) {
                is Either.Left -> {
                    when (cursor.a) {
                        is TruncateException -> {
                            responseChannel.send(QueryResult {
                                truncated = true
                            })
                        }
                        else -> throw errorWrapper(cursor.a, "query")
                    }
                }
                is Either.Right -> {
                    when (val content = cursor.b) {
                        is Either.Left -> {
                            responseChannel.send(QueryResult {
                                fields {
                                    addAllFields(content.a.map {
                                        SchemaField {
                                            name = it.name
                                            displayType = toDisplayType(it.type)
                                            sqlType = SQLType.forNumber(it.type)
                                        }
                                    })
                                }
                            })
                        }
                        is Either.Right -> {
                            responseChannel.send(QueryResult {
                                row = ByteString.copyFrom(serializer.toJson(content.b), UTF_8)
                            })
                        }
                    }
                }
            }
        }
    }

    override suspend fun importFromFile(request: ImportRequest): ImportResult {
        return withErrorWrapper(request) { req ->
            val connector = ConnectorManager.getDBConnector(req.profile)

            connector.import(req.database,
                req.collection,
                req.schema.ifBlank { null },
                req.url)

            ImportResult {
                database = req.database
                collection = req.collection
                if (req.schema.isNotBlank()) schema = req.schema
            }
        }
    }
}
