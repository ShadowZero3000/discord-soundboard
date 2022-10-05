import * as fs from 'fs'
import nconf from 'nconf'

import {errorLog} from './logger.js'
const log = errorLog

import AccessManager from './AccessManager.js'
const am = AccessManager.getInstance()

import FileManager from './FileManager.js'
const fm = FileManager.getInstance()

// import ListenerManager from './ListenerManager.js'
// const lm = new ListenerManager()

import VoiceQueueManager from './VoiceQueueManager.js'
const vqm = VoiceQueueManager.getInstance()

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
  check(message, access) {
    return (am.checkAccess(message.author, message.guild, this.reverseAccessMap[access]));
  }

  check_interaction(interaction, access) {
    return (am.checkAccess(interaction.user, interaction.guild, this.reverseAccessMap[access]));
  }

  getUserActions(message) {
    var userAccess=am.getUserById(message.author.id).permissions
              .filter(permission => permission in this.accessMap)
              .map(permission => this.accessMap[permission]);
    userAccess = userAccess.reduce((acc, val) => acc.concat(val), []).sort();
    return userAccess;
  }

  // Private functions
  _getDiscordUser(message, username) {
    return message.channel.guild.members.cache.find(a => {
      return a.user['username'].toLowerCase() == username.toLowerCase();
    });
  }

  _getHotPhrases() {
    return this.hotPhrases
  }

  _paramCheck(message, params, minParams = 1) {
    if (!(params.length > (minParams - 1))) {
      message.reply(`That operation needs more parameters.`)
      return false;
    }
    return true;
  }

  _printUserAccess(message, user, access) {
    if (access.length == 0) {
      return message.reply(`${user} does not have any directly assigned permissions`);
    }
    return message.reply(`${user} has: ${access.sort().join(', ')}`, {split: true});
  }

  _saveConfig(key, value) {
    log.debug(`Saving config key: ${key}, value: ${value}`);
    nconf.set(key, value);
    const configFile = nconf.stores.file.file;
    nconf.save(err => {});
  }

  _setImmuneUser(userId) {
    this.immuneUser = userId;
    Object.keys(this.accessMap).forEach(access => {
      am.grantUserAccessById(userId, access);
    });
  }

  forgetphrase(message, params) {
    if (params[0] == 'help') {
      return message.reply('forgetphrase `<phrase id>`: \n' +
        'Forgets a hotphrase.\n'+
        'You\'ll need to use `listphrases` to get their ids.');
    }
    if (!this._paramCheck(message, params, 1)){ return; }
    this.hotPhrases = this.hotPhrases.filter(phrase => phrase.phraseId != params[0])
    this.HotPhraseStore.set('hotphrases', this.hotPhrases)
    return message.reply(`Removed.`);
  }

  hotphrase(message, params) {
    if (params[0] == 'help') {
      return message.reply('hotphrase `[random]` `<clip>` `<string_to_recognize>`: \n' +
          'Plays `<clip>` when it hears `<string_to_recognize>`.');
    }
    if (!this._paramCheck(message, params, 2)){ return; }
    var random = false
    if(params[0] == 'random') {
      random = true
      params.shift()
    }
    const clipName = params.shift()
    const hotPhrase = params.join(' ')
    if ((!random && !fm.inLibrary(clipName)) || (random && !fm.inRandoms(clipName))) {
      return message.reply(`Clip not found: ${clipName}`);
    }

    this.hotPhrases.push({clip: clipName, phrase: hotPhrase, random: random, phraseId: new Date().getTime()})
    this.HotPhraseStore.set('hotphrases', this.hotPhrases)
    return message.reply(`I'll be listening.`);
  }

  listphrases(message, params) {
    if (params[0] == 'help') {
      return message.reply('listphrases: \n' +
          'Lists hotphrase activations.');
    }

    var result = this.hotPhrases.map(phrase => {
      return `${phrase.phraseId}: ${phrase.phrase} (${phrase.random?'random - ':''}\`${phrase.clip}\`)`
    })
    return message.reply("Hot phrases: \n" + result.join('\n'), {split: true})
  }
}
