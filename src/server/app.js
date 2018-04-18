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
      decodeURIComponent(req.query.url) :
      'https://assets.stuffs.cool/2018/04/the.cool.stuffs_c37da7f1-afe6-4833-ae98-39bb66b5f2b8.jpg'

    req._params = {
      project: {
        slug: 'ntq'
      },
      preset: {
        hash: 'default',
        valueHash: sh.unique('default')
      },
      args: {
        mode: 'crop',
        width: 100,
        height: 100
      },
      url: url,
      urlHash: sh.unique(url)
    }

    next()
  },
  (req, res, next) => {
    const {
      project: { slug },
      preset: { hash, valueHash },
      args: { mode, width, height },
      urlHash
    } = req._params

    req._params.origin = `${slug}/${hash}/${valueHash}/${urlHash}`

    req._params.target = `${slug}/${hash}/${valueHash}/${urlHash}_${mode}_${width}x${height}`

    next()
  },
  async (req, res, next) => {
    console.log('app.js: HEAD /the-resource')

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
          target: req._params.target
        }
      })
      .sendTo('worker')
      .ttl(10e3)
      .onReply(async (error, content) => {
        console.log(error, content)

        next()
      })
      .send()
  },
  (req, res, next) => {
    console.log('GET /the-resource')

    // res.send('ok')
    res.json(req._params)
  }
])
