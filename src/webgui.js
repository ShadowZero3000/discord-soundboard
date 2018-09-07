
const cookieParser = require('cookie-parser');
const discord = require('./DiscordBot2.js');
const express = require('express');
const log = require('./logger.js').errorLog;
const path = require('path');
const request = require('request');
const utils = require('./utils.js');

const app = express();

app.use(cookieParser());
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'public'));

app.get('/', (req, res) => {
  res.status(200).sendFile(path.join(__dirname, 'public/index.html'));
});

app.use('/js', express.static('public/js'));
app.use('/logs', express.static('logs'));
app.use('/api/discord', require('./webapi.js'));

app.get('/version', (req, res) => {
  res.status(200).sendFile(path.join(__dirname, 'public/version.pug'));
});

app.get('/clips', (req, res) => {
  const randomList = Object.keys(utils.files)
    .map(key => key.match(/^([a-z]+)[0-9]+$/))
    .filter(match => !!match)
    .map(match => match[1])
    .filter((element, pos, arr) => {
      // Unique filter
      return arr.indexOf(element) == pos;
    })
    .sort();

  res.status(200).render("clips", {
    files: Object.keys(utils.files).sort(),
    randoms: randomList
  });
});

app.get('/play/:clip', (req, res) => {
  if (req.params.clip in utils.files && req.cookies.discord_session && req.cookies.discord_session.at) {
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
        queue.add(utils.files[req.params.clip]);
        return res.status(200).end();
      }

      log.debug(`Failed to find voice channel for ${userId}`);
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
      const queue = utils.getQueueFromUser(discord.client, userid);
      if (queue) {
        const filenames = Object.keys(utils.files).filter(key => !!key.match(`${req.params.clip}[0-9]+`));
        const clip = utils.selectRandom(filenames);
        queue.add(utils.files[clip]);
        return res.status(200).end();
      }

      log.debug(`Failed to find voice channel for ${userId}`);
      return res.status(404).send("Couldn't find a voice channel for user");
    })
    .auth(null, null, true, accesstoken);
  }
});

module.exports = app