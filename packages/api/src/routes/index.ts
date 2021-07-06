import Router from 'koa-router'

import activities from './activity'
import connectors from './connector'
import global from './global'
import operations from './operation'
import questions from './question'
import stories from './story'
import thought from './thought'
import upload from './upload'
import users from './user'
import workspaces from './workspace'

const router = new Router({
  prefix: '/api',
})

router.use('/connectors', connectors.routes(), connectors.allowedMethods())
router.use('/operations', operations.routes(), operations.allowedMethods())
router.use('/stories', stories.routes(), stories.allowedMethods())
router.use('/questions', questions.routes(), questions.allowedMethods())
router.use('/users', users.routes(), users.allowedMethods())
router.use('/workspaces', workspaces.routes(), workspaces.allowedMethods())
router.use('/activities', activities.routes(), activities.allowedMethods())
router.use('/upload', upload.routes(), upload.allowedMethods())
router.use('/thought', thought.routes(), thought.allowedMethods())
router.use('', global.routes(), global.allowedMethods())

export default router