const db = require("../db");
const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require('path');
const pythonExecutable = path.resolve(__dirname, '..', 'venv/bin/python');
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// JWT 인증 미들웨어
const authenticate = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ message: "인증 실패: 토큰 없음" });
  }

  const token = auth.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "유효하지 않은 토큰" });
  }
};

// 정책 검색 API
router.get("/search", (req, res) => {
  const {
    q,
    sido,
    employmentStatus,
    maritalStatus,
    education,
    major,
    specialGroup,
    interests,
  } = req.query;

  const filters = {
    keyword: q,
    sido,
    employmentStatus,
    maritalStatus,
    education,
    major,
    specialGroup: specialGroup?.split(","),
    interests: interests?.split(","),
  };

  const py = spawn(pythonExecutable, ["search_v2.py", JSON.stringify(filters)]);

  let result = "";
  py.stdout.on("data", (chunk) => (result += chunk.toString()));
  py.stderr.on("data", (err) => console.error("Python error:", err.toString()));

  py.on("close", (code) => {
    if (code !== 0)
      return res.status(500).json({ message: "search_v2.py 실행 실패" });

    try {
      const parsed = JSON.parse(result);
      res.json(parsed);
    } catch (err) {
      res.status(500).json({ message: "파싱 오류" });
    }
  });
});

// 정책 추천 API
router.get("/recommend", authenticate, async (req, res) => {
  const email = req.user.userId;
  const prompt = req.query.prompt || "관심 키워드를 고려한 맞춤 추천";

  try {
    const [[user]] = await db.query(
      "SELECT recommendCount FROM users WHERE email = ?",
      [email]
    );

    if (!user) {
      return res
        .status(404)
        .json({ message: "사용자 정보를 찾을 수 없습니다" });
    }

    const [result] = await db.query(
      `UPDATE users
       SET recommendCount = recommendCount - 1
       WHERE email = ? AND recommendCount > 0`,
      [email]
    );

    if (result.affectedRows === 0) {
      return res
        .status(400)
        .json({ message: "오늘 추천 횟수가 모두 소진되었습니다" });
    }

    const py = spawn(pythonExecutable, ["langchaintest.py", email, prompt /*], { cwd }*/]);

    let resultbuf = "";
    let errbuf = "";
    py.stdout.on("data", (chunk) => (resultbuf += chunk.toString()));
    py.stderr.on("data", (err) => (errbuf += err.toString()));

    py.on("close", async (code) => {
      if (code !== 0) {
        console.error("Python error:", errbuf);
        return res
          .status(500)
          .json({ message: "recommend.py 실행 실패", code });
      }

      try {
        const parsed = JSON.parse(resultbuf);

        if (
          Array.isArray(parsed) &&
          parsed[0] &&
          typeof parsed[0] === "object"
        ) {
          const items = parsed.map((p) => ({
            id: p.id,
            plcyNm: p.plcyNm || p.name,
            reason: p.reason ?? null,
            badges: Array.isArray(p.badges) ? p.badges : [],
          }));
          return res.json({ recommendations: items });
        }

        const names = (Array.isArray(parsed) ? parsed : [])
          .map((item) =>
            typeof item === "string"
              ? item
              : item?.plcyNm ?? item?.name ?? (item && Object.values(item)[0])
          )
          .filter(Boolean);

        if (!names.length) {
          return res.json({ recommendations: [] });
        }

        const placeholders = names.map(() => "?").join(", ");
        const [rows] = await db.query(
          `SELECT id, plcyNm FROM policies WHERE plcyNm IN (${placeholders})`,
          names
        );

        return res.json({ recommendations: rows });
      } catch (err) {
        console.error("recommend 파싱/DB 오류:", err, "\nRAW:", result);
        return res.status(500).json({ message: "추천 결과 처리 실패" });
      }
    });
  } catch (err) {
    console.error("추천 API 실패:", err);
    return res.status(500).json({ message: "서버 오류" });
  }
});

// 조회수 높은 정책 조회 (3개) API
router.get("/popular", authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT id, plcyNm
      FROM policies
      ORDER BY inqCnt DESC
      LIMIT 3
      `
    );

    res.json(rows);
  } catch (err) {
    console.error("정책 조회 오류:", err);
    res.status(500).json({ message: "정책 조회 실패" });
  }
});

// 가장 최근 등록된 정책 조회 (3개) API
router.get("/recent", authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT id, plcyNm
      FROM policies
      WHERE bizPrdBgngYmd IS NOT NULL
      ORDER BY STR_TO_DATE(bizPrdBgngYmd, '%Y%m%d') DESC
      LIMIT 3
      `
    );

    res.json(rows);
  } catch (err) {
    console.error("정책 조회 오류:", err);
    res.status(500).json({ message: "정책 조회 실패" });
  }
});

