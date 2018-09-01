const VoiceQueue = require('./VoiceQueue.js');
const Discord = require('discord.js');
const fs = require('fs');
const request = require('request');
const nconf = require('nconf');

const express = require('express')
const path = require('path');
const app = express()
const cookieParser = require('cookie-parser');

const configFile = path.join(__dirname,'config/config.json');

// TODO: Once all the admin stuff is in a class, this can probably be auto-generated
const ADMIN_ACTIONS = {
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

nconf.argv()
  .env()
  .file({file: configFile})
  .defaults({
    startup: {
      enabled: false,
      clip: 'sensors'
    },
    adminList: {},
    PORT: 3000,
    WEBSERVER_ENABLED: 'true'
  });

function saveConfig(key, value) {
  console.log(`Saving config key: ${key}, value: ${value}`);
  nconf.set(key, value);
  nconf.save(err => {
    fs.readFile(configFile, (err, data) => {
      data = data || {};
      console.dir(JSON.parse(data.toString()));
    })
  });
}

const token = nconf.get('TOKEN');
const adminList = nconf.get('adminList');

// Often seems to break with sub 1-second mp3's
const discord = new Discord.Client();
const queues = {};

// Read the Uploads directory, parse out keywords and file mappings
const items = fs.readdirSync('./Uploads/');
const files = {};
items.forEach(item => {
  const matches = item.match(/^([^-]+)--(.*)$/);
  if (matches) {
    files[matches[1]] = `./Uploads/${matches[0]}`;
  }
});

/////////////////END INITIALIZATION

function botHelp() {
  return
`I'm a bot!
You can ask me to make sounds by saying one of the following:
\`!${Object.keys(files).sort().join('`, `!')}\`
----
Admins can also use:
\`!soundboard ${Object.keys(ADMIN_ACTIONS).sort().join('`, `!soundboard ')}\``;
}

// TODO: Move all the admin stuff into its own class/file
function auth_check(message, access) {
  return (adminList[message.author.id]
      && adminList[message.author.id]['access'].indexOf(access) > -1);
}

function add_clip(message, params) {
  if (!params) {
    return;
  }

  const prefix = params[0];
  if (!prefix.match(/^[a-z0-9_]+$/)) {
    message.reply(`${prefix} is a bad short name`);
  }

  if (message.attachments) {
    // Only check the first attachment
    const a = message.attachments.first();
    const filename = `./Uploads/${prefix}--${a.filename}`;

    console.log(`Writing attachment to file: ${filename}`);
    request(a.url).pipe(fs.createWriteStream(filename));

    files[prefix] = filename;
    message.reply(`!${prefix} is now available`);
  }
}

function remove_clip(message, params) {
  if (!params || !(params[0] in Object.keys(files))) {
    return;
  }

  const clipName = params[0];
  console.log(`Deleting: ${files[clipName]}`);

  fs.unlink(files[clipName], err => {
    if (err) {
      console.log(err);
      return;
    }

    delete files[clipName];
    console.log("Deleted successfully");
    message.reply(`${clipName} removed`);
  });
}

function get_voice_channel(message) {
  if (message.member && message.member.voiceChannel) {
    return message.member.voiceChannel;
  }

  message.reply("You don't appear to be in a voice channel!");
}

function silence(message, params) {
  const vc = get_voice_channel(message);
  if (vc) {
    queues[vc.id].silence();
  }
}

function unsilence(message, params) {
  const vc = get_voice_channel(message);
  if (vc) {
    queues[vc.id].unsilence();
  }
}

function get_user(message) {
  return message.channel.guild.members.find(a => {
    return a.user['username'].toLowerCase() == username.toLowerCase();
  });
}

function access_add(message, params) {
  if (!params) {
    message.reply("Not enough details to add access");
    return;
  }

  const username = params[0];
  let access = params[1];
  const discord_user = get_user(message);

  if (discord_user && access) {
    console.log(`Updating: ${username} with ${access}`);
    access = access.split(',').map(operation => operation.trim());
    const userId = discord_user.user.id;

    if (!(userId in adminList)) {
      console.log("New user")
      adminList[userId] = {'access': access, 'immune': false};
    } else {
      console.log("Additional permissions")
      adminList[userId]['access'] = [...access, ...adminList[userId]['access']];
    }

    print_access(message, username, userId);
    saveConfig('adminList', adminList);
  }
}

function access_remove(message, params) {
  if (!params) {
    message.reply("Not enough details to remove access");
    return;
  }

  const username = params[0];
  const access = params[1];
  const discord_user = get_user(message);

  if (discord_user && access && adminList[discord_user.user.id]) {
    const user = adminList[discord_user.user.id];

    if (user['immune']) {
      message.reply(`${username} is immune to revokes`);
      return;
    }

    user['access'] = user['access'].filter((value, index, arr) => {
      return access.split(',').indexOf(value) < 0;
    });

    print_access(message, username, discord_user.user.id);
    saveConfig('adminList', adminList);
  }
}

function access_show(message, params) {
  if (!params) {
    message.reply("Not enough details to show access");
    return;
  }

  const username = params[0];
  const discord_user = get_user(message);
  if (discord_user && adminList[discord_user.user.id]) {
    print_access(message, username, discord_user.user.id);
  }
}

function toggle_startup(message, params) {
  let startup = nconf.get('startup');
  startup['enabled'] = !startup['enabled'];
  saveConfig('startup', startup);
  message.reply(`Startup audio set: ${startup['enabled']}`);
}

function print_access(message, user, id) {
  message.reply(`${user} now has: ${adminList[id]['access'].join(', ')}`);
}

function get_vc_from_userid(user_id) {
  const user = discord.users.get(user_id);
  const activeGuild = discord.guilds.find(guild => guild._rawVoiceStates.get(user_id));

  if (user && activeGuild) {
    return activeGuild.members.get(user_id).voiceChannel;
  }

  return;
}

function get_queue(vc) {
  if (!vc) {
    // TODO: This will misbehave, need to throw?
    return;
  }

  if (!queues[vc.id]) {
    queues[vc.id] = new VoiceQueue(vc);
  }

  return queues[vc.id];
}

function select_random(collection) {
  if (!collection.length) {
    return;
  }

  return collection[Math.floor(Math.random() * collection.length)];
}

discord.on('message', message => {
  const messageText = message.content.toLowerCase();
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

  // TODO: abstract keyword regex for great maintenance!
  // Also, extract this to an external library - argument parsing sucks.
  const matches = message.content.toLowerCase().match(/^!(soundboard|sb|[a-z0-9_]+)(.*)$/);
  if (!matches) {
    // We aren't being addressed, gtfo!
    return;
  }

  if (matches[1].includes("sb") || matches[1].includes("soundboard")) {
    // Bot command, let's go!

    const command = matches[2];
    if (!command || command.includes("help")) {
      message.reply(botHelp());
    }

    if (command.includes("leave")) {
      const voiceChannel = get_voice_channel(message);

      if (voiceChannel) {
        voiceChannel.leave();
      }
    }

    // Admin area - Keep Out!
    // POTENTIAL PROBLEM: If you haven't joined a voice channel, some admin commands might not work
    // Will have to ensure that we add check logic lower down
    const parameters = command.match(/(\b[\w,]+)/g);
    if (parameters[0] in Object.keys(ADMIN_ACTIONS) && auth_check(message, parameters[0])) {
        ADMIN_ACTIONS[parameters.shift()](message, parameters);
    }

    return;
  }

  // Time for some audio!
  const voiceChannel = get_voice_channel(message);
  if (!voiceChannel) {
    return;
  }

  const keyword = matches[1];

  if (Object.keys(files).indexOf(keyword) > -1) {
    get_queue(voiceChannel).add(files[keyword]);
    return;
  }

  if (keyword == 'random') {
    const parameters = matches[2].match(/(\b[\w,]+)/g);

    if (!parameters) {
      const clip = select_random(Object.keys(files));
      get_queue(voiceChannel).add(files[clip]);
      return;
    }

    const filenames = Object.keys(files).filter(key => key.includes(parameters[0]));
    const clip = select_random(filenames);
    get_queue(voiceChannel).add(files[clip]);
    return;
  }

  // Err.. They asked for something we don't have
  console.log(`Unrecognized command: ${messageText}`);
});

discord.login(token).then(session => {
  //TODO: Make the join noise configurable and optional
  //TODO: Make this not choke if you provide an invalid admin_id or aren't in a channel
  var startup = nconf.get('startup');
  discord.fetchApplication().then(obj => {
    nconf.set('CLIENT_ID', obj.id); //Overrides environment variables
    var startup = nconf.get('startup');
    adminList[obj.owner.id] = {
      'access': Object.keys(ADMIN_ACTIONS),
      'immune': true
    };
    if (startup.enabled) {
      get_queue(get_vc_from_userid(obj.owner.id))
        .add(files[startup.clip]);
    }
  })
});

console.log("Let the fun begin!");

// Make sure we handle exiting properly (SIGTERM might not be needed)
process.on('SIGINT', () => {
  console.log("Shutting down from SIGINT");
  discord.destroy();
  if (nconf.get('WEBSERVER_ENABLED')) {
    server.close();
  }
  process.exit();
});

process.on('SIGTERM', () => {
  console.log("Shutting down from SIGTERM");
  discord.destroy();
  if (nconf.get('WEBSERVER_ENABLED')) {
    server.close();
  }
  process.exit();
});

// Webserver section
app.use(cookieParser());

app.get('/', (req, res) => {
  res.status(200).sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/version', (req, res) => {
  res.status(200).sendFile(path.join(__dirname, 'public/version.pug'));
});

app.use('/js', express.static('public/js'));

app.get('/clips', (req, res) => {
  const randomList = Object.keys(files)
    .map(key => key.match(/^([a-z]+)[0-9]+$/))
    .filter(match => !!match)
    .map(match => match[1])
    .filter((element,pos,arr) => {
      // Unique filter
      return arr.indexOf(element) == pos;
    })
    .sort();

  res.status(200).render("clips", {
    files: Object.keys(files).sort(),
    randoms: randomList
  });
});

app.get('/play/:clip', (req, res) => {
  if (req.params.clip in files && req.cookies.discord_session && req.cookies.discord_session.at) {
    const accesstoken = req.cookies.discord_session.at;
    const headers = {
      'Authorization': 'Bearer ' + accesstoken
    }

    request.get('https://discordapp.com/api/users/@me', (err, r, body) => {
      if (err) {
        return res.redirect(`/`);
      }

      const userid = JSON.parse(body).id;
      const queue = get_queue(get_vc_from_userid(userid));
      if (queue) {
        queue.add(files[req.params.clip]);
        return res.status(200).end();
      }

      return res.status(404).send("Couldn't find a voice channel for user");
    })
    .auth(null, null, true, accesstoken);
  }
});

app.get('/random/:clip', (req, res) => {
  if (req.cookies.discord_session && req.cookies.discord_session.at) {
    const accesstoken = req.cookies.discord_session.at;
    const headers = {
      'Authorization': 'Bearer ' + accesstoken
    }

    request.get('https://discordapp.com/api/users/@me', (err, r, body) => {
      if (err) {
        return res.redirect(`/`);
      }

      const userid = JSON.parse(body).id;
      const queue = get_queue(get_vc_from_userid(userid));
      if (queue) {
        queue.add(files[req.params.clip]);
        const filenames = Object.keys(files).filter(key => !!key.match(`${req.params.clip}[0-9]+`));
        const clip = select_random(filenames);
        queue.add(files[clip]);
        res.status(200).end();
        return;
      }

      return res.status(404).send("Couldn't find a voice channel for user");
    })
    .auth(null, null, true, accesstoken);
  }
});

app.set('view engine', 'pug');

app.set('views', path.join(__dirname, 'public'));

app.use('/api/discord', require('./api'));

if (nconf.get('WEBSERVER_ENABLED')) {
  app.enable('trust proxy');
  var server = app.listen(nconf.get('PORT'), () => console.log(`Web UI available on port ${nconf.get('PORT')}!`))
}