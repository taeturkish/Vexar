const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Rcon } = require('rcon-client');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'vexar-secret-key-2024-degis-bunu';

// Modeller
const ServerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subdomain: { type: String, required: true, unique: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ip: { type: String, required: true },
  port: { type: Number, default: 25565 },
  rconPort: { type: Number, default: 25575 },
  rconPassword: { type: String },
  status: { type: String, enum: ['active', 'inactive', 'maintenance'], default: 'active' },
  onlinePlayers: { type: Number, default: 0 },
  maxPlayers: { type: Number, default: 100 },
  version: { type: String, default: '1.20.4' },
  wallpaper: { type: String, default: '/assets/default-wallpaper.jpg' },
  storeWallpaper: { type: String, default: null },
  supportWallpaper: { type: String, default: null },
  logo: { type: String, default: '/assets/logo.png' },
  favicon: { type: String, default: '/assets/favicon.ico' },
  primaryColor: { type: String, default: '#5865F2' },
  secondaryColor: { type: String, default: '#00ff88' },
  createdAt: { type: Date, default: Date.now }
});

const Server = mongoose.models.Server || mongoose.model('Server', ServerSchema);

// Kullanıcı Modeli (referans için)
const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  role: String,
  serverId: String,
  credits: Number,
  rank: String
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// Ayarlar Modeli
const SettingsSchema = new mongoose.Schema({
  serverId: { type: String, required: true, unique: true },
  siteName: { type: String, default: 'Vexar Project' },
  siteDescription: { type: String },
  testMode: { type: Boolean, default: true },
  maintenance: { type: Boolean, default: false },
  googleAnalytics: { type: String },
  googleSearchConsole: { type: String },
  paymentMethods: {
    shopier: { enabled: Boolean, apiKey: String, secretKey: String },
    paytr: { enabled: Boolean, merchantId: String, merchantKey: String, merchantSalt: String }
  }
});

const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

// Kategori Modeli
const CategorySchema = new mongoose.Schema({
  serverId: { type: String, required: true },
  name: { type: String, required: true },
  description: String,
  icon: { type: String, default: 'fas fa-folder' },
  order: { type: Number, default: 0 }
});

const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);

// Çark Ödül Modeli
const SpinPrizeSchema = new mongoose.Schema({
  serverId: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['credits', 'rank'], required: true },
  value: { type: String, required: true },
  weight: { type: Number, default: 10 },
  color: { type: String, default: '#5865F2' },
  icon: { type: String, default: 'fa-gift' },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 }
});

const SpinPrize = mongoose.models.SpinPrize || mongoose.model('SpinPrize', SpinPrizeSchema);

// Token doğrulama middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token bulunamadı!' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Geçersiz token!' });
    req.user = user;
    next();
  });
};