// 정책 상세 조회 API
router.get("/:id", authenticate, async (req, res) => {
  const policyId = req.params.id;

  try {
    const [rows] = await db.query(
      `
      SELECT
        plcyNm, lclsfNm, mclsfNm,
        plcyKywdNm, plcyExplnCn, plcySprtCn, plcyAplyMthdCn,
        aplyYmd, bizPrdBgngYmd, bizPrdEndYmd,
        aplyUrlAddr, srngMthdCn, sbmsnDcmntCn
      FROM policies
      WHERE id = ?
      `,
      [policyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "정책을 찾을 수 없습니다" });
    }

    const row = rows[0];
    row.plcyKywdNm = (row.plcyKywdNm || "")
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    res.json(row);
  } catch (err) {
    console.error("정책 상세 조회 오류:", err);
    res.status(500).json({ message: "정책 상세 조회 실패" });
  }
});

async function ensurePolicyExists(policyId) {
  const [[row]] = await db.query(
    "SELECT EXISTS(SELECT 1 FROM policies WHERE id = ?) AS ok",
    [policyId]
  );
  return !!(row && row.ok);
}

// 리뷰 작성 API
router.post("/:id/reviews", authenticate, async (req, res) => {
  const policyId = Number(req.params.id);
  const email = req.user?.userId;
  let { rating, content } = req.body || {};

  if (!email)
    return res.status(400).json({ message: "인증 정보에 이메일이 없습니다" });
  rating = Number(rating);
  content = (content ?? "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: "rating은 1~5의 정수여야 합니다" });
  }
  if (!content) {
    return res.status(400).json({ message: "content는 비어있을 수 없습니다" });
  }

  let conn;
  try {
    const exists = await ensurePolicyExists(policyId);
    if (!exists)
      return res.status(404).json({ message: "정책을 찾을 수 없습니다" });

    conn = await db.getConnection();
    await conn.beginTransaction();

    // 평점
    await conn.query(
      `INSERT INTO policy_ratings (policy_id, rater_email, rating)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = ?, updated_at = CURRENT_TIMESTAMP`,
      [policyId, email, rating, rating]
    );

    // 내용
    await conn.query(
      `INSERT INTO policy_comments (policy_id, author_email, content, parent_id, is_review)
       VALUES (?, ?, ?, NULL, 1)
       ON DUPLICATE KEY UPDATE content = ?, is_deleted = 0, updated_at = CURRENT_TIMESTAMP`,
      [policyId, email, content, content]
    );

    // 요약
    const [[agg]] = await conn.query(
      `SELECT COUNT(*) AS rating_count, ROUND(AVG(rating), 2) AS rating_avg
       FROM policy_ratings WHERE policy_id = ?`,
      [policyId]
    );

    // 내 리뷰
    const [[mine]] = await conn.query(
      `SELECT pc.id AS comment_id, pc.content, pr.rating, pc.created_at, pc.updated_at
         FROM policy_comments pc
         LEFT JOIN policy_ratings pr
           ON pr.policy_id = pc.policy_id AND pr.rater_email = pc.author_email
        WHERE pc.policy_id = ? AND pc.author_email = ? AND pc.is_review = 1 AND pc.is_deleted = 0`,
      [policyId, email]
    );

    await conn.commit();

    return res.status(201).json({
      ok: true,
      review: mine || { content, rating },
      summary: agg || { rating_count: 0, rating_avg: null },
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("리뷰 upsert 오류:", err?.sqlMessage || err);
    return res.status(500).json({ message: "리뷰 작성/수정 실패" });
  } finally {
    if (conn) conn.release();
  }
});

// 리뷰 수정 API
router.patch("/:id/reviews", authenticate, async (req, res) => {
  const policyId = Number(req.params.id);
  const email = req.user?.userId;
  let { rating, content } = req.body || {};

  if (!email)
    return res.status(400).json({ message: "인증 정보에 이메일이 없습니다" });

  const hasRating = rating !== undefined && rating !== null && rating !== "";
  const hasContent = typeof content === "string";
  if (!hasRating && !hasContent) {
    return res
      .status(400)
      .json({ message: "수정할 rating 또는 content가 필요합니다" });
  }

  if (hasRating) {
    rating = Number(rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ message: "rating은 1~5의 정수여야 합니다" });
    }
  }
  if (hasContent) content = content.trim();

  let conn;
  try {
    const exists = await ensurePolicyExists(policyId);
    if (!exists)
      return res.status(404).json({ message: "정책을 찾을 수 없습니다" });

    conn = await db.getConnection();
    await conn.beginTransaction();

    if (hasRating) {
      await conn.query(
        `INSERT INTO policy_ratings (policy_id, rater_email, rating)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE rating = ?, updated_at = CURRENT_TIMESTAMP`,
        [policyId, email, rating, rating]
      );
    }

    if (hasContent) {
      await conn.query(
        `INSERT INTO policy_comments (policy_id, author_email, content, parent_id, is_review)
         VALUES (?, ?, ?, NULL, 1)
         ON DUPLICATE KEY UPDATE content = ?, is_deleted = 0, updated_at = CURRENT_TIMESTAMP`,
        [policyId, email, content, content]
      );
    }

    const [[mine]] = await conn.query(
      `SELECT pc.id AS comment_id, pc.content, pr.rating, pc.created_at, pc.updated_at
       FROM policy_comments pc
       LEFT JOIN policy_ratings pr
         ON pr.policy_id = pc.policy_id AND pr.rater_email = pc.author_email
       WHERE pc.policy_id = ? AND pc.author_email = ? AND pc.is_review = 1 AND pc.is_deleted = 0`,
      [policyId, email]
    );

    await conn.commit();
    res.json({ ok: true, review: mine || null });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("리뷰 수정 오류:", err?.sqlMessage || err);
    res.status(500).json({ message: "리뷰 수정 실패" });
  } finally {
    if (conn) conn.release();
  }
});

