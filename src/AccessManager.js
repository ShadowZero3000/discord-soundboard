const log = require('./logger.js').errorLog;
const Store = require('data-store');

class AccessManager {
  constructor() {
    this.guilds = {};
    this.AccessStore = new Store({ name: 'access', path: 'config/access.json', defaults: {} });
  }

  checkAccess(user, guild, access) {
    const userRoles = guild.members.get(user.id)._roles;
    return this.checkAccessById(userRoles, guild.id, access);
  }

  checkAccessById(userRoles, guildId, access) {
    const guild = this.getGuildById(guildId);
    if (access == 'play' && guild[access].length == 0) {
      // Use the empty accesss for global access grant, but only for 'play'
      return true;
    }
    return userRoles.filter(roleId => {
      return guild[access].indexOf(roleId) > -1;
    }).length > 0;
  }

  getAccess(guild, role) {
    if (!guild) { return []; }
    const guildAccess = this.getGuildById(guild.id);
    return guildAccess[role].map(roleId => {
      return guild.roles.get(roleId);
    })
  }

  getGuildById(guildId) {
    if (!this.AccessStore.has(guildId)) {
      this.AccessStore.set(guildId, {
        admin: [],
        play: [],
        request: []
      })
    }
    return this.AccessStore.get(guildId);
  }

  getRole(roleName, guild) {
    return guild.roles.find(role=> role.name.toLowerCase() === roleName);
  }

  grantAccessById(roleId, guildId, access) {
    if (roleId == undefined || guildId == undefined || access == undefined) {
      return false;
    }
    const guild = this.getGuildById(guildId);
    log.info(`Granting '${access}' access for ${roleId} in ${guildId}`)
    if (guild[access].indexOf(roleId) == -1) {
      guild[access].push(roleId);
    }
    this.AccessStore.set(guildId, guild);
    return true;
  }

  revokeAccessById(roleId, guildId, access) {
    const guild = this.getGuildById(guildId);
    log.info(`Revoking '${access}' access for ${roleId} in ${guildId}`)
    if (guild[access].indexOf(roleId) > -1) {
      guild[access].splice(guild[access].indexOf(roleId),1)
    }
    this.AccessStore.set(guildId, guild);
    return true;
  }
}

module.exports = new AccessManager();
