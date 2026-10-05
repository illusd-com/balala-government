/**
 * 巴拉國國民身分證 — 查詢／核發（需密碼）
 * - 名冊與固定字號見 id-registry.js（重製版）
 * - 輸入姓名 → 輸入密碼 → 顯示完整身分證
 * - 寫入 Supabase / localStorage
 */

(() => {
  const REG = window.BalalaIdRegistry;
  const LOCAL_KEY = 'balala_id_cards_v2';

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

  async function dbUpsert(name, idNumber) {
    const record = {
      full_name: name,
      id_number: idNumber,
      created_at: new Date().toISOString(),
    };

    const client = getSupabase();
    if (!client) {
      localSave(name, record);
      return { record, isNew: true };
    }

    const existing = await dbGet(name);
    if (existing) {
      const { data, error } = await client
        .from('id_cards')
        .update({ id_number: idNumber })
        .eq('full_name', name)
        .select('full_name, id_number, created_at')
        .single();

      if (error) {
        console.warn('[id] supabase update', error.message);
        localSave(name, record);
        return { record, isNew: false };
      }
      const saved = {
        full_name: data.full_name,
        id_number: data.id_number,
        created_at: data.created_at,
      };
      localSave(name, saved);
      return { record: saved, isNew: false };
    }

    const { data, error } = await client
      .from('id_cards')
      .insert({ full_name: name, id_number: idNumber })
      .select('full_name, id_number, created_at')
      .single();

    if (error) {
      if (error.code === '23505' || /duplicate|unique/i.test(error.message || '')) {
        const { data: d2, error: e2 } = await client
          .from('id_cards')
          .update({ id_number: idNumber })
          .eq('full_name', name)
          .select('full_name, id_number, created_at')
          .maybeSingle();
        if (!e2 && d2) {
          const saved = {
            full_name: d2.full_name,
            id_number: d2.id_number,
            created_at: d2.created_at,
          };
          localSave(name, saved);
          return { record: saved, isNew: false };
        }
      }
      console.warn('[id] supabase insert', error.message);
      localSave(name, record);
      return { record, isNew: true };
    }

    const saved = {
      full_name: data.full_name,
      id_number: data.id_number,
      created_at: data.created_at,
    };
    localSave(name, saved);
    return { record: saved, isNew: true };
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
      : '身分驗證成功，以下為您的身分證資料。';
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
      const idNumber = citizen.id_number;
      const existing = await dbGet(name);
      const isNew = !existing || existing.id_number !== idNumber;
      const { record } = await dbUpsert(name, idNumber);
      showCard(record, isNew);
    } catch (err) {
      console.error(err);
      showError('系統暫時無法處理，請稍後再試。');
    } finally {
      submitBtn.disabled = false;
      if (step === 'password') submitBtn.textContent = '驗證並顯示身分證';
    }
  });

  btnReset.addEventListener('click', reset);
  setStepName();
})();
