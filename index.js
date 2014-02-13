/**
 * Pigeon
 *
 * Sending mails over HTTP.
 *
 * Copyright (c) 2014 by Hsiaoming Yang.
 */

var fs = require('fs');
var http = require('http');
var path = require('path');
var nodemailer = require("nodemailer");

var themes = ['paper'];
var themeCache = {};


/**
 * Pigeon
 *
 * Create an instance of Pigeon for sending mails.
 */
function Pigeon(config, secret) {
  // config contains mail services
  this.config = config || {};
  this.secret = secret;
}


/**
 * Send mails with the given data.
 */
Pigeon.prototype.send = function(data, cb) {
  var me = this;

  if (!data.title) {
    cb('title is required');
  } else if (data.html || data.text) {
    me.sendMail(data, cb);
  } else if (data.content) {
    render(data, function(err, html) {
      if (err) {
        cb(err);
      } else {
        data.html = html;
        me.sendMail(data, cb);
      }
    });
  } else {
    cb('content is required');
  }
};
Pigeon.prototype.sendMail = function(data, cb) {
  var me = this;

  var config;

  if (~data.user.indexOf('@qq.com') && me.config.qq) {
    config = me.config.qq;
  } else if (~data.user.indexOf('@gmail.com') && me.config.gmail) {
    config = me.config.gmail;
  } else {
    var keys = Object.keys(me.config);
    var index = Math.floor(Math.random() * keys.length);
    if (index >= keys.length) index = keys.length - 1;
    config = me.config[keys[index]];
  }

  var smtp = nodemailer.createTransport('SMTP', config);
  var options = {
    from: config.sender || config.auth.user,
    to: data.user,
    subject: data.title,
  };

  if (data.text) options.text = data.text;
  if (data.html) options.html = data.html;
  smtp.sendMail(options, function(err, resp) {
    cb(err, resp);
    smtp.close();
  });
};


/**
 * Create a HTTP server.
 */
Pigeon.prototype.server = function() {
  var me = this;

  var server = http.createServer(function(req, resp) {
    var secret = req.headers['x-pigeon-secret'];
    var ct = req.headers['content-type'];

    // should return in 10s
    resp.setTimeout(10000);

    if (req.url === '/') {
      resp.writeHead(200);
      resp.end('humor');
    } else if (req.method !== 'POST' || req.url !== '/send') {
      resp.writeHead(404);
      resp.end('not found');
    } else if (secret === me.secret && ct === 'application/json') {
      var buf = '';
      req.setEncoding('utf8');
      req.on('data', function(chunk) { buf += chunk });
      req.on('end', function() {
        // data should contain: user, (title, content) or html
        // data may contain: footer, theme
        var data = JSON.parse(buf);
        me.send(data, function(err) {
          resp.writeHead(200);
          if (err) {
            resp.end(err);
          } else {
            resp.end('ok');
          }
        });
      });
    } else {
      resp.writeHead(404);
      resp.end('invalid');
    }
  });

  return server;
};


function getTheme(name, cb) {
  name = name || 'paper';
  if (!~themes.indexOf(name)) {
    name = 'paper';
  }
  var text = themeCache[name];
  if (text) {
    cb(null, text);
  } else {
    var filepath = path.join(__dirname, 'templates', name + '.html');
    fs.readFile(filepath, {encoding: 'utf8'}, function(err, text) {
      if (err) {
        cb(err);
      } else {
        themeCache[name] = text;
        cb(null, text);
      }
    });
  }
}

function render(data, cb) {
  getTheme(data.theme, function(err, text) {
    if (err) {
      cb(err);
    } else {
      text = text.replace(/\{\{title\}\}/g, data.title || '');
      text = text.replace(/\{\{content\}\}/g, data.content || '');
      text = text.replace(/\{\{footer\}\}/g, data.content || '');
      cb(null, text);
    }
  });
}

module.exports = Pigeon;
