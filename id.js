/**
 * 巴拉國國民身分證 — 查詢／核發（需密碼）
 * - Supabase 為官方來源：已有紀錄則只讀、永不改字號
 * - 僅在尚無紀錄時 insert 一次
 * - 雲端失敗時降級本機（固定字號），不阻斷使用
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
    if (String(cfg.supabaseUrl).includes('YOUR_PROJECT')) return null;
    if (typeof supabase === 'undefined' || !supabase.createClient) return null;
    try {
      return supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    } catch (e) {
      console.warn('[id] createClient', e);
      return null;
    }
  }

  function toRecord(data) {
    return {
      full_name: data.full_name,
      id_number: data.id_number,
      created_at: data.created_at,
    };
  }

  async function dbGetByName(client, name) {
    const { data, error } = await client
      .from('id_cards')
      .select('full_name, id_number, created_at')
      .eq('full_name', name)
      .maybeSingle();
    if (error) {
      console.warn('[id] getByName', error.message || error);
      return { error, record: null };
    }
    return { error: null, record: data ? toRecord(data) : null };
  }

  async function dbGetById(client, idNumber) {
    const { data, error } = await client
      .from('id_cards')
      .select('full_name, id_number, created_at')
      .eq('id_number', idNumber)
      .maybeSingle();
    if (error) {
      console.warn('[id] getById', error.message || error);
      return { error, record: null };
    }
    return { error: null, record: data ? toRecord(data) : null };
  }

  async function resolveCard(name, registryId) {
    const client = getSupabase();

    if (!client) {
      const local = localGet(name);
      if (local) return { record: local, isNew: false, source: 'local' };
      const record = {
        full_name: name,
        id_number: registryId,
        created_at: new Date().toISOString(),
      };
      localSave(name, record);
      return { record, isNew: true, source: 'local' };
    }

    const byName = await dbGetByName(client, name);
    if (byName.record) {
      localSave(name, byName.record);
      return { record: byName.record, isNew: false, source: 'supabase' };
    }

    const { data, error } = await client
      .from('id_cards')
      .insert({ full_name: name, id_number: registryId })
      .select('full_name, id_number, created_at')
      .single();

    if (!error && data) {
      const record = toRecord(data);
      localSave(name, record);
      return { record, isNew: true, source: 'supabase' };
    }

    if (error) {
      console.warn('[id] insert', error.code, error.message || error);
    }

    const again = await dbGetByName(client, name);
    if (again.record) {
      localSave(name, again.record);
      return { record: again.record, isNew: false, source: 'supabase' };
    }

    const byId = await dbGetById(client, registryId);
    if (byId.record && byId.record.full_name === name) {
      localSave(name, byId.record);
      return { record: byId.record, isNew: false, source: 'supabase' };
    }

    if (byId.record && byId.record.full_name !== name) {
      console.warn('[id] id_number occupied by', byId.record.full_name);
    }

    const local = localGet(name);
    if (local) return { record: local, isNew: false, source: 'local' };

    const record = {
      full_name: name,
      id_number: registryId,
      created_at: new Date().toISOString(),
    };
    localSave(name, record);
    return { record, isNew: true, source: 'local' };
  }

  function showError(msg) {
    formError.hidden = !msg;
    formError.textContent = msg || '';
  }

  function showCard(record, isNew, source) {
    cardName.textContent = record.full_name;
    cardNumber.textContent = record.id_number;
    cardDate.textContent = formatDate(record.created_at);
    if (isNew && source === 'supabase') {
      resultMsg.textContent = '已為您核發巴拉國國民身分證，資料已保存至官方資料庫。';
    } else if (!isNew && source === 'supabase') {
      resultMsg.textContent = '身分驗證成功（此證已於先前核發，不可重製）。';
    } else if (isNew) {
      resultMsg.textContent = '已核發身分證（本機暫存；官方庫稍後同步）。';
    } else {
      resultMsg.textContent = '身分驗證成功，以下為您的身分證資料。';
    }
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
      const { record, isNew, source } = await resolveCard(name, citizen.id_number);
      showCard(record, isNew, source);
    } catch (err) {
      console.error(err);
      const record = {
        full_name: name,
        id_number: citizen.id_number,
        created_at: new Date().toISOString(),
      };
      localSave(name, record);
      showCard(record, true, 'local');
    } finally {
      submitBtn.disabled = false;
      if (step === 'password') submitBtn.textContent = '驗證並顯示身分證';
    }
  });

  btnReset.addEventListener('click', reset);
  setStepName();
})();
