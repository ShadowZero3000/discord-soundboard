var expect = require("chai").expect;
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var fs = require('fs');

var stubbedVQM = sinon.stub(require('../src/VoiceQueueManager'));
var stubbedNconf = sinon.stub(require('nconf'));
var stubbedFileManager = sinon.stub(require('../src/FileManager'));
var stubbedAccessManager = sinon.stub(require('../src/AccessManager'));

const AccessGuild = require('../src/AccessGuild.js');
const Access = require('../src/Access.js');

var testUser = {
  username: 'testuser',
  id: '123'
};

var immuneUser = {
  username: 'immuneuser',
  id: '1234'
}

const admins = {
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
    id: '123'
  },
  channel: {
    guild: {
      id: '1',
      members: [{user: testUser},{user: immuneUser}]
    }
  },
  guild: {
    id: '1',
    members: [{user: testUser},{user: immuneUser}],
    roles: {
      find: sinon.stub()
    }
  },
  reply: function (message) {
    return `Message Reply: ${message}`;
  },
  delete: sinon.stub()
}

var fakeLogger = {
  errorLog: {
    debug: sinon.fake()
  }
}
const testAccessGuild = new AccessGuild();
const testAccessGuildWithRoles = new AccessGuild({roles:{'0': 'play'}});
const testAccessUser = new Access();
const testAccessUserWithRoles = new Access(['clipmanager']);
const testRole = {id:'4000',name:'Test role'}

