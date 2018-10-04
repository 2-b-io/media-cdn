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
  getProject: async (identifier) => {
    return await Project.findOne({
      identifier,
      isActive: true
    }).lean()
  },
  getPullSetting: async (project) => {
    return await PullSetting.findOne({
      project
    }).lean()
  }
}
