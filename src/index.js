// Includes
import DiscordBot from './DiscordBot.js'
import nconf from 'nconf'
import path from 'path'

import * as url from 'url';
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

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
    LISTEN_ENABLED: false
  });

import * as webgui from './webgui.js'

// Var definitions
import { errorLog } from './logger.js'
const log = errorLog
var server = null;

const discordBot = DiscordBot.getInstance()

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
// discordBot.configure(nconf.get('TOKEN'));
discordBot.connect();

if (nconf.get('WEBSERVER_ENABLED')) {
  webgui.app.enable('trust proxy');
  server = webgui.app.listen(nconf.get('PORT'), () => log.debug(`Web UI available on port ${nconf.get('PORT')}!`))
}
log.debug("Let the fun begin!");
