import invalidCache from 'services/invalidCache'

export default async (req, res) => {
  const result = await invalidCache(req.body.patterns)
  if ( result.Invalidation) {
    res.status(201).json({
      succeed: true
    })
  }else {
    res.status(400).json({
      succeed: false
    })
  }

}
