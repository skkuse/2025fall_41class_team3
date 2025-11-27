require('dotenv').config();
const axios = require('axios');
const mysql = require('mysql2/promise');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.BASE_URL;
const PAGE_SIZE = 1000;

// zipCd 변환 로딩 (legal_district_code.txt 필요)
const zipCdToName = {};
const filePath = path.join(__dirname, 'legal_district_code.txt');
async function loadZipCdToName() {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream });
    let isHeader = true;
    rl.on('line', (line) => {
      if (isHeader) { isHeader = false; return; }
      if (!line.trim()) return;
      const parts = line.split('\t').map(v => v.trim());
      if (parts.length >= 3) {
                const code = parts[0];
        const sido = parts[1];
                const sigungu = parts[2];
        let newSigungu = sigungu;
        if (/^([가-힣]+시)([가-힣]+구)$/.test(sigungu)) {
          newSigungu = sigungu.replace(/^([가-힣]+시)([가-힣]+구)$/, '$1 $2');
        }
        zipCdToName[code] = `${sido} ${newSigungu}`;
      }
    });
    rl.on('close', () => resolve());
    rl.on('error', (err) => reject(err));
  });
}

const codeMappings = {
  // 정책제공방법코드
  plcyPvsnMthdCd: {
    '0042001': '인프라 구축',
    '0042002': '프로그램',
    '0042003': '직접대출',    
    '0042004': '공공기관',
    '0042005': '계약(위탁운영)',
    '0042006': '보조금',
    '0042007': '대출보증',
    '0042008': '공적보험',
    '0042009': '조세지출',
    '0042010': '바우처',
    '0042011': '정보제공',
    '0042012': '경제적 규제',
    '0042013': '기타'
  },
  // 정책승인상태코드
  plcyAprvSttsCd: {
    '0044001': '신청',
    '0044002': '승인',
    '0044003': '반려',
    '0044004': '임시저장'
  },
  // 신청기간구분코드
  aplyPrdSeCd: {
    '0057001': '특정기간',
    '0057002': '상시',
    '0057003': '마감'
  },
  // 사업기간구분코드
  bizPrdSeCd: {
    '0056001': '특정기간',
    '0056002': '기타'
  },
  //결혼
  mrgSttsCd: {
    '0055001': '기혼',
    '0055002': '미혼',
    '0055003': '제한없음'
  },
  //소득
  earnCndSeCd: {
    '0043001': '무관',
    '0043002': '연소득',
    '0043003': '기타'
  },
  // 정책전공요건코드
  plcyMajorCd: {
    '0011001': '인문계열',
    '0011002': '사회계열',
    '0011003': '상경계열',
    '0011004': '이학계역',
    '0011005': '공학계열',
    '0011006': '예체능계열',
    '0011007': '농산업계열',
    '0011008': '기타',
    '0011009': '제한없음'
  },
  // 정책취업요건코드
    jobCd: {
    '0013001': '재직자',
    '0013002': '자영업자',
    '0013003': '미취업자',
    '0013004': '프리랜서',
    '0013005': '일용근로자',
    '0013006': '(예비)창업자',
    '0013007': '단기근로자',
    '0013008': '영농종사자',
    '0013009': '기타',
    '0013010': '제한없음'
  },
  // 정책학력요건코드
  schoolCd: {
    '0049001': '고졸 미만',
    '0049002': '고교 재학',
    '0049003': '고졸 예정',
    '0049004': '고교 졸업',
    '0049005': '대학 재학',
    '0049006': '대졸 예정',
    '0049007': '대학 졸업',
    '0049008': '석·박사',
    '0049009': '기타',
    '0049010': '제한없음'
  },
  // 정책특화요건코드
  sbizCd: {
    '0014001': '중소기업',
    '0014002': '여성',
    '0014003': '기초생활수급자',
    '0014004': '한부모가정',
    '0014005': '장애인',
    '0014006': '농업인',
    '0014007': '군인',
    '0014008': '지역인재',
    '0014009': '기타',
    '0014010': '제한없음'
  }
};

