const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 리프레시 토큰 생성
function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

// 회원가입 API
router.post('/signup', async (req, res) => {
  const {
    email, nickname, password, birthDate,
    location, income, maritalStatus,
    education, major, employmentStatus,
    specialGroup, interests,
  } = req.body;

  if (!email || !nickname || !password || !birthDate || !location || !income || !education) {
    return res.status(400).json({ message: '필수 값 누락' });
  }

  try {
    const [existing] = await db.query('SELECT email FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: '이메일 중복' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

const normalizeArray = (field) =>
  Array.isArray(field) ? field : (field ? [field] : []);

await db.query(`
  INSERT INTO users
  (email, nickname, password, birthDate, location, income, maritalStatus, education, major, employmentStatus, specialGroup, interests)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`, [
  email,
  nickname,
  hashedPassword,
  birthDate,
  location,
  income,
  maritalStatus || '',
  education || '',
  major || '',
  JSON.stringify(normalizeArray(employmentStatus)),
  JSON.stringify(normalizeArray(specialGroup)),
  JSON.stringify(normalizeArray(interests)),
]);

    const accessToken = jwt.sign({ userId: email }, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = generateRefreshToken();

    await db.query('UPDATE users SET refreshToken = ? WHERE email = ?', [refreshToken, email]);

    res.status(201).json({
      status: 'success',
      nickname,
      token: accessToken,
      refreshToken: refreshToken,
      expires_in: 3600,
    });
  } catch (err) {
    console.error('회원가입 실패:', err);
    res.status(500).json({ message: '회원가입 실패' });
  }
});

// 로그인 API
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = users[0];

    if (!user) {
      return res.status(401).json({ message: '로그인 실패' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: '로그인 실패' });
    }

    const accessToken = jwt.sign({ userId: user.email }, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = generateRefreshToken();

    await db.query('UPDATE users SET refreshToken = ? WHERE email = ?', [refreshToken, email]);

    res.json({
      token: accessToken,
      refreshToken: refreshToken,
      expires_in: 3600,
      nickname: user.nickname,
    });
  } catch (err) {
    console.error('로그인 실패:', err);
    res.status(500).json({ message: '로그인 실패' });
  }
});

// 토큰 재발급 API
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: '리프레시 토큰이 필요합니다.' });
  }

  try {
    const [users] = await db.query('SELECT * FROM users WHERE refreshToken = ?', [refreshToken]);
    const user = users[0];

    if (!user) {
      return res.status(401).json({ message: '유효하지 않은 리프레시 토큰' });
    }

    const newAccessToken = jwt.sign({ userId: user.email }, JWT_SECRET, { expiresIn: '1h' });
    const newRefreshToken = generateRefreshToken();

    await db.query('UPDATE users SET refreshToken = ? WHERE email = ?', [newRefreshToken, user.email]);

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expires_in: 3600,
    });
  } catch (err) {
    console.error('토큰 재발급 실패:', err);
    res.status(500).json({ message: '토큰 재발급 실패' });
  }
});

// 이메일 중복 체크 API
router.get('/check-email', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: '이메일이 필요합니다.' });
  }

  try {
    const [rows] = await db.query('SELECT email FROM users WHERE email = ?', [email]);
    const exists = rows.length > 0;
    res.json({ data: { exists } });
  } catch (err) {
    console.error('이메일 중복 확인 실패:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// 닉네임 중복 체크 API
router.get('/check-nickname', async (req, res) => {
  const { nickname } = req.query;

  if (!nickname) {
    return res.status(400).json({ message: '닉네임이 필요합니다.' });
  }

  const blacklist = new Set([
    'fuck', 'shit', 'bitch', 'asshole', 'bastard',
    '씨발', '병신', '지랄', '개새', '좆', '씹', '개년', '육시랄',
  ]);
  const lowered = nickname.toLowerCase();
  for (const word of blacklist) {
    if (lowered.includes(word)) {
      return res.status(400).json({
        message: '부적절한 닉네임입니다.',
        data: { exists: true },
      });
    }
  }

  try {
    const [rows] = await db.query('SELECT 1 FROM users WHERE nickname = ? LIMIT 1', [nickname]);
    const exists = rows.length > 0;
    res.json({ data: { exists } });
  } catch (err) {
    console.error('닉네임 중복 확인 실패:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