// 리뷰 목록 조회 API
router.get("/:id/reviews", async (req, res) => {
  const policyId = Number(req.params.id);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  try {
    const exists = await ensurePolicyExists(policyId);
    if (!exists)
      return res.status(404).json({ message: "정책을 찾을 수 없습니다" });

    const [rows] = await db.query(
      `SELECT
         pc.id AS comment_id,
         pc.author_email,
	 u.nickname,
         pc.content,
         pc.created_at,
         pc.updated_at,
         pr.rating
       FROM policy_comments pc
       LEFT JOIN policy_ratings pr
         ON pr.policy_id = pc.policy_id
        AND pr.rater_email = pc.author_email
       LEFT JOIN users u
         ON u.email = pc.author_email
       WHERE pc.policy_id = ? AND pc.is_review = 1 AND pc.is_deleted = 0
       ORDER BY pc.created_at DESC
       LIMIT ? OFFSET ?`,
      [policyId, limit, offset]
    );

    const [[agg]] = await db.query(
      `SELECT COUNT(*) AS rating_count, ROUND(AVG(rating), 2) AS rating_avg
         FROM policy_ratings
        WHERE policy_id = ?`,
      [policyId]
    );

    res.json({
      items: rows,
      limit,
      offset,
      summary: agg || { rating_count: 0, rating_avg: null },
    });
  } catch (err) {
    console.error("리뷰 목록 조회 오류:", err);
    res.status(500).json({ message: "리뷰 목록 조회 실패" });
  }
});

// 내 리뷰 조회 API
router.get("/:id/reviews/mine", authenticate, async (req, res) => {
  const policyId = Number(req.params.id);
  const email = req.user?.userId;
  if (!email)
    return res.status(400).json({ message: "인증 정보에 이메일이 없습니다" });

  try {
    const [[mine]] = await db.query(
      `SELECT
         pc.id AS comment_id, pc.content, pr.rating,
         pc.created_at, pc.updated_at
       FROM policy_comments pc
       LEFT JOIN policy_ratings pr
         ON pr.policy_id=pc.policy_id AND pr.rater_email=pc.author_email
       WHERE pc.policy_id=? AND pc.author_email=? AND pc.is_review=1 AND pc.is_deleted=0`,
      [policyId, email]
    );
    res.json(mine || null);
  } catch (err) {
    console.error("내 리뷰 조회 오류:", err);
    res.status(500).json({ message: "내 리뷰 조회 실패" });
  }
});

// 내 리뷰 삭제(소프트 삭제) API
router.delete("/:id/reviews", authenticate, async (req, res) => {
  const policyId = Number(req.params.id);
  const email = req.user?.userId;
  if (!email)
    return res.status(400).json({ message: "인증 정보에 이메일이 없습니다" });

  let conn;
  try {
    const exists = await ensurePolicyExists(policyId);
    if (!exists)
      return res.status(404).json({ message: "정책을 찾을 수 없습니다" });

    conn = await db.getConnection();
    await conn.beginTransaction();

    await conn.query(
      `UPDATE policy_comments
          SET is_deleted=1, updated_at=NOW()
        WHERE policy_id=? AND author_email=? AND is_review=1 AND is_deleted=0`,
      [policyId, email]
    );

    await conn.query(
      `DELETE FROM policy_ratings
        WHERE policy_id=? AND rater_email=?`,
      [policyId, email]
    );

    const [[agg]] = await conn.query(
      `SELECT COUNT(*) AS rating_count, ROUND(AVG(rating), 2) AS rating_avg
       FROM policy_ratings WHERE policy_id = ?`,
      [policyId]
    );

    await conn.commit();
    res.json({
      ok: true,
      summary: agg || { rating_count: 0, rating_avg: null },
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error("리뷰 삭제 오류:", err);
    res.status(500).json({ message: "리뷰 삭제 실패" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
