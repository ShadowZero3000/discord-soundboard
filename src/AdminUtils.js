const fs = require('fs');
const log = require('./logger.js').errorLog;
const nconf = require('nconf');
const request = require('request');
const utils = require('./utils.js');

const files = utils.files
const queues = utils.queues;

class AdminUtils {
  getActions() {
    return Object.getOwnPropertyNames(Object.getPrototypeOf(this))
          .filter(key => ['constructor', 'getActions', 'check'].indexOf(key) == -1)
          .filter(key => !key.match('^_.*'));
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

  _paramCheck(message, params) {
    if (!params.length > 0) {
      message.reply(`${this._paramCheck.caller.name} needs more parameters`)
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
    if (!this._paramCheck(message, params)){ return; }

    const prefix = params[0];
    if (!prefix.match(/^[a-z0-9_]+$/)) {
      return message.reply(`${prefix} is a bad short name`);
    }
    if (Object.keys(files).indexOf(prefix) > -1) {
      return message.reply("That sound effect already exists");
    }
    if (message.attachments.first()) {
      // Only check the first attachment
      const a = message.attachments.first();
      const filename = `./Uploads/${prefix}--${a.filename}`;

      log.debug(`Writing attachment to file: ${filename}`);
      request(a.url).pipe(fs.createWriteStream(filename));

      files[prefix] = filename;
      return message.reply(`${nconf.get('KEY_SYMBOL')}${prefix} is now available`);
    } else {
      return message.reply(`You need to attach a file`);
    }
  }

  grant(discord, message, params) {
    if (!this._paramCheck(message, params)){ return; }

    const username = params[0];
    let access = params[1];
    const discordUser = this._getDiscordUser(message, username);
    const adminList = this._admins();
    if (discordUser && access) {
      log.debug(`Updating: ${username} with ${access}`);
      access = access.split(',').map(operation => operation.trim());
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
    if (!this._paramCheck(message, params)){ return; }
    if (!(Object.keys(files).indexOf(params[0]) > -1)) {
      return log.debug(`File not found: ${params}`);
    }

    const clipName = params[0];
    log.debug(`Deleting: ${files[clipName]}`);

    fs.unlink(files[clipName], err => {
      if (err) {
        log.debug(err);
        return;
      }

      delete files[clipName];
      log.debug("Deleted successfully");
      message.reply(`${clipName} removed`);
    });
  }

  revoke(discord, message, params) {
    if (!this._paramCheck(message, params)){ return; }

    const username = params[0];
    const access = params[1];
    const discordUser = this._getDiscordUser(message, username);

    if (discordUser && access && this._admins()[discordUser.user.id]) {
      const user = this._admins()[discordUser.user.id];

      if (user['immune']) {
        message.reply(`${username} is immune to revokes`);
        return;
      }

      user['access'] = user['access'].filter((value, index, arr) => {
        return access.split(',').indexOf(value) < 0;
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

const adm = new AdminUtils()
module.exports = adm