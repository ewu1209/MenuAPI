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

https.get(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(data);
  });
}).on('error', (error) => {
  console.error('Error:', error);
});