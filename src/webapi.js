import { accessLog, errorLog } from './logger.js'
const log = errorLog

import * as express from 'express'
import fetch from 'node-fetch'

import Config from './Config.js'
import { URLSearchParams } from 'url'

import AccessManager from './AccessManager.js'
const am = AccessManager.getInstance()

import DiscordBot from './DiscordBot.js'

import FileManager from './FileManager.js'
const fm = FileManager.getInstance()

import request from 'request'
const router = express.Router();

import VoiceQueueManager from './VoiceQueueManager.js'
const vqm = VoiceQueueManager.getInstance()

import rsdb from 'rocket-store'
import SessionStore from './SessionStore.js'

import { REST } from 'discord.js'

// TODO: Move all of the discord session token stuff into memory, instead have a client session between us and the user
// that we map that session to. We can then automate the refresh of tokens

function getRedirect(req) {
  return encodeURIComponent(`${req.protocol}://${req.headers.host}/api/discord/callback`);
}

async function refreshSession(req, res, callback) {
  if ( !req.session.discord_session
    || !req.session.discord_session.at
    || new Date().getTime() > req.session.discord_session.refresh_by ) {
    accessLog.info(`Expired session, attempting refresh`);
    return await refreshDiscordSession(req, res, callback)
  }
  return true;
}

async function backgroundRefresh(session_id, session) {
  const current_time = new Date().getTime()
  if ( session.discord_session
    && session.discord_session.at
    && current_time > session.discord_session.refresh_by
    && current_time < new Date(session.cookie.expires).getTime()
    ) {

    log.debug("Session renewal needed")
    await refreshDiscordSession({session: session})
    return session
  }
  return null
}

// This loops through all the discord sessions we have
// and renews them if they can be renewed
async function refreshAllDiscordSessions() {
  var ss = SessionStore.getInstance()
  rsdb.options({data_storage_area: "./rsdb"})

  const resolve = await rsdb.get('session')
  if (resolve.key != null) {
    log.debug(`Beginning refresh of Discord ${resolve.key.length} sessions`)

    resolve.key.forEach((session_id) => {
      ss.get(session_id, (error, session) => {
        backgroundRefresh(session_id, session)
          .then((result) => {
            if (result != null) {
              ss.set(session_id, result)
            }
          })
      })
    })
  }
}

function updateSessionData(req, data) {
  const session = {
    'at': data.access_token,
    'rt': data.refresh_token,
    'refresh_by': new Date().getTime() + 3*24*60*60*1000
  };

  req.session.active = true
  req.session.discord_session = session
}

function generateRefreshForm(refreshToken) {
  return new URLSearchParams({
    'client_id': Config.get('CLIENT_ID'),
    'client_secret': Config.get('CLIENT_SECRET'),
    'grant_type': 'refresh_token',
    'refresh_token': refreshToken
  });
}

async function refreshDiscordSession(req, res, callback) {
  var refreshToken
  try {
    refreshToken = req.session.discord_session.rt;
  } catch (e){
    log.debug("Session truly expired")
    if(res!==undefined){
      req.session.destroy()
      res.status(403).send("Session expired, please log back in")
    }
    return false;
  }

  const response = await fetch(`https://discord.com/api/oauth2/token`, { // ?redirect_uri=${getRedirect(req)}`, {
    method: 'POST',
    body: generateRefreshForm(refreshToken)
  }).catch(err => {
    log.debug(`Error from discord during refresh api call: ${err}`);
    if(res!==undefined){
      req.session.destroy()
      res.status(403).send("Session expired, please log back in")
    } else {
      log.debug(`Error during background refresh: ${res.body}`)
    }
    return false
  });

  const json = await response.json();
  if (json.error) {
    if(res!==undefined){
      log.debug(`Error from discord during parsing of results of refresh call: ${json.error}`)
      req.session.destroy()
      // Possible this leaks non-user data. Not going to worry right now.
      res.status(400).send(`Error from discord during parsing resuls of refresh call: ${json.error}`)
    } else {
      log.debug(`Error from discord during background refresh: ${json.error}`)
    }
    return false
  }

  updateSessionData(req, json)
  log.debug(`Session successfully refreshed`)
  return true
}

router.get('/discord/login', (req, res) => {
  const redirect = getRedirect(req);
  res.redirect(`https://discordapp.com/oauth2/authorize?client_id=${Config.get('CLIENT_ID')}&scope=identify&response_type=code&redirect_uri=${redirect}`);
});

router.get('/discord/callback', async (req, res) => {
  if (!req.query.code) {
    throw new Error('NoCodeProvided');
  }
  const redirect = getRedirect(req);

  const code = req.query.code;

  const params = new URLSearchParams({
    'client_id': Config.get('CLIENT_ID'),
    'client_secret': Config.get('CLIENT_SECRET'),
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

  req.session.active = true
  req.session.discord_session = session

  return res.redirect(`/clips`);
});

import {Routes} from 'discord.js'
router.get('/play/:clip', async (req, res) => {
  accessLog.info(`Request received via gui to play: ${req.params.clip}`);
  const validSession = await refreshSession(req, res, 'play')
  if (!validSession){ return; }

  if (fm.inLibrary(req.params.clip)) {
    // Use a user-token for REST
    const rest = new REST({ version: '10', authPrefix: 'Bearer'}).setToken(req.session.discord_session.at)

    log.debug(`Got request to play: ${req.params.clip}`);

    const discord = DiscordBot.getInstance();

    rest.get(Routes.user())
      .then((data) => {
        const userid = data.id
        const queue = vqm.getQueueFromUser(userid);
        const user = queue.channel.guild.members.cache.get(userid);

        if (am.checkAccess(user, queue.channel.guild, 'play')) {
          queue.add(req.params.clip);
          return res.status(200).end();
        } else {
          return res.status(403).send("Play permission not available on your current server.");
        }
      })
      .catch((err) =>{
        return res.status(400).send(err.message)
      });
  }
});

router.get('/random/:clip', async (req, res) => {
  const validSession = await refreshSession(req, res, 'random')
  if (!validSession){ return; }
  if (fm.inRandoms(req.params.clip)) {
    // Use a user-token for REST
    const rest = new REST({ version: '10', authPrefix: 'Bearer'}).setToken(req.session.discord_session.at)

    log.debug(`Got request to play random: ${req.params.clip}`);

    const discord = DiscordBot.getInstance();

    rest.get(Routes.user())
      .then((data) => {
        const userid = data.id
        const queue = vqm.getQueueFromUser(userid);
        const user = queue.channel.guild.members.cache.get(userid);

        if (am.checkAccess(user, queue.channel.guild, 'play')) {
          queue.add(fm.random(req.params.clip));
          return res.status(200).end();
        } else {
          return res.status(403).send("Play permission not available on your current server.");
        }
      })
      .catch((err) =>{
        log.debug(err.message, err.stack)
        return res.status(400).send(err.message)
      });
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

// Renew Discord sessions in the background every 6 hours
// This prevents us from ever having a user's discord session expire
// Though their session with us may
setInterval(refreshAllDiscordSessions, 1000 * 60 * 6)

export { router };
