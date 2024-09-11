const http = require('http');
const https = require('https');
const PORT = 8080;

// API details
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

// Helper function to format price by rounding to nearest dollar (no dollar sign, no cents)
function formatPrice(amount) {
  return Math.round(amount / 100); // Rounds the price to the nearest dollar
}

// Create an HTTP server
http.createServer((req, res) => {
  if (req.url === '/') {
    // Make a GET request to the Square API to fetch catalog data
 