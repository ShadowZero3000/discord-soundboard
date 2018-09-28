
const cookieParser = require('cookie-parser');
const discord = require('./DiscordBot.js');
const express = require('express');
const log = require('./logger.js').errorLog;
const accessLog = require('./logger.js').accessLog;
const path = require('path');
const request = require('request');
const utils = require('./utils.js');
const fm = require('./FileManager');

const app = express();

app.use(cookieParser());
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'public'));

app.get('/', (req, res) => {
  if ( req.cookies.discord_session && req.cookies.discord_session.at) {
    return res.redirect('/clips');
  }
  return res.status(200).render(path.join(__dirname, 'public/index.pug'));
});

app.use('/js', express.static('public/js'));
app.use('/logs', express.static('logs'));
app.use('/api/discord', require('./webapi.js'));

app.get('/version', (req, res) => {
  res.status(200).sendFile(path.join(__dirname, 'public/version.pug'));
});

function refreshSession(req, res) {
  if ( !req.cookies.discord_session || !req.cookies.discord_session.at) {
    accessLog.info(`Invalid session, attempting refresh`);
    res.redirect(`/api/discord/refresh?callback=/play/${req.params.clip}`);
    return false;
  }
  return true;
}

app.get('/clips', (req, res) => {
  res.status(200).render("clips", {
    files: fm.getClipList(),
    randoms: fm.getRandomList(),
    categories: fm.getCategorizedFiles()
  });
});

app.get('/play/:clip', (req, res) => {
  accessLog.info(`Request received via gui to play: ${req.params.clip}`);
  if (!refreshSession(req, res)){ return; }

  if (fm.inLibrary(req.params.clip)) {
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
      const queue = utils.getQueueFromUser(discord.client, userid);
      if (queue) {
        queue.add(req.params.clip);
        return res.status(200).end();
      }

      log.debug(`Failed to find voice channel for ${userId}`);
      return res.status(404).send("Couldn't find a voice channel for user");
    })
    .auth(null, null, true, accesstoken);
  }
});

app.get('/random/:clip', (req, res) => {
  if (!refreshSession(req, res)){ return; }
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
      const queue = utils.getQueueFromUser(discord.client, userid);
      if (queue) {
        queue.add(fm.random(req.params.clip));
        return res.status(200).end();
      }

      log.debug(`Failed to find voice channel for ${userId}`);
      return res.status(404).send("Couldn't find a voice channel for user");
    })
    .auth(null, null, true, accesstoken);
  }
});

module.exports = app
