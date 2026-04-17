const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Bağlantısı
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vexar';
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB bağlantısı başarılı'))
  .catch(err => console.error('MongoDB bağlantı hatası:', err));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'vexar-secret-key-2024';

// Multer yapılandırması (dosya yükleme)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = '/tmp/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// ==================== MODELS ====================

// Kullanıcı Modeli
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'moderator', 'user'], default: 'user' },
  serverId: { type: String, required: true },
  credits: { type: Number, default: 0 },
  rank: { type: String, default: 'Oyuncu' },
  avatar: { type: String, default: '/assets/default-avatar.png' },
  minecraftUsername: { type: String },
  lastLogin: { type: Date },
  ipAddress: { type: String },
  forcePasswordChange: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Sunucu Modeli
const ServerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subdomain: { type: String, required: true, unique: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ip: { type: String, required: true },
  port: { type: Number, default: 25565 },
  rconPort: { type: Number },
  rconPassword: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  onlinePlayers: { type: Number, default: 0 },
  maxPlayers: { type: Number, default: 100 },
  version: { type: String, default: '1.20.4' },
  wallpaper: { type: String, default: '/assets/default-wallpaper.jpg' },
  storeWallpaper: { type: String },
  supportWallpaper: { type: String },
  logo: { type: String },
  primaryColor: { type: String, default: '#5865F2' },
  secondaryColor: { type: String, default: '#00ff88' },
  googleAnalytics: { type: String },
  googleSearchConsole: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Kategori Modeli
const CategorySchema = new mongoose.Schema({
  serverId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  icon: { type: String },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Ürün Modeli
const ProductSchema = new mongoose.Schema({
  serverId: { type: String, required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  discountPrice: { type: Number },
  image: { type: String },
  rconCommands: [{ type: String }],
  stock: { type: Number, default: -1 },
  featured: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Satın Alım Modeli
const PurchaseSchema = new mongoose.Schema({
  serverId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String },
  price: { type: Number },
  minecraftUsername: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  paymentMethod: { type: String },
  paymentId: { type: String },
  rconStatus: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

// Destek Talebi Modeli
const TicketSchema = new mongoose.Schema({
  serverId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  department: { type: String, enum: ['general', 'payment', 'technical', 'bug'], default: 'general' },
  subject: { type: String, required: true },
  status: { type: String, enum: ['open', 'closed', 'waiting'], default: 'open' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  messages: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    attachments: [String],
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

// Haber Modeli
const NewsSchema = new mongoose.Schema({
  serverId: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  image: { type: String },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Yetkili Başvuru Modeli
const StaffApplicationSchema = new mongoose.Schema({
  serverId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  minecraftUsername: { type: String, required: true },
  age: { type: Number, required: true },
  experience: { type: String, required: true },
  whyJoin: { type: String, required: true },
  availability: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  answers: [{
    questionId: String,
    question: String,
    answer: String
  }],
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNote: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Yetkili Başvuru Soruları Modeli
const StaffQuestionSchema = new mongoose.Schema({
  serverId: { type: String, required: true },
  question: { type: String, required: true },
  type: { type: String, enum: ['text', 'textarea', 'select'], default: 'text' },
  options: [String],
  required: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
});

// Daily Spin Modeli
const DailySpinSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  serverId: { type: String, required: true },
  lastSpin: { type: Date },
  spinCount: { type: Number, default: 0 }
});

// Ayarlar Modeli
const SettingsSchema = new mongoose.Schema({
  serverId: { type: String, required: true, unique: true },
  siteName: { type: String, default: 'Vexar Project' },
  siteDescription: { type: String },
  logo: { type: String },
  favicon: { type: String },
  wallpaper: { type: String },
  storeWallpaper: { type: String },
  supportWallpaper: { type: String },
  primaryColor: { type: String, default: '#5865F2' },
  secondaryColor: { type: String, default: '#00ff88' },
  paymentMethods: {
    shopier: {
      enabled: { type: Boolean, default: false },
      apiKey: { type: String },
      secretKey: { type: String }
    },
    paytr: {
      enabled: { type: Boolean, default: false },
      merchantId: { type: String },
      merchantKey: { type: String },
      merchantSalt: { type: String }
    }
  },
  testMode: { type: Boolean, default: true },
  maintenance: { type: Boolean, default: false }
});

const User = mongoose.model('User', UserSchema);
const Server = mongoose.model('Server', ServerSchema);
const Category = mongoose.model('Category', CategorySchema);
const Product = mongoose.model('Product', ProductSchema);
const Purchase = mongoose.model('Purchase', PurchaseSchema);
const Ticket = mongoose.model('Ticket', TicketSchema);
const News = mongoose.model('News', NewsSchema);
const StaffApplication = mongoose.model('StaffApplication', StaffApplicationSchema);
const StaffQuestion = mongoose.model('StaffQuestion', StaffQuestionSchema);
const DailySpin = mongoose.model('DailySpin', DailySpinSchema);
const Settings = mongoose.model('Settings', SettingsSchema);

// ==================== MIDDLEWARE ====================

// JWT Doğrulama
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token bulunamadı' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Geçersiz token' });
    req.user = user;
    next();
  });
};

// Admin Yetki Kontrolü
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin yetkisi gerekli' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
};

// Sunucu Kontrolü (Subdomain)
const getServerFromRequest = async (req) => {
  const host = req.headers.host;
  const subdomain = host.split('.')[0];
  
  let server;
  if (subdomain && subdomain !== 'www' && subdomain !== 'vexar') {
    server = await Server.findOne({ subdomain });
  }
  
  if (!server) {
    const pathParts = req.path.split('/');
    if (pathParts[1]) {
      server = await Server.findOne({ subdomain: pathParts[1] });
    }
  }
  
  return server;
};

// ==================== AUTH ROUTES ====================

// Kayıt Ol
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, serverId } = req.body;
    
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Kullanıcı adı veya email zaten kullanılıyor' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      username,
      email,
      password: hashedPassword,
      serverId
    });
    
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role, serverId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ token, user: { ...user.toObject(), password: undefined } });
  } catch (error) {
    res.status(500).json({ error: 'Kayıt başarısız' });
  }
});

// Giriş Yap
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, serverId } = req.body;
    
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }],
      serverId 
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Hatalı şifre' });
    }
    
    // Admin ilk giriş kontrolü
    if (user.role === 'admin' && password === '123') {
      user.forcePasswordChange = true;
    }
    
    user.lastLogin = new Date();
    user.ipAddress = req.ip;
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id, username: user.username, role: user.role, serverId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token, 
      user: { ...user.toObject(), password: undefined },
      forcePasswordChange: user.forcePasswordChange
    });
  } catch (error) {
    res.status(500).json({ error: 'Giriş başarısız' });
  }
});

// Şifre Değiştir
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.userId);
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Mevcut şifre hatalı' });
    }
    
    user.password = await bcrypt.hash(newPassword, 10);
    user.forcePasswordChange = false;
    await user.save();
    
    res.json({ message: 'Şifre başarıyla değiştirildi' });
  } catch (error) {
    res.status(500).json({ error: 'Şifre değiştirilemedi' });
  }
});

// ==================== SERVER ROUTES ====================

