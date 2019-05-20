import { execFile } from 'child_process'
import fs from 'fs-extra'
import gm from 'gm'
import path from 'path'
import pify from 'pify'
import pngquant from 'pngquant-bin'
import promise from 'bluebird'
import sharp from 'sharp'
import uuid from 'uuid'

import localpath from 'services/localpath'

const formatRatio = async (file, originRatio, ratio, width, height, output) => {
  if (originRatio < ratio) {
    return await gm(file.path).resize(width, null).writeAsync(output)
  }

  return await gm(file.path).resize(null, height).writeAsync(output)
}

const processPngByGM = async (file, resize, width = null, height = null, mode, output) => {
  promise.promisifyAll(gm.prototype)

  const { size: { width: originWidth, height: originHeight } } = await gm(file.path).identifyAsync()

  const originRatio = originWidth / originHeight
  const ratio = width / height

  if (resize) {
    if (mode === 'cover') {
      // to do optimize png
      await formatRatio(file, originRatio, ratio, width, height, output)

      return
    }

    if (mode === 'contain') {
      // to do optimize png
      await gm(file.path).resize(width, height).writeAsync(output)

      return
    }

    if (mode === 'crop') {
      const dir = path.join(path.dirname(output), 'png')
      await fs.ensureDir(dir)
      const tmpFile = path.join(dir, uuid.v4())

      await formatRatio(file, originRatio, ratio, width, height, tmpFile)
      // to do optimize png
      await gm(tmpFile).gravity('Center').crop(width, height).writeAsync(output)

      await fs.remove(tmpFile)

      return
    }
  }

  // to do process quality png
  await gm(file.path).writeAsync(output)
}

const optimizePNG = async (input, output, args) => {
  const dir = path.join(path.dirname(output), 'png')
  await fs.ensureDir(dir)
  const outputPng = path.join(dir, uuid.v4())
  try {
    await pify(execFile)(pngquant, [
      ...args,
      '-o', outputPng,
      input
    ])
  } catch (error) {
    console.error('OPTIMIZE_TARGET', error)

    if (error.code === 99) {
      await fs.move(input, output)

      return
    }

    throw error
  }

  await fs.remove(output)
  await fs.move(outputPng, output)
}

export default async (file, args, parameters = {}, optimizeByGm) => {
  const output = await localpath(file.ext)

  // arguments for resizing
  const {
    mode = 'cover',
    width = 'auto',
    height = 'auto'
  } = args

  // parameters for optimizing
  const minQuality = parseInt(parameters.minQuality, 10)
  const maxQuality = parseInt(parameters.maxQuality, 10)
  const speed = parseInt(parameters.speed, 10)

  const resize = !(width === 'auto' && height === 'auto')

  if (optimizeByGm) {
    await processPngByGM(file, resize, width, height, mode, output)

    return {
      contentType: file.contentType,
      ext: file.ext,
      path: output
    }
  }

  if (resize) {
    const image = sharp(file.path)

    image.resize({
      width: width === 'auto' ? null : width,
      height: height === 'auto' ? null : height,
      fit: mode === 'crop' ?
        sharp.fit.cover : (
          mode === 'cover' ?
            sharp.fit.outside :
            sharp.fit.inside
        )
    })

    image.png()

    await image.toFile(output)
  }

  await optimizePNG(resize ? output : file.path, output, [
    '--quality', `${ minQuality }-${ maxQuality }`,
    '--speed', speed
  ])

  return {
    contentType: file.contentType,
    ext: file.ext,
    path: output
  }
}
