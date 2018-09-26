var expect = require("chai").expect;
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var fs = require('fs');
var nock = require('nock');
var Discord = require('../src/DiscordBot');
var nconf = require('nconf');
var vqm = require('../src/VoiceQueueManager');

// var stubbedFileManager = {
//   addRequest: sinon.stub().returns(true),
//   getRequests: sinon.stub().returns([]),
//   inLibrary: sinon.stub().returns(true),
//   removeRequest: sinon.stub(),
//   register: sinon.stub().returns(true),
//   deregister: sinon.stub(),
//   create: sinon.stub().returns(true),
//   delete: sinon.stub().returns(true),
//   get: sinon.stub().returns({'name': 'test'}), //Needs more?
//   getAll: sinon.stub().returns([]),
//   getCategory: sinon.stub().returns([]),
//   getClipList: sinon.stub().returns([]),
//   getRandomList: sinon.stub().returns([]),
//   getCategorizedFiles: sinon.stub().returns([]),
//   getStream: sinon.stub().returns(), //File stream?
//   inLibrary: sinon.stub().returns(true),
//   inRandoms: sinon.stub().returns(true),
//   random: sinon.stub().returns('clip'),
//   rename: sinon.stub().returns(true)
// }

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

nconf.defaults({
  KEY_SYMBOL: '!',
  adminList: admins
});

