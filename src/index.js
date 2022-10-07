// Includes
import DiscordBot from './DiscordBot.js'

import Config from './Config.js'
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
  if (Config.get('WEBSERVER_ENABLED')) {
    server.close();
  }
  process.exit();
});

process.on('SIGTERM', () => {
  log.debug("Shutting down from SIGTERM");
  discordBot.client.destroy();
  if (Config.get('WEBSERVER_ENABLED')) {
    server.close();
  }
  process.exit();
});

/////////////////END INITIALIZATION

// Start up the discordBot bot
// discordBot.configure(Config.get('TOKEN'));
discordBot.connect();

if (Config.get('WEBSERVER_ENABLED')) {
  webgui.app.enable('trust proxy');
  server = webgui.app.listen(Config.get('PORT'), () => log.debug(`Web UI available on port ${Config.get('PORT')}!`))
}
log.debug("Let the fun begin!");
