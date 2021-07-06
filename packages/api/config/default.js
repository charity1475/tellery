module.exports = {
  postgres: {
    host: process.env.PG_HOST || '127.0.0.1',
    port: process.env.PG_PORT || 5432,
    username: process.env.PG_USERNAME || 'postgres',
    password: process.env.PG_PASSWORD || 'root',
    database: process.env.PG_DATABASE || 'tellery',
    searchLanguage: process.env.PG_SEARCH_LANGUAGE || 'en',
    searchPlugin: process.env.PG_SEARCH_PLUGIN,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  socket: {
    url: process.env.SOCKET_URL,
  },
  objectStorage: {
    type: process.env.OBJECT_STORAGE_TYPE || 's3',
    endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
    bucket: process.env.OBJECT_STORAGE_BUCKET,
    accessKey: process.env.OBJECT_STORAGE_ACCESS_KEY_ID,
    secretKey: process.env.OBJECT_STORAGE_ACCESS_KEY_SECRET,
    region: process.env.OBJECT_STORAGE_REGION,
  },
  email: {
    backend: 'smtp',
    tls: process.env.EMAIL_USE_TLS || false,
    username: process.env.EMAIL_USERNAME,
    password: process.env.EMAIL_PASSWORD,
    port: process.env.EMAIL_PORT || 587,
    host: process.env.EMAIL_HOST,
    from: process.env.EMAIL_FROM,
  },
  secretKey: process.env.SECRET_KEY || 'SABD7KacL28vxZd6BgOSGStJGbh',
  server: {
    protocol: process.env.SERVER_PROTO || 'https',
    host: process.env.SERVER_HOST,
    web_port: process.env.SERVER_WEB_PORT || 80,
    port: process.env.SERVER_PORT || 8000,
  },
}