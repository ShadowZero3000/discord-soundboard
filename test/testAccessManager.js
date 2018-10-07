var expect = require("chai").expect;
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var Store = require('data-store');
stubbedStore = sinon.createStubInstance(Store);

var testUser = {
  username: 'testuser',
  id: '123',
  _roles: ['4000']
};

var immuneUser = {
  username: 'immuneuser',
  id: '1234'
}

admins = {
  '123': {
    username: 'testuser',
    access: ['access']
  },
  '1234': {
    username: 'immuneuser',
    access: ['access', 'grant'],
    immune: true
  }
}

var fakeMessage = {
  attachments: {
    first: () => {
      return {
        filename: 'test',
        url: 'http://example.com'
      };
    }
  },
  author: {
    id: '0'
  },
  channel: {
    guild: {
      members: [{user: testUser},{user: immuneUser}]
    }
  },
  reply: function (message) {
    return `Message Reply: ${message}`;
  }
}

var fakeLogger = {
  errorLog: {
    debug: sinon.fake(),
    info: sinon.fake()
  }
}

const testRole = {id:'4000',name:'Test role'}

const testGuild = {
  members: {
    get: function(userid) { return testUser }
  },
  roles: {
    get: function(roleid) { return testRole },
    find: sinon.stub()
  }
}

const testGuildAccessRecord = {admin:[],play:['4000'],request:[]}


