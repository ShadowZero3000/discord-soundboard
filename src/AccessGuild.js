const Access = require('./Access.js');
class AccessGuild {
  constructor(roles=null, globalPlay=true) {
    this.roles = {};
    this.globalPlay = globalPlay;
    if (roles) {
      Object.keys(roles).forEach(roleId => {
        this.roles[roleId] = new Access(roles[roleId].permissions);
      })
    }
  }

  hasRole(roleId) {
    return roleId in this.roles; //this.roles.indexOf(roleId) > -1;
  }

  getRole(roleId) {
    if (! this.hasRole(roleId)) {
      this.roles[roleId] = new Access();
    }
    return this.roles[roleId];
  }

  getRoles() {
    return Object.keys(this.roles);
  }

  grant(roleId, permission) {
    if (permission == 'play') {
      this.globalPlay = false;
    }
    this.getRole(roleId).grant(permission);
    return true;
  }

  revoke(roleId, permission) {
    if (this.hasRole(roleId)) {
      this.getRole(roleId).revoke(permission);
    }
    if (permission == 'play') {
      this.globalPlay = true;
      Object.keys(this.roles).forEach(roleId => {
        const role = this.roles[roleId];
        if (role.can('play')) {
          this.globalPlay = false;
          return;
        }
      })
    }
    if (this.getRole(roleId).empty()) {
      delete this.roles[roleId];
    }
  }
}

module.exports = AccessGuild;