const outputSpec = [
  //{ key: 'plcyNo',               type: 'String', desc: '정책번호' },
  //{ key: 'bscPlanCycl',          type: 'String', desc: '기본계획차수' },
  //{ key: 'bscPlanPlcyWayNo',     type: 'String', desc: '기본계획정책방향번호' },
  //{ key: 'bscPlanFcsAsmtNo',     type: 'String', desc: '기본계획중점과제번호' },
  //{ key: 'bscPlanAsmtNo',        type: 'String', desc: '기본계획과제번호' },
  //{ key: 'pvsnInstGroupCd',      type: 'String', desc: '제공기관그룹코드' },
  { key: 'plcyAprvSttsCd',       type: 'String', desc: '정책승인상태코드' },
  { key: 'aplyPrdSeCd',          type: 'String', desc: '신청기간구분코드' },
  { key: 'aplyYmd',              type: 'String', desc: '신청기간' },
  { key: 'bizPrdSeCd',           type: 'String', desc: '사업기간구분코드' },
  { key: 'bizPrdBgngYmd',        type: 'String', desc: '사업기간시작일자' },
  { key: 'bizPrdEndYmd',         type: 'String', desc: '사업기간종료일자' },
  { key: 'bizPrdEtcCn',          type: 'String', desc: '사업기간기타내용' },
  { key: 'zipCd',                type: 'String', desc: '정책거주지역코드' },
  { key: 'sprtTrgtMinAge',       type: 'String', desc: '지원대상최소연령' },
  { key: 'sprtTrgtMaxAge',       type: 'String', desc: '지원대상최대연령' },
  { key: 'sprtTrgtAgeLmtYn',     type: 'String', desc: '지원대상연령제한여부' },
  { key: 'mrgSttsCd',            type: 'String', desc: '결혼상태코드' },
  { key: 'earnCndSeCd',          type: 'String', desc: '소득조건구분코드' },
  { key: 'earnMinAmt',           type: 'String', desc: '소득최소금액' },
  { key: 'earnMaxAmt',           type: 'String', desc: '소득최대금액' },
  { key: 'earnEtcCn',            type: 'String', desc: '소득기타내용' },
  { key: 'schoolCd',             type: 'String', desc: '정책학력요건코드' },
  { key: 'jobCd',                type: 'String', desc: '정책취업요건코드' },
  { key: 'plcyMajorCd',          type: 'String', desc: '정책전공요건코드' },
  { key: 'sbizCd',               type: 'String', desc: '정책특화요건코드' },
  { key: 'plcyPvsnMthdCd',       type: 'String', desc: '정책제공방법코드' },
  { key: 'plcyNm',               type: 'String', desc: '정책명' },
  { key: 'lclsfNm',              type: 'String', desc: '정책대분류명' },
  { key: 'mclsfNm',              type: 'String', desc: '정책중분류명' },
  { key: 'plcyKywdNm',           type: 'String', desc: '정책키워드명' },
  { key: 'plcyExplnCn',          type: 'String', desc: '정책설명내용' },
  { key: 'plcySprtCn',           type: 'String', desc: '정책지원내용' },
  //{ key: 'sprvsnInstCd',         type: 'String', desc: '주관기관코드' },
  //{ key: 'sprvsnInstCdNm',       type: 'String', desc: '주관기관코드명' },
  //{ key: 'sprvsnInstPicNm',      type: 'String', desc: '주관기관담당자명' },
  //{ key: 'operInstCd',           type: 'String', desc: '운영기관코드' },
  //{ key: 'operInstCdNm',         type: 'String', desc: '운영기관코드명' },
  //{ key: 'operInstPicNm',        type: 'String', desc: '운영기관담당자명' },
  { key: 'sprtSclLmtYn',         type: 'String', desc: '지원규모제한여부' },
  { key: 'plcyAplyMthdCn',       type: 'String', desc: '정책신청방법내용' },
  { key: 'srngMthdCn',           type: 'String', desc: '심사방법내용' },
  { key: 'aplyUrlAddr',          type: 'String', desc: '신청URL주소' },
  { key: 'sbmsnDcmntCn',         type: 'String', desc: '제출서류내용' },
  { key: 'etcMttrCn',            type: 'String', desc: '기타사항내용' },
  { key: 'refUrlAddr1',          type: 'String', desc: '참고URL주소1' },
  { key: 'refUrlAddr2',          type: 'String', desc: '참고URL주소2' },
  { key: 'sprtSclCnt',           type: 'String', desc: '지원규모수' },
  //{ key: 'sprtArvlSeqYn',        type: 'String', desc: '지원도착순서여부' },
  { key: 'addAplyQlfcCndCn',     type: 'String', desc: '추가신청자격조건내용' },
  { key: 'ptcpPrpTrgtCn',        type: 'String', desc: '참여제안대상내용' },
  { key: 'inqCnt',               type: 'String', desc: '조회수' }
  //{ key: 'rgtrInstCd',           type: 'String', desc: '등록자기관코드' },
  //{ key: 'rgtrInstCdNm',         type: 'String', desc: '등록자기관코드명' },
  //{ key: 'rgtrUpInstCd',         type: 'String', desc: '등록자상위기관코드' },
  //{ key: 'rgtrUpInstCdNm',       type: 'String', desc: '등록자상위기관코드명' },
  //{ key: 'rgtrHghrkInstCd',      type: 'String', desc: '등록자최상위기관코드' },
  //{ key: 'rgtrHghrkInstCdNm',    type: 'String', desc: '등록자최상위기관코드명' },
  //{ key: 'frstRegDt',            type: 'String', desc: '최초등록일시' },
  //{ key: 'lastMdfcnDt',          type: 'String', desc: '최종수정일시' },
];

