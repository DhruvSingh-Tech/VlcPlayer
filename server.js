const express = require('express');
// const fetch = require('node-fetch');
const https = require('https');
const http = require('http');
const urlModule = require('url');
const path = require('path');
const axios = require('axios');




const app = express();
const PORT = 5000;

// Set headers for SharedArrayBuffer
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});

// Serve local files (index.html, VLC WASM)
app.use(express.static('.'));

// Serve subtitle files
app.use('/subtitles', express.static('./subtitles'));

// Proxy endpoint
app.get('/proxy', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('Missing URL');

    try {
        const response = await axios.get(url, {
            responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 15000 // 15s timeout
        });

        res.setHeader('Content-Type', response.headers['content-type'] || 'video/x-matroska');
        res.setHeader('Access-Control-Allow-Origin', '*');
        response.data.pipe(res);

        response.data.on('end', () => console.log('[Proxy] Video stream ended'));
        response.data.on('error', (err) => console.error('[Proxy] Stream error', err));
    } catch (err) {
        console.error('[Proxy] Axios fetch error:', err.message);
        res.status(500).send('Error fetching video: ' + err.message);
    }
});


app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
