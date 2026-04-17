const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'vexar-secret-key-2024-degis-bunu';

// Kullanıcı Modeli
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'moderator', 'user'], default: 'user' },
  serverId: { type: String, default: null },
  credits: { type: Number, default: 0 },
  rank: { type: String, default: 'Oyuncu' },
  avatar: { type: String, default: '/assets/default-avatar.png' },
  minecraftUsername: { type: String, default: null },
  forcePasswordChange: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// Kayıt Ol
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, serverId } = req.body;

    // Validasyon
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Tüm alanları doldurun!' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalı!' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı!' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin!' });
    }

    // Kullanıcı zaten var mı?
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(400).json({ error: 'Bu kullanıcı adı zaten kullanılıyor!' });
      }
      if (existingUser.email === email) {
        return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanılıyor!' });
      }
    }

    // Şifreyi hashle (AES-256 seviyesinde bcrypt)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Yeni kullanıcı oluştur
    const user = new User({
      username,
      email,
      password: hashedPassword,
      serverId: serverId || null
    });

    await user.save();

    // Token oluştur
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        role: user.role,
        serverId: user.serverId
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        credits: user.credits,
        rank: user.rank,
        avatar: user.avatar
      }
    });

  } catch (error) {
    console.error('Kayıt hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası, lütfen tekrar deneyin!' });
  }
});

// Giriş Yap
router.post('/login', async (req, res) => {
  try {
    const { username, password, serverId } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli!' });
    }

    // Kullanıcıyı bul
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    });

    if (!user) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı!' });
    }

    // Şifre kontrolü
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Hatalı şifre!' });
    }

    // Admin ilk giriş kontrolü (şifre hala "123" ise)
    if (user.role === 'admin' && password === '123') {
      user.forcePasswordChange = true;
    }

    // ServerId güncelle (eğer verilmişse)
    if (serverId && !user.serverId) {
      user.serverId = serverId;
    }

    await user.save();

    // Token oluştur
    const token = jwt.sign(
      {
        userId: user._id,
        username: user.username,
        role: user.role,
        serverId: user.serverId
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      forcePasswordChange: user.forcePasswordChange || false,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        credits: user.credits,
        rank: user.rank,
        avatar: user.avatar,
        minecraftUsername: user.minecraftUsername
      }
    });

  } catch (error) {
    console.error('Giriş hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası, lütfen tekrar deneyin!' });
  }
});

// Şifre Değiştir
router.post('/change-password', async (req, res) => {
  try {
    const { token, currentPassword, newPassword } = req.body;

    if (!token) {
      return res.status(401).json({ error: 'Token gerekli!' });
    }

    // Token'ı doğrula
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token!' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
    }

    // Mevcut şifreyi kontrol et
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Mevcut şifre hatalı!' });
    }

    // Yeni şifre validasyonu
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalı!' });
    }

    // Şifreyi güncelle
    user.password = await bcrypt.hash(newPassword, 12);
    user.forcePasswordChange = false;
    await user.save();

    res.json({
      success: true,
      message: 'Şifre başarıyla değiştirildi!'
    });

  } catch (error) {
    console.error('Şifre değiştirme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası!' });
  }
});

// Token Doğrula
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(401).json({ error: 'Token gerekli!' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı!' });
    }

    res.json({
      valid: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        credits: user.credits,
        rank: user.rank,
        avatar: user.avatar,
        forcePasswordChange: user.forcePasswordChange
      }
    });

  } catch (error) {
    res.status(401).json({ valid: false, error: 'Geçersiz token!' });
  }
});

module.exports = router;
