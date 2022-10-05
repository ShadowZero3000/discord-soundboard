import * as fs from 'fs'
import nconf from 'nconf'

import {errorLog} from './logger.js'
const log = errorLog

import AccessManager from './AccessManager.js'
const am = AccessManager.getInstance()

import FileManager from './FileManager.js'
const fm = FileManager.getInstance()

import ListenerManager from './ListenerManager.js'
const lm = new ListenerManager()

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

  // Public functions
  // access(message, params) {
  //   if (params[0] == 'help') {
  //     return message.reply('access `<username>`: \n' +
  //         'Prints what access <username> has.');
  //   }
  //   if (!this._paramCheck(message, params)){ return; }

  //   const username = params[0];
  //   const discordUser = this._getDiscordUser(message, username);
  //   // No need to keep the requested message visible
  //   message.delete();
  //   if (discordUser) {
  //     const userAccess = am.getUserAccess(discordUser.user);
  //     return this._printUserAccess(message, username, userAccess);
  //   } else {
  //     return message.reply(`${username} does not presently have any admin permissions`)
  //   }
  // }

  // accessrole(message, params) {
  //   var response = `\`accessrole\`\nCurrent role access:`;
  //   am.getRoleAccess(message.guild)
  //     .sort((a,b) => (a.name > b.name) ? 1 : 0)
  //     .forEach(role => {
  //       response += `\n${role.name} - ${role.access.sort().join(', ')}`;
  //     });
  //   // No need to keep the requested message visible
  //   message.delete();
  //   return message.reply(response, {split: true});
  // }

  // add(message, params) {
  //   if (params[0] == 'help') {
  //     return message.reply('add `<clip>` `[category]` `[subcategory]` (with attachment): \n' +
  //         'Adds a sound effect with <clip> as its shortcut.\n' +
  //         'If provided, will assign to [category] and [subcategory]. Defaults to "misc".');
  //   }
  //   if (!this._paramCheck(message, params)){ return; }

  //   const clipName = params[0];
  //   const category = params[1] || 'misc';
  //   const subcategory = params[2] || 'misc';
  //   if (!clipName.match(/^[a-z0-9_]+$/)) {
  //     return message.reply(`${clipName} is a bad short name`);
  //   }
  //   if (!category.match(/^[a-z0-9_]+$/)) {
  //     return message.reply(`${category} is a bad category name`);
  //   }
  //   if (!subcategory.match(/^[a-z0-9_]+$/)) {
  //     return message.reply(`${subcategory} is a bad subcategory name`);
  //   }
  //   if (fm.inLibrary(clipName)) {
  //     return message.reply("That sound effect already exists");
  //   }
  //   if (message.attachments.first()) {
  //     // Only check the first attachment
  //     fm.create(clipName, category, subcategory, message.attachments.first());
  //     return message.reply(`${nconf.get('KEY_SYMBOL')}${clipName} is now available`);
  //   } else {
  //     return message.reply(`You need to attach a file`);
  //   }
  // }

  // categorize(message, params) {
  //   if (params[0] == 'help') {
  //     return message.reply('categorize `<new category>` `<new subcategory>` `<clip>` [`<clip>` ...]: \n' +
  //       'Updates the category/subcategory for any sound(s) (space separated).\n'+
  //       'Remember that categories should use `_` for spaces.');
  //   }
  //   if (!this._paramCheck(message, params, 3)){ return; }
  //   const category = params.shift();
  //   if (!category.match(/^[a-z0-9_]+$/)) {
  //     return message.reply(`${category} is a bad category name`);
  //   }
  //   const subcategory = params.shift();
  //   if (!subcategory.match(/^[a-z0-9_]+$/)) {
  //     return message.reply(`${subcategory} is a bad subcategory name`);
  //   }
  //   params.forEach(clip => {
  //     if(fm.inLibrary(clip)) {
  //       fm.rename(clip, clip, category, subcategory);
  //       message.reply(`${clip}'s category is now: ${category} - ${subcategory}`);
  //     } else {
  //       message.reply(`I don't recognize ${clip}`)
  //     }
  //   });
  //   return true;
  // }

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

  // grant(message, params) {
  //   const validRoles = Object.keys(this.accessMap).sort().join('|');
  //   if (params[0] == 'help') {
  //     return message.reply('grant `<username>` `<permission>` [`<permission>` ...]: \n' +
  //         'Gives `<username>` access to `<permission>` feature(s).\n' +
  //         `Permissions: \`${validRoles}\``);
  //   }
  //   if (!this._paramCheck(message, params, 2)){ return; }

  //   const username = params.shift();
  //   const discordUser = this._getDiscordUser(message, username);
  //   if (discordUser && params) {
  //     const access = params.map(operation => operation.trim())
  //                          .filter(operation => (operation in this.accessMap));
  //     if (access.length == 0){ return; }

  //     const userId = discordUser.user.id;
  //     message.delete();
  //     // Access manager
  //     am.grantUserAccessById(userId, access);
  //     this._printUserAccess(message, username, am.getUserAccess(discordUser.user));
  //   }

  // }

  // grantrole(message, params) {
  //   const validRoles = Object.keys(this.accessMap).sort().join('|');
  //   if (params[0] == 'help') {
  //     return message.reply(`grantrole \`${validRoles}\` \`<role name>\`: \n` +
  //         'Gives `<role name>` access to the named role.');
  //   }
  //   if (!this._paramCheck(message, params, 2)){ return; }
  //   const access = params.shift();
  //   const roleName = params.join(' ');
  //   if (!access.match("^(" + validRoles + ")$")) {
  //     return message.reply('Must select the granted access: `' + validRoles + '`', {split: true})
  //   }

  //   const role = message.guild.roles.cache.find(role => role.name.toLowerCase() === roleName);
  //   if (!role) {
  //     return message.reply(`Couldn't find that role`);
  //   }
  //   if (am.grantRoleAccessById(role.id, message.guild.id, access)){
  //     return message.reply(`Granted ${access} to '${role.name}'`);
  //   }
  //   return message.reply(`Something went wrong with that`);
  // }

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

  ignoreme(message, params) {
    lm.ignore(message.author.id)
    message.reply('I will no longer listen to what you are saying.')
  }

  listen(message, params) {
    lm.listenTo(message.author.id)
    message.reply(`I will now listen to what you are saying and attempt witty responses.\n`
      +`Please be aware that by issuing this command you accept that all of your conversations `
      +`spoken in a channel where I am also present will be recorded, and may be transferred `
      +`to the Wit AI (https://wit.ai/) for processing.\n`
      +`I will not permanently record your data (unless I crash, in which case it will be tidied later)`
      +`, however, Wit may use these recordings to improve itself.\n`
      +'If you do not agree to these terms, simply tell me: `ignoreme`', {split: true})
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

  // remove(message, params) {
  //   if (params[0] == 'help') {
  //     return message.reply('remove `<clip>`: \n' +
  //         'Permanently deletes `<clip>` from the soundboard.');
  //   }
  //   if (!this._paramCheck(message, params)){ return; }
  //   const clipName = params[0];
  //   if (!fm.inLibrary(clipName)) {
  //     return log.debug(`File not found: ${params}`);
  //   }
  //   if(fm.delete(clipName)) {
  //     message.reply(`${clipName} removed`);
  //   }
  // }

  // rename(message, params) {
  //   if (params[0] == 'help') {
  //     return message.reply('rename `<clip>` `<new clip name>`: \n' +
  //         'Renames `<clip>` to `<new clip name>`.');
  //   }
  //   if (!this._paramCheck(message, params, 2)){ return; }
  //   const oldClipName = params[0];
  //   const newClipName = params[1];
  //   if (!fm.inLibrary(oldClipName)) {
  //     message.reply(`Could not find: ${oldClipName}`)
  //     return log.debug(`File not found: ${oldClipName}`);
  //   }
  //   if (!newClipName.match(/^[a-z0-9_]+$/)) {
  //     return message.reply(`${newClipName} is a bad short name`);
  //   }
  //   if(fm.rename(oldClipName, newClipName)) {
  //     message.reply(`Rename to ${newClipName} complete.`);
  //   }
  // }

  request(message, params) {
    if (params[0] == 'help') {
      return message.reply('request `<clip>` `<description/url>`: \n' +
          'Adds a request for a clip.');
    }
    if (!this._paramCheck(message, params, 2)){ return; }
    const requestClipName = params.shift();
    const requestDescription = params.join(' ');
    if (!requestClipName.match(/^[a-z0-9_]+$/)) {
      return message.reply(`${requestClipName} is a bad clip name`);
    }
    if(fm.addRequest(requestClipName, requestDescription)) {
      message.reply(`Ok, I'll add it to the list`);
    } else {
      message.reply(`Already on the list`);
    }
  }

  reqlist(message, params) {
    const requests = fm.getRequests();
    const result = requests.map(req => `${req.name} - ${req.description}`).join('\n');
    message.reply(`Here's what we've got requested:\n${result}`, {split: true});
  }

  // revoke(message, params) {
  //   const validRoles = Object.keys(this.accessMap).sort().join('|');
  //   if (params[0] == 'help') {
  //     return message.reply('revoke `<username>` `<permission>` [`<permission>` ...]: \n' +
  //         'Revokes access for `<username>` to `<permission>` feature(s).\n' +
  //         'Permissions: `' + validRoles + '`');
  //   }
  //   if (!this._paramCheck(message, params, 2)){ return; }

  //   const username = params.shift();
  //   const discordUser = this._getDiscordUser(message, username);

  //   if (discordUser && params) {
  //     if (discordUser.user.id == this.immuneUser) {
  //       return message.reply(`${username} is immune to revokes`);
  //     }
  //     // Access manager
  //     am.revokeUserAccessById(discordUser.user.id, params);
  //     this._printUserAccess(message, username, am.getUserAccess(discordUser.user));
  //   }
  // }

  // revokerole(message, params) {
  //   const validRoles = Object.keys(this.accessMap).sort().join('|');
  //   if (params[0] == 'help') {
  //     return message.reply('revokerole `' + validRoles + '` `<role name>`: \n' +
  //         'Removes `<role name>` access to the named role.');
  //   }
  //   if (!this._paramCheck(message, params, 2)){ return; }
  //   const access = params.shift();
  //   const roleName = params.join(' ');
  //   if (!access.match("^(" + validRoles + ")$")) {
  //     return message.reply('Must select the revoked access: `' + validRoles + '`')
  //   }
  //   const role = message.guild.roles.cache.find(role => role.name.toLowerCase() === roleName);
  //   if (!role) {
  //     return message.reply(`Couldn't find that role`);
  //   }
  //   if (am.revokeRoleAccessById(role.id, message.guild.id, access)){
  //     return message.reply(`Revoked ${access} from '${role.name}'`);
  //   }
  //   return message.reply(`Something went wrong with that`);
  // }

  silence(message, params) {
    try {
      var queue = vqm.getQueueFromMessage(message)
      if(queue){
        queue.silence();
      }
      message.reply("Oooooh kaaaaay. I'll go sit in a corner for a while and think about what I did.");
    } catch (e) {
      message.reply(e.message);
    }
  }

  togglestartup(message, params) {
    let startup = nconf.get('startup');
    startup['enabled'] = !startup['enabled'];
    this._saveConfig('startup', startup);
    message.reply(`Startup audio set: ${startup['enabled']}`);
  }

  unmute(message, params) {
    try {
      var queue = vqm.getQueueFromMessage(message)
      if(queue) {
        queue.unsilence();
      }
      message.reply("Ok, ready to make some noise.");
    } catch (e) {
      message.reply(e.message);
    }
  }

  whereareyou(message, params) {
    console.log(message.dclient.guilds)
    return message.reply(`I'm available in the following servers: \n`+
      message.dclient.guilds.cache.map(guild => guild.name).join('\n'));
  }
}
