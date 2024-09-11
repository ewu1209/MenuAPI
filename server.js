const axios = require('axios');

const baseUrl = 'https://connect.squareup.com/v2/catalog/list';
const squareVersion = '2024-08-21';
//const authorizationToken = 'Bearer EAAAl6G3bYY4jfBkrKQkXsj1lC5nzLAK2uUAIv526MOqhOguOux3YnwPO6DMKvwA';
const authorizationToken = `Bearer ${process.env.SQUARE}`;

const headers = {
  'Square-Version': squareVersion,
  'Authorization': authorizationToken,
  'Content-Type': 'application/json',
};

axios.get(baseUrl, { headers })
  .then(response => {
    console.log(JSON.stringify(response.data, null, 2));
  })
  .catch(error => {
    console.error('Error fetching products:', error);
  });