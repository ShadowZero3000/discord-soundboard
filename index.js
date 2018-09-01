const Discord = require('discord.js');
const fs = require('fs');
const request = require('request');
const nconf = require('nconf');


const express = require('express')
const path = require('path');
const app = express()
const cookieParser = require('cookie-parser');


configFile = path.join(__dirname,'config/config.json');
nconf.argv()
  .env()
  .file({file: configFile})
  .defaults({
    startup: {
      enabled: false,
      clip: 'sensors'
    },
    adminList: {}
  })

function saveConfig() {
  console.log("Saving config")
  nconf.save(function (err) {
    fs.readFile(configFile, function (err, data) {
      data = data || {};
      console.dir(JSON.parse(data.toString()));
    })
  })
}

var token = nconf.get('TOKEN');

// Often seems to break with sub 1-second mp3's
var bot = new Discord.Client();
var files = {};
var queues = {};
var adminList = {};

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
    Object.keys(files).sort().join('`, `!') + '`'
    + '\n----\nAdmins can also use: \n`!soundboard '
    + Object.keys(adminWords).sort().join('`, `!soundboard ') + '`';
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

function add_clip(message, params) {
  if (!params) { return; }
  var prefix = params[0];
  if (!prefix.match('^[a-z0-9_]+$')) {
    message.reply("Bad shortname");
  }
  if (message.attachments){
    console.log("Has attachment");
    // Only the first matters
    var a = message.attachments.first();
    var filename = './Uploads/'+prefix+'--'+a.filename;
    console.log('Writing to file: '+ filename);
    request(a.url).pipe(fs.createWriteStream(filename));
    files[prefix]=filename;
    message.reply(` !${prefix} is now available`)
  }
}
function remove_clip(message, params) {
  if(!params || !(params[0] in files)) { return; }
  console.log("Deleting: " + files[params[0]])
  fs.unlink(files[params[0]], function(err){
    if(err) return console.log(err);
    console.log("Deleted successfully");
    message.reply(`${params[0]} removed`)
  });
  delete files[params[0]];
}
function silence(message, params) {
  if (message.member && message.member.voiceChannel) {
    vc = message.member.voiceChannel;
    queues[vc.id].silence(vc);
  }
}
function unsilence(message, params) {
  if (message.member && message.member.voiceChannel) {
    vc = message.member.voiceChannel;
    queues[vc.id].unsilence(vc);
  }
}
function access_add(message, params) {
  if (!params) { return; }
  var username = params[0];
  var access = params[1];
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
    nconf.set('adminList', adminList);
    saveConfig();
  }
}
function access_remove(message, params) {
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
    nconf.set('adminList', adminList);
    saveConfig();
  }
}
function access_show(message, params) {
  if (!params) { return; }
  var username = params[0];
  var discord_user = message.channel.guild.members.find(function(a){
    return a.user['username'].toLowerCase()==username.toLowerCase()});
  if (discord_user && adminList[discord_user.user.id]) {
    print_access(message, username, discord_user.user.id);
  }
}
function toggle_startup(message, params) {
  var startup = nconf.get('startup');
  startup['enabled'] = !startup['enabled'];
  nconf.set('startup', startup);
  saveConfig();
  message.reply("Startup noise set: " + startup['enabled'])
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
  'permit': access_add,
  'revoke': access_remove,
  'access': access_show,
  'toggle_startup': toggle_startup
  //TODO: Rename!
}
adminList = nconf.get('adminList');

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
  if (messageText === "!soundboard help") {
      message.reply(botHelp());
  }

  // Pull out keywords
  if (messageText.match('![a-z0-9_]+')) {
    keyword = messageText.match('![a-z0-9_]+')[0].substring(1);
  } else {
    keyword = messageText;
  }

  if (keyword == 'soundboard' || keyword == 'sb') { // Admin call
    var params = get_message_params(message, keyword)
    if (params && params[0] in adminWords) {
      if (auth_check(message, params[0])) {
        adminWords[params.shift()](message, params);
      }
    }
  }

  if(message.member && message.member.voiceChannel){
    var vc = message.member.voiceChannel;
    // TODO: Move all the 'bot *' and admin stuff to a consistent namespace ('!soundboard add' etc...)
    if (messageText === "!soundboard leave") {
        vc.leave();
        return;
    }
    if (keyword in files) {
      get_queue(vc).add(files[keyword])
      return;
    }
    if (keyword == 'random') {
      var params = get_message_params(message, keyword);
      if (!params[0]) { return; }
      var filenames = Object.keys(files);
      filenames = filenames.filter(key => {
        if (key.match(`^${params[0]}[0-9]+`)) { return true; }
      })
      var clip = filenames[Math.floor(Math.random()*filenames.length)];
      get_queue(vc).add(files[clip]);
    }
  }
});
bot.login(token).then(session=>{
  //TODO: Make the join noise configurable and optional
  //TODO: Make this not choke if you provide an invalid admin_id or aren't in a channel
  startup = nconf.get('startup');
  bot.fetchApplication().then(obj=>{
    adminList[obj.owner.id] = {
      'access': Object.keys(adminWords),
      'immune': true
    }
    if (startup.enabled) {
      get_queue(get_vc_from_userid(obj.owner.id)).add(files[startup.clip]);
    }
  })
});

