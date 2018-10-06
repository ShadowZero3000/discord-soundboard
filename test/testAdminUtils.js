var expect = require("chai").expect;
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var fs = require('fs');

var stubbedVQM = sinon.stub(require('../src/VoiceQueueManager'));
var stubbedNconf = sinon.stub(require('nconf'));
var stubbedFileManager = sinon.stub(require('../src/FileManager'))


var testUser = {
  username: 'testuser',
  id: '123'
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

  describe("Public functions", () => {
    describe("add", () => {
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
    });

    describe("access", () => {
      it("Will print access when requested", function (){
        stubbedNconf.get.withArgs('adminList').returns(admins);
        expect(adminUtils.access(fakeMessage, [testUser.username])).to.equal(`Message Reply: ${testUser.username} now has: access`);
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
      it("Will not grant fake permissions", function (){
        stubbedNconf.get.withArgs('adminList').returns(admins);
        sinon.stub(adminUtils,'_saveConfig'); // WTF to do with this?

        adminUtils.grant(fakeMessage, [testUser.username, 'grant', 'bogus']);

        adminUtils._saveConfig.restore();
        expect(fakeMessage.reply.calledWith(`${testUser.username} now has: access, grant`)).to.be.true;
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
      it("Will rename songs that exist", function (){
        stubbedFileManager.inLibrary.returns(true);
        stubbedFileManager.rename.returns(true);

        adminUtils.rename(fakeMessage, ['clip1', 'clip2']);

        expect(stubbedFileManager.rename.calledWith('clip1', 'clip2')).to.be.true;
        expect(fakeMessage.reply.calledWith(`Rename to clip2 complete.`)).to.be.true;

      });
      it("Will not rename songs that do not exist", function (){
        stubbedFileManager.inLibrary.returns(false);
        stubbedFileManager.rename.returns(true);

        adminUtils.rename(fakeMessage, ['clip1','clip2']);

        //console.log(fakeMessage.reply.getCall(0).args);
        expect(stubbedFileManager.inLibrary.called).to.be.true;
        expect(stubbedFileManager.rename.called).to.be.false;
        expect(fakeMessage.reply.calledWith(`Could not find: clip1`)).to.be.true;
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
  });
});
