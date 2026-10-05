/**
 * 巴拉國國民身分證名冊（重製版 2026-10）
 * 同名永遠對應固定字號；密碼僅用於前端驗證。
 */
(function (root) {
  const SALT = 'balala-reset-2026-10';

  const CITIZENS = Object.freeze([
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
  ]);

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

  const BY_NAME = Object.create(null);
  const BY_ID = Object.create(null);

  for (const c of CITIZENS) {
    const id = idFor(c.name);
    const record = Object.freeze({ name: c.name, password: c.password, id_number: id });
    BY_NAME[c.name] = record;
    BY_ID[id] = record;
  }

  root.BalalaIdRegistry = Object.freeze({
    SALT,
    CITIZENS,
    idFor,
    getByName(name) {
      return BY_NAME[name] || null;
    },
    getById(id) {
      return BY_ID[id] || null;
    },
    allIds() {
      return Object.keys(BY_ID);
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
