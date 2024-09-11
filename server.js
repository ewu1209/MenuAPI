const http = require('http');
const https = require('https');

const authorizationToken = `Bearer ${process.env.SQUARE}`;
const squareVersion = '2024-08-21';
const apiEndpoint = 'https://connect.squareup.com/v2/catalog/list';

const options = {
  hostname: new URL(apiEndpoint).hostname,
  port: 443,
  path: new URL(apiEndpoint).pathname,
  method: 'GET',
  headers: {
    'Square-Version': squareVersion,
    'Authorization': authorizationToken,
    'Content-Type': 'application/json',
  },
};

const server = http.createServer((req, res) => {
  https.get(options, (apiRes) => {
    let data = '';

    apiRes.on('data', (chunk) => {
      data += chunk;
    });

    apiRes.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
  }).on('error', (error) => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error fetching data');
  });
});

server.listen(8080, () => {
  console.log('Server running at http://localhost:8080/');
});