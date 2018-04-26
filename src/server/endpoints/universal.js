import express from 'express'

import handleRequest from 'server/middlewares/handle-request'
import parseArgsFromQuery from 'server/middlewares/args-q'
import getPreset from 'server/middlewares/preset'
import getProject from 'server/middlewares/project'
import parseUrlFromQuery from 'server/middlewares/url-q'
import join from 'server/middlewares/utils/join'

const router = express()

router.get([ '/:slug', '/:slug/media' ], join(
  async (req, res, next) => {
    req._params = {
      hash: req.query.p || 'default',
      slug: req.params.slug
    }

    next()
  },
  getProject,
  parseUrlFromQuery,
  getPreset,
  parseArgsFromQuery,
  handleRequest
))

export default router
