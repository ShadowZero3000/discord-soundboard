// var expect = require("chai").expect;
// var sinon = require('sinon');
// var proxyquire = require('proxyquire');
// var Store = require('data-store').Store;
// var stubbedStore = sinon.createStubInstance(Store);

// var testUser = {
//   username: 'testuser',
//   id: '123',
//   _roles: ['4000']
// };

// var immuneUser = {
//   username: 'immuneuser',
//   id: '1234'
// }

// admins = {
//   '123': {
//     username: 'testuser',
//     access: ['access']
//   },
//   '1234': {
//     username: 'immuneuser',
//     access: ['access', 'grant'],
//     immune: true
//   }
// }

// var fakeMessage = {
//   attachments: {
//     first: () => {
//       return {
//         filename: 'test',
//         url: 'http://example.com'
//       };
//     }
//   },
//   author: {
//     id: '0'
//   },
//   channel: {
//     guild: {
//       members: {
//         cache: [{user: testUser},{user: immuneUser}]
//       }
//     }
//   },
//   reply: function (message) {
//     return `Message Reply: ${message}`;
//   },
//   delete: sinon.stub()
// }

// var fakeLogger = {
//   errorLog: {
//     debug: sinon.fake(),
//     info: sinon.fake()
//   }
// }
// const AccessGuild = require('../src/AccessGuild.js');
// const testAccessGuild = new AccessGuild();
// const testAccessRole = {permissions:['play']}
// const testAccessGuildWithRoles = new AccessGuild(
//   { '0': testAccessRole },
//   false
// );
// const Access = require('../src/Access.js');
// const testAccessUser = new Access();
// const testRole = {
//   name: 'Test role',
//   id: '0'
// }
// const testGuild = {
//   members: {
//     cache: {
//       get: function(userid) { return testUser }
//     }
//   },
//   roles: {
//     cache: {
//       get: function(roleid) { return testRole },
//       find: sinon.stub()
//     }
//   }
// }

// const testGuildAccessRecord = {admin:[],play:['4000'],request:[]}


// describe("Access Manager", () => {

//   before(() => {
//     accessManager = proxyquire("../src/AccessManager", {
//       './logger.js': fakeLogger
//     });
//     accessManager.AccessStore = stubbedStore;
//     sinon.spy(fakeMessage, 'reply');
//   });
//   after(() => {
//   })
//   beforeEach(() => {
//     sinon.reset();
//   });

//   describe("Public functions", () => {
//     describe("checkAccess", () => {
//       it("Returns false if the user doesn't have the role or permission assigned", () => {
//         sinon.stub(accessManager, 'checkUserAccessById').returns(false);
//         sinon.stub(accessManager, 'checkRoleAccessById').returns(false);
//         var result = accessManager.checkAccess(testUser, testGuild, 'play');
//         accessManager.checkUserAccessById.restore();
//         accessManager.checkRoleAccessById.restore();
//         expect(result).to.be.false;
//       });
//       it("Returns true if there is a role granting, but not a permission assigned", () => {
//         sinon.stub(accessManager, 'checkUserAccessById').returns(false);
//         sinon.stub(accessManager, 'checkRoleAccessById').returns(true);
//         var result = accessManager.checkAccess(testUser, testGuild, 'play');
//         accessManager.checkUserAccessById.restore();
//         accessManager.checkRoleAccessById.restore();
//         expect(result).to.be.true;
//       });
//       it("Returns true if there isn't a granting role, but the user has permission", () => {
//         sinon.stub(accessManager, 'checkUserAccessById').returns(true);
//         sinon.stub(accessManager, 'checkRoleAccessById').returns(false);
//         var result = accessManager.checkAccess(testUser, testGuild, 'play');
//         accessManager.checkUserAccessById.restore();
//         accessManager.checkRoleAccessById.restore();
//         expect(result).to.be.true;
//       });
//       it("Returns true if there is a granting role and the user has permission", () => {
//         sinon.stub(accessManager, 'checkUserAccessById').returns(true);
//         sinon.stub(accessManager, 'checkRoleAccessById').returns(true);
//         var result = accessManager.checkAccess(testUser, testGuild, 'play');
//         accessManager.checkUserAccessById.restore();
//         accessManager.checkRoleAccessById.restore();
//         expect(result).to.be.true;
//       });
//     });

