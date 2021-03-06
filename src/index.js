// Includes
const discordBot = require('./DiscordBot');
const nconf = require('nconf');
const path = require('path');
const configFile = path.join(__dirname,'config/config.json');
nconf.argv()
  .env()
  .file({file: configFile})
  .defaults({
    startup: {
      enabled: false,
      clip: 'sensors'
    },
    PORT: 3000,
    WEBSERVER_ENABLED: 'true',
    ADMIN_KEYS: 'sb,soundbot',
    KEY_SYMBOL: '!',
    LISTEN_ENABLED: false
  });

const webgui = require('./webgui.js');

// Var definitions
const log = require('./logger.js').errorLog;
var server = null;

// Make sure we handle exiting properly (SIGTERM might not be needed)
process.on('SIGINT', () => {
  log.debug("Shutting down from SIGINT");
  discordBot.client.destroy();
  if (nconf.get('WEBSERVER_ENABLED')) {
    server.close();
  }
  process.exit();
});

process.on('SIGTERM', () => {
  log.debug("Shutting down from SIGTERM");
  discordBot.client.destroy();
  if (nconf.get('WEBSERVER_ENABLED')) {
    server.close();
  }
  process.exit();
});

/////////////////END INITIALIZATION


// Start up the discordBot bot
discordBot.configure(nconf.get('TOKEN'));
discordBot.connect();

if (nconf.get('WEBSERVER_ENABLED')) {
  webgui.enable('trust proxy');
  server = webgui.listen(nconf.get('PORT'), () => log.debug(`Web UI available on port ${nconf.get('PORT')}!`))
}
log.debug("Let the fun begin!");
