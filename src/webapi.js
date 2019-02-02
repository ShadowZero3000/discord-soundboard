const accessLog = require('./logger.js').accessLog;
const btoa = require('btoa');
const express = require('express');
const fetch = require('node-fetch');
const log = require('./logger.js').errorLog;
const nconf = require('nconf');
const { URLSearchParams } = require('url');

const am = require('./AccessManager');
const discord = require('./DiscordBot.js');
const fm = require('./FileManager');
const request = require('request');
const router = express.Router();
const vqm = require('./VoiceQueueManager');

function getRedirect(req) {
  return encodeURIComponent(`${req.protocol}://${req.headers.host}/api/discord/callback`);
}

function refreshSession(req, res) {
  if ( !req.cookies.discord_session || !req.cookies.discord_session.at) {
    accessLog.info(`Invalid session, attempting refresh`);
    res.redirect(`/api/discord/refresh?callback=/play/${req.params.clip}`);
    return false;
  }
  return true;
}

router.get('/discord/login', (req, res) => {
  const redirect = getRedirect(req);
  res.redirect(`https://discordapp.com/oauth2/authorize?client_id=${nconf.get('CLIENT_ID')}&scope=identify&response_type=code&redirect_uri=${redirect}`);
});

router.get('/discord/callback', async (req, res) => {
  if (!req.query.code) {
    throw new Error('NoCodeProvided');
  }
  const redirect = getRedirect(req); // encodeURIComponent(`${proto}${req.headers.host}/api/discord/callback`);

  const code = req.query.code;
  const credentials = btoa(`${nconf.get('CLIENT_ID')}:${nconf.get('CLIENT_SECRET')}`);
  const response = await fetch(`https://discordapp.com/api/oauth2/token?grant_type=authorization_code&code=${code}&redirect_uri=${redirect}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
    }
  });

  const json = await response.json();
  const session = {
    'at': json.access_token,
    'rt': json.refresh_token
  };
  // maxAge is milliseconds
  res.cookie('discord_session', session, {
    maxAge: 14*24*60*60*1000, httpOnly: true
  });

  res.redirect(`/clips`);
});

router.get('/discord/refresh', async (req, res) => {
  if (!req.cookies.discord_session || !req.cookies.discord_session.rt) {
    return res.status(403).send("Session expired, please log back in");
  };

  const refreshToken = req.cookies.discord_session.rt;
  const form = new URLSearchParams({
    'client_id': nconf.get('CLIENT_ID'),
    'client_secret': nconf.get('CLIENT_SECRET'),
    'grant_type': 'refresh_token',
    'refresh_token': refreshToken
  });

  const response = await fetch(`https://discordapp.com/api/oauth2/token?redirect_uri=${getRedirect(req)}`, {
    method: 'POST',
    body: form
  }).catch(err => {
    log.debug(`error from discord: ${err}`);
    res.cookie('discord_session', {}, {
      maxAge: 9000000, httpOnly: true
    });
    return res.status(403).send("Session expired, please log back in");
  });

  const json = await response.json();
  if (json.error) {
    // Possible this leaks non-user data. Not going to worry right now.
    return res.status(400).send(`Error from discord: ${json.error}`)
  }

  const session = {
    'at': json.access_token,
    'rt': json.refresh_token
  };

  res.cookie('discord_session', session, {
    maxAge: 9000000, httpOnly: true
  });

  if(req.query.callback) {
    return res.redirect(req.query.callback);
  }
  return res.redirect(`/clips`);
});

router.get('/play/:clip', (req, res) => {
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

      if(r.statusCode != 200) {
        var msg;
        try {
          msg = JSON.parse(body).message;
        } catch(e) {
          msg = "Not parsable"
        }
        return res.status(500).send("Server error: " + msg);
      }
      try {
        const userid = JSON.parse(body).id;
        const queue = vqm.getQueueFromUser(discord.client, userid);
        const user = queue.channel.guild.members.get(userid);
        if (am.checkAccess(user, queue.channel.guild, 'play')) {
          queue.add(req.params.clip);
          return res.status(200).end();
        } else {
          return res.status(403).send("Play permission not available on your current server.");
        }
      } catch (e) {
        log.debug("Error: " + e.message);
        return res.status(404).send("Couldn't find a voice channel for you where I'm available");
      }
    })
    .auth(null, null, true, accesstoken);
  }
});

router.get('/random/:clip', (req, res) => {
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

      if(r.statusCode != 200) {
        var msg;
        try {
          msg = JSON.parse(body).message;
        } catch(e) {
          msg = "Not parsable"
        }
        return res.status(500).send("Server error: " + msg);
      }
      try {
        const userid = JSON.parse(body).id;
        const queue = vqm.getQueueFromUser(discord.client, userid);
        const user = queue.channel.guild.members.get(userid);
        if (am.checkAccess(user, queue.channel.guild, 'play')) {
          queue.add(fm.random(req.params.clip));
          return res.status(200).end();
        } else {
          return res.status(403).send("Play permission not available on your current server.");
        }
      } catch(e) {
        return res.status(404).send("Couldn't find a voice channel for you where I'm available");
      }
    })
    .auth(null, null, true, accesstoken);
  }
});

router.get('/clips', (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200)
       .send(JSON.stringify(fm.getCategorizedFiles()));
  } catch(e) {
    return res.status(404).send("Failure"+e)
  }
});

module.exports = router;
