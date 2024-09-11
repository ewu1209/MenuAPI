const express = require('express');
const axios = require('axios');

const app = express();
const authorizationToken = `Bearer ${process.env.SQUARE}`;
const squareVersion = '2024-08-21';


async function callApi(url, params = {}) {
    try {
        const response = await axios.get(url, { params });
        return response.data;
    } catch (error) {
        console.error('Error calling API:', error);
        return { error: 'API call failed' };
    }
}

app.get('/api', async (req, res) => {
    const apiEndpoint = 'https://connect.squareup.com/v2/catalog/list';
    const apiParams = {
      'Square-Version': squareVersion,
      'Authorization': authorizationToken,
      'Content-Type': 'application/json',
    };

    const data = await callApi(apiEndpoint, apiParams);
    res.json(data);
});

app.listen(8080, () => {
    console.log('Server listening on port 8080');
});
