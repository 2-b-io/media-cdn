import express from 'express'
import morgan from 'morgan'
import sh from 'shorthash'

import cache from 'services/cache'

const app = express()

app.use(morgan('dev'))
app.enable('trust proxy')
app.disable('x-powered-by')

export default app

app.get('/', [
  (req, res, next) => {
    console.log('assert parameters')

    const url = req.query.url ?
      req.query.url :
      'https://assets.stuffs.cool/2018/04/the.cool.stuffs_c37da7f1-afe6-4833-ae98-39bb66b5f2b8.jpg'

    req._params = {
      project: {
        slug: 'dev'
      },
      preset: {
        hash: 'default',
        values: {
          quality: 75
        }
      },
      args: {
        mode: req.query.m || 'cover',
        width: parseInt(req.query.w, 10) || undefined,
        height: parseInt(req.query.h, 10) || undefined
      },
      url: url,
      urlHash: sh.unique(url)
    }

    next()
  },
  (req, res, next) => {
    const {
      args: {
        mode = 'cover',
        width = 'auto',
        height = 'auto'
      },
      project: { slug },
      preset: { hash, values },
      urlHash
    } = req._params

    const valueHash = sh.unique(
      JSON.stringify(
        values,
        Object.keys(values).sort()
      )
    )

    req._params.origin = `${slug}/${hash}/${valueHash}/${urlHash}`

    req._params.target = `${slug}/${hash}/${valueHash}/${urlHash}_${mode}_${width}x${height}`

    next()
  },
  async (req, res, next) => {
    console.log('app.js: HEAD /the-resource')

    if (req.query.f) {
      return next()
    }

    req._meta = await cache.head(req._params.target)

    next()
  },
  (req, res, next) => {
    if (req._meta) {
      return next()
    }

    console.log('JOB /process')

    const producer = app.get('rpc')

    producer.request()
      .content({
        job: 'process',
        payload: {
          url: req._params.url,
          origin: req._params.origin,
          target: req._params.target,
          args: {
            ...req._params.preset.values,
            ...req._params.args
          }
        }
      })
      .waitFor(`process:${req._params.target}`)
      .sendTo('worker')
      .ttl(60e3)
      .onReply(async (error) => {
        if (error) {
          return res.status(500).send(error)
        }

        next()
      })
      .send()
  },
  async (req, res, next) => {
    if (req._meta) {
      return next()
    }

    console.log('app.js: HEAD /the-resource')

    req._meta = await cache.head(req._params.target)

    next()
  },
  (req, res, next) => {
    if (!req._meta) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      res.set('Pragma', 'no-cache')
      res.set('Expires', '0')
      res.set('Surrogate-Control', 'no-store')
      return res.status(500).json(req._params)
    }

    console.log('PIPE /the-resource')

    res.set('accept-ranges', req._meta.AcceptRanges)
    res.set('content-type', req._meta.ContentType)
    res.set('content-length', req._meta.ContentLength)
    res.set('last-Modified', req._meta.LastModified)
    res.set('etag', req._meta.ETag)
    res.set('cache-control', req._meta.CacheControl)
    cache.stream(req._params.target).pipe(res)
  }
])
