import cache from 'services/cache'
import config from 'infrastructure/config'

export default [
  async function checkExistTarget(req, res, next) {
    if (req.query.f) {
      return next()
    }

    console.log(`HEAD_TARGET ${ req._params.target }`)

    try {
      req._targetMeta = await cache.head(req._params.target)

      const { Expires: expires } = req._targetMeta

      if (!expires || Date.now() > expires) {
        console.log(`TARGET_EXPIRED ${ req._params.target }`)

        req._targetExpired = true
      }
    } catch (error) {
      console.log(`NOTFOUND_TARGET ${ req._params.target }`)
    }

    next()
  },
  async function optimizeTarget(req, res, next) {
    if (!req._targetExpired && req._targetMeta) {
      return next()
    }

    const s = Date.now()

    console.log(`OPTIMIZE_TARGET ${ req._params.origin } -> ${ req._params.target }...`)

    req.app.get('rpc').request()
      .content({
        job: 'optimize',
        payload: {
          origin: req._params.origin,
          target: req._params.target,
          args: req._params.args,
          parameters: req._params.preset.parameters,
          expires: req._originMeta.Expires.valueOf()
        }
      })
      .waitFor(`optimize:${ req._params.target }`)
      .sendTo('worker')
      .ttl(60e3)
      .onReply((error) => {
        console.log(`OPTIMIZE_TARGET ${ req._params.origin } -> ${ req._params.target }... ${ Date.now() - s }ms`)

        if (error) {
          const originUrl = req._originMeta.Metadata[ 'origin-url' ]
          res.set('cache-control', `max-age=${ req._params.cacheSetting.ttl }`)
          res.redirect(originUrl)

          return
        }

        next()
      })
      .send()
  },
  function getTargetMeta(req, res, next) {
    if (!req._targetExpired && req._targetMeta) {
      return next()
    }

    console.log(`HEAD_TARGET ${ req._params.target }`)

    req.app.get('rpc').request()
      .content({
        job: 'head',
        payload: {
          target: req._params.target,
        }
      })
      .waitFor(`head:${ req._params.target }`)
      .sendTo('worker')
      .ttl(60e3)
      .onReply((error, content) => {
        if (error) {
          return next({
            statusCode: 500,
            reason: error
          })
        }

        req._targetMeta = content

        next()
      })
      .send()
  },
  async function checkSizeTarget(req, res, next) {
    const { ContentLength: sizeOrigin } = req._originMeta
    const { ContentLength: sizeTarget } = req._targetMeta

    if (sizeTarget > sizeOrigin) {
      const originUrl = req._originMeta.Metadata[ 'origin-url' ]
      res.set('cache-control', `max-age=${ req._params.cacheSetting.ttl }`)
      res.redirect(originUrl)
      // Remove file optimize because file optimize larger than the original image size
      const targetOrigin = `${ config.version }/${ req._params.target }`
      await cache.delete([ { key: targetOrigin} ])

      return
    }

    next()
  },
]
