const fs = require('fs');
const log = require('./logger.js').errorLog;
const nconf = require('nconf');

const am = require('./AccessManager');
const fm = require('./FileManager');
const vqm = require('./VoiceQueueManager');

class AdminUtils {
  constructor() {
    this.accessMap = {
      'servermanager': [
        'access',
        'accessrole',
        'grant',
        'grantrole',
        'revoke',
        'revokerole',
        'togglestartup'
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
      'silencer': [
        'silence',
        'unmute'
      ],
      'play': []
    }
    this.reverseAccessMap = {};
    Object.keys(this.accessMap).forEach(group => {
      this.accessMap[group].forEach(entry => {
        this.reverseAccessMap[entry] = group;
      });
    });
    this.immuneUser = '0';
  }

  // Reserved functions
  check(message, access) {
    return (am.checkAccess(message.author, message.guild, this.reverseAccessMap[access]));
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
    return message.channel.guild.members.find(a => {
      return a.user['username'].toLowerCase() == username.toLowerCase();
    });
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
    return message.reply(`${user} has: ${access.sort().join(', ')}`);
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
  access(message, params) {
    if (params[0] == 'help') {
      return message.reply('access `<username>`: \n' +
          'Prints what access <username> has.');
    }
    if (!this._paramCheck(message, params)){ return; }

    const username = params[0];
    const discordUser = this._getDiscordUser(message, username);
    // No need to keep the requested message visible
    message.delete();
    if (discordUser) {
      const userAccess = am.getUserAccess(discordUser.user);
      return this._printUserAccess(message, username, userAccess);
    } else {
      return message.reply(`${username} does not presently have any admin permissions`)
    }
  }

  accessrole(message, params) {
    var response = `\`accessrole\`\nCurrent role access:`;
    am.getRoleAccess(message.guild)
      .sort((a,b) => (a.name > b.name) ? 1 : 0)
      .forEach(role => {
        response += `\n${role.name} - ${role.access.sort().join(', ')}`;
      });
    // No need to keep the requested message visible
    message.delete();
    return message.reply(response);
  }

  add(message, params) {
    if (params[0] == 'help') {
      return message.reply('add `<clip>` `[category]` (with attachment): \n' +
          'Adds a sound effect with <clip> as its shortcut.\n' +
          'If provided, will assign to [category]. Defaults to "misc".');
    }
    if (!this._paramCheck(message, params)){ return; }

    const clipName = params[0];
    const category = params[1] || 'misc';
    if (!clipName.match(/^[a-z0-9_]+$/)) {
      return message.reply(`${clipName} is a bad short name`);
    }
    if (!category.match(/^[a-z0-9_]+$/)) {
      return message.reply(`${category} is a bad category name`);
    }
    if (fm.inLibrary(clipName)) {
      return message.reply("That sound effect already exists");
    }
    if (message.attachments.first()) {
      // Only check the first attachment
      fm.create(clipName, category, message.attachments.first());
      return message.reply(`${nconf.get('KEY_SYMBOL')}${clipName} is now available`);
    } else {
      return message.reply(`You need to attach a file`);
    }
  }

  categorize(message, params) {
    if (params[0] == 'help') {
      return message.reply('categorize `<new category>` `<clip>` [`<clip>` ...]: \n' +
        'Updates the category for any sound(s) (space separated).\n'+
        'Remember that categories should use `_` for spaces.');
    }
    if (!this._paramCheck(message, params, 2)){ return; }
    const category = params.shift();
    if (!category.match(/^[a-z0-9_]+$/)) {
      return message.reply(`${category} is a bad category name`);
    }
    params.forEach(clip => {
      if(fm.inLibrary(clip)) {
        fm.rename(clip, clip, category);
        message.reply(`${clip}'s category is now: ${category}`);
      } else {
        message.reply(`I don't recognize ${clip}`)
      }
    });
    return true;
  }

  grant(message, params) {
    const validRoles = Object.keys(this.accessMap).sort().join('|');
    if (params[0] == 'help') {
      return message.reply('grant `<username>` `<permission>` [`<permission>` ...]: \n' +
          'Gives `<username>` access to `<permission>` feature(s).\n' +
          `Permissions: \`${validRoles}\``);
    }
    if (!this._paramCheck(message, params, 2)){ return; }

    const username = params.shift();
    const discordUser = this._getDiscordUser(message, username);
    if (discordUser && params) {
      const access = params.map(operation => operation.trim())
                           .filter(operation => (operation in this.accessMap));
      if (access.length == 0){ return; }

      const userId = discordUser.user.id;
      message.delete();
      // Access manager
      am.grantUserAccessById(userId, access);
      this._printUserAccess(message, username, am.getUserAccess(discordUser.user));
    }

  }

  grantrole(message, params) {
    const validRoles = Object.keys(this.accessMap).sort().join('|');
    if (params[0] == 'help') {
      return message.reply(`grantrole \`${validRoles}\` \`<role name>\`: \n` +
          'Gives `<role name>` access to the named role.');
    }
    if (!this._paramCheck(message, params, 2)){ return; }
    const access = params.shift();
    const roleName = params.join(' ');
    if (!access.match("^(" + validRoles + ")$")) {
      return message.reply('Must select the granted access: `' + validRoles + '`')
    }

    const role = message.guild.roles.find(role => role.name.toLowerCase() === roleName);
    if (!role) {
      return message.reply(`Couldn't find that role`);
    }
    if (am.grantRoleAccessById(role.id, message.guild.id, access)){
      return message.reply(`Granted ${access} to '${role.name}'`);
    }
    return message.reply(`Something went wrong with that`);
  }

  remove(message, params) {
    if (params[0] == 'help') {
      return message.reply('remove `<clip>`: \n' +
          'Permanently deletes `<clip>` from the soundboard.');
    }
    if (!this._paramCheck(message, params)){ return; }
    const clipName = params[0];
    if (!fm.inLibrary(clipName)) {
      return log.debug(`File not found: ${params}`);
    }
    if(fm.delete(clipName)) {
      message.reply(`${clipName} removed`);
    }
  }

  rename(message, params) {
    if (params[0] == 'help') {
      return message.reply('rename `<clip>` `<new clip name>`: \n' +
          'Renames `<clip>` to `<new clip name>`.');
    }
    if (!this._paramCheck(message, params, 2)){ return; }
    const oldClipName = params[0];
    const newClipName = params[1];
    if (!fm.inLibrary(oldClipName)) {
      message.reply(`Could not find: ${oldClipName}`)
      return log.debug(`File not found: ${oldClipName}`);
    }
    if (!newClipName.match(/^[a-z0-9_]+$/)) {
      return message.reply(`${newClipName} is a bad short name`);
    }
    if(fm.rename(oldClipName, newClipName)) {
      message.reply(`Rename to ${newClipName} complete.`);
    }
  }

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
    message.reply(`Here's what we've got requested:\n${result}`);
  }

  revoke(message, params) {
    const validRoles = Object.keys(this.accessMap).sort().join('|');
    if (params[0] == 'help') {
      return message.reply('revoke `<username>` `<permission>` [`<permission>` ...]: \n' +
          'Revokes access for `<username>` to `<permission>` feature(s).\n' +
          'Permissions: `' + validRoles + '`');
    }
    if (!this._paramCheck(message, params, 2)){ return; }

    const username = params.shift();
    const discordUser = this._getDiscordUser(message, username);

    if (discordUser && params) {
      if (discordUser.user.id == this.immuneUser) {
        return message.reply(`${username} is immune to revokes`);
      }
      // Access manager
      am.revokeUserAccessById(discordUser.user.id, params);
      this._printUserAccess(message, username, am.getUserAccess(discordUser.user));
    }
  }

  revokerole(message, params) {
    const validRoles = Object.keys(this.accessMap).sort().join('|');
    if (params[0] == 'help') {
      return message.reply('revokerole `' + validRoles + '` `<role name>`: \n' +
          'Removes `<role name>` access to the named role.');
    }
    if (!this._paramCheck(message, params, 2)){ return; }
    const access = params.shift();
    const roleName = params.join(' ');
    if (!access.match("^(" + validRoles + ")$")) {
      return message.reply('Must select the revoked access: `' + validRoles + '`')
    }
    const role = message.guild.roles.find(role => role.name.toLowerCase() === roleName);
    if (!role) {
      return message.reply(`Couldn't find that role`);
    }
    if (am.revokeRoleAccessById(role.id, message.guild.id, access)){
      return message.reply(`Revoked ${access} from '${role.name}'`);
    }
    return message.reply(`Something went wrong with that`);
  }

  silence(message, params) {
    try {
      vqm.getQueueFromMessage(message).silence();
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
      vqm.getQueueFromMessage(message).unsilence();
      message.reply("Ok, ready to make some noise.");
    } catch (e) {
      message.reply(e.message);
    }
  }
}

module.exports = new AdminUtils();
