const express = require('express');
const btoa = require('btoa');
const fetch = require('node-fetch');
const { URLSearchParams } = require('url');
const router = express.Router();
const nconf = require('nconf');
const log = require('./logger.js').errorLog;
function getRedirect(req) {
  return encodeURIComponent(`${req.protocol}://${req.headers.host}/api/discord/callback`);
}
router.get('/login', (req, res) => {
  const redirect = getRedirect(req);
  res.redirect(`https://discordapp.com/oauth2/authorize?client_id=${nconf.get('CLIENT_ID')}&scope=identify&response_type=code&redirect_uri=${redirect}`);
});

router.get('/callback', async (req, res) => {
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

  res.cookie('discord_session', session, {
    maxAge: 9000000, httpOnly: true
  });

  res.redirect(`/clips`);
});

router.get('/refresh', async (req, res) => {
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
  if (!json.error) {
    const session = {
      'at': json.access_token,
      'rt': json.refresh_token
    };

    res.cookie('discord_session', session, {
      maxAge: 9000000, httpOnly: true
    });
  }
  if(req.query.callback) {
    return res.redirect(req.query.callback);
  }
  return res.redirect(`/clips`);
});

module.exports = router;