// Sunucu Bilgisi Getir
app.get('/api/server/info', async (req, res) => {
  try {
    const server = await getServerFromRequest(req);
    if (!server) {
      return res.status(404).json({ error: 'Sunucu bulunamadı' });
    }
    
    // RCON ile online oyuncu sayısını al
    let onlinePlayers = 0;
    try {
      const { Rcon } = require('rcon-client');
      const rcon = await Rcon.connect({
        host: server.ip,
        port: server.rconPort,
        password: server.rconPassword
      });
      const response = await rcon.send('list');
      const match = response.match(/There are (\d+) of a max of (\d+) players online/);
      if (match) {
        onlinePlayers = parseInt(match[1]);
        server.onlinePlayers = onlinePlayers;
        server.maxPlayers = parseInt(match[2]);
        await server.save();
      }
      rcon.end();
    } catch (rconError) {
      console.log('RCON bağlantı hatası:', rconError.message);
    }
    
    res.json({
      name: server.name,
      ip: server.ip,
      port: server.port,
      onlinePlayers: server.onlinePlayers,
      maxPlayers: server.maxPlayers,
      version: server.version,
      wallpaper: server.wallpaper,
      logo: server.logo,
      primaryColor: server.primaryColor,
      secondaryColor: server.secondaryColor
    });
  } catch (error) {
    res.status(500).json({ error: 'Sunucu bilgisi alınamadı' });
  }
});

// Sunucu IP Kopyala (Oyna butonu)
app.get('/api/server/play', async (req, res) => {
  try {
    const server = await getServerFromRequest(req);
    if (!server) {
      return res.status(404).json({ error: 'Sunucu bulunamadı' });
    }
    res.json({ ip: `${server.ip}:${server.port}` });
  } catch (error) {
    res.status(500).json({ error: 'IP bilgisi alınamadı' });
  }
});

// ==================== SETUP ROUTES ====================

// Site Kurulumu - Sunucu Oluştur
app.post('/api/setup/create-server', authenticateToken, async (req, res) => {
  try {
    const { name, subdomain, ip, port, rconPort, rconPassword, version } = req.body;
    
    // Subdomain kullanımda mı kontrol et
    const existingServer = await Server.findOne({ subdomain });
    if (existingServer) {
      return res.status(400).json({ error: 'Bu alt alan adı zaten kullanılıyor!' });
    }
    
    // Yeni sunucu oluştur
    const server = new Server({
      name,
      subdomain,
      ip,
      port: port || 25565,
      rconPort: rconPort || 25575,
      rconPassword,
      version: version || '1.20.4',
      ownerId: req.user.userId,
      status: 'active'
    });
    
    await server.save();
    
    // Kullanıcının serverId'sini güncelle ve admin yap
    const user = await User.findById(req.user.userId);
    user.serverId = server._id.toString();
    user.role = 'admin';
    await user.save();
    
    // Varsayılan ayarları oluştur
    const settings = new Settings({
      serverId: server._id.toString(),
      siteName: name,
      testMode: true
    });
    await settings.save();
    
    // Varsayılan kategoriler oluştur
    const defaultCategories = [
      { name: 'VIP', description: 'VIP rütbeleri ve avantajları', icon: 'fas fa-crown', order: 0 },
      { name: 'Kredi', description: 'Sunucu içi kredi paketleri', icon: 'fas fa-coins', order: 1 },
      { name: 'Eşya', description: 'Özel eşya ve kitler', icon: 'fas fa-box', order: 2 }
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
    
    const SpinPrize = mongoose.model('SpinPrize');
    for (const prize of defaultPrizes) {
      const newPrize = new SpinPrize({
        serverId: server._id.toString(),
        ...prize
      });
      await newPrize.save();
    }
    
    // Yeni token oluştur (güncellenmiş serverId ile)
    const newToken = jwt.sign(
      { userId: user._id, username: user.username, role: user.role, serverId: server._id.toString() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      server,
      token: newToken,
      siteURL: `https://${subdomain}.vexar.net`,
      adminURL: `https://${subdomain}.vexar.net/admin`
    });
    
  } catch (error) {
    console.error('Sunucu oluşturma hatası:', error);
    res.status(500).json({ error: 'Sunucu oluşturulamadı: ' + error.message });
  }
});

// ==================== SPIN PRIZE ADMIN ROUTES ====================

// Ödülleri Getir (Herkese açık - çark için)
app.get('/api/spin/prizes', async (req, res) => {
  try {
    const server = await getServerFromRequest(req);
    let prizes = await SpinPrize.find({ 
      serverId: server._id.toString(),
      active: true 
    }).sort({ order: 1 });
    
    // Eğer hiç ödül yoksa varsayılanları oluştur
    if (prizes.length === 0) {
      const defaultPrizes = [
        { name: '100 Kredi', type: 'credits', value: '100', weight: 30, color: '#00ff88', icon: 'fa-coins' },
        { name: '250 Kredi', type: 'credits', value: '250', weight: 25, color: '#00ff88', icon: 'fa-coins' },
        { name: '500 Kredi', type: 'credits', value: '500', weight: 20, color: '#00ff88', icon: 'fa-coins' },
        { name: '1000 Kredi', type: 'credits', value: '1000', weight: 15, color: '#5865F2', icon: 'fa-coins' },
        { name: 'VIP Rütbesi', type: 'rank', value: 'VIP', weight: 5, color: '#FFD700', icon: 'fa-crown' },
        { name: 'MVP Rütbesi', type: 'rank', value: 'MVP', weight: 3, color: '#FF6B6B', icon: 'fa-crown' },
        { name: '5000 Kredi', type: 'credits', value: '5000', weight: 2, color: '#FFD700', icon: 'fa-gem' }
      ];
      
      for (const p of defaultPrizes) {
        const prize = new SpinPrize({ ...p, serverId: server._id.toString(), order: defaultPrizes.indexOf(p) });
        await prize.save();
        prizes.push(prize);
      }
    }
    
    res.json(prizes);
  } catch (error) {
    res.status(500).json({ error: 'Ödüller alınamadı' });
  }
});

// Admin - Tüm Ödülleri Getir
app.get('/api/admin/spin/prizes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { serverId } = req.user;
    const prizes = await SpinPrize.find({ serverId }).sort({ order: 1 });
    res.json(prizes);
  } catch (error) {
    res.status(500).json({ error: 'Ödüller alınamadı' });
  }
});

// Admin - Ödül Ekle
app.post('/api/admin/spin/prizes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { serverId } = req.user;
    const { name, type, value, weight, color, icon, active, order } = req.body;
    
    const prize = new SpinPrize({
      serverId,
      name,
      type,
      value,
      weight: parseInt(weight) || 10,
      color: color || '#5865F2',
      icon: icon || 'fa-gift',
      active: active !== false,
      order: parseInt(order) || 0
    });
    
    await prize.save();
    res.json(prize);
  } catch (error) {
    res.status(500).json({ error: 'Ödül eklenemedi' });
  }
});

