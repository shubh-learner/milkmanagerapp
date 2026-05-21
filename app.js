// app.js — main application logic (Firebase version)

const App = (() => {

  let _summaryRange = 'month';
  let _logFilter    = '';
  let _emailFilter  = '';

  // ── Boot ───────────────────────────────────────────
  async function start() {
    initDateDefaults();
    bindEvents();
    await loadPrices();
    await render();
  }

  // ── Defaults ───────────────────────────────────────
  function initDateDefaults() {
    document.getElementById('entry-date').value = todayStr();
    const ym = todayStr().slice(0, 7);
    document.getElementById('log-month-filter').value = ym;
    document.getElementById('email-month-filter').value = ym;
    _logFilter = ym;
    _emailFilter = ym;
  }

  function todayStr() {
    const d    = new Date();
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // ── Nav Tab Switching ──────────────────────────────
  function switchPage(page) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.nav-tab[data-page="${page}"]`).classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${page}`).classList.remove('hidden');
    if (page === 'log') renderLog();
    if (page === 'email') renderEmail();
  }

  // ── Prices ─────────────────────────────────────────
  async function loadPrices() {
    const p = await Storage.getPrices();
    document.getElementById('price-cow').value = p.cow;
    document.getElementById('price-buf').value = p.buffalo;
  }

  async function savePrices() {
    const btn     = document.getElementById('save-prices-btn');
    btn.disabled  = true;
    btn.textContent = 'Saving…';
    const cow     = parseFloat(document.getElementById('price-cow').value) || 0;
    const buffalo = parseFloat(document.getElementById('price-buf').value) || 0;
    await Storage.savePrices({ cow, buffalo });
    btn.disabled    = false;
    btn.textContent = 'Save Prices';
    const msg = document.getElementById('price-saved-msg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2000);
    await renderSummary();
  }

  // ── Add Entry ──────────────────────────────────────
  async function addEntry() {
    const errEl = document.getElementById('entry-error');
    errEl.classList.add('hidden');

    const date   = document.getElementById('entry-date').value;
    const cowQty = parseFloat(document.getElementById('entry-cow-qty').value) || 0;
    const bufQty = parseFloat(document.getElementById('entry-buf-qty').value) || 0;

    if (!date)                      { showEntryError('Please select a date.'); return; }
    if (cowQty <= 0 && bufQty <= 0) { showEntryError('Enter quantity for at least one milk type.'); return; }

    const btn       = document.getElementById('add-entry-btn');
    btn.disabled    = true;
    btn.textContent = 'Saving…';

    const prices = await Storage.getPrices();

    if (cowQty > 0) {
      const cost = +(cowQty * prices.cow).toFixed(2);
      await Storage.addEntry({ date, type: 'cow', qty: cowQty, cost });
    }
    if (bufQty > 0) {
      const cost = +(bufQty * prices.buffalo).toFixed(2);
      await Storage.addEntry({ date, type: 'buffalo', qty: bufQty, cost });
    }

    btn.disabled    = false;
    btn.textContent = 'Add Entry';
    document.getElementById('entry-cow-qty').value = '';
    document.getElementById('entry-buf-qty').value = '';
    await render();
  }

  function showEntryError(msg) {
    const el = document.getElementById('entry-error');
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  // ── Delete Entry ───────────────────────────────────
  async function deleteEntry(id) {
    await Storage.deleteEntry(id);
    await render();
    if (!document.getElementById('page-log').classList.contains('hidden')) renderLog();
  }

  // ── Render ─────────────────────────────────────────
  async function render() {
    await renderSummary();
    if (!document.getElementById('page-log').classList.contains('hidden')) await renderLog();
    if (!document.getElementById('page-email').classList.contains('hidden')) await renderEmail();
    }

  // ── Render Entries Log ─────────────────────────────────────────
  async function renderLog() {
    const entries  = await Storage.getEntries();
    const tbody    = document.getElementById('entries-body');
    const noMsg    = document.getElementById('no-entries-msg');

    const filtered = _logFilter
      ? entries.filter(e => e.date.startsWith(_logFilter))
      : entries;

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      noMsg.classList.remove('hidden');
      return;
    }
    noMsg.classList.add('hidden');

    tbody.innerHTML = filtered.map(e => `
      <tr class="${e.type === 'buffalo' ? 'buffalo-row' : ''}">
        <td>${formatDate(e.date)}</td>
        <td><span class="type-badge ${e.type}">${e.type === 'cow' ? '🐄 Cow' : '🐃 Buffalo'}</span></td>
        <td>${e.qty.toFixed(1)}</td>
        <td>₹${e.cost.toFixed(2)}</td>
        <td><button class="btn-delete" onclick="App.deleteEntry('${e.id}')" title="Delete">✕</button></td>
      </tr>
    `).join('');
  }

  // ── Render Email Preview ─────────────────────────────────────────

  async function renderEmail() {
    const noMsg    = document.getElementById('email-no-entries-msg');
    const emaildata    = document.getElementById('email-preview-rows');
    const emailFinal    = document.getElementById('email-preview-foot');

    const entries = await Storage.getEntries();
    const currentuser = await Storage.getUser();
    const btn = document.getElementById('email-send-btn');
    
    const filtered = _emailFilter
      ? entries.filter(e => e.date.startsWith(_emailFilter))
      : entries;

    const formattedMonth = formatmonth(_emailFilter);
    const monthlabel     = document.getElementById('email-month-label');
    const subjmonth      = document.getElementById('subject-month');
    monthlabel.textContent = `${formattedMonth}`;
    subjmonth.textContent = `${formattedMonth}`;

    document.getElementById('email-to-display').textContent = currentuser ? currentuser.email : "Add an Email";

    if (filtered.length === 0) {
      emaildata.innerHTML = '';
      emailFinal.innerHTML = '';
      noMsg.classList.remove('hidden');
      btn.disabled = true;
      btn.classList.add('disabled');
      return;
    }
    noMsg.classList.add('hidden');
    btn.disabled = false;
    btn.classList.remove('disabled');

    const cowE = filtered.filter(e => e.type === 'cow');
    const bufE = filtered.filter(e => e.type === 'buffalo');

    const cowL    = cowE.reduce((s, e) => s + e.qty,  0);
    const bufL    = bufE.reduce((s, e) => s + e.qty,  0);
    const cowCost = cowE.reduce((s, e) => s + e.cost, 0);
    const bufCost = bufE.reduce((s, e) => s + e.cost, 0);
   
    //
    const emailrows       = document.getElementById('email-preview-rows');
    emailrows.innerHTML   = `<tr>
                                <td>🐄 Cow Milk</td>
                                <td>${cowL.toFixed(1)} L</td>
                                <td>${cowCost}</td>
                             </tr>
                             <tr>
                                <td>🐃 Buffalo Milk</td>
                                <td>${bufL.toFixed(1)} L</td>
                                <td>${bufCost}</td>
                             </tr>` ;
    const emailrowstotal       = document.getElementById('email-preview-foot');
    emailrowstotal.innerHTML   = `<tr>
                                    <td>Total</td>
                                    <td>${(cowL + bufL).toFixed(1)} L</td>
                                    <td>₹ ${(cowCost + bufCost)}</td>
                                 </tr>`;
    
  }

  //Send Email  ─────────────────────────────────────────

  async function sendEmail() {
    const entries  = await Storage.getEntries();
    const filtered = _emailFilter
      ? entries.filter(e => e.date.startsWith(_emailFilter))
      : entries;

    const btn = document.getElementById('email-send-btn');
    btn.disabled = true;
    btn.textContent = 'Sending…';

    const formattedMonth = formatmonth(_emailFilter);
    const currentuser = await Storage.getUser();
    const currentuseremail = currentuser.email; 

    const cowE = filtered.filter(e => e.type === 'cow');
    const bufE = filtered.filter(e => e.type === 'buffalo');

    const cowL    = cowE.reduce((s, e) => s + e.qty,  0);
    const bufL    = bufE.reduce((s, e) => s + e.qty,  0);
    const cowCost = cowE.reduce((s, e) => s + e.cost, 0);
    const bufCost = bufE.reduce((s, e) => s + e.cost, 0);

    const templateParams = {
    to_email:     currentuseremail, 
    month:        formattedMonth,
    cow_qty:      cowL.toFixed(1),
    cow_cost:     cowCost.toFixed(2),
    buffalo_qty:  bufL.toFixed(1),
    buffalo_cost: bufCost.toFixed(2),
    total_qty:    (cowL + bufL).toFixed(1),
    total_cost:   (cowCost + bufCost).toFixed(2)
    };

    try {
    await emailjs.send('service_sd0qc8b', 'template_ru4b3c6', templateParams); 
    btn.textContent = '✓ Sent!';
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Send via Email';
      }, 3000);
    } catch (err) {
    console.error('EmailJS error:', err);
    btn.disabled = false;
    btn.textContent = 'Failed — Retry';
    }
  }

  // Summary on Dashboard ─────────────────────────────────────────
  async function renderSummary() {
    const entries = await Storage.getEntries();
    let filtered  = entries;

    if (_summaryRange === 'month') {
      const ym = todayStr().slice(0, 7);
      filtered = entries.filter(e => e.date.startsWith(ym));
    }

    const cowE = filtered.filter(e => e.type === 'cow');
    const bufE = filtered.filter(e => e.type === 'buffalo');

    const cowL    = cowE.reduce((s, e) => s + e.qty,  0);
    const bufL    = bufE.reduce((s, e) => s + e.qty,  0);
    const cowCost = cowE.reduce((s, e) => s + e.cost, 0);
    const bufCost = bufE.reduce((s, e) => s + e.cost, 0);

    document.getElementById('sum-cow-liters').textContent   = cowL.toFixed(1) + ' L';
    document.getElementById('sum-cow-cost').textContent     = '₹' + cowCost.toFixed(2);
    document.getElementById('sum-buf-liters').textContent   = bufL.toFixed(1) + ' L';
    document.getElementById('sum-buf-cost').textContent     = '₹' + bufCost.toFixed(2);
    document.getElementById('sum-total-liters').textContent = (cowL + bufL).toFixed(1) + ' L';
    document.getElementById('sum-total-cost').textContent   = '₹' + (cowCost + bufCost).toFixed(2);
  }

  // ── Event Bindings ─────────────────────────────────
  function bindEvents() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => switchPage(tab.dataset.page));
    });

    document.getElementById('save-prices-btn').addEventListener('click', savePrices);
    document.getElementById('add-entry-btn').addEventListener('click', addEntry);

    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _summaryRange = btn.dataset.range;
        renderSummary();
      });
    });

    document.getElementById('log-month-filter').addEventListener('change', e => {
      _logFilter = e.target.value;
      renderLog();
    });

    document.getElementById('clear-filter-btn').addEventListener('click', () => {
      _logFilter = '';
      document.getElementById('log-month-filter').value = '';
      renderLog();
    });

    document.getElementById('email-month-filter').addEventListener('change', e => {
      _emailFilter = e.target.value;
       renderEmail();
    });

    document.getElementById('email-send-btn').addEventListener('click', sendEmail);

  }

  // ── Helpers ────────────────────────────────────────
  function formatDate(str) {
    const [y, m, d] = str.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${d} ${months[+m - 1]} ${y}`;
  }

  function formatmonth(str) {
    const [y, m, d] = str.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[+m - 1]} ${y}`;
  }

  return { start, deleteEntry, renderEmail };
})();
