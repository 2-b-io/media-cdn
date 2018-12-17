import pullSettingService from 'services/pull-setting'

export default async function getPullSetting(req, res, next) {
  const { project } = req._params

  const pullSetting = req._params.pullSetting = await pullSettingService.get(project.identifier)

  if (!pullSetting) {
    return next({
      statusCode: 400,
      reason: 'Pull setting not found'
    })
  }

  next()
}