//     describe("checkRoleAccessById", () => {
//       it("Returns true if there are no play roles assigned", () => {
//         stubbedStore.has.returns(true);
//         sinon.stub(accessManager,'getGuildById').returns(testAccessGuild);
//         var result = accessManager.checkRoleAccessById(testUser._roles, testGuild.id, 'play');
//         accessManager.getGuildById.restore();
//         expect(result).to.be.true;
//       });
//       it("Returns false if there are play roles assigned and the user doesn't have one", () => {
//         stubbedStore.has.returns(true);
//         sinon.stub(accessManager,'getGuildById').returns(testAccessGuildWithRoles);
//         var result = accessManager.checkRoleAccessById(testUser._roles, testGuild.id, 'play');
//         accessManager.getGuildById.restore();
//         expect(result).to.be.false;
//       });
//       it("Returns true if there are play roles assigned and the user has one", () => {
//         stubbedStore.has.returns(true);
//         sinon.stub(accessManager,'getGuildById').returns(testAccessGuild);
//         var result = accessManager.checkRoleAccessById(testUser._roles, testGuild.id, 'play');
//         accessManager.getGuildById.restore();
//         expect(result).to.be.true;
//       });
//     });

//     describe("getRoleAccess", () => {
//       it("Returns empty if passed a bad guild", () => {
//         expect(accessManager.getRoleAccess(null)).to.deep.equal([]);
//       });
//       it("Returns all roles with specified access", () => {
//         sinon.stub(accessManager,'getGuildById').returns(testAccessGuildWithRoles);
//         var result = accessManager.getRoleAccess(testGuild);
//         accessManager.getGuildById.restore();
//         expect(result).to.deep.include({name: testRole.name, access:['play']});
//       });
//     });

//     describe("getGuildById", () => {
//       it("Creates a new guild object if not already present", () => {
//         expect(accessManager.getGuildById(1)).to.deep.equal(new AccessGuild());
//       });
//       it("Returns an existing guild object if already present", () => {
//         stubbedStore.get.returns(testAccessGuildWithRoles);
//         expect(accessManager.getGuildById(1)).to.deep.equal(testAccessGuild);
//         expect(stubbedStore.set.called).to.be.false;
//       });
//     });

//     describe("grantRoleAccessById", () => {
//       it("Returns false if given bad inputs", () => {
//         expect(accessManager.grantRoleAccessById(null,'1','play')).to.be.false;
//         expect(accessManager.grantRoleAccessById('1',null,'play')).to.be.false;
//         expect(accessManager.grantRoleAccessById('1','1',null)).to.be.false;
//       });
//       it("Grants access for a role", () => {
//         sinon.stub(accessManager,'getGuildById').returns(testAccessGuild);
//         sinon.stub(testAccessGuild, 'grant');
//         sinon.stub(accessManager, 'save');
//         var result = accessManager.grantRoleAccessById('1000','1','play');
//         expect(testAccessGuild.grant.called).to.be.true;
//         expect(accessManager.save.called).to.be.true;
//         testAccessGuild.grant.restore();
//         accessManager.save.restore();
//         accessManager.getGuildById.restore();
//         expect(result).to.be.true;
//       });
//       it("Is a no-op for existing roles", () => {
//         sinon.stub(accessManager,'getGuildById').returns(testAccessGuild);
//         sinon.stub(testAccessGuild, 'grant');
//         sinon.stub(accessManager, 'save');
//         var result = accessManager.grantRoleAccessById('4000','1','play');
//         expect(testAccessGuild.grant.called).to.be.true;
//         expect(accessManager.save.called).to.be.true;
//         testAccessGuild.grant.restore();
//         accessManager.save.restore();
//         accessManager.getGuildById.restore();
//         expect(result).to.be.true;
//       });
//     });

//     describe("revokeRoleAccessById", () => {
//       it("Returns false if given bad inputs", () => {
//         expect(accessManager.revokeRoleAccessById(null,'1','play')).to.be.false;
//         expect(accessManager.revokeRoleAccessById('1',null,'play')).to.be.false;
//         expect(accessManager.revokeRoleAccessById('1','1',null)).to.be.false;
//       });
//       it("Revokes access for a role", () => {
//         sinon.stub(accessManager,'getGuildById').returns(testAccessGuild);
//         sinon.stub(testAccessGuild, 'revoke');
//         sinon.stub(accessManager, 'save');
//         var result = accessManager.revokeRoleAccessById('4000','1','play');
//         expect(testAccessGuild.revoke.called).to.be.true;
//         expect(accessManager.save.called).to.be.true;
//         testAccessGuild.revoke.restore();
//         accessManager.save.restore();
//         accessManager.getGuildById.restore();
//         expect(result).to.be.true;
//       });
//       it("Is a no-op for non-existant roles", () => {
//         sinon.stub(accessManager,'getGuildById').returns(testAccessGuild);
//         sinon.stub(testAccessGuild, 'revoke');
//         sinon.stub(accessManager, 'save');
//         var result = accessManager.revokeRoleAccessById('4000','1','play');
//         expect(testAccessGuild.revoke.called).to.be.true;
//         expect(accessManager.save.called).to.be.true;
//         testAccessGuild.revoke.restore();
//         accessManager.save.restore();
//         accessManager.getGuildById.restore();
//         expect(result).to.be.true;
//       });
//     });
//   });
// });
