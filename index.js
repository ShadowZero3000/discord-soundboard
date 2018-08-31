var Discord = require('discord.js');
var fs = require('fs');
var bot = new Discord.Client();
var request = require('request');

var token = process.env.TOKEN;
var global_admin_id = process.env.GLOBAL_ADMIN;
// TODO: Allow config from file instead of requiring env vars

// Often seems to break with sub 1-second mp3's
var files = {};
var queues = {};
var adminList = {};
adminList[global_admin_id] = {
    'access': ['remove','add', 'silence', 'unsilence', 'accessadd', 'accessdel'],
    'immune': true
  }

// Read the Uploads directory, parse out keywords and file mappings
items = fs.readdirSync('./Uploads/');
items.forEach(item => {
  matches = item.match('^([^-]+)--(.*)$');
  if (matches) {
    files[matches[1]] = './Uploads/'+matches[0];
  }
})

/////////////////END INITIALIZATION

// TODO: Move this to its own class/file
function VoiceQueue(channel) {
  var playQueue = [];
  var connection;
  var playing = false;
  var silenced = false;
  var id = channel.id;
  var name = channel.guild.name;

  return {
    log: function(message) {
      console.log(name + ': ' + message);
    },
    add: function(file) {
      if (silenced) { return; }
      this.log("Queued: " + file)
      playQueue.unshift(file);
      this.play(channel);
    },
    silence: function() {
      silenced = true;
      playQueue = [];
      this.disconnect(channel);
    },
    unsilence: function() {
      silenced = false;
    },
    disconnect: function(force=false) {
      if(playing && !force){
        this.log("Still playing");
        return
      }
      this.log("Leaving");
      channel.leave();
    },
    play: function() {
      if (playing) {
        return;
      }
      playing = true;
      file = playQueue.pop();
      if (file !== undefined) {
        channel.join().then(conn => {
          var stream = fs.createReadStream(file);
          this.log("Playing: " + file);
          const dispatcher = conn.playStream(stream, {type: 'opus'});
          dispatcher.on("end", end =>{
            this.log("Finished with: " + file)
            playing = false;
            this.play();
          })
        }).catch(err => {
          this.log(err)
          playing = false;
          this.play();
        });
      } else {
        this.log("Queue empty");
        playing = false;
        theObj = this;
        setTimeout(function(){theObj.disconnect();}, 3000);
      }
    }
  };
}

function botHelp(){
  return "I'm a bot. \nYou can ask me to make sounds by saying one of the following: \n`!" +
    Object.keys(files).sort().join('`, `!') + '`';
}
// TODO: Move all the message stuff into its own class/file
function get_message_params(message, keyword) {
  var matches = message.content.toLowerCase().match('^!('+keyword+')(.*)$');
  if (matches) {
    return matches[2].match(/((\b[\w,]+)+)/g);
  }
}

// TODO: Move all the admin stuff into its own class/file
function auth_check(message, access) {
  return (adminList[message.author.id]
      && adminList[message.author.id]['access'].indexOf(access) > -1)
}

