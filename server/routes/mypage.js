const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// JWT 인증 미들웨어
const authenticate = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: '인증 실패: 토큰 없음' });
  }

  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: '유효하지 않은 토큰' });
  }
};

// 기본 정보 조회 API
router.get('/basic', authenticate, async (req, res) => {
  try {
    const email = req.user.userId;

    const [rows] = await db.query(
      'SELECT email, nickname, birthDate, location FROM users WHERE email = ?',
      [email]
    );

    if (!rows.length) {
      return res.status(404).json({ message: '사용자 정보를 찾을 수 없습니다' });
    }

    const user = rows[0];

    res.json({
      email: user.email,
      nickname: user.nickname,
      birthDate: user.birthDate,
      location: user.location,
    });
  } catch (err) {
    console.error('마이페이지 조회 실패:', err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// 상세 정보 조회 API
router.get('/detail', authenticate, async (req, res) => {
  try {
    const email = req.user.userId;

    const [userRows] = await db.query(
      `SELECT email, nickname, birthDate, location, income,
              maritalStatus, education, major, employmentStatus,
              specialGroup, interests
       FROM users
       WHERE email = ?`,
      [email]
    );

    if (!userRows.length) {
      return res.status(404).json({ message: '사용자 정보를 찾을 수 없습니다' });
    }

    const user = userRows[0];

    const tags = {
      '혼인 여부': [user.maritalStatus],
      '최종 학력': [user.education],
      '전공': [user.major],
      '취업 상태': JSON.parse(user.employmentStatus || '[]'),
      '특화 분야': JSON.parse(user.specialGroup || '[]'),
      '관심 분야': JSON.parse(user.interests || '[]'),
    };

    res.json({
      email: user.email,
      nickname: user.nickname,
      birthDate: user.birthDate,
      location: user.location,
      income: user.income,
      tags,
    });
  } catch (err) {
    console.error('마이페이지 상세 조회 실패:', err.stack || err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// 개인 정보 수정 API
router.put('/edit', authenticate, async (req, res) => {
  try {
    const email = req.user.userId;
    const {
      nickname,
      birthDate,
      location,
      income,
      maritalStatus,
      education,
      major,
      employmentStatus,
      specialGroup,
      interests,
    } = req.body;

    const fields = [];
    const values = [];

    if (nickname !== undefined)     { fields.push('nickname = ?');      values.push(nickname); }
    if (birthDate !== undefined)    { fields.push('birthDate = ?');     values.push(birthDate); }
    if (location !== undefined)     { fields.push('location = ?');      values.push(location); }
    if (income !== undefined)       { fields.push('income = ?');        values.push(income); }
    if (maritalStatus !== undefined){ fields.push('maritalStatus = ?'); values.push(maritalStatus); }
    if (education !== undefined)    { fields.push('education = ?');     values.push(education); }
    if (major !== undefined)        { fields.push('major = ?');         values.push(major); }

    if (employmentStatus !== undefined) {
      fields.push('employmentStatus = ?');
      values.push(JSON.stringify(employmentStatus));
    }
    if (specialGroup !== undefined) {
      fields.push('specialGroup = ?');
      values.push(JSON.stringify(specialGroup));
    }
    if (interests !== undefined) {
      fields.push('interests = ?');
      values.push(JSON.stringify(interests));
    }

    if (!fields.length) {
      return res.status(400).json({ message: '업데이트할 필드가 없습니다' });
    }

    if (nickname !== undefined) {
      const [dup] = await db.query(
        'SELECT 1 FROM users WHERE nickname = ? AND email <> ?',
        [nickname, email],
      );
      if (dup.length) {
        return res.status(409).json({ message: '닉네임 중복' });
      }
    }

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE email = ?`;
    values.push(email);
    await db.query(sql, values);

    return res.json({ message: '수정 완료' });
  } catch (err) {
    console.error('마이페이지 수정 실패:', err.stack || err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

// 관심 정책 조회 API
router.get('/likes', authenticate, async (req, res) => {
  try {
    const email = req.user.userId;

    const [rows] = await db.query(
      'SELECT likedPolicies FROM users WHERE email = ?',
      [email]
    );

    if (!rows.length) {
      return res.status(404).json({ message: '사용자 정보를 찾을 수 없습니다' });
    }

    let likedPolicies = [];
    if (rows[0].likedPolicies) {
      try {
        likedPolicies = JSON.parse(rows[0].likedPolicies).map(n => Number(n));
      } catch (e) {
        console.error('likedPolicies JSON 파싱 오류:', e);
      }
    }

    if (!likedPolicies.length) {
      return res.json([]);
    }

    const [policies] = await db.query(
      `SELECT id, plcyNm 
       FROM policies 
       WHERE id IN (?)`,
      [likedPolicies]
    );

   const result = likedPolicies.map(id => {
      const policy = policies.find(p => p.id === id);
      return policy ? { id: policy.id, plcyNm: policy.plcyNm } : null;
    }).filter(Boolean);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류' });
  }
});

// 관심 정책 추가 API
router.post('/likes', authenticate, async (req, res) => {
  try {
    const email = req.user.userId;
    const { policyId } = req.body;

    if (!policyId) {
      return res.status(400).json({ message: 'policyId는 필수입니다' });
    }

   const [userRows] = await db.query(
      'SELECT likedPolicies FROM users WHERE email = ?',
      [email]
    );

    if (!userRows.length) {
      return res.status(404).json({ message: '사용자 정보를 찾을 수 없습니다' });
    }

    let ids = [];
    const raw = userRows[0].likedPolicies;
    if (raw) {
      try { ids = JSON.parse(raw); } catch (_) {}
    }

    if (!ids.includes(policyId)) {
      ids.push(policyId);
    }

    await db.query(
      'UPDATE users SET likedPolicies = ? WHERE email = ?',
      [JSON.stringify(ids), email]
    );

   const [policies] = await db.query(
      `SELECT id, plcyNm 
       FROM policies 
       WHERE id IN (?)`,
      [ids]
    );

  const result = ids.map(id => {
      const p = policies.find(row => row.id === id);
      return p ? { id: p.id, plcyNm: p.plcyNm } : null;
    }).filter(Boolean);

    return res.json(result);
  } catch (err) {
    console.error('관심 정책 추가 오류:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

// 관심 정책 삭제 API
router.delete('/likes/:policyId', authenticate, async (req, res) => {
  try {
    const email = req.user.userId;
    const policyId = Number(req.params.policyId);

    if (!policyId) {
      return res.status(400).json({ message: 'policyId는 필수입니다' });
    }

    const [userRows] = await db.query(
      'SELECT likedPolicies FROM users WHERE email = ?',
      [email]
    );

    if (!userRows.length) {
      return res.status(404).json({ message: '사용자 정보를 찾을 수 없습니다' });
    }

    let ids = [];
    const raw = userRows[0].likedPolicies;
    if (raw) {
      try { ids = JSON.parse(raw); } catch (_) {}
    }

    ids = ids.filter(id => id !== policyId);

    await db.query(
      'UPDATE users SET likedPolicies = ? WHERE email = ?',
      [JSON.stringify(ids), email]
    );

   const [policies] = await db.query(
      `SELECT id, plcyNm 
       FROM policies 
       WHERE id IN (?)`,
      [ids.length > 0 ? ids : [0]]
    );

    const result = ids.map(id => {
      const p = policies.find(row => row.id === id);
      return p ? { id: p.id, plcyNm: p.plcyNm } : null;
    }).filter(Boolean);

    return res.json(result);
  } catch (err) {
    console.error('관심 정책 삭제 오류:', err);
    return res.status(500).json({ message: '서버 오류' });
  }
});

// 추천 횟수 조회 API
router.get("/recommend", authenticate, async (req, res) => {
  try {
    const email = req.user.userId;

    const [rows] = await db.query(
      "SELECT recommendCount FROM users WHERE email = ?",
      [email]
    );

    if (!rows.length) {
      return res
        .status(404)
        .json({ message: "사용자 정보를 찾을 수 없습니다" });
    }

    return res.json({ recommendCount: rows[0].recommendCount });
  } catch (err) {
    console.error("추천 횟수 조회 실패:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

module.exports = router;
