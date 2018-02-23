import dl from 'download'
import fs from 'fs'
import mkdirp from 'mkdirp'
import path from 'path'
import rpc from 'one-doing-the-rest-waiting'
import sharp from 'sharp'

import config from 'infrastructure/config'
import s3 from 'infrastructure/s3'
import Media from 'entities/Media'

const { queuePrefix:prefix, redis } = config

Promise.all([
  new Promise(resolve => {
    rpc.createConsumer({ prefix, redis }).register(resolve)
  }),
  new Promise(resolve => {
    rpc.createProducer({ prefix, redis }).discover(resolve)
  })
]).then(([ input, output ]) => {
  input.onRequest((message, done) => {
    const media = Media.from(message.data.media)

    switch (message.type) {
      case 'process-media':
        console.log('process-media')

        console.log('download-original...')

        return output
          .request('download-original', {
            media: message.data.media
          })
          .waitFor(media.props.localOriginal)
          .onResponse(response => {
            console.log('download-original done')

            if (!response.data.succeed) {
              return done(response.data)
            }

            console.log('optimize-original...')

            output
              .request('optimize-original', {
                media: message.data.media,
                options: message.data.options
              })
              .waitFor(media.props.localTarget)
              .onResponse(response => {
                console.log('optimize-original done')

                done(response.data)
              })
              .send()

          })
          .send()

      case 'download-original':
        return s3
          .meta(media.props.remoteOriginal)
          .catch(() => null)
          .then(meta => {
            if (!meta) {
              console.log('downloading from src...')

              return new Promise((resolve, reject) => {
                const dir = path.dirname(media.props.localOriginal)

                mkdirp.sync(dir)

                dl(media.props.src)
                  .on('error', error => {
                    reject(error)
                  })
                  .pipe(fs.createWriteStream(media.props.localOriginal))
                  .on('finish', () => {
                    resolve()
                  })
              })
              .then(() => {
                console.log('download from src done, uploading to s3...')
                return s3.store(
                  media.props.localOriginal,
                  media.props.remoteOriginal
                )
              })
              .then(() => {
                console.log('upload to s3 done')
              })
            }

            console.log('downloading from s3...')

            return new Promise((resolve, reject) => {
              const dir = path.dirname(media.props.localOriginal)

              mkdirp.sync(dir)

              s3
                .receive(media.props.remoteOriginal)
                .pipe(fs.createWriteStream(media.props.localOriginal))
                .on('finish', () => {
                  resolve()
                })
            })
            .then(() => {
              console.log('download from s3 done')
            })
          })
          .then(() => done({
            succeed: true
          }))
          .catch(() => done({
            succeed: false,
            reason: 'download-original failed'
          }))

      case 'optimize-original':
        const options = message.data.options
        const dir = path.dirname(media.props.localTarget)

        mkdirp.sync(dir)

        return sharp(media.props.localOriginal)
          .resize(media.props.width)
          .jpeg({
            quality: options.quality,
            progressive: true
          })
          .png({
            progressive: true,
            force: false
          })
          .toFile(media.props.localTarget)
          .then(() => {
            return s3.store(
              media.props.localTarget,
              media.props.remoteTarget
            )
          })
          .then(() => done({
            succeed: true
          }))
          .catch(() => done({
            succeed: false,
            reason: 'optimize-original failed'
          }))
    }

    done({
      succeed: false
    })
  })
})