console.log("Let the fun begin!");

// Make sure we handle exiting properly (SIGTERM might not be needed)
process.on('SIGINT', function() {
  // Leave all voice channels
  Object.keys(queues).forEach(queue =>{
    queues[queue].disconnect(true);
  })
  bot.destroy();
  server.close();
  process.exit();
});
process.on('SIGTERM', function() {
  // Leave all voice channels
  Object.keys(queues).forEach(queue =>{
    queues[queue].disconnect(true);
  })
  bot.destroy();
  server.close();
  process.exit();
});


// Webserver section
app.use(cookieParser());

app.get('/', (req, res) => {
  res.status(200).sendFile(path.join(__dirname, 'public/index.html'));
})
app.get('/version', (req, res) => {
  res.status(200).sendFile(path.join(__dirname, 'public/version.pug'));
})
app.use('/js', express.static('public/js'));
app.get('/clips', (req, res) => {
  randoms = Object.keys(files).filter(key => {
    if (key.match('^[a-z]+[0-9]+$')) { return true; }
  });
  randomList = {};
  randoms.forEach(key => {

    randomList[key.match('^([a-z]+)[0-9]+$')[1]] = true
  });
  randomList = Object.keys(randomList);
  res.status(200).render("clips", {
    files: Object.keys(files).sort(),
    randoms: randomList
  });
})
app.get('/play/:clip', (req, res) => {
  if (req.params.clip in files && req.cookies.discord_session && req.cookies.discord_session.at) {
    accesstoken = req.cookies.discord_session.at;
    headers = {
      'Authorization': 'Bearer '+accesstoken
    }
    request.get('https://discordapp.com/api/users/@me',function(err, r, body){
      if(err) {
        return res.redirect(`/`);
      }
      userid = JSON.parse(body).id;
      queue = get_queue(get_vc_from_userid(userid));
      if(queue) {
        queue.add(files[req.params.clip]);
      }
    })
    .auth(null, null, true, accesstoken)
  }
})

app.get('/random/:clip', (req, res) => {
  if (req.cookies.discord_session && req.cookies.discord_session.at) {
    accesstoken = req.cookies.discord_session.at;
    headers = {
      'Authorization': 'Bearer '+accesstoken
    }
    request.get('https://discordapp.com/api/users/@me',function(err, r, body){
      if(err) {
        return res.redirect(`/`);
      }
      userid = JSON.parse(body).id;
      queue = get_queue(get_vc_from_userid(userid));
      if(queue) {
        queue.add(files[req.params.clip]);
        var filenames = Object.keys(files);
        filenames = filenames.filter(key => {
          if (key.match(`^${req.params.clip}[0-9]+`)) { return true; }
        })
        var clip = filenames[Math.floor(Math.random()*filenames.length)];
        queue.add(files[clip]);
      }
    })
    .auth(null, null, true, accesstoken)
  }
})
app.set('view engine', 'pug')
app.set('views', path.join(__dirname, 'public'));

var server = app.listen(3000, () => console.log('Example app listening on port 3000!'))
app.use('/api/discord', require('./api'));