import cookieParser from 'cookie-parser'
import express from 'express'

import { errorLog, accessLog } from './logger.js'
const log = errorLog

import * as path from 'path'

import FileManager from './FileManager.js'
const fm = FileManager.getInstance()

import * as webapi from './webapi.js'

import * as url from 'url';
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

import session from 'express-session'
import sessionStore from 'express-session-rsdb'
const app = express()

import Config from './Config.js'
import SessionStore from './SessionStore.js'

app.use(cookieParser());
app.use(session({
    secret: Config.get('SESSION_SECRET'),
    saveUninitialized:true,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
    resave: false,
    store: SessionStore.getInstance()
}))

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'public'));

app.get('/', (req, res) => {
  if(req.session.active
      && new Date().getTime() < req.session.discord_session.refresh_by) {
    return res.redirect('/clips')
  }
  return res.status(200).render(path.join(__dirname, 'public/index.pug'));
});

app.get('/logout', (req, res) => {
  req.session.destroy()
  return res.redirect('/');
});

const oneMonth = 1000 * 60 * 60 * 24 * 30
const oneWeek = 1000 * 60 * 60 * 24 * 7

app.use('/css', express.static('public/css', { maxage: oneWeek }));
app.use('/js', express.static('public/js', { maxage: oneWeek }));
app.use('/media', express.static('public/media', { maxage: oneMonth }));
app.use('/logs', express.static('logs'));
app.use('/api', webapi.router);

app.get('/version', (req, res) => {
  res.status(200).render(path.join(__dirname, 'public/version.pug'));
});

app.get('/clips', (req, res) => {
  if(!req.session.active) {
    return res.redirect('/')
  }
  // May need to refresh session shenanigans here
  res.status(200).render("clips", {
    files: fm.getClipList(),
    randoms: fm.getRandomList(),
    categories: fm.getCategorizedFiles()
  });
});

export { app }
