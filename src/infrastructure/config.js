import path from 'path'

const rootDir = path.resolve(__dirname, '..')

export default {
  __rootDir: rootDir,
  development: process.env.NODE_ENV === 'development',
  server: {
    bind: process.env.SERVER_BIND,
    port: process.env.SERVER_PORT
  },
  amq: {
    host: process.env.AMQ_HOST,
    prefix: process.env.AMQ_PREFIX
  },
  aws: {
    s3: {
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_S3_REGION,
      accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
      version: process.env.AWS_S3_VERSION
    }
  },
  apiUrl: process.env.API_URL,
  apiSecretKey: process.env.API_SECRET_KEY,
  scraperUrl: process.env.SCRAPER_URL,
  tmpDir: process.env.TMP_DIR || path.resolve(rootDir, '../tmp'),
  cacheDuration: process.env.CACHE_DURATION
}