describe("Admin Utils", () => {

  before(() => {
    stubbedNconf.get.withArgs('KEY_SYMBOL').returns('!');
    // This short circuits any save calls by default
    stubbedNconf.save.returns(true);
    stubbedNconf.set.returns(true);
    sinon.stub(stubbedNconf, 'stores').value({file:{file:'blah'}})

    adminUtils = proxyquire("../src/AdminUtils", {
      'nconf': stubbedNconf,
      './VoiceQueueManager': stubbedVQM,
      './logger': fakeLogger,
      './FileManager': stubbedFileManager
    });
    sinon.spy(fakeMessage, 'reply');
  });

  after(() => {
    stubbedNconf.get.restore();
    stubbedNconf.save.restore();
    stubbedNconf.set.restore();
  })

  beforeEach(() => {
    sinon.reset();
  });

  describe("Private functions", () => {

    describe("_getDiscordUser", () => {
      it("Returns the user", function () {
        expect(adminUtils._getDiscordUser(fakeMessage, testUser.username)).to.deep.equal({user: testUser})
      });
    });

    describe("_paramCheck", () => {
      it("Returns parameters", function () {
        expect(adminUtils._paramCheck(fakeMessage, ['one', 'two'])).to.be.true;
        expect(adminUtils._paramCheck(fakeMessage, ['one', 'two'], 2)).to.be.true;
        expect(adminUtils._paramCheck(fakeMessage, ['one', 'two'], 3)).to.be.false;
        expect(adminUtils._paramCheck(fakeMessage, [])).to.be.false;
      });
    });

    describe("_saveConfig", () => {
      it("Saves a parameter value", function () {
        adminUtils._saveConfig('key', 'value');

        expect(stubbedNconf.set.called).to.be.true;
        expect(stubbedNconf.save.called).to.be.true;
      });
    });

  });

  describe("Non-admin public functions", () => {
    describe("check", () => {
      it("Verifies that access is granted", function () {
        stubbedAccessManager.checkAccess.returns(true);
        expect(adminUtils.check(fakeMessage, 'access')).to.be.true;
      });
      it("Does not permit access that is not granted", function() {
        stubbedAccessManager.checkAccess.returns(false);
        expect(adminUtils.check(fakeMessage, 'revoke')).to.be.false;
      });
    });

    describe("getUserActions", () => {
      it("Returns all actions the user is authorized for", function () {
        stubbedAccessManager.getUserById.returns(testAccessUserWithRoles)
        expect(adminUtils.getUserActions(fakeMessage)).to.deep.equal(['add','categorize','remove','rename']);
      });
      it("Returns nothing if the user is not found", function () {
        stubbedAccessManager.getUserById.returns(testAccessUser)
        expect(adminUtils.getUserActions(fakeMessage)).to.deep.equal([]);
      });
    });
  });

  describe("Public functions", () => {

    describe("access", () => {
      it("Has a help function", () => {
        expect(adminUtils.access(fakeMessage, ['help'])).to.match(/Message Reply: access `<username>`.*/);
      });
      it("Will print access when requested", function (){
        stubbedAccessManager.getUserAccess.returns(testAccessUserWithRoles.permissions)
        expect(adminUtils.access(fakeMessage, [testUser.username])).to.equal(`Message Reply: ${testUser.username} has: clipmanager`);
      });
      it("Will print a message for users with no access", function (){
        stubbedAccessManager.getUserAccess.returns(testAccessUser.permissions)
        expect(adminUtils.access(fakeMessage, [testUser.username])).to.equal(`Message Reply: ${testUser.username} does not have any directly assigned permissions`);
      });
    });

    describe("accessrole", () => {
      it("Will print access by role when requested", function (){
        stubbedAccessManager.getRoleAccess.returns([{name: 'Play role', access: ['play']}]);

        expect(adminUtils.accessrole(fakeMessage)).to.equal(
          `Message Reply: \`accessrole\`\n`+
          `Current role access:\n`+
          `Play role - play`
        );
      });
    });

    describe("add", () => {
      it("Has a help function", () => {
        expect(adminUtils.add(fakeMessage, ['help'])).to.match(/Message Reply: add `<clip>` `\[category]` `\[subcategory]` \(with attachment\).*/);
      });
      it("Can add a new sound", function () {
        stubbedNconf.get.withArgs('KEY_SYMBOL').returns('!');
        stubbedFileManager.inLibrary.returns(false);

        expect(adminUtils.add(fakeMessage, ['hi'])).to.equal('Message Reply: !hi is now available');
        expect(stubbedFileManager.inLibrary.called).to.be.true;
        expect(stubbedFileManager.create.called).to.be.true;
      });
      it("Won't re-add the same sound", function () {
        stubbedFileManager.inLibrary.returns(true);

        expect(adminUtils.add(fakeMessage, ['hi'])).to.equal('Message Reply: That sound effect already exists');
        expect(stubbedFileManager.inLibrary.called).to.be.true;
      });
      it("Will not add clips with a bad clip name", function (){
        stubbedFileManager.inLibrary.returns(true);

        adminUtils.add(fakeMessage, ['clip!1']);

        expect(stubbedFileManager.create.called).to.be.false;
        expect(fakeMessage.reply.calledWith(`clip!1 is a bad short name`)).to.be.true;
      });
      it("Will not add clips with a bad category name", function (){
        stubbedFileManager.inLibrary.returns(true);

        adminUtils.add(fakeMessage, ['clip1', 'category!']);

        expect(stubbedFileManager.create.called).to.be.false;
        expect(fakeMessage.reply.calledWith(`category! is a bad category name`)).to.be.true;
      });
      it("Will print a message if the user forgot an attachment", function (){
        stubbedFileManager.inLibrary.returns(false);
        sinon.stub(fakeMessage.attachments, 'first').returns(null);

        adminUtils.add(fakeMessage, ['clip1', 'category']);

        fakeMessage.attachments.first.restore()

        expect(stubbedFileManager.create.called).to.be.false;
        expect(fakeMessage.reply.calledWith(`You need to attach a file`)).to.be.true;
      });
    });

    describe("categorize", () => {
      it("Has a help function", () => {
        expect(adminUtils.categorize(fakeMessage, ['help'])).to.match(/Message Reply: categorize `<new category>` `<new subcategory>` `<clip>`.*/);
      });
      it("Will error if the sound doesn't exist", function (){
        expect(adminUtils.categorize(fakeMessage, ['category1', 'subcategory1', 'soundclip'])).to.be.true;
        expect(fakeMessage.reply.calledWith(`I don't recognize soundclip`)).to.be.true;
      });
      it("Will change a sound's category", function (){
        stubbedFileManager.inLibrary.returns(true);
        stubbedFileManager.rename.returns(true);

        expect(adminUtils.categorize(fakeMessage, ['category1', 'subcategory1', 'soundclip'])).to.be.true;

        expect(stubbedFileManager.rename.called).to.be.true
        expect(fakeMessage.reply.calledWith(`soundclip's category is now: category1 - subcategory1`)).to.be.true;
      });
      it("Will not categorize clips with a bad category name", function (){
        stubbedFileManager.inLibrary.returns(true);
        stubbedFileManager.rename.returns(true);

        adminUtils.categorize(fakeMessage, ['category!', 'subcategory1', 'clip1']);

        expect(stubbedFileManager.rename.called).to.be.false;
        expect(fakeMessage.reply.calledWith(`category! is a bad category name`)).to.be.true;
      });
      it("Will not categorize clips with a bad subcategory name", function (){
        stubbedFileManager.inLibrary.returns(true);
        stubbedFileManager.rename.returns(true);

        adminUtils.categorize(fakeMessage, ['category1', 'subcategory!', 'clip1']);

        expect(stubbedFileManager.rename.called).to.be.false;
        expect(fakeMessage.reply.calledWith(`subcategory! is a bad subcategory name`)).to.be.true;
      });
    });

    describe("grant", () => {
      it("Has a help function", () => {
        expect(adminUtils.grant(fakeMessage, ['help'])).to.match(/Message Reply: grant `<username>` `<permission>`.*/);
      });
      it("Will grant users permissions", function (){
        stubbedAccessManager.getUserAccess.returns(['clipmanager']);
        sinon.stub(adminUtils,'_getDiscordUser').returns({user: {id: '5'}});

        adminUtils.grant(fakeMessage, [testUser.username, 'clipmanager']);

        adminUtils._getDiscordUser.restore();
        expect(fakeMessage.reply.lastCall.args[0]).to.equal(`${testUser.username} has: clipmanager`)
        expect(stubbedAccessManager.grantUserAccessById.called).to.be.true;
      });
      it("Will grant users permission even if they never been granted permissions", function (){
        stubbedAccessManager.getUserAccess.returns(['clipmanager']);
        sinon.stub(adminUtils,'_getDiscordUser').returns({user: {id: '5'}});

        adminUtils.grant(fakeMessage, [testUser.username + 'bogus', 'clipmanager']);

        adminUtils._getDiscordUser.restore();
        expect(fakeMessage.reply.lastCall.args[0]).to.equal(`${testUser.username}bogus has: clipmanager`);
      });
      it("Will not grant fake permissions", function (){
        stubbedAccessManager.getUserAccess.returns(['clipmanager']);
        sinon.stub(adminUtils,'_getDiscordUser').returns({user: {id: '5'}});


        adminUtils.grant(fakeMessage, [testUser.username, 'clipmanager', 'bogus']);

        adminUtils._getDiscordUser.restore();
        expect(stubbedAccessManager.grantUserAccessById.lastCall.args).to.deep.equal(['5',['clipmanager']])
        expect(fakeMessage.reply.lastCall.args[0]).to.equal(`${testUser.username} has: clipmanager`);
      });
    });

    describe("grantrole", () => {
      it("Has a help function", () => {
        expect(adminUtils.grantrole(fakeMessage, ['help'])).to.match(/Message Reply: grantrole `clipmanager|play|requestor|servermanager|silencer|vocalist` `<role name>`.*/);
      });
      it("Will grant a server role permissions", function (){
        stubbedAccessManager.grantRoleAccessById.returns(true);
        fakeMessage.guild.roles.find.returns({name: 'Test role'});
        adminUtils.grantrole(fakeMessage, ['play', 'test', 'role']);
        expect(fakeMessage.reply.lastCall.args).to.deep.equal([`Granted play to 'Test role'`]);
        expect(stubbedAccessManager.grantRoleAccessById.called).to.be.true;
      });
      it("Will do nothing given a bad role", function (){
        adminUtils.grantrole(fakeMessage, ['play', 'bogus', 'role']);
        expect(fakeMessage.reply.calledWith(`Couldn't find that role`)).to.be.true;
      });
      it("Will not grant invalid permissions", function (){
        adminUtils.grantrole(fakeMessage, ['bogus', 'bogus', 'role']);

        expect(fakeMessage.reply.lastCall.args[0]).to.equal(`Must select the granted access: \`clipmanager|play|requestor|servermanager|silencer|vocalist\``);
      });
      it("Will fail if an underlying system fails", function (){
        stubbedAccessManager.grantRoleAccessById.returns(false);
        fakeMessage.guild.roles.find.returns({name: 'Test role'})

        adminUtils.grantrole(fakeMessage, ['play', 'bogus', 'role']);

        expect(fakeMessage.reply.calledWith(`Something went wrong with that`)).to.be.true;
        expect(stubbedAccessManager.grantRoleAccessById.called).to.be.true;
      });
    });

    describe("remove", () => {
      it("Has a help function", () => {
        expect(adminUtils.remove(fakeMessage, ['help'])).to.match(/Message Reply: remove `<clip>`.*/);
      });
      it("Will remove songs that exist", function (){
        stubbedFileManager.inLibrary.returns(true);
        stubbedFileManager.delete.returns(true);

        adminUtils.remove(fakeMessage, ['clip1']);

        expect(fakeMessage.reply.calledWith(`clip1 removed`)).to.be.true;
      });
      it("Will not remove songs that don't exist", function (){
        stubbedFileManager.inLibrary.returns(false);
        stubbedFileManager.delete.returns(true);

        adminUtils.remove(fakeMessage, ['clip2']);

        expect(fakeMessage.reply.called).to.be.false;
        expect(stubbedFileManager.inLibrary.called).to.be.true;
        expect(stubbedFileManager.delete.called).to.be.false;
      });
    });

    describe("rename", () => {
      it("Has a help function", () => {
        expect(adminUtils.rename(fakeMessage, ['help'])).to.match(/Message Reply: rename `<clip>`.*/);
      });
      it("Will rename clips that exist", function (){
        stubbedFileManager.inLibrary.returns(true);
        stubbedFileManager.rename.returns(true);

        adminUtils.rename(fakeMessage, ['clip1', 'clip2']);

        expect(stubbedFileManager.rename.calledWith('clip1', 'clip2')).to.be.true;
        expect(fakeMessage.reply.calledWith(`Rename to clip2 complete.`)).to.be.true;

      });
      it("Will not rename clips that do not exist", function (){
        stubbedFileManager.inLibrary.returns(false);
        stubbedFileManager.rename.returns(true);

        adminUtils.rename(fakeMessage, ['clip1','clip2']);

        expect(stubbedFileManager.inLibrary.called).to.be.true;
        expect(stubbedFileManager.rename.called).to.be.false;
        expect(fakeMessage.reply.calledWith(`Could not find: clip1`)).to.be.true;
      });
      it("Will not rename clips with a bad name", function (){
        stubbedFileManager.inLibrary.returns(true);
        stubbedFileManager.rename.returns(true);

        adminUtils.rename(fakeMessage, ['clip1','clip!2']);

        expect(stubbedFileManager.rename.called).to.be.false;
        expect(fakeMessage.reply.calledWith(`clip!2 is a bad short name`)).to.be.true;
      });
    });

    describe("request", () => {
      it("Has a help function", () => {
        expect(adminUtils.request(fakeMessage, ['help'])).to.match(/Message Reply: request `<clip>`.*/);
      });
      it("Will add requests", function (){
        stubbedFileManager.addRequest.returns(true);

        adminUtils.request(fakeMessage, ['clip1', 'description']);

        expect(stubbedFileManager.addRequest.calledWith('clip1', 'description')).to.be.true;
        expect(fakeMessage.reply.calledWith(`Ok, I'll add it to the list`)).to.be.true;

      });
      it("Will not request clips that already have been requested", function (){
        stubbedFileManager.addRequest.returns(false);

        adminUtils.request(fakeMessage, ['clip1','clip2']);

        expect(stubbedFileManager.addRequest.called).to.be.true;
        expect(fakeMessage.reply.calledWith(`Already on the list`)).to.be.true;
      });
      it("Will not request clips with a bad name", function (){
        stubbedFileManager.addRequest.returns(false);

        adminUtils.request(fakeMessage, ['clip!1','clip2']);

        expect(stubbedFileManager.addRequest.called).to.be.false;
        expect(fakeMessage.reply.calledWith(`clip!1 is a bad clip name`)).to.be.true;
      });
    });

    describe("reqlist", () => {
      it("Tells you what has been requested", function (){
        stubbedFileManager.getRequests.returns([{name:'clip1',description:'test description'}]);

        adminUtils.reqlist(fakeMessage, []);

        expect(stubbedFileManager.getRequests.called).to.be.true;
        expect(fakeMessage.reply.calledWith(`Here's what we've got requested:\nclip1 - test description`)).to.be.true;
      });
    });

    describe("revoke", () => {
      it("Has a help function", () => {
        expect(adminUtils.revoke(fakeMessage, ['help'])).to.match(/Message Reply: revoke `<username>` `<permission>`.*/);
      });
      it("Will revoke users permissions if present", function (){
        stubbedAccessManager.getUserAccess.returns(['silencer']);
        sinon.stub(adminUtils,'_getDiscordUser').returns({user: {id: '5'}});

        // Our test data didn't get reset before this :(
        // We need to fix that
        adminUtils.revoke(fakeMessage, [testUser.username, 'clipmanager']);

        adminUtils._getDiscordUser.restore();
        expect(stubbedAccessManager.revokeUserAccessById.lastCall.args).to.deep.equal(['5',['clipmanager']])
        expect(fakeMessage.reply.lastCall.args[0]).to.equal(`${testUser.username} has: silencer`);

      });
      it("Will not revoke permissions from immune users", function (){
        stubbedAccessManager.getUserAccess.returns(['silencer']);
        sinon.stub(adminUtils,'_getDiscordUser').returns({user: {id: '5'}});
        adminUtils.immuneUser = '5';

        adminUtils.revoke(fakeMessage, ['immuneuser', 'revoke', 'grant']);

        adminUtils._getDiscordUser.restore();
        adminUtils.immuneUser = '-1';
        expect(fakeMessage.reply.lastCall.args).to.deep.equal([`${immuneUser.username} is immune to revokes`]);
      });
    });

    describe("revokerole", () => {
      it("Has a help function", () => {
        expect(adminUtils.revokerole(fakeMessage, ['help'])).to.match(/Message Reply: revokerole `play|request|admin` `<role name>`.*/);
      });
      it("Will revoke a server role permissions", function (){
        stubbedAccessManager.revokeRoleAccessById.returns(true);
        fakeMessage.guild.roles.find.returns({name: 'Bogus role'})

        adminUtils.revokerole(fakeMessage, ['play', 'bogus', 'role']);

        expect(fakeMessage.reply.lastCall.args).to.deep.equal([`Revoked play from 'Bogus role'`]);
        expect(stubbedAccessManager.revokeRoleAccessById.called).to.be.true;
      });
      it("Will do nothing given a bad role", function (){
        adminUtils.revokerole(fakeMessage, ['play', 'bogus', 'role']);

        expect(fakeMessage.reply.calledWith(`Couldn't find that role`)).to.be.true;
      });
      it("Will not revoke invalid permissions", function (){
        fakeMessage.guild.roles.find.returns({name: 'Bogus role'})
        adminUtils.revokerole(fakeMessage, ['bogus', 'bogus', 'role']);

        expect(fakeMessage.reply.lastCall.args).to.deep.equal([`Must select the revoked access: \`clipmanager|play|requestor|servermanager|silencer|vocalist\``]);
      });
      it("Will fail if an underlying system fails", function (){
        stubbedAccessManager.revokeRoleAccessById.returns(false);
        fakeMessage.guild.roles.find.returns({name: 'Bogus role'})

        adminUtils.revokerole(fakeMessage, ['play', 'bogus', 'role']);
        expect(fakeMessage.reply.lastCall.args).to.deep.equal([`Something went wrong with that`]);
      });
    });

    describe("silence", () => {
      it("Will silence a voice channel", function (){
        var fakeSilence = sinon.stub();
        stubbedVQM.getQueueFromMessage.returns({silence: fakeSilence})

        adminUtils.silence(fakeMessage, []);

        expect(stubbedVQM.getQueueFromMessage.called).to.be.true;
        expect(fakeSilence.called).to.be.true;
        expect(fakeMessage.reply.calledWith(`Oooooh kaaaaay. I'll go sit in a corner for a while and think about what I did.`)).to.be.true;
      });
      it  ("Will not silence if the user isn't in a channel", function (){
        stubbedVQM.getQueueFromMessage.throws(new Error('Not in channel'))

        adminUtils.silence(fakeMessage, []);

        expect(stubbedVQM.getQueueFromMessage.called).to.be.true;
        expect(fakeMessage.reply.calledWith(`Not in channel`)).to.be.true;
      });
    });

    describe("togglestartup", () => {
      it("Will toggle startup sounds from false to true", function (){
        stubbedNconf.get.withArgs('startup').returns({enabled: false});

        adminUtils.togglestartup(fakeMessage, []);

        expect(stubbedNconf.get.called).to.be.true;
        expect(fakeMessage.reply.calledWith(`Startup audio set: true`)).to.be.true;
      });
      it("Will toggle startup sounds from true to false", function (){
        stubbedNconf.get.withArgs('startup').returns({enabled: true});

        adminUtils.togglestartup(fakeMessage, []);

        expect(stubbedNconf.get.called).to.be.true;
        expect(fakeMessage.reply.calledWith(`Startup audio set: false`)).to.be.true;
      });
    });

    describe("unmute", () => {
      it("Will unmute a voice channel", function (){
        //sinon.stub(vqm, 'getQueueFromMessage').returns({silence:function(){}})
        var fakeUnSilence = sinon.stub();
        stubbedVQM.getQueueFromMessage.returns({unsilence: fakeUnSilence})

        adminUtils.unmute(fakeMessage, []);

        expect(stubbedVQM.getQueueFromMessage.called).to.be.true;
        expect(fakeUnSilence.called).to.be.true;
        expect(fakeMessage.reply.calledWith(`Ok, ready to make some noise.`)).to.be.true;
      });
      it  ("Will not unmute if the user isn't in a channel", function (){
        stubbedVQM.getQueueFromMessage.throws(new Error('Not in channel'))

        adminUtils.unmute(fakeMessage, []);

        expect(stubbedVQM.getQueueFromMessage.called).to.be.true;
        expect(fakeMessage.reply.calledWith(`Not in channel`)).to.be.true;
      });
    });
  });
});
