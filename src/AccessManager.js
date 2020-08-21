const Access = require('./Access.js');
const AccessGuild = require('./AccessGuild.js');
const log = require('./logger.js').errorLog;
const Store = require('data-store');

class AccessManager {
  constructor() {
    this.guilds = {};
    this.users = {};
    this.AccessStore = new Store({ name: 'access', path: 'config/access.json', defaults: {} });

    const storeGuilds = this.AccessStore.get('guilds') || {};
    // Deserialize the store into actual objects
    Object.keys(storeGuilds).forEach(guildId => {
      const data = storeGuilds[guildId];
      this.guilds[guildId] = new AccessGuild(data.roles, data.globalPlay);
    });

    const storeUsers = this.AccessStore.get('users') || {};
    Object.keys(storeUsers).forEach(userId => {
      const data = storeUsers[userId];
      this.users[userId] = new Access(data.permissions);
    });
  }

  checkAccess(user, guild, access) {
    const userRoles = guild.members.cache.get(user.id)._roles;
    return (this.checkUserAccessById(user.id, access) ||
            this.checkRoleAccessById(userRoles, guild.id, access));
  }

  checkRoleAccessById(userRoles, guildId, access) {
    const guild = this.getGuildById(guildId);
    if (access == 'play' && guild.globalPlay) {
      // If no roles are assigned in a guild, allow play to everyone
      return true;
    }
    return userRoles.filter(roleId => {
      return guild.getRole(roleId).can(access);
    }).length > 0;
  }

  checkUserAccessById(userId, access) {
    const user = this.getUserById(userId);
    return user.can(access);
  }

  getGuildById(guildId) {
    if (!(guildId in this.guilds)) {
      this.guilds[guildId] = new AccessGuild();
    }
    return this.guilds[guildId];
  }

  getUserById(userId) {
    if (!(userId in this.users)) {
      this.users[userId] = new Access();
    }
    return this.users[userId];
  }

  getRoleAccess(guild) {
    if (!guild) { return []; }
    const guildAccess = this.getGuildById(guild.id);
    return guildAccess.getRoles().map(role => {
      return {name: guild.roles.cache.get(role).name, access: guildAccess.getRole(role).permissions};
    });
  }

  getUserAccess(user) {
    if (!user) { return []; }
    return this.getUserById(user.id).permissions;
  }

  grantRoleAccessById(roleId, guildId, access) {
    if (roleId == undefined || guildId == undefined || access == undefined) {
      return false;
    }
    const guild = this.getGuildById(guildId);
    log.info(`Granting '${access}' access for ${roleId} in ${guildId}`)
    guild.grant(roleId, access);

    this.save('guilds');
    return true;
  }

  grantUserAccessById(userId, access) {
    if (userId == undefined || access == undefined) {
      return false;
    }
    const user = this.getUserById(userId);
    log.info(`Granting '${access}' access for ${userId}`)
    if (Array.isArray(access)) {
      access.forEach(item => {
        user.grant(item);
      })
    } else {
      user.grant(access);
    }

    this.save('users');
    return true;
  }

  revokeRoleAccessById(roleId, guildId, access) {
    if (roleId == undefined || guildId == undefined || access == undefined) {
      return false;
    }
    const guild = this.getGuildById(guildId);
    log.info(`Revoking '${access}' access for ${roleId} in ${guildId}`)
    guild.revoke(roleId, access);

    this.save('guilds');
    return true;
  }

  revokeUserAccessById(userId, access) {
    if (userId == undefined || access == undefined) {
      return false;
    }
    const user = this.getUserById(userId);
    log.info(`Granting '${access}' access for ${userId}`)
    if (Array.isArray(access)) {
      access.forEach(item => {
        user.revoke(item);
      })
    } else {
      user.revoke(access);
    }

    this.save('users');
    return true;
  }

  save(type) {
    this.AccessStore.set(type, this[type]);
  }
}

module.exports = new AccessManager();
