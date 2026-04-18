const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'vexar-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ============= BASİT DİZİ VERİTABANI =============
let users = [];
let servers = [];
let serverIdCounter = 1;

// Örnek veri (test için)
servers.push({
    id: 1,
    userId: 'test',
    serverName: 'Test Sitesi',
    subdomain: 'dada',
    status: 'running',
    createdAt: new Date()
});

// ============= AUTH ROUTES =============
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    
    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }
    
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true, redirect: '/dashboard' });
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Bu email zaten kayıtlı' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
        id: Date.now().toString(),
        username,
        email,
        password: hashedPassword,
        createdAt: new Date()
    };
    
    users.push(user);
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true, redirect: '/dashboard' });
});

app.get('/dashboard', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// ============= SUNUCU YÖNETİM API =============
app.get('/api/servers', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Yetkisiz' });
    
    const userServers = servers.filter(s => s.userId === req.session.userId);
    res.json(userServers);
});

app.post('/api/servers/create', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Yetkisiz' });
    
    const { serverName, subdomain } = req.body;
    const userId = req.session.userId;
    
    // Limit kontrolü
    const userServerCount = servers.filter(s => s.userId === userId).length;
    if (userServerCount >= 3) {
        return res.status(400).json({ error: 'Maksimum 3 sunucu oluşturabilirsiniz' });
    }
    
    // Subdomain benzersizlik kontrolü
    if (servers.find(s => s.subdomain === subdomain)) {
        return res.status(400).json({ error: 'Bu alt alan adı zaten kullanılıyor' });
    }
    
    const server = {
        id: serverIdCounter++,
        userId,
        serverName,
        subdomain,
        status: 'stopped',
        createdAt: new Date()
    };
    
    servers.push(server);
    res.json({ success: true, server });
});

app.post('/api/servers/:id/start', (req, res) => {
    const server = servers.find(s => s.id === parseInt(req.params.id) && s.userId === req.session.userId);
    if (!server) return res.status(404).json({ error: 'Sunucu bulunamadı' });
    
    server.status = 'running';
    res.json({ success: true });
});

app.post('/api/servers/:id/stop', (req, res) => {
    const server = servers.find(s => s.id === parseInt(req.params.id) && s.userId === req.session.userId);
    if (!server) return res.status(404).json({ error: 'Sunucu bulunamadı' });
    
    server.status = 'maintenance';
    res.json({ success: true });
});

app.delete('/api/servers/:id', (req, res) => {
    const index = servers.findIndex(s => s.id === parseInt(req.params.id) && s.userId === req.session.userId);
    if (index === -1) return res.status(404).json({ error: 'Sunucu bulunamadı' });
    
    servers.splice(index, 1);
    res.json({ success: true });
});

// ============= 🛡️ DÜZELTME 1: ÇAKIŞMA KONTROLÜ =============
// Sistem sayfalarını koruma listesi
const sistemSayfalari = ['login', 'register', 'dashboard', 'api', 'public', 'views', 'css', 'js', 'favicon.ico'];

// Ana sayfa routing - DÜZELTİLMİŞ VERSİYON
app.get('/:siteAdi', (req, res, next) => {
    const siteAdi = req.params.siteAdi;
    
    // 🔥 KRİTİK KONTROL: Eğer gidilmeye çalışılan yer sistem sayfasıysa, bu middleware'i ATLA
    if (sistemSayfalari.includes(siteAdi) || siteAdi.includes('.')) {
        return next();
    }
    
    // DİZİDE ARA - VAR MI?
    const site = servers.find(s => s.subdomain === siteAdi);
    
    if (!site) {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>404 - Site Bulunamadı</title>
                <style>
                    body {
                        margin: 0;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
                        font-family: Arial, sans-serif;
                        color: white;
                    }
                    .error-card {
                        background: rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(10px);
                        padding: 3rem;
                        border-radius: 20px;
                        text-align: center;
                    }
                    h1 { font-size: 4rem; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                </style>
            </head>
            <body>
                <div class="error-card">
                    <h1>404</h1>
                    <p>❌ "${siteAdi}" adında bir Vexar sitesi bulunamadı.</p>
                    <p style="opacity: 0.7; margin-top: 20px;">Böyle bir site mevcut değil veya silinmiş olabilir.</p>
                </div>
            </body>
            </html>
        `);
    }
    
    // Site bakımda mı kontrolü
    if (site.status === 'maintenance') {
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Bakımda - ${site.serverName}</title>
                <style>
                    body {
                        margin: 0;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        font-family: Arial, sans-serif;
                    }
                    .maintenance-card {
                        background: rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(10px);
                        padding: 3rem;
                        border-radius: 20px;
                        text-align: center;
                        color: white;
                    }
                    h1 { font-size: 2.5rem; margin-bottom: 1rem; }
                    p { font-size: 1.2rem; opacity: 0.9; }
                </style>
            </head>
            <body>
                <div class="maintenance-card">
                    <h1>🚧 Bu site bakımdadır</h1>
                    <p>${site.serverName} şu anda bakımda.</p>
                    <p>Lütfen daha sonra tekrar deneyin.</p>
                </div>
            </body>
            </html>
        `);
    }
    
    // DİZİDE VARSA, ANA index.html DOSYASINI GÖNDER
    res.sendFile(path.join(__dirname, 'public', 'templates', 'index.html'));
});

// Mağaza sayfası routing - DÜZELTİLMİŞ VERSİYON
app.get('/:siteAdi/magaza', (req, res, next) => {
    const siteAdi = req.params.siteAdi;
    
    // Sistem sayfası kontrolü
    if (sistemSayfalari.includes(siteAdi)) {
        return next();
    }
    
    // DİZİDE ARA - BU SİTE VAR MI?
    const site = servers.find(s => s.subdomain === siteAdi);
    
    if (!site) {
        return res.status(404).send('Site bulunamadı');
    }
    
    if (site.status === 'maintenance') {
        return res.redirect(`/${siteAdi}`);
    }
    
    // DİZİDE VARSA, TEK magaza.html DOSYASINI GÖNDER
    res.sendFile(path.join(__dirname, 'public', 'templates', 'magaza.html'));
});

// Admin sayfası routing - DÜZELTİLMİŞ VERSİYON
app.get('/:siteAdi/admin', (req, res, next) => {
    const siteAdi = req.params.siteAdi;
    
    // Sistem sayfası kontrolü
    if (sistemSayfalari.includes(siteAdi)) {
        return next();
    }
    
    // DİZİDE ARA - BU SİTE VAR MI?
    const site = servers.find(s => s.subdomain === siteAdi);
    
    if (!site) {
        return res.status(404).send('Site bulunamadı');
    }
    
    if (site.status === 'maintenance') {
        return res.redirect(`/${siteAdi}`);
    }
    
    // DİZİDE VARSA, TEK admin.html DOSYASINI GÖNDER
    res.sendFile(path.join(__dirname, 'public', 'templates', 'admin.html'));
});

app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Vexar Project running on port ${PORT}`);
    console.log(`📝 Mevcut siteler:`, servers.map(s => s.subdomain));
});