function convertCodeToMeaning(key, value) {
  if (!value || value === '') return '';
  if (key === 'zipCd') {
    return value
      .split(',')
      .map(code => zipCdToName[code.trim()] || code.trim())
      .join(', ');
  }
    const mapping = codeMappings[key];
  if (['schoolCd', 'plcyMajorCd', 'jobCd', 'sbizCd', 'mrgSttsCd', 'earnCndSeCd', 'plcyPvsnMthdCd'].includes(key)) {
        return value
      .split(',')
      .map(code => mapping ? (mapping[code.trim()] || code.trim()) : code.trim())
      .join(', ');
  }
  if (mapping && mapping[value]) {
    return mapping[value];
  }
  return value;
}

// DB 연결 풀
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
});

// 정책을 한글 변환해서 DB에 저장
async function upsertPolicy(policy) {
   // outputSpec 순서대로 의미 변환 적용
  const keys = outputSpec.map(({ key }) => key);
  const fields = keys.join(',');
  const placeholders = keys.map(() => '?').join(',');
  const updateFields = keys.map(k => `${k}=VALUES(${k})`).join(',');
  // 각 필드를 변환해서 저장!
  const values = keys.map(k => convertCodeToMeaning(k, policy[k] || ''));

  const sql = `
    INSERT INTO policies (${fields}) VALUES (${placeholders})
    ON DUPLICATE KEY UPDATE ${updateFields}
  `;
  await pool.query(sql, values);
}

function formatApplicationPeriod(aplyYmd) {
  if (!aplyYmd || aplyYmd === '') return '';
  const parts = aplyYmd.split(' ~ ');
  if (parts.length === 2) {
    const startDate = parts[0].replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3');
        const endDate = parts[1].replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3');
    return `${startDate} ~ ${endDate}`;
  }
    return aplyYmd;
}

function parseYmd(dateStr) {
  if (!dateStr || dateStr.length !== 8) return null;
  return new Date(
    parseInt(dateStr.slice(0, 4), 10),
    parseInt(dateStr.slice(4, 6), 10) - 1,
    parseInt(dateStr.slice(6, 8), 10)
  );
}

