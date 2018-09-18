const fs = require('fs');
const log = require('./logger.js').errorLog;
const nconf = require('nconf');
const utils = require('./utils.js');

const fm = require('./FileManager');
const queues = utils.queues;

class AdminUtils {
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

  check(message, access) {
    return (this._admins()[message.author.id]
        && this._admins()[message.author.id]['access'].indexOf(access) > -1);
  }

  // Private functions
  _printAccess(message, user, id) {
    message.reply(`${user} now has: ${this._admins()[id]['access'].sort().join(', ')}`);
  }

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
  _saveConfig(key, value) {
    log.debug(`Saving config key: ${key}, value: ${value}`);
    nconf.set(key, value);
    const configFile = nconf.stores.file.file;
    nconf.save(err => {
      fs.readFile(configFile, (err, data) => {
        data = data || {};
        // TODO: I'm pretty sure this can be dropped
        console.dir(JSON.parse(data.toString()));
      })
    });
  }

  // Public functions
  access(discord, message, params) {
    if (params[0] == 'help') {
      return message.reply('access <username>: \n' +
          'Prints what access <username> has.');
    }
    if (!this._paramCheck(message, params)){ return; }

    const username = params[0];
    const discordUser = this._getDiscordUser(message, username);
    if (discordUser && this._admins()[discordUser.user.id]) {
      this._printAccess(message, username, discordUser.user.id);
    } else {
      message.reply(`${username} does not presently have any admin permissions`)
    }
  }

  add(discord, message, params) {
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

  categorize(discord, message, params) {
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
  }

  grant(discord, message, params) {
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

  remove(discord, message, params) {
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

  rename(discord, message, params) {
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

  request(discord, message, params) {
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
    fm.addRequest(requestClipName, requestDescription);
    message.reply(`Ok, I'll add it to the list`);
  }

  reqlist(discord, message, params) {
    const requests = fm.getRequests();
    console.log(requests);
    const result = requests.map(req => `${req.name} - ${req.description}`).join('\n');
    message.reply(`Here's what we've got requested:\n${result}`);
  }

  revoke(discord, message, params) {
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

  silence(discord, message, params) {
    utils.getQueueFromUser(discord, message.member.id).silence();
    message.reply("Oooooh kaaaaay. I'll go sit in a corner for a while and think about what I did.");
  }

  togglestartup(discord, message, params) {
    let startup = nconf.get('startup');
    startup['enabled'] = !startup['enabled'];
    this._saveConfig('startup', startup);
    message.reply(`Startup audio set: ${startup['enabled']}`);
  }

  unmute(discord, message, params) {
    utils.getQueueFromUser(discord, message.member.id).unsilence();
    message.reply("Ok, ready to make some noise.");
  }
}

module.exports = new AdminUtils();