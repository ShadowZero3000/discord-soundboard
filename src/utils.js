const fs = require('fs');
const items = fs.readdirSync('./Uploads/');
const files = {};
items.forEach(item => {
  const matches = item.match(/^([^-]+)--(.*)$/);
  if (matches) {
    files[matches[1]] = `./Uploads/${matches[0]}`;
  }
});

const queues = {}

module.exports = {
  files: files,
  queues: queues
}