import express from 'express'

import handleRequest from 'server/middlewares/handle-request'
import parseArgsFromQuery from 'server/middlewares/args-q'
import getPreset from 'server/middlewares/preset'
import getProject from 'server/middlewares/project'
import parseUrlFromPath from 'server/middlewares/url-p'
import join from 'server/middlewares/utils/join'

const router = express()

router.get('/:identifier/*', join(
  (req, res, next) => {
    if (!req.params[0]) {
      return next({
        statusCode: 400,
        reason: 'URL is missing'
      })
    }

    next()
  },
  (req, res, next) => {
    req._params = {
      hash: req.query.p || 'default',
      identifier: req.params.identifier
    }

    next()
  },
  getProject,
  getPreset,
  parseUrlFromPath,
  parseArgsFromQuery,
  handleRequest
))

export default router
