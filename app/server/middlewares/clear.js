export default (req, res, next) => {
  req.app.get('rpc')
    .request('flow', {
      media: req._media,
      flow: [ 'clear' ]
    })
    .onResponse(() => next())
    .send()
}
