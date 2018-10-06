var expect = require("chai").expect;
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var fs = require('fs');

var stubbedVQM = sinon.stub(require('../src/VoiceQueueManager'));
var stubbedNconf = sinon.stub(require('nconf'));
var stubbedFileManager = sinon.stub(require('../src/FileManager'));
var stubbedAccessManager = sinon.stub(require('../src/AccessManager'));


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
    members: [{user: testUser},{user: immuneUser}]
  },
  reply: function (message) {
    return `Message Reply: ${message}`;
  }
}

var fakeLogger = {
  errorLog: {
    debug: sinon.fake()
  }
}

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
    describe("_admins", () => {
      it("Returns admins", function () {
        stubbedNconf.get.withArgs('adminList').returns(admins);
        expect(adminUtils._admins()).to.deep.equal(admins)
        expect(stubbedNconf.get.calledWith('adminList')).to.be.true;
      });
    });

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

    describe("_printAccess", () => {
      it("Prints access for a user", function () {
        stubbedNconf.get.withArgs('adminList').returns(admins);
        expect(adminUtils._printAccess(fakeMessage, testUser.username, testUser.id)).to.equal(`Message Reply: ${testUser.username} now has: access`);
      });
    });

    describe("_saveConfig", () => {
      it("Saves a parameter value", function () {
        sinon.stub(fs, 'readFile');
        fs.readFile.yields(null, {file: 'blah'})

        stubbedNconf.save.yields(null);
        sinon.stub(console, 'dir');

        adminUtils._saveConfig('key', 'value');

        console.dir.restore();

        expect(stubbedNconf.set.called).to.be.true;
        expect(fs.readFile.called).to.be.true;
      });
    });

  });

  describe("Non-admin public functions", () => {
    describe("check", () => {
      it("Verifies that access is granted", function () {
        stubbedNconf.get.withArgs('adminList').returns(admins);
        expect(adminUtils.check(fakeMessage, 'access')).to.be.true;
      });
      it("Does not permit access that is not granted", function() {
        stubbedNconf.get.withArgs('adminList').returns(admins);
        expect(adminUtils.check(fakeMessage, 'revoke')).to.be.false;
      });
    });
    describe("getActions", () => {
      it("Returns all admin actions", function () {
        expect(adminUtils.getActions()).to.deep.equal([
          "access", "accessrole", "add",
          "categorize", "grant", "grantrole",
          "remove", "rename", "request",
          "reqlist", "revoke", "revokerole",
          "silence", "togglestartup", "unmute"]);
      });
    });
    describe("getUserActions", () => {
      it("Returns all actions the user is authorized for", function () {
        stubbedNconf.get.withArgs('adminList').returns(admins);
        expect(adminUtils.getUserActions(fakeMessage)).to.equal(admins['123']['access']);
      });
      it("Returns nothing if the user is not found", function () {
        stubbedNconf.get.withArgs('adminList').returns([]);
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
        stubbedNconf.get.withArgs('adminList').returns(admins);
        expect(adminUtils.access(fakeMessage, [testUser.username])).to.equal(`Message Reply: ${testUser.username} now has: access`);
      });
      it("Will print a message for users with no access", function (){
        stubbedNconf.get.withArgs('adminList').returns([]);
        expect(adminUtils.access(fakeMessage, [testUser.username])).to.equal(`Message Reply: ${testUser.username} does not presently have any admin permissions`);
      });
    });

    describe("accessrole", () => {
      it("Will print access by role when requested", function (){
        stubbedAccessManager.getAccess.onFirstCall().returns([{name: 'Play role'}]);
        stubbedAccessManager.getAccess.onSecondCall().returns([{name: 'Request role'}]);
        stubbedAccessManager.getAccess.onThirdCall().returns([{name: 'Admin role'}]);

        expect(adminUtils.accessrole(fakeMessage)).to.equal(
          `Message Reply: Roles with play permission: Play role\n`+
          `Roles with request permission: Request role\n`+
          `Roles with admin permission: Admin role`
        );
      });
    });

    describe("add", () => {
      it("Has a help function", () => {
        expect(adminUtils.add(fakeMessage, ['help'])).to.match(/Message Reply: add `<clip>` `\[category]` \(with attachment\).*/);
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
        expect(adminUtils.categorize(fakeMessage, ['help'])).to.match(/Message Reply: categorize `<new category>` `<clip>`.*/);
      });
      it("Will error if the sound doesn't exist", function (){
        expect(adminUtils.categorize(fakeMessage, ['category1', 'soundclip'])).to.be.true;
        expect(fakeMessage.reply.calledWith(`I don't recognize soundclip`)).to.be.true;
      });
      it("Will change a sound's category", function (){
        stubbedFileManager.inLibrary.returns(true);
        stubbedFileManager.rename.returns(true);

        expect(adminUtils.categorize(fakeMessage, ['category1', 'soundclip'])).to.be.true;

        expect(stubbedFileManager.rename.called).to.be.true
        expect(fakeMessage.reply.calledWith(`soundclip's category is now: category1`)).to.be.true;
      });
      it("Will not categorize clips with a bad category name", function (){
        stubbedFileManager.inLibrary.returns(true);
        stubbedFileManager.rename.returns(true);

        adminUtils.categorize(fakeMessage, ['category!','clip1']);

        expect(stubbedFileManager.rename.called).to.be.false;
        expect(fakeMessage.reply.calledWith(`category! is a bad category name`)).to.be.true;
      });
    });

    describe("grant", () => {
      it("Has a help function", () => {
        expect(adminUtils.grant(fakeMessage, ['help'])).to.match(/Message Reply: grant `<username>` `<permission>`.*/);
      });
      it("Will grant users permissions", function (){
        stubbedNconf.get.withArgs('adminList').returns(admins);
        sinon.stub(adminUtils,'_saveConfig'); // WTF to do with this?

        adminUtils.grant(fakeMessage, [testUser.username, 'grant']);

        adminUtils._saveConfig.restore();
        expect(fakeMessage.reply.calledWith(`${testUser.username} now has: access, grant`)).to.be.true;
      });
      it("Will grant users permission even if they never been granted permissions", function (){
        stubbedNconf.get.withArgs('adminList').returns(admins);
        sinon.stub(adminUtils,'_saveConfig'); // WTF to do with this?
        sinon.stub(adminUtils,'_getDiscordUser').returns({user: {id: '5'}})

        adminUtils.grant(fakeMessage, [testUser.username + 'bogus', 'grant']);

        adminUtils._saveConfig.restore();
        adminUtils._getDiscordUser.restore();
        expect(fakeMessage.reply.calledWith(`${testUser.username}bogus now has: grant`)).to.be.true;
      });
      it("Will not grant fake permissions", function (){
        stubbedNconf.get.withArgs('adminList').returns(admins);
        sinon.stub(adminUtils,'_saveConfig'); // WTF to do with this?

        adminUtils.grant(fakeMessage, [testUser.username, 'grant', 'bogus']);

        adminUtils._saveConfig.restore();
        expect(fakeMessage.reply.calledWith(`${testUser.username} now has: access, grant`)).to.be.true;
      });
    });

    describe("grantrole", () => {
      it("Has a help function", () => {
        expect(adminUtils.grantrole(fakeMessage, ['help'])).to.match(/Message Reply: grantrole `play|request|admin` `<role name>`.*/);
      });
      it("Will grant a server role permissions", function (){
        stubbedAccessManager.getRole.returns({name: 'Bogus role', id: 1})
        stubbedAccessManager.grantAccessById.returns(true);
        adminUtils.grantrole(fakeMessage, ['play', 'bogus', 'role']);
        expect(fakeMessage.reply.calledWith(`Granted play to 'Bogus role'`)).to.be.true;
        expect(stubbedAccessManager.grantAccessById.called).to.be.true;
      });
      it("Will do nothing given a bad role", function (){
        adminUtils.grantrole(fakeMessage, ['play', 'bogus', 'role']);
        expect(fakeMessage.reply.calledWith(`Couldn't find that role`)).to.be.true;
      });
      it("Will not grant invalid permissions", function (){
        adminUtils.grantrole(fakeMessage, ['bogus', 'bogus', 'role']);

        expect(fakeMessage.reply.calledWith(`Must select the granted access: play|request|admin`)).to.be.true;
      });
      it("Will fail if an underlying system fails", function (){
        stubbedAccessManager.getRole.returns({name: 'Bogus role', id: 1})
        stubbedAccessManager.grantAccessById.returns(false);

        adminUtils.grantrole(fakeMessage, ['play', 'bogus', 'role']);

        expect(fakeMessage.reply.calledWith(`Something went wrong with that`)).to.be.true;
        expect(stubbedAccessManager.grantAccessById.called).to.be.true;
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

        //console.log(fakeMessage.reply.getCall(0).args);
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
        stubbedNconf.get.withArgs('adminList').returns(admins);
        sinon.stub(adminUtils,'_saveConfig'); // WTF to do with this?

        // Our test data didn't get reset before this :(
        // We need to fix that
        adminUtils.revoke(fakeMessage, [testUser.username, 'grant']);

        adminUtils._saveConfig.restore();
        //console.log(fakeMessage.reply.getCall(0).args)
        expect(fakeMessage.reply.calledWith(`${testUser.username} now has: access`)).to.be.true;

      });
      it("Will not revoke permissions from immune users", function (){
        stubbedNconf.get.withArgs('adminList').returns(admins);
        sinon.stub(adminUtils,'_saveConfig'); // WTF to do with this?

        adminUtils.revoke(fakeMessage, ['immuneuser', 'revoke', 'grant']);

        adminUtils._saveConfig.restore();
        //console.log(fakeMessage.reply.getCall(0).args)
        expect(fakeMessage.reply.calledWith(`${immuneUser.username} is immune to revokes`)).to.be.true;
      });
    });

    describe("revokerole", () => {
      it("Has a help function", () => {
        expect(adminUtils.revokerole(fakeMessage, ['help'])).to.match(/Message Reply: revokerole `play|request|admin` `<role name>`.*/);
      });
      it("Will revoke a server role permissions", function (){
        stubbedAccessManager.getRole.returns({name: 'Bogus role', id: 1})
        stubbedAccessManager.revokeAccessById.returns(true);

        adminUtils.revokerole(fakeMessage, ['play', 'bogus', 'role']);

        expect(fakeMessage.reply.calledWith(`Revoked play from 'Bogus role'`)).to.be.true;
        expect(stubbedAccessManager.revokeAccessById.called).to.be.true;
      });
      it("Will do nothing given a bad role", function (){
        adminUtils.revokerole(fakeMessage, ['play', 'bogus', 'role']);

        expect(fakeMessage.reply.calledWith(`Couldn't find that role`)).to.be.true;
      });
      it("Will not revoke invalid permissions", function (){
        adminUtils.revokerole(fakeMessage, ['bogus', 'bogus', 'role']);

        expect(fakeMessage.reply.calledWith(`Must select the revoked access: play|request|admin`)).to.be.true;
      });
      it("Will fail if an underlying system fails", function (){
        stubbedAccessManager.getRole.returns({name: 'Bogus role', id: 1})
        stubbedAccessManager.revokeAccessById.returns(false);

        adminUtils.revokerole(fakeMessage, ['play', 'bogus', 'role']);

        expect(fakeMessage.reply.calledWith(`Something went wrong with that`)).to.be.true;
        expect(stubbedAccessManager.revokeAccessById.called).to.be.true;
      });
    });

    describe("silence", () => {
      it("Will silence a voice channel", function (){
        //sinon.stub(vqm, 'getQueueFromMessage').returns({silence:function(){}})
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
