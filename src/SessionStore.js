import Config from './Config.js'

import session from 'express-session'
import sessionStore from 'express-session-rsdb'

export default class SessionStore {
  constructor() {
    throw new Error('Use SessionStore.getInstance()');
  }
  static getInstance() {
    if (!SessionStore.instance) {
      SessionStore.instance = new sessionStore({
        data_storage_area: "./rsdb"
      })
    }
    return SessionStore.instance;
  }
}
