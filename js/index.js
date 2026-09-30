(() => {
  'use strict';
  const memoryStore = {};
  const readStorage = (key, fallback) => {
    try { return localStorage.getItem(key) ?? fallback; }
    catch { return memoryStore[key] ?? fallback; }
  };
  const writeStorage = (key, value) => {
    try { localStorage.setItem(key, value); }
    catch { memoryStore[key] = value; }
  };
  const removeStorage = (key) => {
    try { localStorage.removeItem(key); }
    catch { delete memoryStore[key]; }
  };

  const SCENE_PRESETS = { Home: 72, Away: 65, Evening: 70, Rest: 68 };
  const TASK_FLOW = ['pending', 'in-progress', 'done'];
  const TASK_LABEL = { pending: 'Start', 'in-progress': 'Complete', done: 'Done ✓' };
  const VALET_FLOW = ['Requested', 'Retrieving', 'Parked'];
  const DEFAULT_AI_CARD = {
    type: 'sunset',
    label: 'Aura noticed',
    text: 'Sunset is in 22 minutes. Shall I warm the living room and lower the west shades?',
    actionLabel: 'Do it',
    done: false,
    meta: null
  };

  const ROLES = ['owner', 'manager', 'staff'];
  const DEFAULT_PIN = '1234';
  const DEFAULT_UNIT_NAME = 'Unit PH-12';
  const DEFAULT_UNIT_SHORT = 'PH-12';
  const ROLE_LABELS = { owner: 'Owner', manager: 'Manager', staff: 'Staff' };

  const SIGNUP_ROLES = {
    owner: {
      label: 'Unit Number',
      placeholder: 'e.g. PH-12',
      profileKey: 'unitNumber'
    },
    manager: {
      label: 'Admin / Employee Key',
      placeholder: 'e.g. ADM-4821',
      profileKey: 'adminKey'
    },
    staff: {
      label: 'Staff ID / Shift',
      placeholder: 'e.g. S-204 · Morning',
      profileKey: 'staffId'
    }
  };

  const normalizeRole = (r) => (ROLES.includes(r) ? r : 'owner');
  const profileKeyFor = (role) => `aura_user_${role}`;

  function getProfile(role) {
    const raw = readStorage(profileKeyFor(role), null);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveProfile(role, profile) {
    writeStorage(profileKeyFor(role), JSON.stringify(profile));
  }

  function getRolePin(role) {
    const profile = getProfile(normalizeRole(role));
    return profile && /^\d{4}$/.test(String(profile.pin ?? '')) ? String(profile.pin) : DEFAULT_PIN;
  }

  function cleanUnitNumber(raw) {
    return String(raw ?? '').trim().replace(/^unit\s*[:#-]?\s*/i, '');
  }

  function getOwnerUnitShort() {
    const stored = readStorage('aura_unit', '');
    return cleanUnitNumber(getProfile('owner')?.unitNumber || stored) || DEFAULT_UNIT_SHORT;
  }

  function getOwnerUnitName() {
    const number = getOwnerUnitShort();
    return number ? `Unit ${number}` : DEFAULT_UNIT_NAME;
  }

  const state = {
    currentRole: normalizeRole(readStorage('aura_role', 'owner')),
    theme: readStorage('aura_theme', 'dark'),
    isAuthenticated: readStorage('aura_auth', 'false') === 'true',

    unit: { name: getOwnerUnitName(), thermostat: 72, activeScene: 'Home' },

    storageUnit: { temp: 14, humidity: 65 },

    parkingBay: { bay: 'B-12', vehicle: 'Range Rover Autobiography', status: 'Parked' },

    aiCard: { ...DEFAULT_AI_CARD },

    lockers: [
      { id: 'L1', locker: 'C-08', code: '4471', carrier: 'FedEx', claimed: false },
      { id: 'L2', locker: 'C-11', code: '9930', carrier: 'Amazon', claimed: false }
    ],

    bills: [
      { id: 'electricity', label: 'Electricity & Smart Climate (HVAC)', amount: 84.20, dueDate: 'Oct 5', status: 'due' },
      { id: 'water', label: 'Water & Building Chiller', amount: 34.50, dueDate: 'Oct 5', status: 'due' },
      { id: 'hoa', label: 'HOA Maintenance Dues', amount: 240.00, dueDate: 'Oct 1', status: 'due' }
    ],

    guestPass: { code: '8892' },

    governance: {
      reserveFundPct: 72,
      vote: { id: 'roof-2026', choice: null }
    },

    managerFeed: {
      permits: [
        { id: 'P1', title: 'Balcony glazing permit', detail: 'Unit 14B · Merrow & Co.', status: 'pending' },
        { id: 'P2', title: 'Freight elevator booking', detail: 'Unit 6A · Moving crew', status: 'pending' }
      ],
      tickets: [
        { id: 'T1', title: 'HVAC noise complaint', detail: 'Unit 09C · Filed 8:14 AM', assignee: null, status: 'open' },
        { id: 'T2', title: 'Lobby light flickering', detail: 'Common area · Filed 7:02 AM', assignee: null, status: 'open' }
      ],
      metrics: { occupancy: 94, hoaCollected: 88.2, openTickets: 2, staffOnShift: 6 }
    },

    staffTasks: [
      { id: 'S1', label: 'Restock lobby amenities', due: '11:00 AM', status: 'pending' },
      { id: 'S2', label: 'Inspect pool deck furniture', due: '1:30 PM', status: 'pending' }
    ],

    valetQueue: [
      { id: 'V1', unit: getOwnerUnitShort(), car: 'Range Rover', status: 'Retrieving' },
      { id: 'V2', unit: '09C', car: 'Tesla Model S', status: 'Parked' }
    ]
  };

  const ASSIGNEES = ['Marcus (Facilities)', 'Priya (Facilities)', 'Denny (HVAC contractor)'];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const escapeHtml = (str) => String(str).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  function syncOwnerUnit() {
    state.unit.name = getOwnerUnitName();
    const ownerValet = state.valetQueue.find(v => v.id === 'V1');
    if (ownerValet) ownerValet.unit = getOwnerUnitShort();
  }

  function hideModal(selector) {
    const el = $(selector);
    if (!el || !window.bootstrap?.Modal) return;
    const instance = window.bootstrap.Modal.getInstance(el) || new window.bootstrap.Modal(el);
    instance?.hide();
  }

  function showToast(message, glyph = '🏘️') {
    const host = $('#toast-host');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'aura-toast';
    el.innerHTML = `<span class="toast-glyph">${glyph}</span><span>${escapeHtml(message)}</span>`;
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-out');
      setTimeout(() => el.remove(), 250);
    }, 3200);
  }

  function renderAiCard() {
    const card = $('#aura-ai-card');
    const label = $('#aura-label');
    const text = $('#aura-dynamic-text');
    const btn = $('#aura-action-btn');
    if (!card || !text || !btn) return;

    label.textContent = state.aiCard.label;
    text.textContent = state.aiCard.text;
    btn.textContent = state.aiCard.done ? 'Done ✓' : state.aiCard.actionLabel;
    btn.disabled = state.aiCard.done;
    card.classList.toggle('aura-card-alert', !state.aiCard.done && state.aiCard.type !== 'sunset');
  }

  function pushAlert({ type, text, actionLabel, meta = null, toast = null, toastGlyph = '🏘️' }) {
    state.aiCard = { type, label: 'Aura noticed', text, actionLabel, done: false, meta };
    renderAiCard();
    if (toast) showToast(toast, toastGlyph);
  }

  function resolveAiCard() {
    const { type, meta } = state.aiCard;
    if (type === 'sunset') {
      state.aiCard.text = 'Living room warmed and west shades lowered.';
      state.aiCard.done = true;
    } else if (type === 'broadcast') {
      state.aiCard.text = 'Broadcast acknowledged. Aura is watching for anything new.';
      state.aiCard.done = true;
    } else if (type === 'parcel') {
      state.aiCard.text = `Locker ${meta?.locker ?? ''} opened for pickup.`;
      state.aiCard.done = true;
      if (meta?.lockerId) {
        const l = state.lockers.find(x => x.id === meta.lockerId);
        if (l) l.claimed = true;
      }
      const lifestyleNav = $('.nav-item[data-tab="lifestyle-tab"]');
      lifestyleNav?.click();
      renderOwner();
    }
    renderAiCard();
  }

  function applyTheme(t) {
    state.theme = t;
    document.documentElement.setAttribute('data-theme', t);
    writeStorage('aura_theme', t);
  }
  function initTheme() {
    applyTheme(state.theme);
    $('#theme-toggle-btn')?.addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });
  }

  let pinBuffer = '';
  let selectedRole = state.currentRole;

  function updateLoginDots() {
    ['#lpd0', '#lpd1', '#lpd2', '#lpd3'].forEach((id, i) => {
      $(id)?.classList.toggle('filled', i < pinBuffer.length);
    });
  }

  function updateLoginFormFields(role) {
    const unitField = $('#unit-group');
    const staffField = $('#staff-group');
    const managerField = $('#manager-group');

    unitField?.classList.add('d-none');
    staffField?.classList.add('d-none');
    managerField?.classList.add('d-none');

    if (role === 'owner') unitField?.classList.remove('d-none');
    if (role === 'staff') staffField?.classList.remove('d-none');
    if (role === 'manager') managerField?.classList.remove('d-none');
  }

  function highlightLoginRole(r) {
    selectedRole = normalizeRole(r);
    $$('.login-role-card').forEach(c => c.classList.toggle('active', c.dataset.role === selectedRole));
  }

  function ensureLoginGreeting() {
    let el = $('#login-welcome');
    if (el) return el;
    const host = $('#login-view');
    if (!host) return null;
    el = document.createElement('p');
    el.id = 'login-welcome';
    el.className = 'card-label text-center mb-3 d-none';
    el.setAttribute('role', 'status');
    const anchor = $('#login-role-cards');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(el, anchor);
    else host.prepend(el);
    return el;
  }

  function setLoginGreeting(message) {
    const el = ensureLoginGreeting();
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('d-none', !message);
  }

  function renderLoginGreeting(role) {
    const profile = getProfile(role);
    if (profile?.name) {
      setLoginGreeting(`Welcome back, ${profile.name}. Enter your PIN to sign in as ${ROLE_LABELS[role]}.`);
    } else {
      setLoginGreeting('');
    }
  }

  function maskKey(value) {
    const v = String(value ?? '');
    if (v.length <= 2) return '••';
    return `••••${v.slice(-2)}`;
  }

  function timeGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function firstName(name) {
    return String(name ?? '').trim().split(/\s+/)[0] || '';
  }

  function renderIdentity() {
    const role = normalizeRole(state.currentRole);
    const profile = getProfile(role);
    const view = document.getElementById(`${role}-view`);

    if (view && role === 'owner') {
      const unitEyebrow = view.querySelector('.aura-header .eyebrow');
      if (unitEyebrow) unitEyebrow.textContent = state.unit.name || DEFAULT_UNIT_NAME;
    }

    if (view && profile?.name) {
      const eyebrow = view.querySelector('.aura-header .eyebrow');
      const heading = view.querySelector('.aura-header h1');

      if (heading) heading.textContent = `${timeGreeting()}, ${firstName(profile.name)}`;

      if (eyebrow) {
        if (role === 'owner') {
          eyebrow.textContent = state.unit.name || DEFAULT_UNIT_NAME;
        } else if (role === 'manager') {
          eyebrow.textContent = profile.adminKey
            ? `Building Management · Key ${maskKey(profile.adminKey)}`
            : 'Building Management';
        } else if (role === 'staff') {
          eyebrow.textContent = profile.staffId
            ? `Front Desk · ${profile.staffId}`
            : 'Front Desk';
        }
      }
    }

    const displayName = profile?.name || '';
    $$('#user-name, [data-user-name]').forEach(el => { el.textContent = displayName; });
    $$('#user-role, [data-user-role]').forEach(el => { el.textContent = ROLE_LABELS[role]; });
    $$('#unit-name, [data-unit-name]').forEach(el => { el.textContent = state.unit.name; });
  }

  function switchRole(role) {
    role = normalizeRole(role);
    state.currentRole = role;
    writeStorage('aura_role', role);
    syncOwnerUnit();

    ['owner-view', 'manager-view', 'staff-view'].forEach(id => {
      document.getElementById(id)?.classList.add('d-none');
    });
    document.getElementById(`${role}-view`)?.classList.remove('d-none');

    if (role === 'owner') { renderOwner(); renderAiCard(); }
    if (role === 'manager') renderManager();
    if (role === 'staff') renderStaff();
    renderIdentity();
  }

  function handleLogin() {
    const role = normalizeRole(selectedRole);
    const validPin = getRolePin(role);
    const errorEl = $('#login-error');

    if (pinBuffer === validPin) {
      state.isAuthenticated = true;
      writeStorage('aura_auth', 'true');
      if (errorEl) errorEl.textContent = '\u00A0';
      $('#login-view')?.classList.add('d-none');
      pinBuffer = '';
      updateLoginDots();
      setLoginGreeting('');
      switchRole(role);
    } else {
      if (errorEl) errorEl.textContent = 'Incorrect PIN — try again';
      pinBuffer = '';
      updateLoginDots();
    }
  }

  let signupFieldRole = null;

  function getRoleField() {
    return $('#signup-role-field') || $('#signup-unit');
  }

  function getSignupRole() {
    return normalizeRole(selectedRole);
  }

  function updateSignupFields(role) {
    role = normalizeRole(role);
    const cfg = SIGNUP_ROLES[role];
    const field = getRoleField();

    if (field) {
      if (signupFieldRole !== role) field.value = '';
      field.placeholder = cfg.placeholder;
      field.required = true;
      field.disabled = false;
      field.maxLength = 40;
      field.autocomplete = 'off';
      field.setAttribute('aria-label', cfg.label);
      field.dataset.role = role;

      const label = field.id ? $(`label[for="${field.id}"]`) : null;
      if (label) label.textContent = cfg.label;
    }

    ['#signup-admin-key', '#signup-admin', '#signup-staff-id', '#signup-staff'].forEach(sel => {
      const extra = $(sel);
      if (!extra || extra === field) return;
      extra.required = false;
      extra.disabled = true;
      (extra.closest('.mb-2, .mb-3') || extra).classList.add('d-none');
    });

    const title = $('#signupModal .card-label');
    if (title) title.textContent = `Create ${ROLE_LABELS[role]} Account`;

    const form = $('#signup-form');
    if (form) form.dataset.role = role;

    signupFieldRole = role;
  }

  function showLoginViewFor(role) {
    ['owner-view', 'manager-view', 'staff-view'].forEach(id => {
      document.getElementById(id)?.classList.add('d-none');
    });
    $('#login-view')?.classList.remove('d-none');
    highlightLoginRole(role);
    updateLoginFormFields(role);
    pinBuffer = '';
    updateLoginDots();
    const errorEl = $('#login-error');
    if (errorEl) errorEl.textContent = '\u00A0';
  }

  function initSignupModal() {
    $('#signupModal')?.addEventListener('show.bs.modal', () => {
      signupFieldRole = null;
      updateSignupFields(getSignupRole());
    });

    updateSignupFields(getSignupRole());

    $('#signup-form')?.addEventListener('submit', e => {
      e.preventDefault();

      const role = getSignupRole();
      const cfg = SIGNUP_ROLES[role];
      const name = $('#signup-name')?.value.trim() ?? '';
      const roleValue = getRoleField()?.value.trim() ?? '';
      const pin = $('#signup-pin')?.value.trim() ?? '';

      if (!name) {
        showToast('Please enter your full name', '⚠️');
        return;
      }
      if (!roleValue) {
        showToast(`Please enter your ${cfg.label}`, '⚠️');
        return;
      }
      if (!/^\d{4}$/.test(pin)) {
        showToast('PIN must be exactly 4 digits', '⚠️');
        return;
      }

      saveProfile(role, { role, name, pin, [cfg.profileKey]: roleValue });
      if (role === 'owner') writeStorage('aura_unit', roleValue);
      syncOwnerUnit();

      state.isAuthenticated = false;
      removeStorage('aura_auth');
      state.currentRole = role;
      writeStorage('aura_role', role);

      hideModal('#signupModal');
      e.target.reset();
      signupFieldRole = null;
      updateSignupFields(role);

      showLoginViewFor(role);
      setLoginGreeting(`Welcome, ${name}! Please enter your PIN to sign in as ${ROLE_LABELS[role]}.`);
      showToast(`Account created for ${name}. Sign in to continue.`, '✨');
    });
  }

  function handleLogout() {
    state.isAuthenticated = false;
    removeStorage('aura_auth');
    showLoginViewFor(state.currentRole);
    renderLoginGreeting(normalizeRole(state.currentRole));
  }

  function initAuth() {
    $('#login-role-cards')?.addEventListener('click', e => {
      const card = e.target.closest('.login-role-card');
      if (!card) return;

      const role = normalizeRole(card.dataset.role);
      highlightLoginRole(role);
      updateLoginFormFields(role);
      pinBuffer = '';
      updateLoginDots();
      const errorEl = $('#login-error');
      if (errorEl) errorEl.textContent = '\u00A0';
      renderLoginGreeting(role);
      updateSignupFields(role);
    });

    $('#login-pin-grid')?.addEventListener('click', e => {
      const k = e.target.closest('.pin-key')?.dataset.key;
      if (!k) return;
      if (k === 'clear') pinBuffer = '';
      else if (k === 'back') pinBuffer = pinBuffer.slice(0, -1);
      else if (pinBuffer.length < 4) pinBuffer += k;
      updateLoginDots();
    });

    $('#login-btn')?.addEventListener('click', handleLogin);

    document.addEventListener('click', e => {
      if (e.target.closest('.btn-logout')) handleLogout();
    });

    if (state.isAuthenticated) {
      $('#login-view')?.classList.add('d-none');
      switchRole(state.currentRole);
    } else {
      $('#login-view')?.classList.remove('d-none');
      highlightLoginRole(state.currentRole);
      updateLoginFormFields(state.currentRole);
      renderLoginGreeting(normalizeRole(state.currentRole));
    }
  }

  function initTabs() {
    $('.aura-bottom-nav')?.addEventListener('click', e => {
      const btn = e.target.closest('.nav-item');
      if (!btn) return;
      const tab = btn.dataset.tab;
      $$('.tab-panel').forEach(p => p.classList.add('d-none'));
      document.getElementById(tab)?.classList.remove('d-none');
      $$('.nav-item').forEach(b => b.classList.toggle('active', b === btn));
    });
  }

  function renderOwner() {
    const f = $('#finance-cards-container');
    if (f) {
      f.innerHTML = state.bills.map(b => `
        <div class="glass-card d-flex justify-content-between align-items-center">
          <div><span class="card-label d-block">${b.label}</span><span class="card-value-sm text-muted-aura">${b.dueDate}</span></div>
          <div class="d-flex align-items-center gap-2">
            <span class="card-value">$${b.amount.toFixed(2)}</span>
            <button type="button" class="btn-sm-aura ${b.status === 'paid' ? 'btn-outline-aura' : 'btn-aura'} pay-btn" data-id="${b.id}" ${b.status === 'paid' ? 'disabled' : ''}>${b.status === 'paid' ? 'Paid ✓' : 'Pay'}</button>
          </div>
        </div>
      `).join('');
    }

    const l = $('#lockers-container');
    if (l) {
      l.innerHTML = state.lockers.map(lk => `
        <div class="glass-card d-flex justify-content-between align-items-center">
          <div><span class="card-label">Locker ${lk.locker}</span><p class="card-value-sm mb-0">${lk.carrier} · Code ${lk.code}</p></div>
          <button type="button" class="btn-sm-aura ${lk.claimed ? 'btn-outline-aura' : 'btn-aura'} claim-btn" data-id="${lk.id}" ${lk.claimed ? 'disabled' : ''}>${lk.claimed ? 'Claimed' : 'Claim'}</button>
        </div>
      `).join('');
    }

    const st = $('#storage-temp'), sh = $('#storage-humidity'), sb = $('#storage-humidity-bar');
    if (st) st.textContent = `${state.storageUnit.temp}°F`;
    if (sh) sh.textContent = `${state.storageUnit.humidity}%`;
    if (sb) sb.style.width = `${state.storageUnit.humidity}%`;

    syncOwnerUnit();
    renderIdentity();
    renderQr();
    renderGovernance();
  }

  function renderGovernance() {
    const pctLabel = $('#reserve-fund-pct');
    const bar = $('#reserve-fund-bar');
    if (pctLabel) pctLabel.textContent = `${state.governance.reserveFundPct}% funded`;
    if (bar) bar.style.width = `${state.governance.reserveFundPct}%`;

    const voteBtn = $('#open-vote-btn');
    const voteStatus = $('#vote-status-text');
    const { choice } = state.governance.vote;
    if (voteBtn) {
      if (choice === 'yes') {
        voteBtn.textContent = 'Voted: In Favor ✓';
        voteBtn.disabled = true;
      } else if (choice === 'no') {
        voteBtn.textContent = 'Voted: Opposed ✕';
        voteBtn.disabled = true;
      } else {
        voteBtn.textContent = 'Review & vote';
        voteBtn.disabled = false;
      }
    }
    if (voteStatus) {
      voteStatus.textContent = choice ? 'Vote recorded — thank you' : 'Open for owner vote';
    }
  }

  function setThermostat(value, sceneName) {
    state.unit.thermostat = value;
    state.unit.activeScene = sceneName || null;
    const slider = $('#thermostat-slider');
    const readout = $('#temp-readout');
    if (slider) slider.value = value;
    if (readout) readout.textContent = `${value}°F`;
    $$('.scene-chip').forEach(c => c.classList.toggle('active', c.dataset.scene === sceneName));
  }

  function seededRandom(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) { h = (h * 31 + seed.charCodeAt(i)) >>> 0; }
    return () => {
      h ^= h << 13; h >>>= 0;
      h ^= h >> 17;
      h ^= h << 5; h >>>= 0;
      return (h % 1000) / 1000;
    };
  }

  function buildQrSvg(code) {
    const size = 21;
    const cell = 8;
    const px = size * cell;
    const rand = seededRandom(`AURA-${code}`);
    const finder = (x, y) => `
      <rect x="${x}" y="${y}" width="${cell * 7}" height="${cell * 7}" fill="#0A0C10"/>
      <rect x="${x + cell}" y="${y + cell}" width="${cell * 5}" height="${cell * 5}" fill="#FFFFFF"/>
      <rect x="${x + cell * 2}" y="${y + cell * 2}" width="${cell * 3}" height="${cell * 3}" fill="#0A0C10"/>
    `;
    let modules = '';
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const inFinder =
          (row < 7 && col < 7) ||
          (row < 7 && col >= size - 7) ||
          (row >= size - 7 && col < 7);
        if (inFinder) continue;
        if (rand() > 0.56) {
          modules += `<rect x="${col * cell}" y="${row * cell}" width="${cell}" height="${cell}" fill="#0A0C10"/>`;
        }
      }
    }
    return `
      <svg viewBox="0 0 ${px} ${px}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Guest pass QR code">
        <rect width="${px}" height="${px}" fill="#FFFFFF"/>
        ${modules}
        ${finder(0, 0)}
        ${finder(px - cell * 7, 0)}
        ${finder(0, px - cell * 7)}
      </svg>
    `;
  }

  function renderQr() {
    const wrap = $('#qr-wrap');
    const codeText = $('#qr-code-text');
    if (wrap) wrap.innerHTML = buildQrSvg(state.guestPass.code);
    if (codeText) codeText.textContent = `QR-AURA-${state.guestPass.code}`;
  }

  function initOwnerInteractions() {
    $('#scene-row')?.addEventListener('click', e => {
      const chip = e.target.closest('.scene-chip');
      if (!chip) return;
      const scene = chip.dataset.scene;
      const temp = SCENE_PRESETS[scene];
      if (temp === undefined) return;
      setThermostat(temp, scene);
    });

    $('#thermostat-slider')?.addEventListener('input', e => {
      const value = Number(e.target.value);
      state.unit.thermostat = value;
      const readout = $('#temp-readout');
      if (readout) readout.textContent = `${value}°F`;
      if (state.unit.activeScene && SCENE_PRESETS[state.unit.activeScene] !== value) {
        state.unit.activeScene = null;
        $$('.scene-chip').forEach(c => c.classList.remove('active'));
      }
    });

    $('#valet-request-btn')?.addEventListener('click', function () {
      this.textContent = 'Valet Requested ✓';
      this.disabled = true;
      setTimeout(() => { this.textContent = 'Request valet'; this.disabled = false; }, 2000);
    });

    $('#aura-action-btn')?.addEventListener('click', resolveAiCard);

    $('#finance-cards-container')?.addEventListener('click', e => {
      const btn = e.target.closest('.pay-btn');
      if (!btn) return;
      const bill = state.bills.find(b => b.id === btn.dataset.id);
      if (bill && bill.status !== 'paid') {
        bill.status = 'paid';
        state.managerFeed.metrics.hoaCollected = Math.round(
          (state.managerFeed.metrics.hoaCollected + bill.amount / 1000) * 100
        ) / 100;
      }
      renderOwner();
      renderManager();
    });

    $('#lockers-container')?.addEventListener('click', e => {
      const btn = e.target.closest('.claim-btn');
      if (!btn) return;
      const locker = state.lockers.find(l => l.id === btn.dataset.id);
      if (locker) locker.claimed = true;
      renderOwner();
    });

    $('#qr-generate-btn')?.addEventListener('click', () => {
      state.guestPass.code = String(Math.floor(1000 + Math.random() * 9000));
      renderQr();
    });

    let sosArmed = false;
    let sosTimer = null;
    $('#sos-btn')?.addEventListener('click', function () {
      const label = $('#sos-label');
      const confirm = $('#sos-confirm');
      if (!sosArmed) {
        sosArmed = true;
        this.classList.add('armed');
        if (label) label.textContent = 'Press again to confirm';
        if (confirm) confirm.textContent = 'Tap once more within 4 seconds to alert the front desk.';
        sosTimer = setTimeout(() => {
          sosArmed = false;
          this.classList.remove('armed');
          if (label) label.textContent = 'Emergency SOS';
          if (confirm) confirm.textContent = '\u00A0';
        }, 4000);
      } else {
        clearTimeout(sosTimer);
        sosArmed = false;
        this.classList.remove('armed');
        const label2 = $('#sos-label');
        if (label2) label2.textContent = 'Alert sent ✓';
        if (confirm) confirm.textContent = 'Front desk notified — help is on the way.';
        setTimeout(() => { if (label2) label2.textContent = 'Emergency SOS'; }, 4000);
      }
    });

    document.addEventListener('click', e => {
      const trigger = e.target.closest('[data-bs-target="#bookingModal"]');
      if (!trigger) return;
      const service = trigger.dataset.service || 'a service';
      const nameEl = $('#booking-service-name');
      if (nameEl) nameEl.textContent = service;
    });

    $('#booking-confirm-btn')?.addEventListener('click', function () {
      const service = $('#booking-service-name')?.textContent || 'your service';
      const time = $('#booking-time')?.value || '';
      this.dataset.lastBooking = `${service} at ${time}`;
    });

    function castVote(choice) {
      state.governance.vote.choice = choice;
      renderGovernance();
      hideModal('#voteModal');
      showToast(choice === 'yes' ? 'Vote recorded: In Favor ✓' : 'Vote recorded: Opposed ✕', '🗳');
    }
    $('#vote-yes-btn')?.addEventListener('click', () => castVote('yes'));
    $('#vote-no-btn')?.addEventListener('click', () => castVote('no'));

    $('#policies-btn')?.addEventListener('click', () => {
      showToast('Building policies document opened', '📄');
    });
  }

  function initSmartLockModal() {
    let buffer = '';
    const dotsIds = ['#pd0', '#pd1', '#pd2', '#pd3'];

    function updateDots() {
      dotsIds.forEach((id, i) => $(id)?.classList.toggle('filled', i < buffer.length));
    }
    function setStatus(text, cls) {
      const el = $('#pin-status');
      if (!el) return;
      el.textContent = text;
      el.classList.remove('status-success', 'status-error');
      if (cls) el.classList.add(cls);
    }
    function resetPad() {
      buffer = '';
      updateDots();
      setStatus('\u00A0', null);
      $('#pin-modal-content')?.classList.remove('shake-error');
    }

    $('#pin-grid')?.addEventListener('click', e => {
      const k = e.target.closest('.pin-key')?.dataset.key;
      if (!k) return;
      if (k === 'clear') { buffer = ''; updateDots(); setStatus('\u00A0', null); return; }
      if (k === 'back') { buffer = buffer.slice(0, -1); updateDots(); setStatus('\u00A0', null); return; }
      if (buffer.length >= 4) return;
      buffer += k;
      updateDots();

      if (buffer.length === 4) {
        if (buffer === getRolePin('owner')) {
          setStatus('Unlocking…', 'status-success');
          if (navigator.vibrate) navigator.vibrate(120);
          setTimeout(() => {
            setStatus('Unlocked ✓', 'status-success');
            setTimeout(() => hideModal('#pinModal'), 800);
          }, 300);
        } else {
          setStatus('Incorrect PIN — try again', 'status-error');
          $('#pin-modal-content')?.classList.add('shake-error');
          if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
          setTimeout(() => {
            buffer = '';
            updateDots();
            $('#pin-modal-content')?.classList.remove('shake-error');
          }, 500);
        }
      }
    });

    $('#pinModal')?.addEventListener('hidden.bs.modal', resetPad);
  }

  function initIntercomModal() {
    $('#audio-toggle')?.addEventListener('click', function () {
      const muted = this.dataset.muted === 'true';
      this.dataset.muted = String(!muted);
      this.textContent = muted ? 'Mute audio' : 'Unmute audio';
    });

    $('#open-door-btn')?.addEventListener('click', function () {
      const status = $('#door-status');
      this.disabled = true;
      if (status) { status.textContent = 'Opening…'; status.classList.remove('status-error'); status.classList.add('status-success'); }
      setTimeout(() => {
        if (status) status.textContent = 'Door opened ✓';
        setTimeout(() => {
          if (status) status.textContent = 'Door locked automatically';
          this.disabled = false;
        }, 3000);
      }, 500);
    });

    $('#intercomModal')?.addEventListener('hidden.bs.modal', () => {
      const status = $('#door-status');
      if (status) { status.textContent = '\u00A0'; status.classList.remove('status-success', 'status-error'); }
      const audioBtn = $('#audio-toggle');
      if (audioBtn) { audioBtn.dataset.muted = 'false'; audioBtn.textContent = 'Mute audio'; }
    });
  }

  function renderManager() {
    const m = $('#manager-metrics');
    if (m) {
      const { occupancy, hoaCollected, openTickets, staffOnShift } = state.managerFeed.metrics;
      m.innerHTML = `
        <div class="col-6 col-lg-3"><div class="glass-card text-center"><p class="card-value">${occupancy}%</p><span class="card-label">Occupancy</span></div></div>
        <div class="col-6 col-lg-3"><div class="glass-card text-center"><p class="card-value">$${hoaCollected.toFixed(1)}k</p><span class="card-label">HOA Dues</span></div></div>
        <div class="col-6 col-lg-3"><div class="glass-card text-center"><p class="card-value">${openTickets}</p><span class="card-label">Open Tickets</span></div></div>
        <div class="col-6 col-lg-3"><div class="glass-card text-center"><p class="card-value">${staffOnShift}</p><span class="card-label">Staff On Shift</span></div></div>
      `;
    }

    const p = $('#manager-permits-container');
    if (p) {
      p.innerHTML = state.managerFeed.permits.map(pm => `
        <div class="glass-card">
          <p class="card-label mb-1">${pm.title}</p>
          <p class="card-value-sm text-muted-aura mb-2">${pm.detail}</p>
          ${pm.status === 'pending' ? `
            <div class="d-flex gap-2">
              <button type="button" class="btn-sm-aura btn-aura flex-fill approve-btn" data-id="${pm.id}">Approve</button>
              <button type="button" class="btn-sm-aura btn-outline-aura flex-fill reject-btn" data-id="${pm.id}">Reject</button>
            </div>` : `<p class="card-value-sm mb-0" style="color:var(--${pm.status === 'approved' ? 'green' : 'red'})">${pm.status === 'approved' ? 'Approved ✓' : 'Rejected ✕'}</p>`}
        </div>
      `).join('');
    }

    const t = $('#manager-tickets-container');
    if (t) {
      t.innerHTML = state.managerFeed.tickets.map(tk => `
        <div class="glass-card">
          <p class="card-label mb-1">${tk.title}</p>
          <p class="card-value-sm text-muted-aura mb-2">${tk.detail}</p>
          ${tk.assignee
            ? `<p class="card-value-sm mb-0" style="color:var(--green)">Assigned to ${tk.assignee}</p>`
            : `<select class="aura-input assign-select" data-id="${tk.id}">
                 <option value="">Assign to…</option>
                 ${ASSIGNEES.map(a => `<option value="${a}">${a}</option>`).join('')}
               </select>`}
        </div>
      `).join('');
    }
  }

  function initManagerInteractions() {
    $('#manager-permits-container')?.addEventListener('click', e => {
      const approveBtn = e.target.closest('.approve-btn');
      const rejectBtn = e.target.closest('.reject-btn');
      const id = (approveBtn || rejectBtn)?.dataset.id;
      if (!id) return;
      const permit = state.managerFeed.permits.find(p => p.id === id);
      if (permit) permit.status = approveBtn ? 'approved' : 'rejected';
      renderManager();
    });

    $('#manager-tickets-container')?.addEventListener('change', e => {
      const select = e.target.closest('.assign-select');
      if (!select) return;
      const value = select.value;
      if (!value) return;
      const ticket = state.managerFeed.tickets.find(t => t.id === select.dataset.id);
      if (ticket) {
        ticket.assignee = value;
        state.staffTasks.push({ id: `S-${ticket.id}`, label: ticket.title, due: 'ASAP', status: 'pending' });
        state.managerFeed.metrics.openTickets = Math.max(0, state.managerFeed.metrics.openTickets - 1);
      }
      renderManager();
      renderStaff();
      showToast(`${ticket ? ticket.title : 'Ticket'} assigned to ${value}`, '🛠');
    });

    $('#broadcast-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const msg = $('#broadcast-message')?.value.trim();
      const audience = $('#broadcast-audience')?.value;
      const confirm = $('#broadcast-confirm');
      if (!msg) return;

      pushAlert({
        type: 'broadcast',
        text: `Building alert: "${msg}"`,
        actionLabel: 'Acknowledge',
        toast: 'Broadcast sent — Owner dashboard updated',
        toastGlyph: '⚑'
      });

      const audienceLabel = audience === 'all' ? 'all residents' : audience === 'owners' ? 'owners only' : 'the selected floor';
      if (confirm) confirm.textContent = `Sent to ${audienceLabel} ✓`;
      e.target.reset();
      setTimeout(() => { if (confirm) confirm.textContent = '\u00A0'; }, 3000);
    });
  }

  function renderStaff() {
    const t = $('#staff-tasks-container');
    if (t) {
      t.innerHTML = state.staffTasks.map(tk => `
        <div class="glass-card d-flex justify-content-between align-items-center">
          <div><p class="card-label mb-0">${tk.label}</p><span class="card-value-sm text-muted-aura">Due ${tk.due}</span></div>
          <button type="button" class="btn-sm-aura ${tk.status === 'done' ? 'btn-outline-aura' : 'btn-aura'} task-btn" data-id="${tk.id}" ${tk.status === 'done' ? 'disabled' : ''}>${TASK_LABEL[tk.status]}</button>
        </div>
      `).join('');
    }

    const v = $('#staff-valet-container');
    if (v) {
      v.innerHTML = state.valetQueue.map(vq => `
        <div class="d-flex justify-content-between align-items-center mb-2 valet-row">
          <span class="card-value-sm">${vq.unit} · ${vq.car}</span>
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-warning text-dark">${vq.status}</span>
            ${vq.status !== 'Parked' ? `<button type="button" class="btn-sm-aura btn-outline-aura advance-valet-btn" data-id="${vq.id}">Advance</button>` : ''}
          </div>
        </div>
      `).join('');
    }
  }

  function initStaffInteractions() {
    $('#gate-scan-btn')?.addEventListener('click', function () {
      const result = $('#scan-result');
      const line = $('#scanner-line');
      this.disabled = true;
      this.textContent = 'Scanning…';
      line?.classList.add('paused');
      setTimeout(() => {
        const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (result) result.textContent = `Pass QR-AURA-${state.guestPass.code} verified — Guest of ${getOwnerUnitShort()} · ${ts}`;
        this.textContent = 'Scan QR pass';
        this.disabled = false;
        setTimeout(() => line?.classList.remove('paused'), 600);
      }, 900);
    });

    $('#parcel-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const unit = $('#parcel-unit')?.value.trim();
      const locker = $('#parcel-locker')?.value.trim();
      const carrier = $('#parcel-carrier')?.value.trim();
      const confirm = $('#parcel-confirm');
      if (!unit || !locker || !carrier) return;

      const code = String(Math.floor(1000 + Math.random() * 9000));
      const newLocker = { id: `L${state.lockers.length + 1}`, locker, carrier, code, claimed: false };
      state.lockers.push(newLocker);

      pushAlert({
        type: 'parcel',
        text: `Aura noticed: Parcel arrived for Unit ${unit} in Locker ${locker} (Code: ${code})`,
        actionLabel: 'View locker',
        meta: { lockerId: newLocker.id, locker, unit },
        toast: `Owner of Unit ${unit} notified of parcel in Locker ${locker}`,
        toastGlyph: '📦'
      });

      if (confirm) confirm.textContent = `Logged parcel for Unit ${unit}, locker ${locker} ✓`;
      e.target.reset();
      setTimeout(() => { if (confirm) confirm.textContent = '\u00A0'; }, 3000);
    });

    $('#incident-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const type = $('#incident-type')?.value || 'Other';
      const confirm = $('#incident-confirm');
      if (confirm) confirm.textContent = `Incident report filed (${type}) ✓`;
      e.target.reset();
      setTimeout(() => { if (confirm) confirm.textContent = '\u00A0'; }, 3000);
    });

    $('#staff-tasks-container')?.addEventListener('click', e => {
      const btn = e.target.closest('.task-btn');
      if (!btn) return;
      const task = state.staffTasks.find(t => t.id === btn.dataset.id);
      if (task) {
        const idx = TASK_FLOW.indexOf(task.status);
        task.status = TASK_FLOW[Math.min(idx + 1, TASK_FLOW.length - 1)];
      }
      renderStaff();
    });

    $('#staff-valet-container')?.addEventListener('click', e => {
      const btn = e.target.closest('.advance-valet-btn');
      if (!btn) return;
      const car = state.valetQueue.find(v => v.id === btn.dataset.id);
      if (car) {
        const idx = VALET_FLOW.indexOf(car.status);
        car.status = VALET_FLOW[Math.min(idx + 1, VALET_FLOW.length - 1)];
      }
      renderStaff();
    });
  }

  function initAll() {
    syncOwnerUnit();

    initTheme();
    initSignupModal();
    initAuth();
    initTabs();
    initOwnerInteractions();
    initSmartLockModal();
    initIntercomModal();
    initManagerInteractions();
    initStaffInteractions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();