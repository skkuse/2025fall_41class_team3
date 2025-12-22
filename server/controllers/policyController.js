const db = require('../config/db');
const { runPython } = require('../utils/pythonRunner');
const { normalizePolicyRow } = require("../utils/policyNormalizer");


// 정책 검색
exports.search = async (req, res) => {
  const { q, sido, employmentStatus, maritalStatus, education, major, specialGroup, interests } = req.query;
  const filters = {
    keyword: q, sido, employmentStatus, maritalStatus, education, major,
    specialGroup: specialGroup?.split(","),
    interests: interests?.split(","),
  };

  try {
    const result = await runPython("python/search.py", [JSON.stringify(filters)]);
    res.json(JSON.parse(result));
  } catch (err) {
    res.status(500).json({ message: "검색 실패" });
  }
};

// AI 정책 추천 (로직 완벽 복구)
exports.recommend = async (req, res) => {
  const email = req.user.userId;
  const prompt = req.query.prompt || "관심 키워드를 고려한 맞춤 추천";

  try {
    const [[user]] = await db.query("SELECT recommendCount FROM users WHERE email = ?", [email]);
    if (!user) return res.status(404).json({ message: "사용자 정보 없음" });

    const [updateResult] = await db.query(
      "UPDATE users SET recommendCount = recommendCount - 1 WHERE email = ? AND recommendCount > 0",
      [email]
    );

    if (updateResult.affectedRows === 0) return res.status(400).json({ message: "추천 횟수 소진" });

    const resultbuf = await runPython("python/recommend.py", [email, prompt]);
    const parsed = JSON.parse(resultbuf);

    // AI가 객체 배열을 준 경우 바로 반환
    if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === "object") {
      const items = parsed.map(p => ({
        id: p.id, plcyNm: p.plcyNm || p.name, reason: p.reason ?? null,
        badges: Array.isArray(p.badges) ? p.badges : [],
      }));
      return res.json({ recommendations: items });
    }

    // AI가 이름 리스트만 준 경우 DB 재조회
    const names = (Array.isArray(parsed) ? parsed : [])
      .map(item => typeof item === "string" ? item : item?.plcyNm ?? item?.name ?? (item && Object.values(item)[0]))
      .filter(Boolean);

    if (!names.length) return res.json({ recommendations: [] });

    const [rows] = await db.query(
      `SELECT id, plcyNm FROM policies WHERE plcyNm IN (${names.map(() => "?").join(", ")})`,
      names
    );
    res.json({ recommendations: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "추천 실패" });
  }
};

// 정책 요약 (stdin 전달 로직 포함)
exports.getSummary = async (req, res) => {
  try {
    const [[row]] = await db.query('SELECT * FROM policies WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ message: "정책 없음" });

    const inputText = `정책명: ${row.plcyNm}\n설명: ${row.plcyExplnCn}\n지원내용: ${row.plcySprtCn}\n방법: ${row.plcyAplyMthdCn}...`.trim();
    const out = await runPython("python/policy_summary.py", [], inputText);
    res.json({ summary: out.trim() });
  } catch (err) {
    res.status(500).json({ message: "요약 실패" });
  }
};

// 정책 상세/인기/최근
exports.getDetail = async (req, res) => {
  const [rows] = await db.query("SELECT * FROM policies WHERE id = ?", [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ message: "정책 없음" });

  const row = normalizePolicyRow(rows[0]);
  res.json(row);
};


exports.getPopular = async (req, res) => {
  const [rows] = await db.query("SELECT id, plcyNm FROM policies ORDER BY inqCnt DESC LIMIT 3");
  res.json(rows);
};

exports.getRecent = async (req, res) => {
  const [rows] = await db.query("SELECT id, plcyNm FROM policies WHERE bizPrdBgngYmd IS NOT NULL ORDER BY STR_TO_DATE(bizPrdBgngYmd, '%Y%m%d') DESC LIMIT 3");
  res.json(rows);
};