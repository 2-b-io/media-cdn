import amqp from 'amqplib'
import debug from 'debug'
import delay from 'delay'
import uuid from 'uuid'

class Connection {
  constructor(props) {
    this.props = {
      host: 'amqp://localhost',
      retryInterval: 1e3,
      ...props
    }

    this._id = uuid.v4()
    this._retryCount = 0
    this._ready = 0
    this._channel = null
    this._exchange = 'mb.bus',
    this._queue = `mb.${this.props.name}`
    this._log = debug('message-bus')
  }

  log(...msg) {
    return this._log(`[${this.props.name}]`, ...msg)
  }

  parseContent(msg) {
    return JSON.parse(msg.content.toString())
  }

  _setChannel(channel) {
    this._retryCount = 0
    this._ready = true
    this._channel = channel
  }

  _clearChannel() {
    this._retryCount = this._retryCount + 1
    this._ready = false
    this._channel = null
  }

  async send(msg) {
    console.log(msg)
  }

  async connect() {
    this.log(`Connecting... retries: ${this._retryCount}`)

    try {
      const conn = await amqp.connect(this.props.host)

      // disconnect - reconnect
      conn.once('close', async () => {
        this.log('Connection closed! Reconnecting...')

        await this._retry()
      })

      const channel = await conn.createChannel()
      // await channel.prefetch(1)

      this._setChannel(channel)
      this.log('Connected!')

      await this._init()

      return this
    } catch (e) {
      return await this._retry()
    }
  }

  async _retry() {
    this._clearChannel()

    await delay(this.props.retryInterval)

    return await this.connect()
  }

  async _init() {
    const channel = this._channel
    const { name } = this.props

    await channel.assertExchange(
      this._exchange,
      'direct',
      {
        durable: true,
        // autoDelete: true
      }
    )

    await channel.assertQueue(
      this._queue,
      {
        // exclusive: true,
        durable: true,
        // autoDelete: true
      }
    )

    await channel.bindQueue(this._queue, this._exchange, this.props.type)

    await channel.consume(this._queue, async (msg) => {
      this.log(`Message received: [${msg.properties.appId}] -> [${this.props.name}]`)
      const content = JSON.parse(msg.content.toString())

      if (content.from !== this._id) {
        if (typeof this.handleMessage === 'function') {
          await this.handleMessage(msg)
        }
      }

      await channel.ack(msg)

      this.log(`Message acknowledged`)
    }, {
      noAck: false
    })
  }
}

export default Connection
