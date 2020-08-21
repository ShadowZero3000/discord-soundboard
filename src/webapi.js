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

async function refreshSession(req, res, callback, session_cookie) {
  if ( !req.cookies.discord_session
    || !req.cookies.discord_session.at
    || new Date().getTime() > req.cookies.discord_session.refresh_by ) {
    accessLog.info(`Expired session, attempting refresh`);
    return await refreshDiscordSession(req, res, callback, session_cookie)
  }
  return true;
}

async function refreshDiscordSession(req, res, callback, session_cookie) {
  var refreshToken
  try {
    refreshToken = req.cookies.discord_session.rt;
  } catch (e){
    res.status(403).send("Session expired, please log back in");
    return false;
  }
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
    log.debug(`Error from discord: ${err}`);
    res.cookie('discord_session', {}, {
      maxAge: 7*24*60*60*1000, httpOnly: true
    });
    res.status(403).send("Session expired, please log back in");
    return false
  });

  const json = await response.json();
  if (json.error) {
    // Possible this leaks non-user data. Not going to worry right now.
    res.status(400).send(`Error from discord: ${json.error}`)
    return false
  }

  const session = {
    'at': json.access_token,
    'rt': json.refresh_token,
    'refresh_by': new Date().getTime() + 3*24*60*60*1000
  };

  // Expire ours one day sooner than discord's, which is 7 days normally
  session_cookie['value'] = session
  session_cookie['updated'] = true
  return true
}

router.get('/discord/login', (req, res) => {
  const redirect = getRedirect(req);
  res.redirect(`https://discordapp.com/oauth2/authorize?client_id=${nconf.get('CLIENT_ID')}&scope=identify&response_type=code&redirect_uri=${redirect}`);
});

router.get('/discord/callback', async (req, res) => {
  if (!req.query.code) {
    throw new Error('NoCodeProvided');
  }
  const redirect = getRedirect(req);

  const code = req.query.code;

  const params = new URLSearchParams({
    'client_id': nconf.get('CLIENT_ID'),
    'client_secret': nconf.get('CLIENT_SECRET'),
    'grant_type': 'authorization_code',
    'code': code,
    'redirect_uri': decodeURIComponent(redirect),
    'scope': 'identify guilds'
  });
  const response = await fetch(`https://discordapp.com/api/oauth2/token`, {
    method: 'POST',
    body: params
  });

  const json = await response.json();
  const session = {
    'at': json.access_token,
    'rt': json.refresh_token,
    'refresh_by': new Date().getTime() + 3*24*60*60*1000
  };
  // maxAge is milliseconds
  res.cookie('discord_session', session, {
    maxAge: 7*24*60*60*1000, httpOnly: true
  });

  return res.redirect(`/clips`);
});

router.get('/play/:clip', async (req, res) => {
  accessLog.info(`Request received via gui to play: ${req.params.clip}`);
  var session_cookie = { 'updated': false }
  const validSession = await refreshSession(req, res, 'play', session_cookie)
  if (!validSession){ return; }
  if (fm.inLibrary(req.params.clip)) {
    var accesstoken = req.cookies.discord_session.at;
    if(session_cookie['updated']) {
      accesstoken = session_cookie['value']['at']
    }
    const headers = {
      'Authorization': 'Bearer ' + accesstoken
    }
    log.debug(`Got request to play: ${req.params.clip}`);

    request.get('https://discordapp.com/api/users/@me', (err, r, body) => {
      if (err) {
        log.debug("Got an error asking for user details")
        return res.redirect(`/`);
      }

      if(r.statusCode != 200) {
        var msg;
        try {
          msg = JSON.parse(body).message;
        } catch(e) {
          msg = "Not parsable"
        }
        return res.status(500).send("Discord server error: " + msg);
      }
      try {
        const userid = JSON.parse(body).id;
        const queue = vqm.getQueueFromUser(discord.client, userid);
        const user = queue.channel.guild.members.cache.get(userid);

        if(session_cookie['updated']) {
          res.cookie('discord_session', session_cookie.value, {
            maxAge: 7*24*60*60*1000, httpOnly: true
          })
        }
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

router.get('/random/:clip', async (req, res) => {
  var session_cookie = { 'updated': false }
  const validSession = await refreshSession(req, res, 'random', session_cookie)
  if (!validSession){ return; }
  if (fm.inRandoms(req.params.clip)) {
    var accesstoken = req.cookies.discord_session.at;
    if(session_cookie['updated']) {
      accesstoken = session_cookie['value']['at']
    }
    const headers = {
      'Authorization': 'Bearer ' + accesstoken
    }

    log.debug(`Got request to play random: ${req.params.clip}`);

    request.get('https://discordapp.com/api/users/@me', (err, r, body) => {
      if (err) {
        return res.redirect(`/`);
      }

      if(session_cookie['updated']) {
        res.cookie('discord_session', session_cookie.value, {
          maxAge: 7*24*60*60*1000, httpOnly: true
        })
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
        const user = queue.channel.guild.members.cache.get(userid);
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

router.get('/clips/random', (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    return res.status(200)
       .send(JSON.stringify(fm.getRandomList()));
  } catch(e) {
    return res.status(404).send("Failure"+e)
  }
});

module.exports = router;
