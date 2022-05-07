package io.tellery.integrations

import io.tellery.connectors.fields.MySQLFields
import io.tellery.entities.ProfileEntity

@DbtIntegrationType("MySQL")
class MySQLDbtIntegration : DbtIntegration() {

    override fun transformToDbtProfile(profileEntity: ProfileEntity): MySQLDbtProfile {
        return MySQLDbtProfile(
            host = getValueOrThrowException(profileEntity, MySQLFields.ENDPOINT),
            port = getValueOrThrowException(profileEntity, MySQLFields.PORT).toInt(),
            user = getValueOrThrowException(profileEntity, MySQLFields.USERNAME),
            password = getValueOrThrowException(profileEntity, MySQLFields.PASSWORD),
            dbname = getValueOrThrowException(profileEntity, MySQLFields.DATABASE),
            schema = getValueOrThrowException(profileEntity, MySQLFields.SCHEMA)
        )
    }

    class MySQLDbtProfile(
        val host: String,
        val port: Int,
        val user: String,
        val password: String,
        val dbname: String,
        val schema: String
    ) : BaseDbtProfile("mysql")
}