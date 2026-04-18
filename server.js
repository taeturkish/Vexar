// ============= GLOBAL ADMIN SİSTEMİ =============
const GLOBAL_ADMIN_PASSWORD = "vexar2024";
let globalFeatures = ['magaza', 'admin']; // Varsayılan global özellikler
const fs = require('fs');

// Global Admin Giriş Sayfası
app.get('/global-admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'global-admin-login.html'));
});

// Global Admin Giriş API
app.post('/api/global-admin/login', (req, res) => {
    const { password } = req.body;
    
    if (password === GLOBAL_ADMIN_PASSWORD) {
        req.session.globalAdmin = true;
        res.json({ success: true, redirect: '/global-admin/panel' });
    } else {
        res.status(401).json({ error: 'Geçersiz şifre' });
    }
});

// Global Admin Panel (Korumalı)
app.get('/global-admin/panel', (req, res) => {
    if (!req.session.globalAdmin) {
        return res.redirect('/global-admin');
    }
    res.sendFile(path.join(__dirname, 'views', 'global-admin-panel.html'));
});

// Global Özellikleri Getir
app.get('/api/global-admin/features', (req, res) => {
    if (!req.session.globalAdmin) {
        return res.status(401).json({ error: 'Yetkisiz' });
    }
    
    // Templates klasöründeki mevcut dosyaları tara
    const templatesDir = path.join(__dirname, 'public', 'templates');
    const availableTemplates = fs.existsSync(templatesDir) 
        ? fs.readdirSync(templatesDir)
            .filter(file => file.endsWith('.html'))
            .map(file => file.replace('.html', ''))
        : [];
    
    res.json({ 
        globalFeatures,
        availableTemplates 
    });
});

// Global Özellik Ekle
app.post('/api/global-admin/features/add', (req, res) => {
    if (!req.session.globalAdmin) {
        return res.status(401).json({ error: 'Yetkisiz' });
    }
    
    const { feature } = req.body;
    
    // Template dosyası var mı kontrol et
    const templatePath = path.join(__dirname, 'public', 'templates', `${feature}.html`);
    
    if (!fs.existsSync(templatePath)) {
        return res.status(400).json({ 
            error: `${feature}.html dosyası templates klasöründe bulunamadı!` 
        });
    }
    
    if (!globalFeatures.includes(feature)) {
        globalFeatures.push(feature);
        res.json({ success: true, message: `${feature} tüm sitelere eklendi!` });
    } else {
        res.status(400).json({ error: 'Bu özellik zaten ekli' });
    }
});

// Global Özellik Sil
app.delete('/api/global-admin/features/:feature', (req, res) => {
    if (!req.session.globalAdmin) {
        return res.status(401).json({ error: 'Yetkisiz' });
    }
    
    const { feature } = req.params;
    const index = globalFeatures.indexOf(feature);
    
    if (index > -1) {
        globalFeatures.splice(index, 1);
        res.json({ success: true, message: `${feature} tüm sitelerden kaldırıldı!` });
    } else {
        res.status(404).json({ error: 'Özellik bulunamadı' });
    }
});

// Global Admin Çıkış
app.get('/api/global-admin/logout', (req, res) => {
    req.session.globalAdmin = false;
    res.redirect('/global-admin');
});

// ============= GÜNCELLENMİŞ DİNAMİK ROUTING =============
// Sayfa routing (global özellik kontrolü ile)
app.get('/:siteAdi/:sayfa', (req, res, next) => {
    const { siteAdi, sayfa } = req.params;
    
    if (sistemSayfalari.includes(siteAdi)) return next();
    
    const site = servers.find(s => s.subdomain === siteAdi);
    if (!site) return res.status(404).send('Site bulunamadı');
    if (site.status === 'maintenance') return res.redirect(`/${siteAdi}`);
    
    // Global özelliklerde var mı kontrol et
    if (globalFeatures.includes(sayfa)) {
        const templatePath = path.join(__dirname, 'public', 'templates', `${sayfa}.html`);
        
        if (fs.existsSync(templatePath)) {
            return res.sendFile(templatePath);
        }
    }
    
    res.status(404).send('Sayfa bulunamadı');
});
