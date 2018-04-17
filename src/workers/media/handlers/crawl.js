import dl from 'download'
import fs from 'fs'
import mkdirp from 'mkdirp'
import path from 'path'

import config from 'infrastructure/config'
import s3 from 'infrastructure/s3'
import Media from 'entities/Media'

const getMeta = async (media) => {
  try {
    return await s3.meta(`media/${media.state.source}`)
  } catch (error) {
    return null
  }
}

const crawl = async (media) => {
  return new Promise((resolve, reject) => {
    const { source, url } = media.state
    const output = path.join(config.tmpDir, source)
    const outputDir = path.dirname(output)

    mkdirp.sync(outputDir)

    dl(url)
      .on('error', reject)
      .pipe(fs.createWriteStream(output))
      .on('finish', () => resolve())
  })
}

const getFromCache = async (file) => {
  const output = path.join(config.tmpDir, file)
  const outputDir = path.dirname(output)

  mkdirp.sync(outputDir)

  return new Promise((resolve, reject) => {
    s3
      .receive(`media/${file}`)
      .on('error', reject)
      .pipe(fs.createWriteStream(output))
      .on('finish', () => resolve())
  })
}

const putToCache = async (file) => {
  const local = path.join(config.tmpDir, file)
  const remote = `media/${file}`

  await s3.store(local, remote)
}

const download = async (media) => {
  const meta = await getMeta(media)

  if (!meta) {
    console.log('cache miss')

    if (media.state.crawlable) {
      await crawl(media)
    } else {
      throw new Error('Media is not crawlable')
    }
  } else {
    console.log('cache hit')

    await getFromCache(media.state.source)
  }

  media.addTemporaryFile(media.state.source)

  return media
}

export default async (data, rpc) => {
  let media = Media.from(data.media)

  media = await download(media)

  return {
    succeed: true,
    media
  }
}