var fakeMessage = {
  attachments: {
    first: function() {
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
var fakeVQM = sinon.stub(vqm);

describe("Admin Utils", function () {

  before(function () {
    nock(/.*/)
      .get(/.*/)
      .reply(200,'Artificial response');
    adminUtils = proxyquire("../src/AdminUtils", {
      './VoiceQueueManager': fakeVQM,
      './logger': fakeLogger,
      './FileManager': stubbedFileManager
    });
    sinon.spy(fakeMessage, 'reply');
  });
  beforeEach(function() {
    sinon.reset();
  });

  describe("Private functions", function() {
    describe("_admins", function() {
      it("Returns admins", function () {
        sinon.stub(nconf, 'get').returns(admins);
        expect(adminUtils._admins()).to.deep.equal(admins)
        nconf.get.restore();
      });
    });

    describe("_getDiscordUser", function() {
      it("Returns the user", function () {
        expect(adminUtils._getDiscordUser(fakeMessage, testUser.username)).to.deep.equal({user: testUser})
      });
    });

    describe("_paramCheck", function() {
      it("Returns parameters", function () {
        expect(adminUtils._paramCheck(fakeMessage, ['one', 'two'])).to.be.true;
        expect(adminUtils._paramCheck(fakeMessage, ['one', 'two'], 2)).to.be.true;
        expect(adminUtils._paramCheck(fakeMessage, ['one', 'two'], 3)).to.be.false;
        expect(adminUtils._paramCheck(fakeMessage, [])).to.be.false;
      });
    });

    describe("_printAccess", function() {
      it("Prints access for a user", function () {
        expect(adminUtils._printAccess(fakeMessage, testUser.username, testUser.id)).to.equal(`Message Reply: ${testUser.username} now has: access`);
      });
    });
    /* I have no idea how to test this thing without finding a good way to mock up nconf */
    // describe("_saveConfig", function() {
    //   it("Prints access for a user", function () {
    //     sinon.stub(nconf, 'save');
    //     sinon.stub(nconf, 'set');
    //     sinon.stub(nconf, 'stores').value({file:{file:'blah'}})
    //     adminUtils._saveConfig('key', 'value');
    //     expect(nconf.set.called).to.be.true;
    //     nconf.save.restore();
    //     nconf.set.restore();
    //   });
    // });

  });

  describe("Public functions", function() {
    describe("add", function() {
      it("Can add a new sound", function () {
        sinon.stub(nconf, 'get').returns('!');
        stubbedFileManager.inLibrary.returns(false);
        nconf.get.restore();

        expect(adminUtils.add(fakeMessage, ['hi'])).to.equal('Message Reply: !hi is now available');
        expect(stubbedFileManager.inLibrary.called).to.be.true;
        expect(stubbedFileManager.create.called).to.be.true;
      });
      it("Won't re-add the same sound", function () {
        sinon.stub(nconf, 'get').returns('!');
        stubbedFileManager.inLibrary.returns(true);
        nconf.get.restore();

        expect(adminUtils.add(fakeMessage, ['hi'])).to.equal('Message Reply: That sound effect already exists');
        expect(stubbedFileManager.inLibrary.called).to.be.true;
      });
    });

    describe("access", function() {
      it("Will print access when requested", function (){
        expect(adminUtils.access(fakeMessage, [testUser.username])).to.equal(`Message Reply: ${testUser.username} now has: access`);
      });
    });

    describe("categorize", function() {
      it("Has a help function", function() {
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

    describe("grant", function() {
      it("Has a help function", function() {
        expect(adminUtils.grant(fakeMessage, ['help'])).to.match(/Message Reply: grant `<username>` `<permission>`.*/);
      });
      it("Will grant users permissions", function (){
        sinon.stub(adminUtils,'_saveConfig'); // WTF to do with this?

        adminUtils.grant(fakeMessage, [testUser.username, 'grant']);

        adminUtils._saveConfig.restore();
        expect(fakeMessage.reply.calledWith(`${testUser.username} now has: access, grant`)).to.be.true;
      });
      it("Will not grant fake permissions", function (){
        sinon.stub(adminUtils,'_saveConfig'); // WTF to do with this?

        adminUtils.grant(fakeMessage, [testUser.username, 'grant', 'bogus']);

        adminUtils._saveConfig.restore();
        expect(fakeMessage.reply.calledWith(`${testUser.username} now has: access, grant`)).to.be.true;
      });
    });

    describe("remove", function() {
      it("Has a help function", function() {
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

    describe("rename", function() {
      it("Has a help function", function() {
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

    describe("request", function() {
      it("Has a help function", function() {
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

    describe("reqlist", function() {
      it("Tells you what has been requested", function (){
        stubbedFileManager.getRequests.returns([{name:'clip1',description:'test description'}]);

        adminUtils.reqlist(fakeMessage, []);

        expect(stubbedFileManager.getRequests.called).to.be.true;
        expect(fakeMessage.reply.calledWith(`Here's what we've got requested:\nclip1 - test description`)).to.be.true;
      });
    });

    describe("revoke", function() {
      it("Has a help function", function() {
        expect(adminUtils.revoke(fakeMessage, ['help'])).to.match(/Message Reply: revoke `<username>` `<permission>`.*/);
      });
      it("Will revoke users permissions if present", function (){
        sinon.stub(adminUtils,'_saveConfig'); // WTF to do with this?

        // Our test data didn't get reset before this :(
        // We need to fix that
        adminUtils.revoke(fakeMessage, [testUser.username, 'grant']);

        adminUtils._saveConfig.restore();
        //console.log(fakeMessage.reply.getCall(0).args)
        expect(fakeMessage.reply.calledWith(`${testUser.username} now has: access`)).to.be.true;

      });
      it("Will not revoke permissions from immune users", function (){
        sinon.stub(adminUtils,'_saveConfig'); // WTF to do with this?

        adminUtils.revoke(fakeMessage, ['immuneuser', 'revoke', 'grant']);

        adminUtils._saveConfig.restore();
        //console.log(fakeMessage.reply.getCall(0).args)
        expect(fakeMessage.reply.calledWith(`${immuneUser.username} is immune to revokes`)).to.be.true;
      });
    });

    describe("silence", function() {
      it("Will silence a voice channel", function (){
        //sinon.stub(vqm, 'getQueueFromMessage').returns({silence:function(){}})
        var fakeSilence = sinon.stub();
        fakeVQM.getQueueFromMessage.returns({silence: fakeSilence})

        adminUtils.silence(fakeMessage, []);

        expect(fakeVQM.getQueueFromMessage.called).to.be.true;
        expect(fakeSilence.called).to.be.true;
        expect(fakeMessage.reply.calledWith(`Oooooh kaaaaay. I'll go sit in a corner for a while and think about what I did.`)).to.be.true;
      });
      it  ("Will not silence if the user isn't in a channel", function (){
        fakeVQM.getQueueFromMessage.throws(new Error('Not in channel'))

        adminUtils.silence(fakeMessage, []);

        expect(fakeVQM.getQueueFromMessage.called).to.be.true;
        expect(fakeMessage.reply.calledWith(`Not in channel`)).to.be.true;
      });
    });

    describe("togglestartup", function() {
      it("Will toggle startup sounds from false to true", function (){
        sinon.stub(adminUtils,'_saveConfig'); // WTF to do with this?
        sinon.stub(nconf, 'get').returns({enabled: false});

        adminUtils.togglestartup(fakeMessage, []);

        adminUtils._saveConfig.restore();
        expect(nconf.get.called).to.be.true;
        nconf.get.restore();

        expect(fakeMessage.reply.calledWith(`Startup audio set: true`)).to.be.true;

      });
      it("Will toggle startup sounds from true to false", function (){
        sinon.stub(adminUtils,'_saveConfig'); // WTF to do with this?
        sinon.stub(nconf, 'get').returns({enabled: true});

        adminUtils.togglestartup(fakeMessage, []);

        adminUtils._saveConfig.restore();
        expect(nconf.get.called).to.be.true;
        nconf.get.restore();

        expect(fakeMessage.reply.calledWith(`Startup audio set: false`)).to.be.true;
      });
    });
  });
});
