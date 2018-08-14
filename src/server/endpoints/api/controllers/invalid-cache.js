import serializeError from 'serialize-error'

import config from 'infrastructure/config'
import cache from 'services/cache'
import project from 'services/project'

export default async (req, res) => {
  try {
    const { patterns, slug } = req.body

    if (!patterns.length) {
      return res.status(201).json({ succeed: true })
    }

    const { prettyOrigin } = await project.get(slug)

    // delete on s3
    const s3Prefix = `${ config.version }/${ slug }`

    const s3Keys = await cache.search(s3Prefix, patterns)

    await cache.delete(s3Keys)

    // delete on cloudfront
    const cloudfrontPatterns = patterns
      .map(
        (pattern) => ({
          pretty: prettyOrigin && pattern.indexOf(prettyOrigin) === 0 ?
            `/p/${ slug }${ pattern.replace(prettyOrigin, '') }` :
            null,
          universal: `/u/${ slug }?*url=${ encodeURIComponent(pattern) }*`
        })
      )
      .reduce(
        (cloudfrontPatterns, pattern) => [
          ...cloudfrontPatterns,
          pattern.pretty,
          pattern.universal
        ], []
      )
      .filter(Boolean)

    await cache.invalid(cloudfrontPatterns)

    return res.status(201).json({ succeed: true })
  } catch (e) {
    res.status(500).json(serializeError(e))
  }
}
