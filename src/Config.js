import nconf from 'nconf'
import path from 'path'
import * as url from 'url';
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const configFile = path.join(__dirname,'config/config.json');

function Config(){
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
  })
  .required(['SESSION_SECRET'])
}

Config.prototype.get = function(key) {
  return nconf.get(key);
};

Config.prototype.set = function(key, value) {
  return nconf.set(key, value);
};

export default Config = new Config();
