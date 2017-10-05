const bluebird = require('bluebird');
const download = require('download');
const gm = require('gm');
const kue = require('kue');
const Redis = require('ioredis');

const storage = require('../services/storage');
const Media = require('../entities/Media');

const queue = kue.createQueue();
const redis = new Redis();

kue.app.listen(3001);

function init(done) {
  // listen RPC
  queue.process('rpc', (job, done) => {
    registerTask(job, () => done());
  });

  // register other processes here
  done();
}

function reply(cid, response) {
  return new bluebird((resolve, reject) => {
    queue
      .create('rpc:reply', {
        cid,
        response
      })
      .ttl(1000)
      .events(false)
      .removeOnComplete(true)
      .save(() => resolve());
  });
}

function replyAll(hash, response) {
  return redis
    .lrange(`w:${hash}`, 0, -1)
    .then(jobs => bluebird.all(
      jobs.map(id => reply(id, response))
    ))
    .then(() => redis.del(`w:${hash}`));
}

function beginProcess(hash, media) {
  storage
    .meta(media, true)
    .then(media => {
      let exists = !!media.meta;

      if (!exists) {
        return media
          .fetch(true)
          .then(media => storage.set(media, true));
      }

      return storage
        .get(media, true)
        .then(media => media.save());
    })
    .then(media => {
      // optimize
      return new bluebird((resolve, reject) => {
        let outPath = media.createLocalPath();

        gm(media.local)
          .resize(media.width)
          .strip()
          .interlace('Line')
          .write(outPath, err => {
            media.local = outPath;

            resolve(media);
          });
      })
      .then(media => storage.set(media));
    })
    .then(() => {
      replyAll(hash, {
        succeed: true,
        media: media.toJSON()
      });
    })
    .catch(err => {
      replyAll(hash, {
        succeed: false,
        media: media.toJSON()
      });
    })
    .finally(() => media.dispose());
}

function registerTask(job, done) {
  console.log('registerTask...', job.id);

  const media = Media.create(job.data.media);
  const hash = media.hash;

  redis
    .llen(`w:${hash}`)
    .then(length => {
      return redis
        .lpush(`w:${hash}`, job.id)
        .then(result => length === 0)
        .finally(() => done());;
    })
    .then(isFirst => {
      if (!isFirst) {
        return;
      }

      beginProcess(hash, media);
    });

}

init(() => console.log('Worker [media] started...'));
