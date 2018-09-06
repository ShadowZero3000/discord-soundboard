const fs = require('fs');
const log = require('./logger.js').errorLog;
const nconf = require('nconf');
const files = require('./utils.js').files
const request = require('request');
const queues = require('./utils.js').queues;

class AdminUtils {
  get_actions() {
    return Object.getOwnPropertyNames(Object.getPrototypeOf(this))
          .filter(key => ['constructor', 'get_actions', 'check'].indexOf(key) == -1)
          .filter(key => !key.match('^_.*'));
  }

  check(message, access) {
    return (this._admins()[message.author.id]
        && this._admins()[message.author.id]['access'].indexOf(access) > -1);
  }
  // Private functions
  _print_access(message, user, id) {
    message.reply(`${user} now has: ${this._admins()[id]['access'].sort().join(', ')}`);
  }

  _admins() {
    return nconf.get('adminList');
  }

  _get_voice_channel(message) {
    if (message.member && message.member.voiceChannel) {
      return message.member.voiceChannel;
    }

    message.reply("You don't appear to be in a voice channel!");
  }
  _get_discord_user(message, username) {
    return message.channel.guild.members.find(a => {
      return a.user['username'].toLowerCase() == username.toLowerCase();
    });
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
  access(message, params) {
    if (!params.length > 0) {
      message.reply("Not enough details to show access");
      return;
    }

    const username = params[0];
    const discord_user = this._get_discord_user(message, username);
    if (discord_user && this._admins()[discord_user.user.id]) {
      this._print_access(message, username, discord_user.user.id);
    } else {
      message.reply(`${username} does not presently have any admin permissions`)
    }
  }

  add(message, params) {
    if (!params.length > 0) {
      return;
    }

    const prefix = params[0];
    if (!prefix.match(/^[a-z0-9_]+$/)) {
      message.reply(`${prefix} is a bad short name`);
    }

    if (message.attachments.first()) {
      // Only check the first attachment
      const a = message.attachments.first();
      const filename = `./Uploads/${prefix}--${a.filename}`;

      log.debug(`Writing attachment to file: ${filename}`);
      request(a.url).pipe(fs.createWriteStream(filename));

      files[prefix] = filename;
      message.reply(`!${prefix} is now available`);
    } else {
      message.reply(`You need to attach a file`);
    }
  }

  grant(message, params) {
    if (!params.length > 0) {
      message.reply("Not enough details to add access");
      return;
    }

    const username = params[0];
    let access = params[1];
    const discord_user = this._get_discord_user(message, username);
    const adminList = this._admins();
    if (discord_user && access) {
      log.debug(`Updating: ${username} with ${access}`);
      access = access.split(',').map(operation => operation.trim());
      console.log(access);
      const userId = discord_user.user.id;

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
      this._print_access(message, username, userId);
    }
  }

  remove(message, params) {
    if (!params.length > 0 || !(Object.keys(files).indexOf(params[0]) > -1)) {
      log.debug(`Valid removal not found for: ${params}`)
      return;
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

  revoke(message, params) {
    if (!params.length > 0) {
      message.reply("Not enough details to remove access");
      return;
    }

    const username = params[0];
    const access = params[1];
    const discord_user = this._get_discord_user(message, username);

    if (discord_user && access && this._admins()[discord_user.user.id]) {
      const user = this._admins()[discord_user.user.id];

      if (user['immune']) {
        message.reply(`${username} is immune to revokes`);
        return;
      }

      user['access'] = user['access'].filter((value, index, arr) => {
        return access.split(',').indexOf(value) < 0;
      });

      this._print_access(message, username, discord_user.user.id);
      this._saveConfig('adminList', this._admins());
    }
  }

  silence(message, params) {
    const vc = this._get_voice_channel(message);
    if (vc && vc.id in queues) {
      queues[vc.id].silence();
    }
  }

  toggle_startup(message, params) {
    let startup = nconf.get('startup');
    startup['enabled'] = !startup['enabled'];
    this._saveConfig('startup', startup);
    message.reply(`Startup audio set: ${startup['enabled']}`);
  }

  unmute(message, params) {
    const vc = this._get_voice_channel(message);
    if (vc && vc.id in queues) {
      queues[vc.id].unsilence();
    }
  }
}

const adm = new AdminUtils()
module.exports = adm