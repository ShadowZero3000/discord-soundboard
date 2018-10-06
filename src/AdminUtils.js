const fs = require('fs');
const log = require('./logger.js').errorLog;
const nconf = require('nconf');

const am = require('./AccessManager');
const fm = require('./FileManager');
const vqm = require('./VoiceQueueManager');

class AdminUtils {
  // Reserved functions
  check(message, access) {
    return (this._admins()[message.author.id]
        && this._admins()[message.author.id]['access'].indexOf(access) > -1);
  }

  getActions() {
    return Object.getOwnPropertyNames(Object.getPrototypeOf(this))
          .filter(key => ['constructor', 'getActions', 'check', 'getUserActions'].indexOf(key) == -1)
          .filter(key => !key.match('^_.*'));
  }

  getUserActions(message) {
    const user = this._admins()[message.author.id];
    if (!user) {
      return [];
    }
    return user['access'].sort();
  }

  // Private functions
  _admins() {
    return nconf.get('adminList');
  }

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

  _printAccess(message, user, id) {
    return message.reply(`${user} now has: ${this._admins()[id]['access'].sort().join(', ')}`);
  }

  _saveConfig(key, value) {
    log.debug(`Saving config key: ${key}, value: ${value}`);
    nconf.set(key, value);
    const configFile = nconf.stores.file.file;
    nconf.save(err => {
      fs.readFile(configFile, (err, data) => {
        data = data || {};
        // TODO: I'm pretty sure this can be dropped
        console.dir(data);
      })
    });
  }

  // Public functions
  access(message, params) {
    if (params[0] == 'help') {
      return message.reply('access <username>: \n' +
          'Prints what access <username> has.');
    }
    if (!this._paramCheck(message, params)){ return; }

    const username = params[0];
    const discordUser = this._getDiscordUser(message, username);
    if (discordUser && this._admins()[discordUser.user.id]) {
      return this._printAccess(message, username, discordUser.user.id);
    } else {
      return message.reply(`${username} does not presently have any admin permissions`)
    }
  }

  accessrole(message, params) {
    const play = am.getAccess(message.guild, 'play').map(role => { return role.name });
    var response = `Roles with play permission: ${play.join(', ')}`;

    const request = am.getAccess(message.guild, 'request').map(role => { return role.name });
    if (request.length != 0) {
      response += '\nRoles with request permission: ' + request.join(', ');
    }

    const admin = am.getAccess(message.guild, 'admin').map(role => { return role.name });
    if (admin.length != 0) {
      response += '\nRoles with admin permission: ' + request.join(', ');
    }

    return message.reply(response);
  }

  add(message, params) {
    if (params[0] == 'help') {
      return message.reply('add <clip> [category] (with attachment): \n' +
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
    if (params[0] == 'help') {
      return message.reply('grant `<username>` `<permission>` [`<permission>` ...]: \n' +
          'Gives `<username>` access to `<permission>` feature(s).');
    }
    if (!this._paramCheck(message, params, 2)){ return; }

    const username = params.shift();
    const discordUser = this._getDiscordUser(message, username);
    const adminList = this._admins();
    if (discordUser && params) {
      const validActions = this.getActions();
      const access = params.map(operation => operation.trim())
                .filter(operation => {
                  return validActions.indexOf(operation) > -1;
                });
      if (access.length == 0){ return; }
      log.debug(`Updating: ${username} with ${access}`);

      const userId = discordUser.user.id;

      if (!(userId in adminList)) {
        log.debug("New user")
        adminList[userId] = {'access': access, 'immune': false};
      } else {
        log.debug("Additional permissions")
        adminList[userId]['access'] = [...access, ...adminList[userId]['access']]
          .filter((element, pos, arr) => {
            // Unique filter
            return arr.indexOf(element) == pos;
          });
      }

      this._saveConfig('adminList', adminList);
      this._printAccess(message, username, userId);
    }
  }

  grantrole(message, params) {
    if (params[0] == 'help') {
      return message.reply('grantrole `play|request|admin` `<role name>`: \n' +
          'Gives `<role name>` access to `play` `request` or do `admin` things(s).');
    }
    if (!this._paramCheck(message, params, 2)){ return; }
    const access = params.shift();
    const roleName = params.join(' ');
    if (!access.match(/^(play|request|admin)$/)) {
      return message.reply('Must select the granted access: play|request|admin')
    }
    const role = am.getRole(roleName, message.guild);
    if (!role) {
      return message.reply(`Couldn't find that role`);
    }
    if (am.grantAccessById(role.id, message.guild.id, access)){
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
    if (params[0] == 'help') {
      return message.reply('revoke `<username>` `<permission>` [`<permission>` ...]: \n' +
          'Revokes access for `<username>` to `<permission>` feature(s).');
    }
    if (!this._paramCheck(message, params, 2)){ return; }

    const username = params.shift();
    const discordUser = this._getDiscordUser(message, username);

    if (discordUser && params && this._admins()[discordUser.user.id]) {
      const user = this._admins()[discordUser.user.id];

      if (user['immune']) {
        message.reply(`${username} is immune to revokes`);
        return;
      }

      user['access'] = user['access'].filter((value, index, arr) => {
        return params.indexOf(value) < 0;
      });

      this._printAccess(message, username, discordUser.user.id);
      this._saveConfig('adminList', this._admins());
    }
  }

  revokerole(message, params) {
    if (params[0] == 'help') {
      return message.reply('revokerole `play|request|admin` `<role name>`: \n' +
          'Removes `<role name>` access to `play` `request` or do `admin` things(s).');
    }
    if (!this._paramCheck(message, params, 2)){ return; }
    const access = params.shift();
    const roleName = params.join(' ');
    if (!access.match(/^(play|request|admin)$/)) {
      return message.reply('Must select the revoked access: play|request|admin')
    }
    const role = am.getRole(roleName, message.guild);
    if (!role) {
      return message.reply(`Couldn't find that role`);
    }
    if (am.revokeAccessById(role.id, message.guild.id, access)){
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
