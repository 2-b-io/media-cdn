import Infrastructure from 'models/infrastructure'
import Preset from 'models/Preset'
import Project from 'models/Project'
import PullSetting from 'models/pull-setting'

export default {
  getPreset: async (contentType, project) => {
    return await Preset.findOne({
      contentType,
      project,
      isActive: true
    }).lean()
  },
  getProject: async (domain) => {
    const infrastructure = await Infrastructure.findOne({
      domain
    }).lean()

    return await Project.findOne({
      _id: infrastructure.project,
      isActive: true
    }).lean()
  },
  getPullSetting: async (project) => {
    return await PullSetting.findOne({
      project
    }).lean()
  }
}
