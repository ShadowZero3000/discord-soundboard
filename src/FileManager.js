const fs = require('fs');
const log = require('./logger.js').errorLog;
const request = require('request');
const Store = require('data-store');

class FileManager {
  constructor() {
    this.categories = {};
    this.files = {};
    this.home = './Uploads';
    this.requestStore = new Store({ name: 'requests', path: 'config/requests.json', defaults: {} });

    const items = fs.readdirSync(this.home, {withFileTypes: true});
    items.forEach(item => {
      if (item.isDirectory()) {
        var sounds = fs.readdirSync(`${this.home}/${item.name}`, {withFileTypes: true});
        sounds.forEach(sound => {
          this.register(sound, item.name);
        });
      } else {
        // I think we ignore this, because the register thing would have to account for base path
        this.register(item, undefined);
      }
    });
  }

  addRequest(clip, description) {
    if (this.requestStore.has(clip)) {
      return false;
    }
    this.requestStore.set(clip, {name: clip, description: description});
    return true;
  }

  getRequests() {
    var requestList = [];
    const requests = this.requestStore.clone();
    Object.keys(requests).sort().forEach(function(key) {
      requestList.push(requests[key]);
    })
    return requestList;
  }

  removeRequest(clip) {
    if(this.requestStore.has(clip)){
      this.requestStore.del(clip);
    }
  }

  register(file, category) {
    var matches;
    if (file instanceof(fs.Dirent)) {
      if(!file.isFile()) { return false; }
      matches = file.name.match(/^([^-]+)--(.*)$/);
    } else {
      matches = file.match(/^([^-]+)--(.*)$/);
    }
    //const matches = file.name.match(/^([^-]+)--(.*)$/);
    if (matches) {
      const realCategory = (category || 'misc').toLowerCase();
      const obj = {
        name: matches[1],
        category: realCategory,
        fileSuffix: matches[2],
        fileName: `${this.home}/${category || ''}/${matches[0]}`,
      }
      this.files[obj.name] = obj;
      this.categories[realCategory] = this.categories[realCategory] || {};
      this.categories[realCategory][obj.name] = obj;
      this.removeRequest(obj.name);
      this.sortCategories();
      return true;
    }
    return false;
  }

  sortCategories() {
    var result = {};
    Object.keys(this.categories).sort().forEach(category => {
      result[category] = {}
      Object.keys(this.categories[category]).sort().forEach(key => {
        result[category][key] = this.categories[category][key];
      });
    });
    this.categories = result;
  }

  deregister(file) {
    delete this.categories[file.category][file.name];
    // Remove empty categories
    if (Object.keys(this.categories[file.category]).length === 0) {
      delete this.categories[file.category];
    }
    delete this.files[file.name];
  }

  create(keyword, category, file) {
    var directory = `${this.home}/${category.toLowerCase()}`;
    var destination = `${directory}/${keyword}--${file.name}`;
    log.debug(`Writing attachment to file: ${destination}`);
    if (!fs.existsSync(directory)){
        fs.mkdirSync(directory);
    }
    request(file.url).pipe(fs.createWriteStream(destination));
    return this.register(`${keyword}--${file.name}`, category);
  }

  delete(keyword) {
    if (!this.inLibrary(keyword)) { return false; }
    log.debug(`Deleting: ${keyword}`);
    fs.unlinkSync(this.files[keyword].fileName);
    this.deregister(this.get(keyword));
    log.debug("Deleted successfully");
    return true;
  }

  get(keyword) {
    return this.files[keyword];
  }

  getAll() {
    return this.files;
  }

  getCategory(keyword) {
    return this.categories[keyword];
  }

  getFilesByCategory(category) {

  }

  getClipList() {
    return Object.keys(this.files).sort();
  }

  getRandomList() {
    return Object.keys(this.files)
      .map(key => key.match(/^([A-z0-9]+[A-z])[0-9]+$/))
      .filter(match => !!match)
      .map(match => match[1])
      .filter((element, pos, arr) => {
        // Unique filter
        return arr.indexOf(element) == pos;
      })
      .sort();
  }

  getCategorizedFiles() {
    return this.categories;
  }

  getStream(keyword) {
    return fs.createReadStream(this.files[keyword].fileName);
  }

  inLibrary(keyword) {
    return this.getClipList().indexOf(keyword) > -1;
  }

  inRandoms(keyword) {
    return this.getRandomList().indexOf(keyword) > -1;
  }

  random(keyword) {
    if (!keyword || !this.inRandoms(keyword)) { // Play a random clip if there's no extra args
      return this.selectRandom(this.getClipList());
    }

    const filenames = this.getClipList().filter(key => key.includes(keyword));
    return this.selectRandom(filenames);
  }

  rename(oldKeyword, newKeyword, newCategory = undefined) {
    const oldFile = this.get(oldKeyword);
    const newFileName = `${newKeyword}--${oldFile.fileSuffix}`
    if (newCategory == undefined) {
      newCategory = oldFile.category || 'misc';
    }
    const newDirectory = `${this.home}/${newCategory.toLowerCase()}`;
    const newFilePath = `${newDirectory}/${newFileName}`
    log.debug(`Renaming: ${oldFile.fileName} to ${newFilePath}`);
    if (!fs.existsSync(newDirectory)){
        fs.mkdirSync(newDirectory);
    }
    fs.renameSync(oldFile.fileName, newFilePath);
    this.deregister(oldFile);
    this.register(newFileName, newCategory);
    return true;
  }

  selectRandom(collection) {
    if (!collection.length) {
      return;
    }

    return collection[Math.floor(Math.random() * collection.length)];
  }
}

module.exports = new FileManager();
