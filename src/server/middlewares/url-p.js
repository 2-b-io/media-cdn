import querystring from 'querystring'
import sh from 'shorthash'
import { URL } from 'url'

export default function parseUrlFromPath(req, res, next) {
  const {
    project: {
      domain,
      protocol
    }
  } = req._params
  const pullUrl = protocol + '://' + domain

  const url = new URL(
    req.params[0] + (
      Object.keys(req.query).length ?
        '?' + querystring.stringify(req.query) : ''
    ),
    pullUrl
  ).toString()
  req._params = {
    ...req._params,
    url,
    hashedURL: sh.unique(url)
  }

  next()
}