describe("Access Manager", () => {

  before(() => {
    accessManager = proxyquire("../src/AccessManager", {
      './logger.js': fakeLogger
    });
    accessManager.AccessStore = stubbedStore;
    sinon.spy(fakeMessage, 'reply');
  });
  after(() => {
  })
  beforeEach(() => {
    sinon.reset();
  });

  describe("Public functions", () => {
    describe("checkAccess", () => {
      it("Returns true if there are no play roles assigned", () => {
        stubbedStore.has.returns(true);
        stubbedStore.get.returns({admin:[],play:[],request:[]})
        expect(accessManager.checkAccess(testUser, testGuild, 'play')).to.be.true;
      });
      it("Returns false if there are no request roles assigned", () => {
        stubbedStore.has.returns(true);
        stubbedStore.get.returns({admin:[],play:[],request:[]})
        expect(accessManager.checkAccess(testUser, testGuild, 'request')).to.be.false;
      });
      it("Returns false if there are no admin roles assigned", () => {
        stubbedStore.has.returns(true);
        stubbedStore.get.returns({admin:[],play:[],request:[]})
        expect(accessManager.checkAccess(testUser, testGuild, 'admin')).to.be.false;
      });
      it("Returns false if there are play roles assigned and the user doesn't have one", () => {
        stubbedStore.has.returns(true);
        stubbedStore.get.returns({admin:[],play:['0'],request:[]})
        expect(accessManager.checkAccess(testUser, testGuild, 'play')).to.be.false;
      });
      it("Returns true if there are play roles assigned and the user has one", () => {
        stubbedStore.has.returns(true);
        stubbedStore.get.returns(testGuildAccessRecord)
        expect(accessManager.checkAccess(testUser, testGuild, 'play')).to.be.true;
      });
    });

    describe("checkAccessById", () => {
      it("Returns true if there are no play roles assigned", () => {
        stubbedStore.has.returns(true);
        stubbedStore.get.returns({admin:[],play:[],request:[]})
        expect(accessManager.checkAccessById(testUser._roles, testGuild.id, 'play')).to.be.true;
      });
      it("Returns false if there are play roles assigned and the user doesn't have one", () => {
        stubbedStore.has.returns(true);
        stubbedStore.get.returns({admin:[],play:['0'],request:[]})
        expect(accessManager.checkAccessById(testUser._roles, testGuild.id, 'play')).to.be.false;
      });
      it("Returns true if there are play roles assigned and the user has one", () => {
        stubbedStore.has.returns(true);
        stubbedStore.get.returns(testGuildAccessRecord)
        expect(accessManager.checkAccessById(testUser._roles, testGuild.id, 'play')).to.be.true;
      });
    });

    describe("getAccess", () => {
      it("Returns empty if passed a bad guild", () => {
        expect(accessManager.getAccess(null, '4000')).to.deep.equal([]);
      });
      it("Returns all roles with specified access", () => {
        stubbedStore.has.returns(true);
        stubbedStore.get.returns({admin:[],play:['4000'],request:[]})
        expect(accessManager.getAccess(testGuild, 'play')).to.deep.equal([testRole]);
      });
    });

    describe("getGuildById", () => {
      it("Creates a new guild object if not already present", () => {
        stubbedStore.has.returns(false);
        stubbedStore.get.returns(testGuildAccessRecord);
        stubbedStore.set.reset();
        expect(accessManager.getGuildById(1)).to.equal(testGuildAccessRecord);
        expect(stubbedStore.set.called).to.be.true;
      });
      it("Returns an existing guild object if already present", () => {
        stubbedStore.has.returns(true);
        stubbedStore.get.returns(testGuildAccessRecord)
        stubbedStore.set.reset();
        expect(accessManager.getGuildById(1)).to.equal(testGuildAccessRecord);
        expect(stubbedStore.set.called).to.be.false;
      });
    });

    describe("getRole", () => {
      // Does this even need a check?
      it("Returns the requested role", () => {
        testGuild.roles.find.returns(testRole);
        expect(accessManager.getRole('test role', testGuild)).to.equal(testRole)
      });
    });

    describe("grantAccessById", () => {
      it("Returns false if given bad inputs", () => {
        expect(accessManager.grantAccessById(null,'1','play')).to.be.false;
        expect(accessManager.grantAccessById('1',null,'play')).to.be.false;
        expect(accessManager.grantAccessById('1','1',null)).to.be.false;
      });
      it("Grants access for a role", () => {
        stubbedStore.has.returns(true);
        stubbedStore.get.returns(testGuildAccessRecord);
        stubbedStore.set.returns(true);
        stubbedStore.set.reset();
        expect(accessManager.grantAccessById('1000','1','play')).to.be.true;
        expect(stubbedStore.set.calledWith('1', { admin: [], play: [ '4000', '1000' ], request: [] })).to.be.true;
      });
      it("Is a no-op for existing roles", () => {
        stubbedStore.has.returns(true);
        stubbedStore.get.returns(testGuildAccessRecord);
        stubbedStore.set.returns(true);
        stubbedStore.set.reset();
        expect(accessManager.grantAccessById('4000','1','play')).to.be.true;
        expect(stubbedStore.set.calledWith('1', testGuildAccessRecord)).to.be.true;
      });
    });

    describe("revokeAccessById", () => {
      it("Returns false if given bad inputs", () => {
        expect(accessManager.revokeAccessById(null,'1','play')).to.be.false;
        expect(accessManager.revokeAccessById('1',null,'play')).to.be.false;
        expect(accessManager.revokeAccessById('1','1',null)).to.be.false;
      });
      it("Revokes access for a role", () => {
        stubbedStore.has.returns(true);
        stubbedStore.get.returns(testGuildAccessRecord);
        stubbedStore.set.returns(true);
        expect(accessManager.revokeAccessById('4000','1','play')).to.be.true;
        // The test object remained edited from the grant, even though I tried to prevent this
        expect(stubbedStore.set.calledWith('1', { admin: [], play: ['1000'], request: [] })).to.be.true;
      });
      it("Is a no-op for non-existant roles", () => {
        stubbedStore.has.returns(true);
        stubbedStore.get.returns(testGuildAccessRecord);
        stubbedStore.set.returns(true);
        stubbedStore.set.reset();
        expect(accessManager.revokeAccessById('4000','1','play')).to.be.true;
        expect(stubbedStore.set.calledWith('1', { admin: [], play: ['1000'], request: [] })).to.be.true;
      });
    });
  });
});