function add_clip(message, keyword) {
  var matches = message.content.toLowerCase().match('^!?add ([a-z0-9]+)$');
  if (matches) {
    var prefix = matches[1];
    if (message.attachments){
      console.log("Has attachment");
      // Only the first matters
      var a = message.attachments.first();
      var filename = './Uploads/'+prefix+'--'+a.filename;
      console.log('Writing to file: '+ filename);
      request(a.url).pipe(fs.createWriteStream(filename));
      files[prefix]=filename;
    }
  }
}
function remove_clip(message, keyword) {
  params = get_message_params(message, keyword);
  if(params && params[0] in files) {
    console.log("Deleting: " + files[params[0]])
    fs.unlink(files[params[0]], function(err){
      if(err) return console.log(err);
      console.log("Deleted successfully");
    });
    delete files[params[0]];
  }
}
function silence(message, keyword) {
  if (message.member && message.member.voiceChannel) {
    vc = message.member.voiceChannel;
    queues[vc.id].silence(vc);
  }
}
function unsilence(message, keyword) {
  if (message.member && message.member.voiceChannel) {
    vc = message.member.voiceChannel;
    queues[vc.id].unsilence(vc);
  }
}
function access_add(message, keyword) {
  params = get_message_params(message, keyword);
  if (!params) { return; }
  var username = params[0];
  var access = params[1];
  console.log(access.split(','))
  var discord_user = message.channel.guild.members.find(function(a){
    return a.user['username'].toLowerCase()==username.toLowerCase()});
  if (discord_user && access) {
    console.log("Updating: " + username)
    if (!(discord_user.user.id in adminList)) {
      console.log("New user")
      adminList[discord_user.user.id]={'access': access.split(','), 'immune': false}
    } else {
      console.log("Additional permissions")
      adminList[discord_user.user.id]['access'] = Array.from(new Set(
        access.split(',').concat(adminList[discord_user.user.id]['access'])))
    }
    print_access(message, username, discord_user.user.id);
  }
}
function access_remove(message, keyword) {
  params = get_message_params(message, keyword);
  if (!params) { return; }
  var username = params[0];
  var access = params[1];
  var discord_user = message.channel.guild.members.find(function(a){
    return a.user['username'].toLowerCase()==username.toLowerCase()});
  if (discord_user && access && adminList[discord_user.user.id]) {
    var user=adminList[discord_user.user.id];
    if (user['immune']) {
      message.reply(username + " is immune to revokes");
      return;
    }
    var filtered_access = user['access'].filter(function(value, index, arr){
      return access.split(',').indexOf(value) < 0;
    });
    user['access'] = filtered_access;
    print_access(message, username, discord_user.user.id);
  }
}

function print_access(message, user, id) {
  message.reply(user + ' now has: ' + adminList[id]['access'].join(','))
}

function get_vc_from_userid(user_id) {
  var user = bot.users.get(user_id);
  var activeGuild = bot.guilds.find(function(guild){return guild._rawVoiceStates.get(user_id)});
  if (user && activeGuild) {
    return activeGuild.members.get(user_id).voiceChannel;
  }
  return null;
}

function get_queue(vc) {
  // TODO: This will misbehave, need to throw?
  if (!vc) { return; }
  if (!queues[vc.id]) {
    queues[vc.id] = VoiceQueue(vc);
  }
  return queues[vc.id]
}

// TODO: Once all the admin stuff is in a class, this can probably be auto-generated
adminWords = {
  'add': add_clip,
  'silence': silence,
  'unmute': unsilence,
  'remove': remove_clip,
  'accessadd': access_add,
  'accessdel': access_remove
}


bot.on('message', message => {
  var messageText = message.content.toLowerCase();
  // Keeping this block of code in case I want to return to having it just camp in channel
  /*if (message.content.toLowerCase() === "bot join") {
    if (message.member && message.member.voiceChannel){
      voiceChannel = message.member.voiceChannel;
      voiceConnection = voiceChannel.join();
      isJoined = true;
      message.reply("I'm here to help. For more details, try `bot help`")
    } else {
      message.reply("You're not in a voice channel");
      return;
    }
  }

  */
  if (messageText === "bot help") {
      message.reply(botHelp());
  }

  // Pull out keywords
  if (messageText.match('![a-z]+')) {
    keyword = messageText.match('![a-z]+')[0].substring(1);
  } else {
    keyword = messageText;
  }

  if (keyword in adminWords) {
    if (auth_check(message,keyword)) {
      adminWords[keyword](message, keyword);
    }
    return; //Don't let admin keywords waterfall down to non-admin stuff
  }

  if(message.member && message.member.voiceChannel){
    var vc = message.member.voiceChannel;
    // TODO: Move all the 'bot *' and admin stuff to a consistent namespace ('!soundboard add' etc...)
    if (messageText === "bot leave") {
        vc.leave();
        return;
    }
    if (keyword in files) {
      get_queue(vc).add(files[keyword])
      return;
    }
  }
});
bot.login(token).then(session=>{
  //TODO: Make the join noise configurable and optional
  //TODO: Make this not choke if you provide an invalid admin_id or aren't in a channel
  get_queue(get_vc_from_userid(global_admin_id)).add(files['sensors']);
});
console.log("Let the fun begin!");

// Make sure we handle exiting properly (SIGTERM might not be needed)
process.on('SIGINT', function() {
  // Leave all voice channels
  Object.keys(queues).forEach(queue =>{
    queues[queue].disconnect(true);
  })
  process.exit();
});
process.on('SIGTERM', function() {
  // Leave all voice channels
  Object.keys(queues).forEach(queue =>{
    queues[queue].disconnect(true);
  })
  process.exit();
});