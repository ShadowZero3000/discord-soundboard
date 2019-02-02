
const cookieParser = require('cookie-parser');
const express = require('express');
const log = require('./logger.js').errorLog;
const accessLog = require('./logger.js').accessLog;
const path = require('path');
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

app.get('/logout', (req, res) => {
  res.cookie('discord_session', {}, {
    maxAge: 1000, httpOnly: true
  });
  return res.redirect('/');
});

app.use('/css', express.static('public/css'));
app.use('/js', express.static('public/js'));
app.use('/media', express.static('public/media'));
app.use('/logs', express.static('logs'));
app.use('/api', require('./webapi.js'));

app.get('/version', (req, res) => {
  res.status(200).render(path.join(__dirname, 'public/version.pug'));
});

app.get('/clips', (req, res) => {
  res.status(200).render("clips", {
    files: fm.getClipList(),
    randoms: fm.getRandomList(),
    categories: fm.getCategorizedFiles()
  });
});

module.exports = app
