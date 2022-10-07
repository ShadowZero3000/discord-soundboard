import Config from './Config.js'
import {errorLog} from './logger.js'
const log = errorLog

import AccessManager from './AccessManager.js'
const am = AccessManager.getInstance()

// import ListenerManager from './ListenerManager.js'
// const lm = new ListenerManager()

import Store from 'data-store'

export default class AdminUtils {
  constructor() {
    throw new Error('Use AdminUtils.getInstance()');
  }
  static getInstance() {
    if (!AdminUtils.instance) {
      AdminUtils.instance = new PrivateAdminUtils();
    }
    return AdminUtils.instance;
  }
}

class PrivateAdminUtils {
  constructor() {
    this.accessMap = {
      'servermanager': [
        'access',
        'accessrole',
        'forgetphrase',
        'grant',
        'grantrole',
        'hotphrase',
        'listphrases',
        'revoke',
        'revokerole',
        'togglestartup',
        'whereareyou',
        'administer'
      ],
      'clipmanager': [
        'add',
        'categorize',
        'remove',
        'rename'
      ],
      'requestor': [
        'request',
        'reqlist'
      ],
      'vocalist': [
        'listen',
        'ignoreme'
      ],
      'silencer': [
        'silence',
        'unmute'
      ],
      'play': [ 'play' ]
    }
    this.reverseAccessMap = {};
    Object.keys(this.accessMap).forEach(group => {
      this.accessMap[group].forEach(entry => {
        this.reverseAccessMap[entry] = group
      });
    });
    this.immuneUser = '0'
    this.hotPhrases = []

    this.HotPhraseStore = new Store({ name: 'hotphrases', path: 'config/hotphrases.json', defaults: {} });

    const store = this.HotPhraseStore.get('hotphrases') || [];
    // Deserialize the store into actual objects
     store.forEach(phrase => {
      this.hotPhrases.push(phrase)
    });
  }

  // Reserved functions
  check_interaction(interaction, access) {
    return (am.checkAccess(interaction.user, interaction.guild, this.reverseAccessMap[access]));
  }

  getHotPhrases() {
    return this.hotPhrases
  }

  saveConfig(key, value) {
    log.debug(`Saving config key: ${key}, value: ${value}`);
    Config.set(key, value);
    const configFile = Config.stores.file.file;
    Config.save(err => {});
  }

  setImmuneUser(userId) {
    this.immuneUser = userId;
    Object.keys(this.accessMap).forEach(access => {
      am.grantUserAccessById(userId, access);
    });
  }
}
