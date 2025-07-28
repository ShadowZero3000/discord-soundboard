// import Config from './Config.js'

import session from 'express-session'
import fileStore from 'session-file-store'
const FileStore = fileStore(session)
// import sessionStore from 'express-session-rsdb'

export default class SessionStore {
  constructor () {
    throw new Error('Use SessionStore.getInstance()')
  }

  static getInstance () {
    if (!SessionStore.instance) {
      SessionStore.instance = new FileStore(session)
    }
    return SessionStore.instance
  }
}
