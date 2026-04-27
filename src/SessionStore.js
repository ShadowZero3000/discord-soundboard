// import Config from './Config.js'

import session from 'express-session'
import fileStore from 'session-file-store'
const FileStore = fileStore(session)
// import sessionStore from 'express-session-rsdb'

import * as path from 'path'
import * as url from 'url'
const __filename = url.fileURLToPath(import.meta.url)
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

export default class SessionStore {
  constructor () {
    throw new Error('Use SessionStore.getInstance()')
  }

  static getInstance () {
    if (!SessionStore.instance) {
      SessionStore.instance = new FileStore({
        path: path.join(__dirname, 'sessions')
      })
    }
    return SessionStore.instance
  }
}
