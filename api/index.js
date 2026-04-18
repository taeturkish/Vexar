const express = require('express');
const app = express();
app.use(express.json());

app.post('/api/auth/register', (req, res) => {
    res.json({ success: true, message: 'OK' });
});

app.get('/api/test', (req, res) => {
    res.json({ message: 'API çalışıyor!' });
});

app.get('/setup', (req, res) => {
    res.sendFile('setup.html', { root: './public' });
});

app.get('/:name', (req, res) => {
    res.send(`<h1>${req.params.name} Sunucusu</h1>`);
});

app.get('/', (req, res) => {
    res.send('<h1>Vexar Çalışıyor</h1>');
});

module.exports = app;
