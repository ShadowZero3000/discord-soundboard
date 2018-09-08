var expect = require("chai").expect;
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var fs = require('fs');
var nock = require('nock');


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
  reply: function (message) {
    console.log(`Reply: ${message}`)
  }
}

describe("Discord Soundboard", function () {
  var utils;
  var log;
  before(function () {
    nock(/.*/)
      .get(/.*/)
      .reply(200,'Artificial response');
    utils = sinon.fake();
    log = sinon.fake();
    adminUtils = proxyquire("../AdminUtils", {
      'utils': utils,
      'fs': fs,
      'log': log
    });
  })
  it("creates a Discord client", function () {
    var readFileStub = sinon.stub(fs, 'readFile');
    var createWriteStreamStub = sinon.fake(fs, 'createWriteStream', {});
    adminUtils.add(fakeMessage, ['hi']);
  });
});