import deserializeError from 'deserialize-error'

import cache from 'services/cache'

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
      .onReply((error, content) => {
        console.log(`OPTIMIZE_TARGET ${ req._params.origin } -> ${ req._params.target }... ${ Date.now() - s }ms`)

        if (error) {
          return next({
            statusCode: 500,
            reason: error
          })
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
  }
]
