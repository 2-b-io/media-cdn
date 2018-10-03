import deserializeError from 'deserialize-error'

const crawl = async (payload, producer) => {

  return await new Promise((resolve, reject) => {
    const s = Date.now()
    console.log(`CRAWL ${ payload.url } -> ${ payload.origin }...`)

    producer.request()
      .content({
        job: 'crawl',
        payload: {
          url: payload.url,
          origin: payload.origin,
          headers: payload.headers || []
        }
      })
      .waitFor(`crawl:${ payload.origin }`)
      .sendTo('worker')
      .ttl(30e3)
      .onReply(async (error, content) => {
        console.log(`CRAWL ${ payload.url } -> ${ payload.origin }... ${ Date.now() - s }ms`)

        if (error) {
          reject(deserializeError(error))
        } else {
          resolve(content)
        }
      })
      .send()
  })
}

const head = async (payload, producer, meta) => {
  console.log('bbb', payload);
  return await new Promise((resolve, reject) => {
    const s = Date.now()
    console.log(`HEAD ${ payload.target }...`)

    producer.request()
      .content({
        job: 'head',
        payload: {
          target: payload.target,
          meta,
        }
      })
      .waitFor(`head:${ payload.target }`)
      .sendTo('worker')
      .ttl(30e3)
      .onReply(async (error, content) => {
        console.log(`HEAD ${ payload.target }... ${ Date.now() -s }ms`)

        if (error) {
          reject(deserializeError(error))
        } else {
          resolve(content)
        }
      })
      .send()
  })
}

const optimize = async (payload, producer, meta) => {
  return await new Promise((resolve, reject) => {
    const s = Date.now()
    console.log(`OPTIMIZE ${ payload.origin } -> ${ payload.target }...`)

    producer.request()
      .content({
        job: 'optimize',
        payload: {
          origin: payload.origin,
          target: payload.target,
          args: payload.args,
          meta,
        }
      })
      .waitFor(`optimize:${ payload.target }`)
      .sendTo('worker')
      .ttl(30e3)
      .onReply(async (error, content) => {
        console.log(`OPTIMIZE ${ payload.origin } -> ${ payload.target }... ${ Date.now() - s }ms`)

        if (error) {
          reject(deserializeError(error))
        } else {
          resolve(content)
        }
      })
      .send()
  })
}

export default async (payload, producer) => {
  const origin = payload.url ?
    await crawl(payload, producer) :
    payload.origin

  const target = await optimize(payload, producer)

  const meta = await head(payload, producer, target.meta)

  return { origin, target, meta }
}