// ==================== SUNUCU OLUŞTURMA (SİTE KURULUMU) ====================
router.post('/create-server', authenticateToken, async (req, res) => {
  try {
    const { name, subdomain, ip, port, rconPort, rconPassword, version } = req.body;

    // Validasyon
    if (!name || !subdomain || !ip) {
      return res.status(400).json({ error: 'Site adı, alt alan adı ve IP adresi zorunludur!' });
    }

    // Subdomain formatını temizle
    const cleanSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
    
    if (cleanSubdomain.length < 3) {
      return res.status(400).json({ error: 'Alt alan adı en az 3 karakter olmalıdır!' });
    }

    // Yasaklı subdomain'ler
    const forbiddenSubdomains = ['admin', 'api', 'www', 'mail', 'ftp', 'smtp', 'pop', 'imap', 'ns1', 'ns2', 'test', 'demo', 'app', 'dashboard'];
    if (forbiddenSubdomains.includes(cleanSubdomain)) {
      return res.status(400).json({ error: 'Bu alt alan adı kullanılamaz!' });
    }

    // Subdomain zaten kullanımda mı?
    const existingServer = await Server.findOne({ subdomain: cleanSubdomain });
    if (existingServer) {
      return res.status(400).json({ error: 'Bu alt alan adı zaten kullanılıyor! Lütfen başka bir tane seçin.' });
    }

    // RCON bağlantısını test et (isteğe bağlı)
    let rconTestSuccess = false;
    if (rconPort && rconPassword) {
      try {
        const rcon = await Rcon.connect({
          host: ip,
          port: parseInt(rconPort),
          password: rconPassword,
          timeout: 5000
        });
        await rcon.send('list');
        rcon.end();
        rconTestSuccess = true;
        console.log(`✅ RCON bağlantısı başarılı: ${ip}:${rconPort}`);
      } catch (rconError) {
        console.warn(`⚠️ RCON bağlantısı başarısız: ${ip}:${rconPort} - ${rconError.message}`);
        // RCON başarısız olsa da site kurulumuna devam et
      }
    }

    // Yeni sunucu oluştur
    const server = new Server({
      name,
      subdomain: cleanSubdomain,
      ip,
      port: parseInt(port) || 25565,
      rconPort: parseInt(rconPort) || 25575,
      rconPassword: rconPassword || null,
      version: version || '1.20.4',
      ownerId: req.user.userId,
      status: 'active'
    });

    await server.save();
    console.log(`✅ Sunucu oluşturuldu: ${cleanSubdomain}.vexar.net`);

    // Kullanıcıyı güncelle ve admin yap
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
    }

    user.serverId = server._id.toString();
    user.role = 'admin';
    await user.save();

    // Varsayılan site ayarlarını oluştur
    const settings = new Settings({
      serverId: server._id.toString(),
      siteName: name,
      testMode: true
    });
    await settings.save();

    // Varsayılan kategorileri oluştur
    const defaultCategories = [
      { name: 'VIP', description: 'VIP rütbeleri ve avantajları', icon: 'fas fa-crown', order: 0 },
      { name: 'Kredi', description: 'Sunucu içi kredi paketleri', icon: 'fas fa-coins', order: 1 },
      { name: 'Eşya', description: 'Özel eşya ve kitler', icon: 'fas fa-box', order: 2 },
      { name: 'Özel', description: 'Özel ürünler ve paketler', icon: 'fas fa-star', order: 3 }
    ];

    for (const cat of defaultCategories) {
      const category = new Category({
        serverId: server._id.toString(),
        ...cat
      });
      await category.save();
    }

    // Varsayılan çark ödüllerini oluştur
    const defaultPrizes = [
      { name: '100 Kredi', type: 'credits', value: '100', weight: 30, color: '#00ff88', icon: 'fa-coins', active: true, order: 0 },
      { name: '250 Kredi', type: 'credits', value: '250', weight: 25, color: '#00ff88', icon: 'fa-coins', active: true, order: 1 },
      { name: '500 Kredi', type: 'credits', value: '500', weight: 20, color: '#00ff88', icon: 'fa-coins', active: true, order: 2 },
      { name: '1000 Kredi', type: 'credits', value: '1000', weight: 15, color: '#5865F2', icon: 'fa-coins', active: true, order: 3 },
      { name: 'VIP Rütbesi', type: 'rank', value: 'VIP', weight: 5, color: '#FFD700', icon: 'fa-crown', active: true, order: 4 },
      { name: 'MVP Rütbesi', type: 'rank', value: 'MVP', weight: 3, color: '#FF6B6B', icon: 'fa-crown', active: true, order: 5 },
      { name: '5000 Kredi', type: 'credits', value: '5000', weight: 2, color: '#FFD700', icon: 'fa-gem', active: true, order: 6 }
    ];

    for (const prize of defaultPrizes) {
      const newPrize = new SpinPrize({
        serverId: server._id.toString(),
        ...prize
      });
      await newPrize.save();
    }

    // Yeni token oluştur (güncellenmiş bilgilerle)
    const newToken = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        role: user.role,
        serverId: server._id.toString()
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Başarılı yanıt
    res.status(201).json({
      success: true,
      message: 'Sunucu başarıyla oluşturuldu!',
      server: {
        id: server._id,
        name: server.name,
        subdomain: server.subdomain,
        ip: server.ip,
        port: server.port,
        version: server.version,
        status: server.status,
        createdAt: server.createdAt
      },
      token: newToken,
      siteURL: `https://${cleanSubdomain}.vexar.net`,
      adminURL: `https://${cleanSubdomain}.vexar.net/admin`,
      rconStatus: rconTestSuccess ? 'connected' : 'failed'
    });

  } catch (error) {
    console.error('❌ Sunucu oluşturma hatası:', error);
    res.status(500).json({
      success: false,
      error: 'Sunucu oluşturulamadı: ' + error.message
    });
  }
});

// ==================== SUNUCU BİLGİSİ GETİR ====================
router.get('/info/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;

    const server = await Server.findOne({ subdomain });
    if (!server) {
      return res.status(404).json({ error: 'Sunucu bulunamadı!' });
    }

    // Hassas bilgileri gizle
    const serverInfo = {
      name: server.name,
      subdomain: server.subdomain,
      ip: server.ip,
      port: server.port,
      status: server.status,
      onlinePlayers: server.onlinePlayers,
      maxPlayers: server.maxPlayers,
      version: server.version,
      wallpaper: server.wallpaper,
      logo: server.logo,
      primaryColor: server.primaryColor,
      secondaryColor: server.secondaryColor
    };

    res.json(serverInfo);

  } catch (error) {
    console.error('Sunucu bilgisi hatası:', error);
    res.status(500).json({ error: 'Sunucu bilgisi alınamadı!' });
  }
});

// ==================== SUBDOMAIN KONTROLÜ ====================
router.get('/check-subdomain/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;
    const cleanSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');

    const existingServer = await Server.findOne({ subdomain: cleanSubdomain });
    
    res.json({
      available: !existingServer,
      subdomain: cleanSubdomain,
      suggested: existingServer ? `${cleanSubdomain}${Math.floor(Math.random() * 1000)}` : cleanSubdomain
    });

  } catch (error) {
    res.status(500).json({ error: 'Kontrol başarısız!' });
  }
});

// ==================== SUNUCU LİSTESİ (ADMIN) ====================
router.get('/all', authenticateToken, async (req, res) => {
  try {
    // Sadece admin kullanıcılar tüm sunucuları görebilir
    const user = await User.findById(req.user.userId);
    
    let servers;
    if (user.role === 'admin' && !user.serverId) {
      // Süper admin - tüm sunucuları gör
      servers = await Server.find().sort({ createdAt: -1 });
    } else {
      // Normal kullanıcı - sadece kendi sunucusunu gör
      servers = await Server.find({ _id: user.serverId });
    }

    res.json(servers);

  } catch (error) {
    res.status(500).json({ error: 'Sunucu listesi alınamadı!' });
  }
});

module.exports = router;
