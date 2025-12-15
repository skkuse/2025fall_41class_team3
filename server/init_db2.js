require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
});

async function initDB() {
  const conn = await pool.getConnection();
  try {
    console.log("🚀 DB 초기화 시작...");

    // ==========================================
    // 1. 기존 테이블 삭제 (순서 중요: 자식 -> 부모)
    // ==========================================
    await conn.query(`DROP TABLE IF EXISTS policy_comments`);
    await conn.query(`DROP TABLE IF EXISTS policy_ratings`);
    await conn.query(`DROP TABLE IF EXISTS policies`); // api_save.js가 쓰는 테이블
    await conn.query(`DROP TABLE IF EXISTS users`);
    console.log("✔ 기존 테이블 삭제 완료");

    // ==========================================
    // 2. Users 테이블 생성 (보여주신 DESC 구조 반영)
    // ==========================================
    await conn.query(`
      CREATE TABLE users (
        email VARCHAR(100) NOT NULL PRIMARY KEY,
        nickname VARCHAR(50) NOT NULL,
        password VARCHAR(255) NOT NULL,
        birthDate DATE NOT NULL,
        location VARCHAR(255) NOT NULL,
        maritalStatus VARCHAR(100) NOT NULL,
        income INT NOT NULL,
        education VARCHAR(100) NOT NULL,
        major VARCHAR(100) NOT NULL,
        employmentstatus VARCHAR(100) NOT NULL,
        specialGroup TEXT NOT NULL,
        interests TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        refreshToken TEXT,
        likedPolicies TEXT,
        recommendCount INT DEFAULT 5
      )
    `);
    console.log("✔ users 테이블 생성 완료");

    // ==========================================
    // 3. Policies 테이블 생성 (api_save.js용)
    // ==========================================
    await conn.query(`
      CREATE TABLE policies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plcyNm VARCHAR(255),
        plcyPvsnMthdCd TEXT,
        plcyAprvSttsCd VARCHAR(50),
        aplyPrdSeCd VARCHAR(50),
        mrgSttsCd VARCHAR(50),
        earnCndSeCd VARCHAR(50),
        schoolCd TEXT,
        jobCd TEXT,
        plcyMajorCd TEXT,
        sbizCd TEXT,
        zipCd TEXT,
        lclsfNm VARCHAR(100),
        mclsfNm VARCHAR(100),
        plcyKywdNm TEXT,
        plcyExplnCn LONGTEXT,
        plcySprtCn LONGTEXT,
        plcyAplyMthdCn LONGTEXT,
        srngMthdCn LONGTEXT,
        sbmsnDcmntCn LONGTEXT,
        etcMttrCn LONGTEXT,
        addAplyQlfcCndCn LONGTEXT,
        ptcpPrpTrgtCn LONGTEXT,
        aplyYmd TEXT,
        bizPrdSeCd VARCHAR(50),
        bizPrdBgngYmd VARCHAR(20),
        bizPrdEndYmd VARCHAR(20),
        bizPrdEtcCn TEXT,
        sprtTrgtMinAge VARCHAR(10),
        sprtTrgtMaxAge VARCHAR(10),
        sprtTrgtAgeLmtYn VARCHAR(10),
        earnMinAmt VARCHAR(50),
        earnMaxAmt VARCHAR(50),
        earnEtcCn TEXT,
        sprtSclLmtYn VARCHAR(10),
        sprtSclCnt VARCHAR(100),
        aplyUrlAddr TEXT,
        refUrlAddr1 TEXT,
        refUrlAddr2 TEXT,
        inqCnt INT DEFAULT 0,
        UNIQUE KEY uk_policy_name (plcyNm)
      )
    `);
    console.log("✔ policies 테이블 생성 완료");

    // ==========================================
    // 4. 부가 테이블 생성 (서버 코드 호환용 수정됨)
    // ==========================================
    
    // policy_ratings: 누가(rater_email) 점수를 줬는지 알아야 하므로 컬럼 추가
    await conn.query(`
      CREATE TABLE policy_ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        policy_id INT,
        rater_email VARCHAR(100),
        rating INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE,
        FOREIGN KEY (rater_email) REFERENCES users(email) ON DELETE CASCADE,
        UNIQUE KEY uk_rating (policy_id, rater_email)
      )
    `);

    // policy_comments: 누가(author_email) 썼는지, 리뷰인지(is_review) 알아야 하므로 컬럼 추가
    await conn.query(`
      CREATE TABLE policy_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        policy_id INT,
        author_email VARCHAR(100),
        content TEXT,
        parent_id INT DEFAULT NULL,
        is_review TINYINT(1) DEFAULT 0,
        is_deleted TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (policy_id) REFERENCES policies(id) ON DELETE CASCADE,
        FOREIGN KEY (author_email) REFERENCES users(email) ON DELETE CASCADE
      )
    `);
    console.log("✔ 댓글/평점 테이블 생성 완료");


    console.log("✨ DB 초기화가 성공적으로 끝났습니다!");

  } catch (err) {
    console.error("❌ 초기화 중 에러 발생:", err);
  } finally {
    conn.release();
    pool.end();
  }
}

initDB();
