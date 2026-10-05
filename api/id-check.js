/**
 * GET /id-check/id-pass={id}/password={password}
 * or /api/id-check?id=...&password=...
 * Pure text:
 *   /id=true/name={name}
 * or
 *   /id=false/name=unknow
 *   *try-again*
 */

const SALT = 'balala-reset-2026-10';

const CITIZENS = [
  { name: '李東羿', password: '00005055' },
  { name: '相俊寬', password: '0910365850' },
  { name: '丁上航', password: '9220' },
  { name: '陳予睿', password: '9220' },
  { name: '陳初樂', password: '9220' },
  { name: '溫世鵬', password: '9220' },
  { name: '吳宥廷', password: '9220' },
  { name: '涂品彥', password: '9220' },
  { name: '張語芯', password: '1022' },
  { name: '李藹棠', password: '9220' },
  { name: '朱亮穎', password: '9220' },
  { name: '陳宣羽', password: '9220' },
  { name: '陳庭萱', password: '9220' },
];

function hashName(name) {
  let h = 2166136261;
  const s = SALT + '|' + name;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function idFor(name) {
  const digits = String(hashName(name) % 1000000000).padStart(9, '0');
  return 'B' + digits;
}

const BY_ID = Object.create(null);
for (const c of CITIZENS) {
  BY_ID[idFor(c.name)] = c;
}

function fail(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end('/id=false/name=unknow\n*try-again*');
}

function ok(res, name) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end('/id=true/name=' + name);
}

module.exports = function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fail(res);
    return;
  }

  let id = '';
  let password = '';

  if (req.query) {
    const qId = req.query.id || req.query['id-pass'];
    const qPw = req.query.password || req.query.pass || req.query.pw;
    if (qId) id = Array.isArray(qId) ? qId[0] : qId;
    if (qPw) password = Array.isArray(qPw) ? qPw[0] : qPw;
  }

  if (req.url) {
    const mId = req.url.match(/id-pass=([A-Za-z0-9]+)/i);
    const mPw = req.url.match(/password=([^/&#?]+)/i);
    if (!id && mId) id = mId[1];
    if (!password && mPw) password = decodeURIComponent(mPw[1]);
  }

  id = String(id || '').trim().toUpperCase();
  password = String(password || '').trim();

  if (!id || !password) {
    fail(res);
    return;
  }

  const citizen = BY_ID[id];
  if (!citizen || citizen.password !== password) {
    fail(res);
    return;
  }

  ok(res, citizen.name);
};
