const express = require('express');
const axios = require('axios');

const app = express();

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
    const apiEndpoint = 'https://api.example.com/data';
    const apiParams = {
        // Add your API parameters here
    };

    const data = await callApi(apiEndpoint, apiParams);
    res.json(data);
});

app.listen(8080, () => {
    console.log('Server listening on port 8080');
});



