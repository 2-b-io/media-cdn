import deserializeError from 'deserialize-error'

const crawl = async (payload, producer) => {
  return await new Promise((resolve, reject) => {
    const s = Date.now()
    console.log(`CRAWL ${payload.url} -> ${payload.origin}...`)

    producer.request()
      .content({
        job: 'crawl',
        payload: {
          url: payload.url,
          origin: payload.origin
        }
      })
      .waitFor(`crawl:${payload.origin}`)
      .sendTo('worker')
      .ttl(30e3)
      .onReply(async (error, content) => {
        console.log(`CRAWL ${payload.url} -> ${payload.origin}... ${Date.now() - s}`)

        if (error) {
          reject(deserializeError(error))
        } else {
          resolve(content)
        }
      })
      .send()
  })
}

const optimize = async (payload, producer) => {
  return await new Promise((resolve, reject) => {
    const s = Date.now()
    console.log(`OPTIMIZE ${payload.origin} -> ${payload.target}...`)

    producer.request()
      .content({
        job: 'optimize',
        payload: {
          origin: payload.origin,
          target: payload.target,
          args: payload.args
        }
      })
      .waitFor(`optimize:${payload.origin}`)
      .sendTo('worker')
      .ttl(30e3)
      .onReply(async (error, content) => {
        console.log(`OPTIMIZE ${payload.origin} -> ${payload.target}... ${Date.now() - s}`)

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
  const origin = await crawl(payload, producer)

  const target = await optimize(payload, producer)

  return { origin, target }
}
