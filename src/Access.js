export default class Access {
  constructor(permissions=null) {
    this.permissions = permissions || [];
  }

  can(permission) {
    return this.permissions.indexOf(permission) > -1;
  }

  empty() {
    return this.permissions.length == 0;
  }

  grant(permission) {
    if (!this.can(permission)) {
      this.permissions.push(permission);
    }
  }

  revoke(permission) {
    if (this.can(permission)) {
      this.permissions.splice(this.permissions.indexOf(permission), 1);
    }
  }
}
