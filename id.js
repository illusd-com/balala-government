/**
 * 巴拉國國民身分證 — 查詢／核發（需密碼）
 * - 字號以 Supabase 為唯一來源：已核發則永不改動
 * - 其他裝置只能查詢既有資料，無法重製字號
 * - 僅在資料庫尚無紀錄時核發一次
 */

(() => {
  const REG = window.BalalaIdRegistry;
  const LOCAL_KEY = 'balala_id_cards_v3';

  const form = document.getElementById('id-form');
  const nameInput = document.getElementById('full-name');
  const passwordInput = document.getElementById('id-password');
  const passwordField = document.getElementById('password-field');
  const formError = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');
  const panelForm = document.getElementById('panel-form');
  const panelResult = document.getElementById('panel-result');
  const resultMsg = document.getElementById('result-msg');
  const cardName = document.getElementById('card-name');
  const cardNumber = document.getElementById('card-number');
  const cardDate = document.getElementById('card-date');
  const btnReset = document.getElementById('btn-reset');

  let step = 'name';
  let pendingName = null;

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

  /** 只讀：從雲端取既有身分證，絕不修改字號 */
  async function dbGet(name) {
    const client = getSupabase();
    if (!client) return null;

    const { data, error } = await client
      .from('id_cards')
      .select('full_name, id_number, created_at')
      .eq('full_name', name)
      .maybeSingle();

    if (error) {
      console.warn('[id] supabase get', error.message);
      return null;
    }
    if (!data) return null;

    const record = {
      full_name: data.full_name,
      id_number: data.id_number,
      created_at: data.created_at,
    };
    localSave(name, record);
    return record;
  }

  /**
   * 僅在雲端尚無此人之紀錄時插入一次。
   * 若已存在（含 unique 衝突）→ 改讀既有資料，絕不 UPDATE 字號。
   */
  async function dbIssueOnce(name, idNumber) {
    const client = getSupabase();
    if (!client) {
      const local = localGet(name);
      if (local) return { record: local, isNew: false, source: 'local' };
      const record = {
        full_name: name,
        id_number: idNumber,
        created_at: new Date().toISOString(),
      };
      localSave(name, record);
      return { record, isNew: true, source: 'local' };
    }

    const { data, error } = await client
      .from('id_cards')
      .insert({ full_name: name, id_number: idNumber })
      .select('full_name, id_number, created_at')
      .single();

    if (!error && data) {
      const saved = {
        full_name: data.full_name,
        id_number: data.id_number,
        created_at: data.created_at,
      };
      localSave(name, saved);
      return { record: saved, isNew: true, source: 'supabase' };
    }

    if (error) {
      console.warn('[id] insert blocked (likely exists)', error.message);
    }
    const existing = await dbGet(name);
    if (existing) {
      return { record: existing, isNew: false, source: 'supabase' };
    }

    throw new Error('無法核發或讀取身分證，請稍後再試。');
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
      ? '已為您核發巴拉國國民身分證，資料已保存至官方資料庫。'
      : '身分驗證成功（此證已於先前核發，不可重製）。';
    panelForm.hidden = true;
    panelResult.hidden = false;
  }

  function setStepName() {
    step = 'name';
    pendingName = null;
    passwordField.hidden = true;
    passwordInput.value = '';
    passwordInput.required = false;
    nameInput.disabled = false;
    submitBtn.textContent = '下一步';
  }

  function setStepPassword(name) {
    step = 'password';
    pendingName = name;
    passwordField.hidden = false;
    passwordInput.required = true;
    passwordInput.value = '';
    nameInput.disabled = true;
    submitBtn.textContent = '驗證並顯示身分證';
    passwordInput.focus();
  }

  function reset() {
    panelResult.hidden = true;
    panelForm.hidden = false;
    showError('');
    nameInput.value = '';
    setStepName();
    nameInput.focus();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');

    if (step === 'name') {
      const name = (nameInput.value || '').trim();
      if (!name) {
        showError('請輸入全名。');
        nameInput.focus();
        return;
      }
      const citizen = REG.getByName(name);
      if (!citizen) {
        showError('無法核發身分證，請確認姓名是否正確。');
        nameInput.focus();
        return;
      }
      setStepPassword(name);
      return;
    }

    const name = pendingName;
    const citizen = REG.getByName(name);
    if (!citizen) {
      showError('無法核發身分證，請確認姓名是否正確。');
      setStepName();
      return;
    }

    const pw = (passwordInput.value || '').trim();
    if (!pw) {
      showError('請輸入密碼。');
      passwordInput.focus();
      return;
    }
    if (pw !== citizen.password) {
      showError('密碼錯誤。');
      passwordInput.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '處理中…';

    try {
      const existing = await dbGet(name);
      if (existing) {
        showCard(existing, false);
        return;
      }

      const { record, isNew } = await dbIssueOnce(name, citizen.id_number);
      showCard(record, isNew);
    } catch (err) {
      console.error(err);
      showError(err.message || '系統暫時無法處理，請稍後再試。');
    } finally {
      submitBtn.disabled = false;
      if (step === 'password') submitBtn.textContent = '驗證並顯示身分證';
    }
  });

  btnReset.addEventListener('click', reset);
  setStepName();
})();
