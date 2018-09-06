
const Discord = require('discord.js');
const nconf = require('nconf');
const adminUtils = require('./adminUtils.js')
const files = require('./utils.js').files
const queues = require('./utils.js').queues;

class DiscordBot {
  constructor(token) {
    this.token = token;
    this.discord = new Discord.Client();
  }

  connect() {
    this.discord.login(this.token).then(session => {
      //TODO: Make the join noise configurable and optional
      //TODO: Make this not choke if you provide an invalid admin_id or aren't in a channel
      var startup = nconf.get('startup');
      this.discord.fetchApplication().then(obj => {
        nconf.set('CLIENT_ID', obj.id); //Overrides environment variables
        var startup = nconf.get('startup');
        const adminList = nconf.get('adminList');
        adminList[obj.owner.id] = {
          'access': adminUtils.get_actions(),
          'immune': true
        };
        nconf.set('adminList', adminList);
        if (startup.enabled) {
          get_queue(get_vc_from_userid(obj.owner.id))
            .add(files[startup.clip]);
        }
      })
    });
    return this.discord;
  }
}

module.exports = DiscordBot