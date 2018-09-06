const VoiceQueue = require('./VoiceQueue.js');
//const Discord = require('discord.js');
const fs = require('fs');
const request = require('request');
const nconf = require('nconf');

const express = require('express')
const path = require('path');
const app = express()
const cookieParser = require('cookie-parser');

const log = require('./logger.js').errorLog;

const configFile = path.join(__dirname,'config/config.json');

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

var adminUtils = require('./adminUtils.js');

const DiscordBot = require('./discordbot.js')
// TODO: Once all the admin stuff is in a class, this can probably be auto-generated

const discord = new DiscordBot(nconf.get('TOKEN')).connect();

// const token = nconf.get('TOKEN');

// Often seems to break with sub 1-second mp3's
const queues = require('./utils.js').queues;

// Read the Uploads directory, parse out keywords and file mappings
const files = require('./utils.js').files

/////////////////END INITIALIZATION

// TODO: Move all of this to the discordbot class
function botHelp() {
  return `I'm a bot!\n` +
    `You can ask me to make sounds by saying one of the following:\n` +
    `\`${keyWord}${Object.keys(files).sort().join(`\`, \`${keyWord}`)}\`\n` +
    '----\n' +
    'Admins can also use:\n'  +
    `\`!${adminWords[0]} ${adminUtils.get_actions().sort().join(`\`, \`!${adminWords[0]} `)}\``;
}

function get_voice_channel(message) {
  if (message.member && message.member.voiceChannel) {
    return message.member.voiceChannel;
  }

  message.reply("You don't appear to be in a voice channel!");
}

function get_vc_from_userid(user_id) {
  log.debug(`Looking for an active voice channel for ${user_id}`);
  const voiceChannel = discord.guilds.map(guild => guild.members.get(user_id))
    .find(member => !!member && !!member.voiceChannel)
    .voiceChannel;
  log.debug(`Found voice channel ${voiceChannel}`);
  return voiceChannel;
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

// const adminWords = ['bot','soundbot','freddy']
// const keyWord = '$'
// For making these variable in the future
const adminWords = ['sb', 'soundbot']
const keyWord = '!'
var keyInit = keyWord;
if (['$','^','(','['].indexOf(keyInit) > -1) {
  keyInit = `\\${keyWord}`;
}

const adminWordRegex = new RegExp(`^!(${adminWords.join('|')})(.*)$`)
const keyWordRegex = new RegExp(`${keyInit}([a-z0-9_]+)(.*)`)

discord.on('message', message => {
  if (message.author.id == nconf.get('CLIENT_ID')) {
    // Don't talk to yourself
    return;
  }
  const messageText = message.content.toLowerCase();
  // TODO: abstract keyword regex for great maintenance!
  // Also, extract this to an external library - argument parsing sucks.
  const adminMatches = message.content.toLowerCase().match(adminWordRegex);
  const keyWordMatches = message.content.toLowerCase().match(keyWordRegex);
  if (!adminMatches && !keyWordMatches) {
    // GTFO
    log.debug("Not a match")
    return;
  }
  if (adminMatches) {
    log.debug("Admin match");
    const command = adminMatches[2];
    if (!command || command.includes("help")) {
      return message.reply(botHelp());
    }

    if (command.includes("leave")) {
      const voiceChannel = get_voice_channel(message);

      if (voiceChannel) {
        voiceChannel.leave();
      }
      return;
    }

    // Admin area - Keep Out!
    // POTENTIAL PROBLEM: If you haven't joined a voice channel, some admin commands might not work
    // Will have to ensure that we add check logic lower down
    const parameters = command.match(/(\b[\w,]+)/g);
    if (adminUtils.get_actions().indexOf(parameters[0]) > -1
         && adminUtils.check(message, parameters[0])) {
      return adminUtils[parameters.shift()](message, parameters);
    }

    return;
  }
  log.debug("Regular match")
  // If we get here, it wasn't an admin match

  // Time for some audio!
  const voiceChannel = get_voice_channel(message);
  if (!voiceChannel) {
    return;
  }

  const keyword = keyWordMatches[1];

  if (Object.keys(files).indexOf(keyword) > -1) {
    get_queue(voiceChannel).add(files[keyword]);
    return;
  }

  if (keyword == 'random') {
    const parameters = keyWordMatches[2].match(/(\b[\w,]+)/g);

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
  log.debug(`Unrecognized command: ${messageText}`);
});

log.debug("Let the fun begin!");

// Make sure we handle exiting properly (SIGTERM might not be needed)
process.on('SIGINT', () => {
  log.debug("Shutting down from SIGINT");
  discord.destroy();
  if (nconf.get('WEBSERVER_ENABLED')) {
    server.close();
  }
  process.exit();
});

process.on('SIGTERM', () => {
  log.debug("Shutting down from SIGTERM");
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
app.use('/logs', express.static('logs'));

app.get('/clips', (req, res) => {
  const randomList = Object.keys(files)
    .map(key => key.match(/^([a-z]+)[0-9]+$/))
    .filter(match => !!match)
    .map(match => match[1])
    .filter((element, pos, arr) => {
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

    log.debug(`Got request to play: ${req.params.clip}`);

    request.get('https://discordapp.com/api/users/@me', (err, r, body) => {
      if (err) {
        return res.redirect(`/`);
      }

      const userid = JSON.parse(body).id;
      const queue = get_queue(get_vc_from_userid(userid));
      if (queue) {
        log.debug(get_vc_from_userid(userid))
        queue.add(files[req.params.clip]);
        return res.status(200).end();
      }

      log.debug(`Failed to find voice channel for ${user_id}`);
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

    log.debug(`Got request to play random: ${req.params.clip}`);

    request.get('https://discordapp.com/api/users/@me', (err, r, body) => {
      if (err) {
        return res.redirect(`/`);
      }

      const userid = JSON.parse(body).id;
      const queue = get_queue(get_vc_from_userid(userid));
      if (queue) {
        const filenames = Object.keys(files).filter(key => !!key.match(`${req.params.clip}[0-9]+`));
        const clip = select_random(filenames);
        queue.add(files[clip]);
        return res.status(200).end();
      }

      log.debug(`Failed to find voice channel for ${user_id}`);
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
  var server = app.listen(nconf.get('PORT'), () => log.debug(`Web UI available on port ${nconf.get('PORT')}!`))
}
