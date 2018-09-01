const express = require('express');
const btoa = require('btoa');
const fetch = require('node-fetch');
const router = express.Router();
const nconf = require('nconf');
const path = require('path');

var configFile = path.join(__dirname,'config/config.json');
nconf.argv()
  .env()
  .file({file: configFile})
  .defaults({
    CALLBACK_HOST: 'https://soundboard.codethat.rocks'
  })
var CLIENT_ID = nconf.get('CLIENT_ID');
var CLIENT_SECRET = nconf.get('CLIENT_SECRET');
var callback_host = nconf.get('CALLBACK_HOST');
var redirect = encodeURIComponent(callback_host+'/api/discord/callback');

router.get('/login', (req, res) => {
  res.redirect(`https://discordapp.com/oauth2/authorize?client_id=${CLIENT_ID}&scope=identify&response_type=code&redirect_uri=${redirect}`);
});

router.get('/callback', async (req, res) => {
  if (!req.query.code) throw new Error('NoCodeProvided');
  const code = req.query.code;
  const creds = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
  const response = await fetch(`https://discordapp.com/api/oauth2/token?grant_type=authorization_code&code=${code}&redirect_uri=${redirect}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
      },
    });

  const json = await response.json();
  var session = {
  	'at': json.access_token,
  	'rt': json.refresh_token
  };
  res.cookie('discord_session', session, {
  	maxAge: 9000000, httpOnly: true
  });
  res.redirect(`/clips`);
});

module.exports = router;