// Admin - Ödül Güncelle
app.put('/api/admin/spin/prizes/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.weight) updates.weight = parseInt(updates.weight);
    if (updates.order) updates.order = parseInt(updates.order);
    if (updates.active !== undefined) updates.active = updates.active === 'true' || updates.active === true;
    
    const prize = await SpinPrize.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );
    res.json(prize);
  } catch (error) {
    res.status(500).json({ error: 'Ödül güncellenemedi' });
  }
});

// Admin - Ödül Sil
app.delete('/api/admin/spin/prizes/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await SpinPrize.findByIdAndDelete(req.params.id);
    res.json({ message: 'Ödül silindi' });
  } catch (error) {
    res.status(500).json({ error: 'Ödül silinemedi' });
  }
});

// Admin - Ödül Sıralamasını Güncelle
app.put('/api/admin/spin/prizes/reorder', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { orders } = req.body; // [{ id: 'xxx', order: 0 }, ...]
    
    for (const item of orders) {
      await SpinPrize.findByIdAndUpdate(item.id, { order: item.order });
    }
    
    res.json({ message: 'Sıralama güncellendi' });
  } catch (error) {
    res.status(500).json({ error: 'Sıralama güncellenemedi' });
  }
});

// ==================== STORE ROUTES ====================

// Kategorileri Getir
app.get('/api/store/categories', async (req, res) => {
  try {
    const server = await getServerFromRequest(req);
    if (!server) {
      return res.status(404).json({ error: 'Sunucu bulunamadı' });
    }
    
    const categories = await Category.find({ serverId: server._id.toString() })
      .sort({ order: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Kategoriler alınamadı' });
  }
});

// Ürünleri Getir
app.get('/api/store/products', async (req, res) => {
  try {
    const server = await getServerFromRequest(req);
    if (!server) {
      return res.status(404).json({ error: 'Sunucu bulunamadı' });
    }
    
    const { categoryId } = req.query;
    const query = { serverId: server._id.toString() };
    if (categoryId) query.categoryId = categoryId;
    
    const products = await Product.find(query)
      .populate('categoryId')
      .sort({ order: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Ürünler alınamadı' });
  }
});

// Ürün Satın Al
app.post('/api/store/purchase', authenticateToken, async (req, res) => {
  try {
    const { productId, minecraftUsername, paymentMethod } = req.body;
    const server = await getServerFromRequest(req);
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Ürün bulunamadı' });
    }
    
    const user = await User.findById(req.user.userId);
    
    // Test modu kontrolü
    const settings = await Settings.findOne({ serverId: server._id.toString() });
    const isTestMode = settings?.testMode || false;
    
    let price = product.discountPrice || product.price;
    let finalPrice = isTestMode ? 0.01 : price;
    
    const purchase = new Purchase({
      serverId: server._id.toString(),
      userId: user._id,
      productId: product._id,
      productName: product.name,
      price: finalPrice,
      minecraftUsername,
      paymentMethod,
      status: isTestMode ? 'completed' : 'pending'
    });
    
    await purchase.save();
    
    // Test modunda RCON komutlarını hemen çalıştır
    if (isTestMode && product.rconCommands.length > 0) {
      try {
        const { Rcon } = require('rcon-client');
        const rcon = await Rcon.connect({
          host: server.ip,
          port: server.rconPort,
          password: server.rconPassword
        });
        
        for (const command of product.rconCommands) {
          const formattedCommand = command.replace('{player}', minecraftUsername);
          await rcon.send(formattedCommand);
        }
        
        rcon.end();
        purchase.rconStatus = 'sent';
        await purchase.save();
      } catch (rconError) {
        console.error('RCON komut hatası:', rconError);
        purchase.rconStatus = 'failed';
        await purchase.save();
      }
    }
    
    res.json({ 
      success: true, 
      purchase,
      redirectUrl: isTestMode ? null : `/payment/${purchase._id}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Satın alma başarısız' });
  }
});

// ==================== PLAYER ROUTES ====================

// Oyuncu Profili
app.get('/api/players/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    // Son işlemleri getir
    const recentPurchases = await Purchase.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.json({
      ...user.toObject(),
      password: undefined,
      recentPurchases
    });
  } catch (error) {
    res.status(500).json({ error: 'Profil bilgileri alınamadı' });
  }
});

// Oyuncu Listesi (Admin)
app.get('/api/players', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { serverId } = req.user;
    const players = await User.find({ serverId })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: 'Oyuncu listesi alınamadı' });
  }
});

// Kredi Ekle/Çıkar (Admin)
app.post('/api/players/:id/credits', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Oyuncu bulunamadı' });
    }
    
    user.credits += amount;
    await user.save();
    
    res.json({ credits: user.credits });
  } catch (error) {
    res.status(500).json({ error: 'Kredi güncellenemedi' });
  }
});

// ==================== DAILY SPIN ROUTES ====================

// Daily Spin Durumu
app.get('/api/daily-spin/status', authenticateToken, async (req, res) => {
  try {
    const server = await getServerFromRequest(req);
    
    let spinData = await DailySpin.findOne({ 
      userId: req.user.userId,
      serverId: server._id.toString()
    });
    
    if (!spinData) {
      spinData = new DailySpin({
        userId: req.user.userId,
        serverId: server._id.toString()
      });
      await spinData.save();
    }
    
    const now = new Date();
    const lastSpin = spinData.lastSpin ? new Date(spinData.lastSpin) : null;
    const canSpin = !lastSpin || (now - lastSpin) >= 24 * 60 * 60 * 1000;
    
    res.json({
      canSpin,
      lastSpin,
      nextSpinTime: lastSpin ? new Date(lastSpin.getTime() + 24 * 60 * 60 * 1000) : now
    });
  } catch (error) {
    res.status(500).json({ error: 'Spin durumu alınamadı' });
  }
});

// Daily Spin Çevir
app.post('/api/daily-spin/spin', authenticateToken, async (req, res) => {
  try {
    const server = await getServerFromRequest(req);
    
    let spinData = await DailySpin.findOne({ 
      userId: req.user.userId,
      serverId: server._id.toString()
    });
    
    if (!spinData) {
      spinData = new DailySpin({
        userId: req.user.userId,
        serverId: server._id.toString()
      });
    }
    
    const now = new Date();
    const lastSpin = spinData.lastSpin ? new Date(spinData.lastSpin) : null;
    
    if (lastSpin && (now - lastSpin) < 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: '24 saat içinde sadece bir kez çevirebilirsiniz' });
    }
    
    // Ödül havuzu
    const prizes = [
      { type: 'credits', amount: 100, weight: 30 },
      { type: 'credits', amount: 250, weight: 25 },
      { type: 'credits', amount: 500, weight: 20 },
      { type: 'credits', amount: 1000, weight: 15 },
      { type: 'rank', rank: 'VIP', weight: 5 },
      { type: 'rank', rank: 'MVP', weight: 3 },
      { type: 'credits', amount: 5000, weight: 2 }
    ];
    
    // Ağırlıklı rastgele seçim
    const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedPrize = prizes[0];
    
    for (const prize of prizes) {
      random -= prize.weight;
      if (random <= 0) {
        selectedPrize = prize;
        break;
      }
    }
    
    // Ödülü ver
    const user = await User.findById(req.user.userId);
    
    if (selectedPrize.type === 'credits') {
      user.credits += selectedPrize.amount;
    } else if (selectedPrize.type === 'rank') {
      user.rank = selectedPrize.rank;
    }
    
    await user.save();
    
    spinData.lastSpin = now;
    spinData.spinCount += 1;
    await spinData.save();
    
    res.json({
      prize: selectedPrize,
      newCredits: user.credits,
      newRank: user.rank
    });
  } catch (error) {
    res.status(500).json({ error: 'Spin başarısız' });
  }
});

// ==================== TICKET ROUTES ====================

// Destek Talebi Oluştur
app.post('/api/tickets', authenticateToken, upload.array('attachments', 5), async (req, res) => {
  try {
    const server = await getServerFromRequest(req);
    const { department, subject, message } = req.body;
    
    const attachments = req.files?.map(f => f.path) || [];
    
    const ticket = new Ticket({
      serverId: server._id.toString(),
      userId: req.user.userId,
      department,
      subject,
      messages: [{
        userId: req.user.userId,
        message,
        attachments
      }]
    });
    
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Destek talebi oluşturulamadı' });
  }
});

// Kullanıcının Taleplerini Getir
app.get('/api/tickets', authenticateToken, async (req, res) => {
  try {
    const tickets = await Ticket.find({ userId: req.user.userId })
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Talepler alınamadı' });
  }
});

// Tüm Talepleri Getir (Admin)
app.get('/api/tickets/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { serverId } = req.user;
    const tickets = await Ticket.find({ serverId })
      .populate('userId', 'username')
      .populate('messages.userId', 'username')
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Talepler alınamadı' });
  }
});

// Talebe Mesaj Ekle
app.post('/api/tickets/:id/messages', authenticateToken, upload.array('attachments', 5), async (req, res) => {
  try {
    const { message } = req.body;
    const attachments = req.files?.map(f => f.path) || [];
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Talep bulunamadı' });
    }
    
    ticket.messages.push({
      userId: req.user.userId,
      message,
      attachments
    });
    
    await ticket.save();
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Mesaj eklenemedi' });
  }
});

// Talep Durumu Güncelle (Admin)
app.put('/api/tickets/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Talep bulunamadı' });
    }
    
    ticket.status = status;
    await ticket.save();
    
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Durum güncellenemedi' });
  }
});

// ==================== NEWS ROUTES ====================

// Haberleri Getir
app.get('/api/news', async (req, res) => {
  try {
    const server = await getServerFromRequest(req);
    const news = await News.find({ serverId: server._id.toString() })
      .populate('authorId', 'username')
      .sort({ createdAt: -1 });
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: 'Haberler alınamadı' });
  }
});

// Haber Oluştur (Admin)
app.post('/api/news', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, content } = req.body;
    const { serverId } = req.user;
    
    const news = new News({
      serverId,
      title,
      content,
      image: req.file?.path,
      authorId: req.user.userId
    });
    
    await news.save();
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: 'Haber oluşturulamadı' });
  }
});

// Haber Güncelle (Admin)
app.put('/api/news/:id', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, content } = req.body;
    
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ error: 'Haber bulunamadı' });
    }
    
    news.title = title;
    news.content = content;
    if (req.file) {
      news.image = req.file.path;
    }
    
    await news.save();
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: 'Haber güncellenemedi' });
  }
});

// Haber Sil (Admin)
app.delete('/api/news/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await News.findByIdAndDelete(req.params.id);
    res.json({ message: 'Haber silindi' });
  } catch (error) {
    res.status(500).json({ error: 'Haber silinemedi' });
  }
});

// ==================== STAFF APPLICATION ROUTES ====================

// Başvuru Sorularını Getir
app.get('/api/staff/questions', async (req, res) => {
  try {
    const server = await getServerFromRequest(req);
    const questions = await StaffQuestion.find({ 
      serverId: server._id.toString(),
      active: true 
    }).sort({ order: 1 });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: 'Sorular alınamadı' });
  }
});

// Başvuru Sorularını Yönet (Admin)
app.post('/api/staff/questions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { question, type, options, required, order } = req.body;
    const { serverId } = req.user;
    
    const staffQuestion = new StaffQuestion({
      serverId,
      question,
      type,
      options,
      required,
      order
    });
    
    await staffQuestion.save();
    res.json(staffQuestion);
  } catch (error) {
    res.status(500).json({ error: 'Soru eklenemedi' });
  }
});

// Başvuru Yap
app.post('/api/staff/apply', authenticateToken, async (req, res) => {
  try {
    const server = await getServerFromRequest(req);
    const { minecraftUsername, age, experience, whyJoin, availability, answers } = req.body;
    
    // Soruları getir ve cevapları doğrula
    const questions = await StaffQuestion.find({ 
      serverId: server._id.toString(),
      active: true 
    });
    
    const formattedAnswers = questions.map(q => {
      const answer = answers.find(a => a.questionId === q._id.toString());
      return {
        questionId: q._id,
        question: q.question,
        answer: answer?.answer || ''
      };
    });
    
    const application = new StaffApplication({
      serverId: server._id.toString(),
      userId: req.user.userId,
      minecraftUsername,
      age,
      experience,
      whyJoin,
      availability,
      answers: formattedAnswers
    });
    
    await application.save();
    res.json(application);
  } catch (error) {
    res.status(500).json({ error: 'Başvuru yapılamadı' });
  }
});

// Başvuruları Getir (Admin)
app.get('/api/staff/applications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { serverId } = req.user;
    const applications = await StaffApplication.find({ serverId })
      .populate('userId', 'username email')
      .populate('reviewedBy', 'username')
      .sort({ createdAt: -1 });
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: 'Başvurular alınamadı' });
  }
});

// Başvuru Durumu Güncelle (Admin)
app.put('/api/staff/applications/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, reviewNote } = req.body;
    
    const application = await StaffApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Başvuru bulunamadı' });
    }
    
    application.status = status;
    application.reviewNote = reviewNote;
    application.reviewedBy = req.user.userId;
    
    await application.save();
    res.json(application);
  } catch (error) {
    res.status(500).json({ error: 'Başvuru güncellenemedi' });
  }
});

// ==================== ADMIN ROUTES ====================

// Dashboard İstatistikleri
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { serverId } = req.user;
    
    const totalUsers = await User.countDocuments({ serverId });
    const totalPurchases = await Purchase.countDocuments({ serverId });
    const totalRevenue = await Purchase.aggregate([
      { $match: { serverId, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$price' } } }
    ]);
    
    const recentPurchases = await Purchase.find({ serverId })
      .populate('userId', 'username')
      .populate('productId', 'name')
      .sort({ createdAt: -1 })
      .limit(10);
    
    const openTickets = await Ticket.countDocuments({ serverId, status: 'open' });
    const pendingApplications = await StaffApplication.countDocuments({ serverId, status: 'pending' });
    
    res.json({
      totalUsers,
      totalPurchases,
      totalRevenue: totalRevenue[0]?.total || 0,
      openTickets,
      pendingApplications,
      recentPurchases
    });
  } catch (error) {
    res.status(500).json({ error: 'İstatistikler alınamadı' });
  }
});

// Sunucu Ayarlarını Getir
app.get('/api/admin/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { serverId } = req.user;
    
    let settings = await Settings.findOne({ serverId });
    if (!settings) {
      settings = new Settings({ serverId });
      await settings.save();
    }
    
    const server = await Server.findById(serverId);
    
    res.json({
      settings,
      server
    });
  } catch (error) {
    res.status(500).json({ error: 'Ayarlar alınamadı' });
  }
});

// Sunucu Ayarlarını Güncelle
app.put('/api/admin/settings', authenticateToken, requireAdmin, upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'wallpaper', maxCount: 1 },
  { name: 'storeWallpaper', maxCount: 1 },
  { name: 'supportWallpaper', maxCount: 1 }
]), async (req, res) => {
  try {
    const { serverId } = req.user;
    const updates = req.body;
    
    const server = await Server.findById(serverId);
    const settings = await Settings.findOne({ serverId });
    
    // Sunucu bilgilerini güncelle
    if (updates.name) server.name = updates.name;
    if (updates.ip) server.ip = updates.ip;
    if (updates.rconPort) server.rconPort = updates.rconPort;
    if (updates.rconPassword) server.rconPassword = updates.rconPassword;
    if (updates.primaryColor) server.primaryColor = updates.primaryColor;
    if (updates.secondaryColor) server.secondaryColor = updates.secondaryColor;
    
    // Dosya yüklemeleri
    if (req.files) {
      if (req.files.logo) server.logo = req.files.logo[0].path;
      if (req.files.wallpaper) server.wallpaper = req.files.wallpaper[0].path;
      if (req.files.storeWallpaper) server.storeWallpaper = req.files.storeWallpaper[0].path;
      if (req.files.supportWallpaper) server.supportWallpaper = req.files.supportWallpaper[0].path;
    }
    
    await server.save();
    
    // Ödeme ayarlarını güncelle
    if (updates.paymentMethods) {
      settings.paymentMethods = JSON.parse(updates.paymentMethods);
    }
    if (updates.testMode !== undefined) {
      settings.testMode = updates.testMode === 'true';
    }
    if (updates.googleSearchConsole) {
      settings.googleSearchConsole = updates.googleSearchConsole;
    }
    
    await settings.save();
    
    res.json({ server, settings });
  } catch (error) {
    res.status(500).json({ error: 'Ayarlar güncellenemedi' });
  }
});

// Market Yönetimi - Sunucu Oluştur
app.post('/api/admin/servers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, subdomain, ip, port, rconPort, rconPassword } = req.body;
    
    const server = new Server({
      name,
      subdomain,
      ip,
      port,
      rconPort,
      rconPassword,
      ownerId: req.user.userId
    });
    
    await server.save();
    
    // Varsayılan admin kullanıcısı oluştur
    const hashedPassword = await bcrypt.hash('123', 10);
    const adminUser = new User({
      username: 'admin',
      email: `admin@${subdomain}.com`,
      password: hashedPassword,
      role: 'admin',
      serverId: server._id.toString(),
      forcePasswordChange: true
    });
    
    await adminUser.save();
    
    res.json(server);
  } catch (error) {
    res.status(500).json({ error: 'Sunucu oluşturulamadı' });
  }
});

// Kategori Yönetimi
app.post('/api/admin/categories', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, icon, order } = req.body;
    const { serverId } = req.user;
    
    const category = new Category({
      serverId,
      name,
      description,
      icon,
      order
    });
    
    await category.save();
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Kategori oluşturulamadı' });
  }
});

app.put('/api/admin/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: 'Kategori güncellenemedi' });
  }
});

app.delete('/api/admin/categories/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Kategori silindi' });
  } catch (error) {
    res.status(500).json({ error: 'Kategori silinemedi' });
  }
});

// Ürün Yönetimi
app.post('/api/admin/products', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { serverId } = req.user;
    const { name, description, price, discountPrice, categoryId, rconCommands, stock, featured, order } = req.body;
    
    const product = new Product({
      serverId,
      name,
      description,
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : undefined,
      categoryId,
      rconCommands: rconCommands ? JSON.parse(rconCommands) : [],
      stock: parseInt(stock),
      featured: featured === 'true',
      order: parseInt(order),
      image: req.file?.path
    });
    
    await product.save();
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Ürün oluşturulamadı' });
  }
});

app.put('/api/admin/products/:id', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.rconCommands) {
      updates.rconCommands = JSON.parse(updates.rconCommands);
    }
    if (updates.price) updates.price = parseFloat(updates.price);
    if (updates.discountPrice) updates.discountPrice = parseFloat(updates.discountPrice);
    if (updates.featured) updates.featured = updates.featured === 'true';
    if (req.file) updates.image = req.file.path;
    
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    );
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Ürün güncellenemedi' });
  }
});

app.delete('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Ürün silindi' });
  } catch (error) {
    res.status(500).json({ error: 'Ürün silinemedi' });
  }
});

// ==================== PAYMENT ROUTES ====================

// Shopier Ödeme
app.post('/api/payment/shopier', authenticateToken, async (req, res) => {
  try {
    const { purchaseId } = req.body;
    const purchase = await Purchase.findById(purchaseId);
    
    if (!purchase) {
      return res.status(404).json({ error: 'Satın alma bulunamadı' });
    }
    
    const settings = await Settings.findOne({ serverId: purchase.serverId });
    
    if (!settings?.paymentMethods?.shopier?.enabled) {
      return res.status(400).json({ error: 'Shopier ödeme yöntemi aktif değil' });
    }
    
    // Shopier API entegrasyonu
    const shopierData = {
      API_key: settings.paymentMethods.shopier.apiKey,
      product_name: purchase.productName,
      product_price: purchase.price,
      buyer_name: req.user.username,
      buyer_email: req.user.email,
      buyer_phone: '5550000000',
      success_url: `${req.headers.origin}/payment/success`,
      fail_url: `${req.headers.origin}/payment/fail`,
      platform_order_id: purchase._id.toString()
    };
    
    // Test modu için
    if (settings.testMode) {
      purchase.status = 'completed';
      purchase.paymentId = 'TEST_' + Date.now();
      await purchase.save();
      return res.json({ success: true, testMode: true });
    }
    
    res.json({ 
      paymentUrl: 'https://www.shopier.com/ShowProduct/api_pay.php',
      data: shopierData 
    });
  } catch (error) {
    res.status(500).json({ error: 'Ödeme başlatılamadı' });
  }
});

// PayTR Ödeme
app.post('/api/payment/paytr', authenticateToken, async (req, res) => {
  try {
    const { purchaseId } = req.body;
    const purchase = await Purchase.findById(purchaseId);
    
    if (!purchase) {
      return res.status(404).json({ error: 'Satın alma bulunamadı' });
    }
    
    const settings = await Settings.findOne({ serverId: purchase.serverId });
    
    if (!settings?.paymentMethods?.paytr?.enabled) {
      return res.status(400).json({ error: 'PayTR ödeme yöntemi aktif değil' });
    }
    
    // Test modu için
    if (settings.testMode) {
      purchase.status = 'completed';
      purchase.paymentId = 'TEST_' + Date.now();
      await purchase.save();
      
      // RCON komutlarını çalıştır
      await executeRconCommands(purchase);
      
      return res.json({ success: true, testMode: true });
    }
    
    // PayTR API entegrasyonu
    const crypto = require('crypto');
    const merchant_id = settings.paymentMethods.paytr.merchantId;
    const merchant_key = settings.paymentMethods.paytr.merchantKey;
    const merchant_salt = settings.paymentMethods.paytr.merchantSalt;
    
    const user = await User.findById(purchase.userId);
    
    const paytrData = {
      merchant_id,
      user_ip: req.ip,
      merchant_oid: purchase._id.toString(),
      email: user.email,
      payment_amount: purchase.price * 100,
      currency: 'TL',
      user_name: user.username,
      user_address: 'Adres girilmedi',
      user_phone: '5550000000',
      merchant_ok_url: `${req.headers.origin}/payment/success`,
      merchant_fail_url: `${req.headers.origin}/payment/fail`,
      timeout_limit: 30,
      debug_on: 1,
      test_mode: settings.testMode ? 1 : 0,
      no_installment: 0,
      max_installment: 0
    };
    
    const hash_str = `${merchant_id}${paytrData.user_ip}${paytrData.merchant_oid}${paytrData.email}${paytrData.payment_amount}${paytrData.user_name}${paytrData.user_address}${paytrData.user_phone}${paytrData.merchant_ok_url}${paytrData.merchant_fail_url}${paytrData.timeout_limit}${paytrData.debug_on}${paytrData.test_mode}${paytrData.no_installment}${paytrData.max_installment}${merchant_salt}`;
    
    const token = crypto.createHmac('sha256', merchant_key).update(hash_str).digest('base64');
    paytrData.paytr_token = token;
    
    res.json({ 
      paymentUrl: 'https://www.paytr.com/odeme/api/get-token',
      data: paytrData 
    });
  } catch (error) {
    res.status(500).json({ error: 'Ödeme başlatılamadı' });
  }
});

// RCON komutlarını çalıştır
async function executeRconCommands(purchase) {
  try {
    const server = await Server.findById(purchase.serverId);
    const product = await Product.findById(purchase.productId);
    
    if (!server || !product || !product.rconCommands.length) return;
    
    const { Rcon } = require('rcon-client');
    const rcon = await Rcon.connect({
      host: server.ip,
      port: server.rconPort,
      password: server.rconPassword
    });
    
    for (const command of product.rconCommands) {
      const formattedCommand = command.replace('{player}', purchase.minecraftUsername);
      await rcon.send(formattedCommand);
    }
    
    rcon.end();
    
    purchase.rconStatus = 'sent';
    await purchase.save();
  } catch (error) {
    console.error('RCON komut hatası:', error);
    purchase.rconStatus = 'failed';
    await purchase.save();
  }
}

// Ödeme Başarılı Callback
app.post('/api/payment/callback', async (req, res) => {
  try {
    const { merchant_oid, status } = req.body;
    
    if (status === 'success') {
      const purchase = await Purchase.findById(merchant_oid);
      if (purchase) {
        purchase.status = 'completed';
        await purchase.save();
        
        // RCON komutlarını çalıştır
        await executeRconCommands(purchase);
      }
    }
    
    res.json({ status: 'OK' });
  } catch (error) {
    res.status(500).json({ error: 'Callback işlenemedi' });
  }
});

// Test Ödemesi
app.post('/api/payment/test', authenticateToken, async (req, res) => {
  try {
    const { purchaseId } = req.body;
    const settings = await Settings.findOne({ serverId: req.user.serverId });
    
    if (!settings?.testMode) {
      return res.status(400).json({ error: 'Test modu aktif değil' });
    }
    
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ error: 'Satın alma bulunamadı' });
    }
    
    purchase.status = 'completed';
    purchase.paymentId = 'TEST_' + Date.now();
    await purchase.save();
    
    await executeRconCommands(purchase);
    
    res.json({ success: true, purchase });
  } catch (error) {
    res.status(500).json({ error: 'Test ödemesi başarısız' });
  }
});

// ==================== PAYMENT ROUTES ====================

// Shopier Ödeme
app.post('/api/payment/shopier', authenticateToken, async (req, res) => {
  try {
    const { purchaseId } = req.body;
    const purchase = await Purchase.findById(purchaseId);
    
    if (!purchase) {
      return res.status(404).json({ error: 'Satın alma bulunamadı' });
    }
    
    const settings = await Settings.findOne({ serverId: purchase.serverId });
    
    if (!settings?.paymentMethods?.shopier?.enabled) {
      return res.status(400).json({ error: 'Shopier ödeme yöntemi aktif değil' });
    }
    
    // Shopier API entegrasyonu
    const shopierData = {
      API_key: settings.paymentMethods.shopier.apiKey,
      product_name: purchase.productName,
      product_price: purchase.price,
      buyer_name: req.user.username,
      buyer_email: req.user.email,
      buyer_phone: '5550000000',
      success_url: `${req.headers.origin}/payment/success`,
      fail_url: `${req.headers.origin}/payment/fail`,
      platform_order_id: purchase._id.toString()
    };
    
    // Test modu için
    if (settings.testMode) {
      purchase.status = 'completed';
      purchase.paymentId = 'TEST_' + Date.now();
      await purchase.save();
      return res.json({ success: true, testMode: true });
    }
    
    res.json({ 
      paymentUrl: 'https://www.shopier.com/ShowProduct/api_pay.php',
      data: shopierData 
    });
  } catch (error) {
    res.status(500).json({ error: 'Ödeme başlatılamadı' });
  }
});

// PayTR Ödeme
app.post('/api/payment/paytr', authenticateToken, async (req, res) => {
  try {
    const { purchaseId } = req.body;
    const purchase = await Purchase.findById(purchaseId);
    
    if (!purchase) {
      return res.status(404).json({ error: 'Satın alma bulunamadı' });
    }
    
    const settings = await Settings.findOne({ serverId: purchase.serverId });
    
    if (!settings?.paymentMethods?.paytr?.enabled) {
      return res.status(400).json({ error: 'PayTR ödeme yöntemi aktif değil' });
    }
    
    // Test modu için
    if (settings.testMode) {
      purchase.status = 'completed';
      purchase.paymentId = 'TEST_' + Date.now();
      await purchase.save();
      
      // RCON komutlarını çalıştır
      await executeRconCommands(purchase);
      
      return res.json({ success: true, testMode: true });
    }
    
    // PayTR API entegrasyonu
    const crypto = require('crypto');
    const merchant_id = settings.paymentMethods.paytr.merchantId;
    const merchant_key = settings.paymentMethods.paytr.merchantKey;
    const merchant_salt = settings.paymentMethods.paytr.merchantSalt;
    
    const user = await User.findById(purchase.userId);
    
    const paytrData = {
      merchant_id,
      user_ip: req.ip,
      merchant_oid: purchase._id.toString(),
      email: user.email,
      payment_amount: purchase.price * 100,
      currency: 'TL',
      user_name: user.username,
      user_address: 'Adres girilmedi',
      user_phone: '5550000000',
      merchant_ok_url: `${req.headers.origin}/payment/success`,
      merchant_fail_url: `${req.headers.origin}/payment/fail`,
      timeout_limit: 30,
      debug_on: 1,
      test_mode: settings.testMode ? 1 : 0,
      no_installment: 0,
      max_installment: 0
    };
    
    const hash_str = `${merchant_id}${paytrData.user_ip}${paytrData.merchant_oid}${paytrData.email}${paytrData.payment_amount}${paytrData.user_name}${paytrData.user_address}${paytrData.user_phone}${paytrData.merchant_ok_url}${paytrData.merchant_fail_url}${paytrData.timeout_limit}${paytrData.debug_on}${paytrData.test_mode}${paytrData.no_installment}${paytrData.max_installment}${merchant_salt}`;
    
    const token = crypto.createHmac('sha256', merchant_key).update(hash_str).digest('base64');
    paytrData.paytr_token = token;
    
    res.json({ 
      paymentUrl: 'https://www.paytr.com/odeme/api/get-token',
      data: paytrData 
    });
  } catch (error) {
    res.status(500).json({ error: 'Ödeme başlatılamadı' });
  }
});

// RCON komutlarını çalıştır
async function executeRconCommands(purchase) {
  try {
    const server = await Server.findById(purchase.serverId);
    const product = await Product.findById(purchase.productId);
    
    if (!server || !product || !product.rconCommands.length) return;
    
    const { Rcon } = require('rcon-client');
    const rcon = await Rcon.connect({
      host: server.ip,
      port: server.rconPort,
      password: server.rconPassword
    });
    
    for (const command of product.rconCommands) {
      const formattedCommand = command.replace('{player}', purchase.minecraftUsername);
      await rcon.send(formattedCommand);
    }
    
    rcon.end();
    
    purchase.rconStatus = 'sent';
    await purchase.save();
  } catch (error) {
    console.error('RCON komut hatası:', error);
    purchase.rconStatus = 'failed';
    await purchase.save();
  }
}

// Ödeme Başarılı Callback
app.post('/api/payment/callback', async (req, res) => {
  try {
    const { merchant_oid, status } = req.body;
    
    if (status === 'success') {
      const purchase = await Purchase.findById(merchant_oid);
      if (purchase) {
        purchase.status = 'completed';
        await purchase.save();
        
        // RCON komutlarını çalıştır
        await executeRconCommands(purchase);
      }
    }
    
    res.json({ status: 'OK' });
  } catch (error) {
    res.status(500).json({ error: 'Callback işlenemedi' });
  }
});

// Test Ödemesi
app.post('/api/payment/test', authenticateToken, async (req, res) => {
  try {
    const { purchaseId } = req.body;
    const settings = await Settings.findOne({ serverId: req.user.serverId });
    
    if (!settings?.testMode) {
      return res.status(400).json({ error: 'Test modu aktif değil' });
    }
    
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      return res.status(404).json({ error: 'Satın alma bulunamadı' });
    }
    
    purchase.status = 'completed';
    purchase.paymentId = 'TEST_' + Date.now();
    await purchase.save();
    
    await executeRconCommands(purchase);
    
    res.json({ success: true, purchase });
  } catch (error) {
    res.status(500).json({ error: 'Test ödemesi başarısız' });
  }
});

// ==================== PATH TABANLI SUNUCU YAKALAYICI ====================
// Bu route EN SONDA olmalı! SADECE BİR TANE!

app.get('/:sunucuYolu', async (req, res) => {
    try {
        const sunucuYolu = req.params.sunucuYolu;
        
        // API, assets ve özel sayfaları yakalama
        const ozelYollar = [
            'api', 'assets', 'css', 'js', 'favicon.ico',
            'admin', 'login', 'register', 'setup', 
            'magaza', 'profil', 'destek', 'change-password',
            'yetkili-basvuru', 'index.html', 'store.html'
        ];
        
        // Dosya uzantılı istekleri yakalama (.html, .css, .js, .png vs)
        if (sunucuYolu.includes('.') || ozelYollar.includes(sunucuYolu)) {
            return res.status(404).send('Sayfa bulunamadı');
        }
        
        // Veritabanında sunucuyu ara (subdomain veya path olarak)
        const Server = mongoose.model('Server');
        const sunucu = await Server.findOne({ 
            $or: [
                { subdomain: sunucuYolu },
                { path: sunucuYolu }
            ]
        });
        
        if (sunucu) {
            // Sunucu bulundu - siteyi göster
            console.log(`✅ Sunucu bulundu: ${sunucuYolu} -> ${sunucu.name}`);
            
            // RCON ile online oyuncu sayısını güncelle (opsiyonel)
            let onlinePlayers = sunucu.onlinePlayers || 0;
            try {
                if (sunucu.rconPort && sunucu.rconPassword) {
                    const { Rcon } = require('rcon-client');
                    const rcon = await Rcon.connect({
                        host: sunucu.ip,
                        port: sunucu.rconPort,
                        password: sunucu.rconPassword,
                        timeout: 3000
                    });
                    const response = await rcon.send('list');
                    const match = response.match(/There are (\d+) of a max of (\d+) players online/);
                    if (match) {
                        onlinePlayers = parseInt(match[1]);
                        sunucu.onlinePlayers = onlinePlayers;
                        sunucu.maxPlayers = parseInt(match[2]);
                        await sunucu.save();
                    }
                    rcon.end();
                }
            } catch (rconError) {
                // RCON başarısız olursa eski değeri kullan
            }
            
            // HTML sayfasını oluştur
            const html = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${sunucu.name} | Minecraft Sunucusu</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { font-family: 'Inter', sans-serif; }
        body { 
            background-image: url('${sunucu.wallpaper || '/assets/default-wallpaper.jpg'}');
            background-size: cover;
            background-position: center;
            background-attachment: fixed;
            margin: 0;
        }
        body::before {
            content: '';
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(10, 11, 14, 0.85);
            backdrop-filter: blur(8px);
            z-index: -1;
        }
        .glass { 
            background: rgba(20, 25, 35, 0.7); 
            backdrop-filter: blur(10px); 
            border: 1px solid rgba(255,255,255,0.05); 
        }
        .btn-primary { 
            background: ${sunucu.primaryColor || '#5865F2'}; 
            transition: all 0.3s;
        }
        .btn-primary:hover { 
            filter: brightness(1.1);
            transform: translateY(-2px);
        }
        .gradient-text {
            background: linear-gradient(135deg, ${sunucu.primaryColor || '#5865F2'}, ${sunucu.secondaryColor || '#00ff88'});
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
    </style>
</head>
<body class="text-gray-200">
    <!-- Navbar -->
    <nav class="glass fixed top-0 left-0 right-0 z-50 px-6 py-3">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
            <a href="/${sunucuYolu}" class="flex items-center gap-3">
                ${sunucu.logo ? 
                    `<img src="${sunucu.logo}" class="h-10 w-auto" alt="${sunucu.name}" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\'fas fa-cube text-2xl\'></i><span class=\'text-xl font-bold\'>${sunucu.name}</span>'">` : 
                    '<i class="fas fa-cube text-2xl"></i>'
                }
                <span class="text-xl font-bold gradient-text">${sunucu.name}</span>
            </a>
            
            <div class="flex items-center gap-6">
                <a href="/${sunucuYolu}/magaza" class="text-gray-300 hover:text-white transition">Mağaza</a>
                <a href="/${sunucuYolu}/profil" class="text-gray-300 hover:text-white transition">Profil</a>
                <a href="/${sunucuYolu}/destek" class="text-gray-300 hover:text-white transition">Destek</a>
                
                <div class="flex items-center gap-3">
                    <div class="glass px-4 py-1.5 rounded-full flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full ${onlinePlayers > 0 ? 'bg-green-400' : 'bg-red-400'}"></span>
                        <span class="text-sm">${onlinePlayers}/${sunucu.maxPlayers || 100}</span>
                    </div>
                    
                    <button onclick="copyIP('${sunucu.ip}:${sunucu.port}')" class="btn-primary px-5 py-2 rounded-full font-medium flex items-center gap-2">
                        <i class="fas fa-play text-sm"></i>
                        <span>Oyna</span>
                    </button>
                    
                    <a href="/login" class="text-gray-400 hover:text-white">
                        <i class="fas fa-user-circle text-xl"></i>
                    </a>
                </div>
            </div>
        </div>
    </nav>
    
    <!-- Hero Section -->
    <main class="pt-28 px-6">
        <div class="max-w-5xl mx-auto">
            <div class="glass rounded-3xl p-12 text-center">
                ${sunucu.logo ? `<img src="${sunucu.logo}" class="h-24 w-auto mx-auto mb-6" alt="${sunucu.name}" onerror="this.style.display='none'">` : ''}
                <h1 class="text-5xl font-bold mb-4 gradient-text">${sunucu.name}</h1>
                <p class="text-gray-400 text-lg mb-8">Minecraft Sunucusuna Hoş Geldiniz!</p>
                
                <div class="flex flex-wrap gap-4 justify-center mb-8">
                    <div class="glass px-6 py-4 rounded-xl flex items-center gap-3">
                        <i class="fas fa-network-wired text-2xl" style="color: ${sunucu.primaryColor || '#5865F2'}"></i>
                        <div class="text-left">
                            <div class="text-xs text-gray-400">Sunucu IP</div>
                            <div class="font-mono text-lg">${sunucu.ip}:${sunucu.port}</div>
                        </div>
                        <button onclick="copyIP('${sunucu.ip}:${sunucu.port}')" class="ml-2 text-gray-400 hover:text-white">
                            <i class="far fa-copy"></i>
                        </button>
                    </div>
                    
                    <div class="glass px-6 py-4 rounded-xl flex items-center gap-3">
                        <i class="fas fa-users text-2xl" style="color: ${sunucu.secondaryColor || '#00ff88'}"></i>
                        <div class="text-left">
                            <div class="text-xs text-gray-400">Oyuncu</div>
                            <div class="font-mono text-lg">${onlinePlayers}/${sunucu.maxPlayers || 100}</div>
                        </div>
                    </div>
                    
                    <div class="glass px-6 py-4 rounded-xl flex items-center gap-3">
                        <i class="fas fa-code-branch text-2xl" style="color: ${sunucu.primaryColor || '#5865F2'}"></i>
                        <div class="text-left">
                            <div class="text-xs text-gray-400">Versiyon</div>
                            <div class="font-mono text-lg">${sunucu.version || '1.20.4'}</div>
                        </div>
                    </div>
                </div>
                
                <div class="flex gap-4 justify-center">
                    <a href="/${sunucuYolu}/magaza" class="btn-primary px-8 py-3 rounded-full font-medium">
                        <i class="fas fa-shopping-cart mr-2"></i>Mağazaya Git
                    </a>
                    <button onclick="copyIP('${sunucu.ip}:${sunucu.port}')" class="glass px-8 py-3 rounded-full font-medium hover:bg-white/10">
                        <i class="fas fa-copy mr-2"></i>IP Kopyala
                    </button>
                </div>
            </div>
            
            <!-- Özellikler -->
            <div class="grid md:grid-cols-3 gap-6 mt-8">
                <div class="glass rounded-2xl p-6 text-center">
                    <i class="fas fa-gift text-3xl mb-3" style="color: ${sunucu.secondaryColor || '#00ff88'}"></i>
                    <h3 class="font-semibold mb-2">Daily Spin</h3>
                    <p class="text-gray-400 text-sm">Her gün çark çevir, ödül kazan!</p>
                </div>
                <div class="glass rounded-2xl p-6 text-center">
                    <i class="fas fa-headset text-3xl mb-3" style="color: ${sunucu.primaryColor || '#5865F2'}"></i>
                    <h3 class="font-semibold mb-2">7/24 Destek</h3>
                    <p class="text-gray-400 text-sm">Ticket sistemi ile anında yardım</p>
                </div>
                <div class="glass rounded-2xl p-6 text-center">
                    <i class="fas fa-shield-alt text-3xl mb-3" style="color: ${sunucu.secondaryColor || '#00ff88'}"></i>
                    <h3 class="font-semibold mb-2">Güvenli Alışveriş</h3>
                    <p class="text-gray-400 text-sm">Shopier ve PayTR ile güvenli ödeme</p>
                </div>
            </div>
        </div>
    </main>
    
    <footer class="mt-16 py-8 text-center text-gray-500 text-sm border-t border-white/5">
        <p>© 2024 ${sunucu.name} | Vexar Project ile oluşturuldu</p>
    </footer>
    
    <script>
        function copyIP(ip) {
            navigator.clipboard.writeText(ip).then(() => {
                alert('✅ IP kopyalandı: ' + ip);
            }).catch(() => {
                prompt('IP adresi:', ip);
            });
        }
        
        // 30 saniyede bir oyuncu sayısını güncelle
        setInterval(async () => {
            try {
                const res = await fetch('/api/server/info');
                const data = await res.json();
                document.querySelector('.glass.px-4.py-1\\.5 span:last-child').textContent = 
                    data.onlinePlayers + '/' + data.maxPlayers;
            } catch (e) {}
        }, 30000);
    </script>
</body>
</html>`;
            
            return res.send(html);
            
        } else {
            // Sunucu bulunamadı
            return res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>404 - Sunucu Bulunamadı</title>
                    <meta charset="UTF-8">
                    <script src="https://cdn.tailwindcss.com"></script>
                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
                </head>
                <body class="bg-[#0a0b0e] text-white flex items-center justify-center min-h-screen">
                    <div class="text-center">
                        <i class="fas fa-server text-6xl text-gray-600 mb-6"></i>
                        <h1 class="text-4xl font-bold mb-4">Sunucu Bulunamadı</h1>
                        <p class="text-gray-400 mb-6">"${sunucuYolu}" adında bir sunucu mevcut değil.</p>
                        <div class="flex gap-4 justify-center">
                            <a href="/" class="bg-[#5865F2] px-6 py-3 rounded-lg hover:bg-[#4752C4] transition">Ana Sayfa</a>
                            <a href="/setup" class="glass px-6 py-3 rounded-lg hover:bg-white/10 transition">Sunucu Oluştur</a>
                        </div>
                    </div>
                </body>
                </html>
            `);
        }
        
    } catch (error) {
        console.error('Sunucu yakalayıcı hatası:', error);
        res.status(500).send('Sunucu hatası!');
    }
});

// ==================== EXPORT ====================
module.exports = app;
