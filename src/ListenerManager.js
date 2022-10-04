import * as Listener from './Listener.js'
import { errorLog } from './logger.js'
const log = errorLog;
import Store from 'data-store'

export default class ListenerManager {
  constructor() {
    this.users = {}
    this.ListenerStore = new Store({ name: 'listeners', path: 'config/listeners.json', defaults: {} });

    const storeListeners = this.ListenerStore.get('users') || {};

    Object.keys(storeListeners).forEach(idx => {
      const user = storeListeners[idx]
      this.createProfile(user['userId'], user['listening'])
    });
  }

  amIListeningTo(userId) {
    if (!(userId in this.users)) {
      return false
    }
    return this.users[userId].listening
  }

  createProfile(userId, listening) {
    this.users[userId] = {listening: listening, listener: new Listener(userId)}
  }

  finish(userId, callback) {
    this.getListener(userId).finish(callback)
  }

  getListener(userId) {
    return this.users[userId].listener;
  }

  ignore(userId) {
    if (!(userId in this.users)) {
      this.createProfile(userId, false)
    }
    this.users[userId].listening = false
    this.ListenerStore.set('users', Object.keys(this.users).map(userid => {
      return {userId: userid, listening: this.users[userid].listening}
    }))
  }

  listenTo(userId) {
    if (!(userId in this.users)) {
      this.createProfile(userId, true)
    }

    this.users[userId].listening = true
    this.ListenerStore.set('users', Object.keys(this.users).map(userid => {
      return {userId: userid, listening: this.users[userid].listening}
    }))
  }

  listen(userId, connection) {
    this.getListener(userId).listen(connection)
  }

}
