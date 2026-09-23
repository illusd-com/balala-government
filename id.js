/**
 * 巴拉國國民身分證 — 查詢／核發
 * - 白名單姓名
 * - 同名永遠產生相同 B 開頭字號
 * - 優先寫入 Supabase；未設定則用 localStorage
 */

(() => {
  const ALLOWED = Object.freeze([
    '朱亮穎',
    '李東羿',
    '涂品彥',
    '陳庭萱',
    '李藹棠',
    '温世鵬',
    '陳宣羽',
  ]);

  const LOCAL_KEY = 'balala_id_cards_v1';

  const form = document.getElementById('id-form');
  const nameInput = document.getElementById('full-name');
  const formError = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');
  const panelForm = document.getElementById('panel-form');
  const panelResult = document.getElementById('panel-result');
  const resultMsg = document.getElementById('result-msg');
  const cardName = document.getElementById('card-name');
  const cardNumber = document.getElementById('card-number');
  const cardDate = document.getElementById('card-date');
  const btnReset = document.getElementById('btn-reset');

  function hashName(name) {
    let h = 2166136261;
    for (let i = 0; i < name.length; i++) {
      h ^= name.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function generateIdNumber(name) {
    const h = hashName(name);
    const digits = String(h % 1000000000).padStart(9, '0');
    return 'B' + digits;
  }

  function formatDate(iso) {
    try {
      const d = iso ? new Date(iso) : new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}.${m}.${day}`;
    } catch {
      return '—';
    }
  }

  function localLoad() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function localSave(name, record) {
    const all = localLoad();
    all[name] = record;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  }

  function localGet(name) {
    return localLoad()[name] || null;
  }

  function getSupabase() {
    const cfg = window.BALALA_CONFIG || {};
    if (cfg.useLocalOnly) return null;
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    if (cfg.supabaseUrl.includes('YOUR_PROJECT')) return null;
    if (typeof supabase === 'undefined' || !supabase.createClient) return null;
    try {
      return supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    } catch {
      return null;
    }
  }

  async function dbGet(name) {
    const client = getSupabase();
    if (!client) return localGet(name);

    const { data, error } = await client
      .from('id_cards')
      .select('full_name, id_number, created_at')
      .eq('full_name', name)
      .maybeSingle();

    if (error) {
      console.warn('[id] supabase get', error.message);
      return localGet(name);
    }
    if (data) {
      const record = {
        full_name: data.full_name,
        id_number: data.id_number,
        created_at: data.created_at,
      };
      localSave(name, record);
      return record;
    }
    return null;
  }

  async function dbInsert(name, idNumber) {
    const record = {
      full_name: name,
      id_number: idNumber,
      created_at: new Date().toISOString(),
    };

    const client = getSupabase();
    if (!client) {
      localSave(name, record);
      return { record, source: 'local', isNew: true };
    }

    const { data, error } = await client
      .from('id_cards')
      .insert({ full_name: name, id_number: idNumber })
      .select('full_name, id_number, created_at')
      .single();

    if (error) {
      if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
        const existing = await dbGet(name);
        if (existing) return { record: existing, source: 'supabase', isNew: false };
      }
      console.warn('[id] supabase insert', error.message);
      localSave(name, record);
      return { record, source: 'local', isNew: true };
    }

    const saved = {
      full_name: data.full_name,
      id_number: data.id_number,
      created_at: data.created_at,
    };
    localSave(name, saved);
    return { record: saved, source: 'supabase', isNew: true };
  }

  function showError(msg) {
    formError.hidden = !msg;
    formError.textContent = msg || '';
  }

  function showCard(record, isNew) {
    cardName.textContent = record.full_name;
    cardNumber.textContent = record.id_number;
    cardDate.textContent = formatDate(record.created_at);
    resultMsg.textContent = isNew
      ? '已為您核發巴拉國國民身分證，資料已保存。'
      : '已查到既有身分證資料（同名永遠相同字號）。';
    panelForm.hidden = true;
    panelResult.hidden = false;
  }

  function reset() {
    panelResult.hidden = true;
    panelForm.hidden = false;
    showError('');
    nameInput.value = '';
    nameInput.focus();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');

    const name = (nameInput.value || '').trim();
    if (!name) {
      showError('請輸入全名。');
      nameInput.focus();
      return;
    }

    if (!ALLOWED.includes(name)) {
      showError('此姓名未在巴拉國國民登記名冊中，無法核發身分證。');
      nameInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '處理中…';

    try {
      let existing = await dbGet(name);
      if (existing) {
        showCard(existing, false);
        return;
      }

      const idNumber = generateIdNumber(name);
      const { record, isNew } = await dbInsert(name, idNumber);
      showCard(record, isNew);
    } catch (err) {
      console.error(err);
      showError('系統暫時無法處理，請稍後再試。');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '查詢／核發身分證';
    }
  });

  btnReset.addEventListener('click', reset);
})();
