/**
 * GET /api/id-check?id=Bxxxxxxxxx
 * or rewritten from /id-check/id-pass={id}/
 * Returns pure text:
 *   /id=true/name={name}
 * or
 *   /id=false/name=unknow
 *   *try-again*
 */

const SALT = 'balala-reset-2026-10';

const CITIZENS = [
  '李東羿', '相俊寬', '丁上航', '陳予睿', '陳初樂', '溫世鵬', '吳宥廷',
  '涂品彥', '張語芯', '李藹棠', '朱亮穎', '陳宣羽', '陳庭萱',
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
for (const name of CITIZENS) {
  BY_ID[idFor(name)] = name;
}

module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.end('/id=false/name=unknow\n*try-again*');
    return;
  }

  let id = (req.query && (req.query.id || req.query['id-pass'])) || '';
  if (Array.isArray(id)) id = id[0];
  id = String(id || '').trim().toUpperCase();

  if (!id && req.url) {
    const m = req.url.match(/id-pass=([A-Za-z0-9]+)/i);
    if (m) id = m[1].toUpperCase();
  }

  const name = BY_ID[id];
  if (name) {
    res.statusCode = 200;
    res.end('/id=true/name=' + name);
  } else {
    res.statusCode = 200;
    res.end('/id=false/name=unknow\n*try-again*');
  }
};
