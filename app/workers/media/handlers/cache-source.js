import path from 'path'

import config from 'infrastructure/config'
import s3 from 'infrastructure/s3'
import Media from 'entities/Media'

const putToCache = async (remote, local) => {
  return await s3.store(
    path.join(config.tmpDir, local),
    `media/${remote}`
  )
}

export default async (data, rpc) => {
  const media = Media.from(data.media)
  const { source } = media.state

  await putToCache(source, source)

  return {
    succeed: true,
    media
  }
}