function isDateInRange(startYmd, endYmd, today) {
  const start = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  if (start && end) {
    return start <= today && today <= end;
  } else if (start && !end) {
    return start <= today;
  } else if (!start && end) {
        return today <= end;
  }
  return true;
}

async function fetchAndSavePolicies() {
  await loadZipCdToName();
  let pageNum = 1;
  const allPolicies = [];
  while (true) {
    const res = await axios.get(BASE_URL, {
      params: {
        apiKeyNm: API_KEY,
        rtnType: 'json',
        pageNum,
        pageSize: PAGE_SIZE
      }
    });
    const list = res.data?.result?.youthPolicyList || [];
    if (list.length === 0) break;
    allPolicies.push(...list);
    pageNum++;
      }

  const today = new Date();

  const filteredPolicies = allPolicies.filter(policy => {
        if (policy.plcyAprvSttsCd !== '0044002') return false;
    if (policy.aplyPrdSeCd === '0057003') return false;

    let aplyIn = true;
    if (policy.aplyPrdSeCd === '0057001' && policy.aplyYmd && policy.aplyYmd.includes('~')) {
      const [start, end] = policy.aplyYmd.split('~').map(s => s.trim().replace(/\./g, ''));
      aplyIn = isDateInRange(start, end, today);
    }

    let bizIn = true;
    if (policy.bizPrdSeCd === '0056001' && policy.bizPrdBgngYmd && policy.bizPrdEndYmd) {
      bizIn = isDateInRange(policy.bizPrdBgngYmd, policy.bizPrdEndYmd, today);
    }
    return aplyIn && bizIn;
  });
  
  let count = 0;
  for (const policy of filteredPolicies) {
    try {
      await upsertPolicy(policy);
            count++;
    } catch (err) {
      console.error('DB 저장 오류:', policy.plcyNm, err.message);
    }
  }
  console.log(`정책 ${count}개를 DB에 저장했습니다.`);
}

async function deleteExpiredOrClosedPoliciesForce() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const criteria = `
      (aplyPrdSeCd IN ('마감', '0057003'))
      OR (
        aplyPrdSeCd IN ('특정기간', '0057001')
        AND aplyYmd IS NOT NULL AND aplyYmd <> ''
        AND STR_TO_DATE(
          REGEXP_REPLACE(TRIM(SUBSTRING_INDEX(aplyYmd, '~', -1)), '[^0-9]', ''),
          '%Y%m%d'
        ) < CURDATE()
      )
    `;

    const [rows] = await conn.query(`SELECT id FROM policies WHERE ${criteria}`);
    if (rows.length === 0) {
      await conn.commit();
      console.log('삭제 대상 없음');
      return;
    }

    const ids = rows.map(r => r.id);
    const chunkArray = (arr, size) => {
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };
    const batches = chunkArray(ids, 1000);

    let delComments = 0, delRatings = 0, delPolicies = 0;

    for (const batch of batches) {
      const [r1] = await conn.query(
        `DELETE FROM policy_comments WHERE policy_id IN (?)`,
        [batch]
      );
      delComments += (r1.affectedRows || 0);

      const [r2] = await conn.query(
        `DELETE FROM policy_ratings WHERE policy_id IN (?)`,
        [batch]
      );
      delRatings += (r2.affectedRows || 0);

      const [r3] = await conn.query(
        `DELETE FROM policies WHERE id IN (?)`,
        [batch]
      );
      delPolicies += (r3.affectedRows || 0);
    }

    await conn.commit();
    console.log(`삭제 완료 - comments:${delComments}, ratings:${delRatings}, policies:${delPolicies}`);
  } catch (e) {
    await conn.rollback();
    console.error('강제 삭제 실패:', e.message);
    throw e;
  } finally {
    conn.release();
  }
}

(async function main() {
  try {
    await fetchAndSavePolicies();
    await deleteExpiredOrClosedPoliciesForce();
    console.log('모든 정책 저장/정리 완료!');
    process.exit(0);
  } catch (err) {
    console.error('실패:', err);
    process.exit(1);
  }
})();
