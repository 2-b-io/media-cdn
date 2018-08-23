import { execFile } from 'child_process'
import fs from 'fs-extra'
import gifsicle from 'gifsicle'
import path from 'path'
import pify from 'pify'
import uuid from 'uuid'
import localpath from 'services/localpath'

const optimizeGif = async (input, output, args) => {

  const dir = path.join(path.dirname(output), 'gif')
  const { height, width, optimize = '-O2', mode } = args
  await fs.ensureDir(dir)

  const outputGif = path.join(dir, uuid.v4())

  let params = [
    '-i', input,
    '-o', outputGif,
    optimize,
  ]
  if (mode) {
    switch (mode) {
      case 'contain':
        params = params.concat([
          '--resize-height', `${ height }`,
          '--resize-width', `${ width }`
        ])
        break
    }
  }
  const optimizedGif = await pify(execFile)(gifsicle, params)
    .then( err => {
      if (err) {
        return err
      }
      return outputGif
    })
  await fs.remove(output)
  await fs.move(optimizedGif, output)
}

export default async (file, args) => {
  const output = await localpath(file.ext)

  const {
    width = 'auto',
    height = 'auto',
    optimize
  } = args

  const resize = !(width === 'auto' && height === 'auto')

  if (!resize) {
    await optimizeGif(file.path, output, {
      optimize
    })

    return {
      contentType: file.contentType,
      ext: file.ext,
      path: output
    }
  }

  await optimizeGif(file.path, output, args)

  return {
    contentType: file.contentType,
    ext: file.ext,
    path: output
  }
}
