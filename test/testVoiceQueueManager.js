var expect = require("chai").expect;
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var fs = require('fs');
var VoiceQueue = require('../src/VoiceQueue.js');
var VoiceQueueStub = sinon.spy(function() {
  return sinon.createStubInstance(VoiceQueue);
});

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
    debug: sinon.fake(),
    info: sinon.fake()
  }
}


describe("Voice Queue Manager", () => {

  before(() => {
    voiceQueueManager = proxyquire("../src/VoiceQueueManager", {
      './logger': fakeLogger,
      './VoiceQueue': VoiceQueueStub
    });
    sinon.spy(fakeMessage, 'reply');
  });
  after(() => {
  })
  beforeEach(() => {
    sinon.reset();
  });

  describe("Public functions", () => {
    describe("getQueueFromChannel", () => {
      var voiceQueues=[];
      it("Creates a new queue if not present", function () {
        expect(voiceQueueManager.getQueueFromChannel({id: '1'})).to.equal(VoiceQueueStub.returnValues[0])
        expect(VoiceQueueStub.calledWithNew()).to.be.true;
        voiceQueues[0]=VoiceQueueStub.returnValues[0];
      });
      it("Provides an existing queue if present", function () {
        // Stored the output of the first test for checking here
        expect(voiceQueueManager.getQueueFromChannel({id: '1'})).to.equal(voiceQueues[0])
        expect(VoiceQueueStub.calledWithNew()).to.be.false;
      });
    });

    // describe("getQueueFromUser", () => {
    //   var voiceQueues=[];
    //   it("Creates a new queue if not present", function () {
    //     expect(voiceQueueManager.getQueueFromChannel({id: '1'})).to.equal(VoiceQueueStub.returnValues[0])
    //     expect(VoiceQueueStub.calledWithNew()).to.be.true;
    //     voiceQueues[0]=VoiceQueueStub.returnValues[0];
    //   });
    //   it("Provides an existing queue if present", function () {
    //     // Stored the output of the first test for checking here
    //     expect(voiceQueueManager.getQueueFromChannel({id: '1'})).to.equal(voiceQueues[0])
    //     expect(VoiceQueueStub.calledWithNew()).to.be.false;
    //   });
    // });

    // Wow, mocking this looks crazy due to how nested things are :(
    // describe("getVCFromUserid", () => {
    //   var voiceQueues=[];
    //   var fakeDiscord={
    //     guilds: [{voiceStates:{
    //       get: () => { return }
    //     }}]
    //   }
    //   it("Creates a new queue if not present", function () {
    //     expect(voiceQueueManager.getVCFromUserid({id: '1'})).to.equal(VoiceQueueStub.returnValues[0])
    //     expect(VoiceQueueStub.calledWithNew()).to.be.true;
    //     voiceQueues[0]=VoiceQueueStub.returnValues[0];
    //   });
    //   it("Provides an existing queue if present", function () {
    //     // Stored the output of the first test for checking here
    //     expect(voiceQueueManager.getVCFromUserid({id: '1'})).to.equal(voiceQueues[0])
    //     expect(VoiceQueueStub.calledWithNew()).to.be.false;
    //   });
    // });
  });
});
