'use strict';
// A minimal fake classic AM for the packed-package probes: it listens on 127.0.0.1 only and answers what a
// login round trip asks. No tenant, no network beyond the loopback interface.
const http = require('node:http');

function start() {
  const log = [];
  const server = http.createServer((req, res) => {
    req.on('data', () => {});
    req.on('end', () => {
      log.push(`${req.method} ${req.url}`);
      const send = (code, body, headers = {}) => {
        res.writeHead(code, { 'content-type': 'application/json', ...headers });
        res.end(JSON.stringify(body));
      };
      const url = req.url;
      if (url.startsWith('/am/json/serverinfo/version')) {
        return send(200, {
          _id: 'version',
          version: '7.5.0',
          fullVersion: 'ForgeRock Access Management 7.5.0',
          revision: 'x',
          date: '2024',
        });
      }
      if (url.startsWith('/am/json/serverinfo/*')) {
        return send(200, {
          _id: '*',
          cookieName: 'iPlanetDirectoryPro',
          domains: [],
          realm: '/',
          secureCookie: false,
          forgotPassword: 'false',
        });
      }
      if (url.includes('/authenticate')) {
        return send(
          200,
          {
            tokenId: 'FAKE-SESSION-TOKEN',
            successUrl: '/am/console',
            realm: '/',
          },
          { 'set-cookie': 'iPlanetDirectoryPro=FAKE-SESSION-TOKEN; Path=/' }
        );
      }
      if (url.includes('idFromSession')) {
        return send(200, {
          id: 'amadmin',
          realm: '/',
          dn: 'id=amadmin,ou=user,dc=openam',
          successURL: '/am/console',
          fullLoginURL: '/am/UI/Login',
        });
      }
      if (url.includes('/sessions'))
        return send(200, { valid: true, uid: 'amadmin', realm: '/' });
      send(404, { code: 404, reason: 'Not Found', message: `fake: ${url}` });
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, log, port: server.address().port })
    )
  );
}

module.exports = { start };
