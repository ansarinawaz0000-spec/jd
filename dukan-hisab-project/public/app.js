// Dukan Hisab — vanilla JS single-page app (sab Hindi me)
// API helper
async function api(method, path, body) {
  const r = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'kuch gadbad hui');
  return data;
}
const $ = (s, el) => (el || document).querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rs = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const todayISO = () => new Date().toISOString().slice(0, 10);

const STATUS_HI = { 'new': 'नया', 'in-progress': 'काम चालू', 'ready': 'तैयार', 'delivered': 'डिलीवर' };

// Naap ke preset — Shirt aur Pant (user ke diye hue code)
const SHIRT_FIELDS = [
  ['L', 'लंबाई', 'Length'], ['S', 'आस्तीन', 'Sleeve length'], ['SH', 'कंधा', 'Shoulder'],
  ['C', 'छाती', 'Chest'], ['BC', 'BC', ''], ['W', 'कमर', 'Waist'],
  ['H', 'हिप', 'Hip'], ['N', 'गला', 'Neck'],
];
const PANT_FIELDS = [
  ['L', 'लंबाई', 'Length'], ['W', 'कमर', 'Waist'], ['H', 'हिप', 'Hip'],
  ['TH', 'जांघ', 'Thigh'], ['KH', 'घुटना', 'Knee'], ['PIND', 'पिंडली', 'Pindli'],
  ['B', 'मोहरी', 'Bottom'], ['FLY', 'फ्लाई', 'Fly'], ['CR', 'आसन', 'Crotch'],
];
function mLabel(kind, code, en) {
  return en ? `${kind} ${code} · ${en}` : `${kind} ${code}`;
}
function mHint(code, hi, en) {
  return en ? `${code} (${hi})` : `${code} (${hi})`;
}

// ---- Navigation ----
let TAB = 'home';
const view = () => $('#view');
document.querySelectorAll('#nav button').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#nav button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    TAB = b.dataset.tab;
    render();
  });
});
function go(tab) {
  TAB = tab;
  document.querySelectorAll('#nav button').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
  render();
}
async function render() {
  const v = view();
  v.innerHTML = '<div class="empty">लोड हो रहा है…</div>';
  try {
    if (TAB === 'home') await vHome(v);
    else if (TAB === 'orders') await vOrders(v);
    else if (TAB === 'customers') await vCustomers(v);
    else if (TAB === 'stock') await vStock(v);
    else if (TAB === 'artisans') await vArtisans(v);
    else if (TAB === 'ledger') await vLedger(v);
  } catch (e) {
    v.innerHTML = `<div class="card"><b>Error:</b> ${esc(e.message)}<br><button class="btn" onclick="render()">फिर कोशिश करो</button></div>`;
  }
  window.scrollTo(0, 0);
}

// ============ घर (Dashboard) ============
async function vHome(v) {
  const d = await api('GET', '/api/dashboard');
  v.innerHTML = `
    <h2 class="ptitle">🏠 घर</h2>
    <div class="row">
      <div class="stat"><div class="v brand">${rs(d.totalSale)}</div><div class="l">कुल बिक्री</div></div>
      <div class="stat"><div class="v green">${rs(d.received)}</div><div class="l">मिल चुका</div></div>
      <div class="stat"><div class="v red">${rs(d.due)}</div><div class="l">लेना बाकी</div></div>
    </div>
    <div class="row">
      <div class="stat"><div class="v">${d.counts.orders}</div><div class="l">ऑर्डर</div></div>
      <div class="stat"><div class="v">${d.counts.customers}</div><div class="l">ग्राहक</div></div>
      <div class="stat"><div class="v">${d.counts.artisans}</div><div class="l">कारीगर</div></div>
      <div class="stat"><div class="v ${d.counts.lowStock ? 'red' : ''}">${d.counts.lowStock}</div><div class="l">कम स्टॉक</div></div>
    </div>
    <div class="card"><h3>ताज़ा ऑर्डर</h3>
      ${d.recentOrders.length ? d.recentOrders.map(o => `
        <div class="list-item" onclick="openOrder(${o.id})" style="cursor:pointer">
          <div><div class="t">${esc(o.customer_name || '—')}</div>
          <div class="s">${esc(o.garment || '')} · ${rs(o.total_amount)}</div></div>
          <span class="badge">${STATUS_HI[o.status] || o.status}</span>
        </div>`).join('') : '<div class="empty">अभी कोई ऑर्डर नहीं</div>'}
    </div>
    <button class="btn" onclick="showOrderForm()">+ नया ऑर्डर</button>`;
}

// ============ ऑर्डर ============
let orderFilter = '';
async function vOrders(v) {
  const orders = await api('GET', '/api/orders');
  const f = orderFilter.trim().toLowerCase();
  const list = orders.filter(o => !f || (o.customer_name || '').toLowerCase().includes(f) || (o.garment || '').toLowerCase().includes(f));
  v.innerHTML = `
    <h2 class="ptitle">🧾 ऑर्डर</h2>
    <div class="toolbar"><input id="of" placeholder="खोजो: ग्राहक / कपड़ा…" value="${esc(orderFilter)}" oninput="orderFilter=this.value;vOrders(view()).then(()=>{const i=$('#of');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}})"></div>
    ${list.map(o => {
      const due = Number(o.total_amount) - Number(o.customer_paid);
      return `<div class="card" onclick="openOrder(${o.id})" style="cursor:pointer">
        <div class="list-item" style="border:0;padding:0">
          <div><div class="t">${esc(o.customer_name || '—')}</div>
          <div class="s">${esc(o.garment || '')} · देना: ${esc(o.due_date || '—')}</div>
          <div class="s">कारीगर: ${o.assignments.length ? esc(o.assignments.map(a => a.artisan_name).join(', ')) : '—'}</div></div>
          <div style="text-align:right"><div class="money">${rs(o.total_amount)}</div>
          <div class="s" style="color:${due > 0 ? 'var(--red)' : 'var(--green)'}">बाकी ${rs(due)}</div>
          <span class="badge">${STATUS_HI[o.status] || o.status}</span></div>
        </div></div>`;
    }).join('') || '<div class="empty">कोई ऑर्डर नहीं मिला</div>'}
    <button class="fab" onclick="showOrderForm()">+</button>`;
}

async function showOrderForm(editId) {
  const v = view();
  const customers = await api('GET', '/api/customers');
  let o = null;
  if (editId) o = await api('GET', '/api/orders/' + editId);
  v.innerHTML = `
    <button class="back" onclick="render()">← वापस</button>
    <h2 class="ptitle">${o ? 'ऑर्डर बदलो' : 'नया ऑर्डर'}</h2>
    <div class="card">
      <label class="fl">ग्राहक</label>
      <select id="ocust"><option value="">— चुनो —</option>
        ${customers.map(c => `<option value="${c.id}" ${o && o.customer_id == c.id ? 'selected' : ''}>${esc(c.name)} (${esc(c.phone || '')})</option>`).join('')}
      </select>
      <label class="fl">कपड़े (जैसे: 2 पैंट 2 शर्ट)</label>
      <input id="ogarment" value="${esc(o?.garment || '')}" placeholder="कपड़े का ब्यौरा">
      <label class="fl">नोट</label>
      <input id="odesc" value="${esc(o?.description || '')}" placeholder="नोट">
      <div class="grid2">
        <div><label class="fl">ऑर्डर तारीख</label><input id="odate" type="date" value="${esc(o?.order_date || todayISO())}"></div>
        <div><label class="fl">डिलीवरी तारीख</label><input id="odue" type="date" value="${esc(o?.due_date || '')}"></div>
      </div>
      <div class="grid2">
        <div><label class="fl">कुल रकम ₹</label><input id="ototal" type="number" inputmode="decimal" value="${o?.total_amount ?? ''}"></div>
        <div><label class="fl">एडवांस ₹</label><input id="opaid" type="number" inputmode="decimal" value="${o?.customer_paid ?? ''}" ${o ? 'disabled' : ''}></div>
      </div>
      <label class="fl">स्थिति</label>
      <select id="ostatus">${Object.entries(STATUS_HI).map(([k, hi]) => `<option value="${k}" ${o?.status === k ? 'selected' : ''}>${hi}</option>`).join('')}</select>
      <button class="btn" onclick="saveOrder(${o ? o.id : 'null'})">सेव करो</button>
      ${o ? `<button class="btn danger" onclick="if(confirm('ऑर्डर हटाएं?'))deleteOrder(${o.id})">हटाओ</button>` : ''}
    </div>`;
}
async function saveOrder(id) {
  const custSel = $('#ocust');
  const body = {
    customer_id: custSel.value || null,
    customer_name: custSel.value ? custSel.options[custSel.selectedIndex].text.split(' (')[0] : null,
    garment: $('#ogarment').value.trim(),
    description: $('#odesc').value.trim(),
    order_date: $('#odate').value || todayISO(),
    due_date: $('#odue').value || null,
    total_amount: parseFloat($('#ototal').value) || 0,
    status: $('#ostatus').value,
  };
  if (!id) body.customer_paid = parseFloat($('#opaid').value) || 0;
  try {
    if (id) await api('PUT', '/api/orders/' + id, body);
    else { const r = await api('POST', '/api/orders', body); id = r.id; }
    openOrder(id);
  } catch (e) { alert(e.message); }
}
async function deleteOrder(id) {
  await api('DELETE', '/api/orders/' + id);
  render();
}

async function openOrder(id) {
  const v = view();
  const o = await api('GET', '/api/orders/' + id);
  const artisans = await api('GET', '/api/artisans');
  const due = Number(o.total_amount) - Number(o.customer_paid);
  v.innerHTML = `
    <button class="back" onclick="go('orders')">← ऑर्डर सूची</button>
    <h2 class="ptitle">🧾 ${esc(o.customer_name || '—')}</h2>
    <div class="card">
      <div class="kv"><span>कपड़े</span><b>${esc(o.garment || '—')}</b></div>
      <div class="kv"><span>नोट</span><b>${esc(o.description || '—')}</b></div>
      <div class="kv"><span>डिलीवरी</span><b>${esc(o.due_date || '—')}</b></div>
      <div class="kv"><span>स्थिति</span><span class="badge">${STATUS_HI[o.status] || o.status}</span></div>
      <div class="kv"><span>कुल रकम</span><b class="money">${rs(o.total_amount)}</b></div>
      <div class="kv"><span>मिल चुका</span><b class="money" style="color:var(--green)">${rs(o.customer_paid)}</b></div>
      <div class="kv"><span>बाकी</span><b class="money" style="color:var(--red)">${rs(due)}</b></div>
      <div class="toolbar" style="margin-top:10px">
        <button class="btn small ghost" onclick="showOrderForm(${o.id})">बदलो</button>
        <button class="btn small green" onclick="showCustPay(${o.id})">+ पेमेंट लो</button>
      </div>
    </div>
    <div class="card">
      <h3>✂️ कारीगर (हर कपड़े के लिए अलग)</h3>
      ${o.assignments.map(a => `
        <div class="list-item">
          <div><div class="t">${esc(a.artisan_name || '—')} <span class="muted">(${esc(a.garment || '')})</span></div>
          <div class="s">मजदूरी ${rs(a.labor_amount)} · दिया ${rs(a.artisan_paid)} · <b style="color:${(a.labor_amount - a.artisan_paid) > 0 ? 'var(--red)' : 'var(--green)'}">बाकी ${rs(a.labor_amount - a.artisan_paid)}</b></div></div>
          <div class="toolbar" style="margin:0">
            <button class="btn small ghost" onclick='editAssign(${JSON.stringify(a).replace(/'/g, "&#39;")})'>बदलो</button>
            <button class="btn small danger" onclick="if(confirm('हटाएं?'))delAssign(${a.id},${o.id})">✕</button>
          </div>
        </div>`).join('') || '<div class="empty">अभी कोई कारीगर नहीं जुड़ा</div>'}
      <div class="sec-title">कारीगर जोड़ो</div>
      <label class="fl">कारीगर</label>
      <select id="aart">${artisans.filter(a => a.active).map(a => `<option value="${a.id}">${esc(a.name)}${a.specialty ? ' (' + esc(a.specialty) + ')' : ''}</option>`).join('')}</select>
      <div class="grid2">
        <div><label class="fl">कपड़ा (पैंट/शर्ट…)</label><input id="agarment" placeholder="जैसे: पैंट"></div>
        <div><label class="fl">मजदूरी ₹</label><input id="alabor" type="number" inputmode="decimal" placeholder="0"></div>
      </div>
      <button class="btn" onclick="addAssign(${o.id})">कारीगर जोड़ो</button>
    </div>
    <div class="card"><h3>💵 पेमेंट इतिहास</h3>
      ${o.payments.map(p => `<div class="kv"><span>${esc(p.date)} · ${esc(p.note || '')}</span><b class="money" style="color:var(--green)">${rs(p.amount)}</b></div>`).join('') || '<div class="empty">कोई पेमेंट नहीं</div>'}
    </div>`;
}
function showCustPay(orderId) {
  const amt = prompt('कितने ₹ मिले?');
  if (amt === null) return;
  const note = prompt('नोट (खाली छोड़ सकते हो)', '') || '';
  api('POST', `/api/orders/${orderId}/payments`, { amount: parseFloat(amt) || 0, note })
    .then(() => openOrder(orderId)).catch(e => alert(e.message));
}
async function addAssign(orderId) {
  const sel = $('#aart');
  if (!sel || !sel.value) { alert('पहले कारीगर बनाओ'); return; }
  const name = sel.options[sel.selectedIndex].text.split(' (')[0];
  await api('POST', `/api/orders/${orderId}/assignments`, {
    artisan_id: sel.value, artisan_name: name,
    garment: $('#agarment').value.trim(), labor_amount: parseFloat($('#alabor').value) || 0,
  }).catch(e => alert(e.message));
  openOrder(orderId);
}
function editAssign(a) {
  const labor = prompt('मजदूरी ₹', a.labor_amount);
  if (labor === null) return;
  const paid = prompt('कारीगर को कितना दिया ₹', a.artisan_paid);
  if (paid === null) return;
  api('PUT', '/api/assignments/' + a.id, { ...a, labor_amount: parseFloat(labor) || 0, artisan_paid: parseFloat(paid) || 0 })
    .then(() => openOrder(a.order_id)).catch(e => alert(e.message));
}
async function delAssign(id, orderId) {
  await api('DELETE', '/api/assignments/' + id);
  openOrder(orderId);
}

// ============ ग्राहक ============
let custFilter = '';
async function vCustomers(v) {
  const list = await api('GET', '/api/customers');
  const f = custFilter.trim().toLowerCase();
  const rows = list.filter(c => !f || c.name.toLowerCase().includes(f) || (c.phone || '').includes(f));
  v.innerHTML = `
    <h2 class="ptitle">👤 ग्राहक</h2>
    <div class="toolbar"><input id="cf" placeholder="खोजो: नाम / मोबाइल…" value="${esc(custFilter)}" oninput="custFilter=this.value;vCustomers(view()).then(()=>{const i=$('#cf');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}})"></div>
    ${rows.map(c => `
      <div class="card" onclick="openCustomer(${c.id})" style="cursor:pointer">
        <div class="list-item" style="border:0;padding:0">
          <div><div class="t">${esc(c.name)}</div><div class="s">📞 ${esc(c.phone || '—')} · ${c.measurements.length} नाप</div></div>
          <span class="badge">खोलो ›</span>
        </div></div>`).join('') || '<div class="empty">कोई ग्राहक नहीं</div>'}
    <button class="fab" onclick="showCustomerForm()">+</button>`;
}

async function showCustomerForm(editId) {
  const v = view();
  const c = editId ? await api('GET', '/api/customers/' + editId) : null;
  v.innerHTML = `
    <button class="back" onclick="go('customers')">← ग्राहक सूची</button>
    <h2 class="ptitle">${c ? 'ग्राहक बदलो' : 'नया ग्राहक'}</h2>
    <div class="card">
      <label class="fl">नाम *</label><input id="cname" value="${esc(c?.name || '')}">
      <label class="fl">मोबाइल</label><input id="cphone" inputmode="tel" value="${esc(c?.phone || '')}">
      <label class="fl">नोट</label><input id="cnotes" value="${esc(c?.notes || '')}">
      <button class="btn" onclick="saveCustomer(${c ? c.id : 'null'})">सेव करो</button>
      ${c ? `<button class="btn danger" onclick="if(confirm('ग्राहक हटाएं? नाप भी हट जाएंगे।'))delCustomer(${c.id})">हटाओ</button>` : ''}
    </div>`;
}
async function saveCustomer(id) {
  const body = { name: $('#cname').value.trim(), phone: $('#cphone').value.trim(), notes: $('#cnotes').value.trim() };
  try {
    if (id) { await api('PUT', '/api/customers/' + id, body); openCustomer(id); }
    else { const r = await api('POST', '/api/customers', body); openCustomer(r.id); }
  } catch (e) { alert(e.message); }
}
async function delCustomer(id) {
  await api('DELETE', '/api/customers/' + id);
  go('customers');
}

async function openCustomer(id) {
  const v = view();
  const c = await api('GET', '/api/customers/' + id);
  const byLabel = {};
  c.measurements.forEach(m => { byLabel[m.label] = m; });

  const fieldGrid = (kind, fields) => fields.map(([code, hi, en]) => {
    const label = mLabel(kind, code, en);
    const m = byLabel[label];
    return `<div><label class="fl">${code} <span class="muted">${esc(hi)}</span></label>
      <input data-mlabel="${esc(label)}" data-mid="${m ? m.id : ''}" value="${esc(m?.value || '')}" inputmode="decimal" placeholder="—"></div>`;
  }).join('');

  const extras = c.measurements.filter(m => !/^Shirt |^Pant /.test(m.label));
  v.innerHTML = `
    <button class="back" onclick="go('customers')">← ग्राहक सूची</button>
    <h2 class="ptitle">👤 ${esc(c.name)}</h2>
    <div class="card">
      <div class="kv"><span>📞 मोबाइल</span><b>${esc(c.phone || '—')}</b></div>
      ${c.notes ? `<div class="kv"><span>नोट</span><b>${esc(c.notes)}</b></div>` : ''}
      <button class="btn small ghost" onclick="showCustomerForm(${c.id})" style="margin-top:8px">नाम/फोन बदलो</button>
    </div>
    <div class="card">
      <h3>📏 नाप (बदलो और सेव दबाओ — पुराना ही अपडेट होगा)</h3>
      <div class="sec-title">शर्ट</div>
      <div class="grid2">${fieldGrid('Shirt', SHIRT_FIELDS)}</div>
      <div class="sec-title">पैंट</div>
      <div class="grid2">${fieldGrid('Pant', PANT_FIELDS)}</div>
      ${extras.length ? `<div class="sec-title">अन्य नाप</div>` + extras.map(m => `
        <div class="kv"><span>${esc(m.label)}</span>
          <span><input data-mid="${m.id}" data-mlabel="${esc(m.label)}" value="${esc(m.value)}" style="width:90px;margin:0" inputmode="decimal">
          <button class="btn small danger" onclick="delMeas(${m.id},${c.id})">✕</button></span></div>`).join('') : ''}
      <button class="btn" onclick="saveMeasurements(${c.id})">नाप सेव करो</button>
      <div class="sec-title">अलग नाप जोड़ो</div>
      <div class="grid2">
        <input id="xlabel" placeholder="नाम (जैसे: कुर्ता L)">
        <input id="xval" placeholder="मान" inputmode="decimal">
      </div>
      <button class="btn ghost" onclick="addExtraMeas(${c.id})">+ जोड़ो</button>
    </div>`;
}

// Naap save: jo id hai wo UPDATE, jo naya hai wo INSERT — duplicate kabhi nahi
async function saveMeasurements(cid) {
  const inputs = document.querySelectorAll('#view [data-mlabel]');
  try {
    for (const inp of inputs) {
      const label = inp.dataset.mlabel, value = inp.value.trim(), mid = inp.dataset.mid;
      if (mid) await api('PUT', '/api/measurements/' + mid, { label, value });
      else if (value) await api('POST', `/api/customers/${cid}/measurements`, { label, value });
    }
    alert('नाप सेव हो गया ✓');
    openCustomer(cid);
  } catch (e) { alert(e.message); }
}
async function addExtraMeas(cid) {
  const label = $('#xlabel').value.trim(), value = $('#xval').value.trim();
  if (!label) { alert('नाम लिखो'); return; }
  await api('POST', `/api/customers/${cid}/measurements`, { label, value });
  openCustomer(cid);
}
async function delMeas(mid, cid) {
  if (!confirm('ये नाप हटाएं?')) return;
  await api('DELETE', '/api/measurements/' + mid);
  openCustomer(cid);
}

// ============ स्टॉक (कपड़ा) ============
const FABRIC_TYPES = ['Shirting', 'Suiting', 'Kurta fabric', 'Coating', 'Lining', 'अन्य'];
async function vStock(v) {
  const items = await api('GET', '/api/inventory');
  v.innerHTML = `
    <h2 class="ptitle">🧵 स्टॉक (कपड़ा)</h2>
    ${items.map(s => {
      const low = Number(s.quantity_meters) <= Number(s.low_stock_meters);
      const val = Number(s.quantity_meters) * Number(s.rate_per_meter);
      return `<div class="card ${low ? 'lowstock' : ''}" onclick="openStock(${s.id})" style="cursor:pointer">
        <div class="list-item" style="border:0;padding:0">
          <div><div class="t">${esc(s.name)}</div>
          <div class="s">${esc(s.fabric_type || '')}${s.shade ? ' · ' + esc(s.shade) : ''} · ₹${esc(s.rate_per_meter)}/m</div>
          ${low ? '<span class="badge red">कम स्टॉक!</span>' : ''}</div>
          <div style="text-align:right"><div class="money">${esc(s.quantity_meters)} m</div>
          <div class="s">${rs(val)}</div></div>
        </div></div>`;
    }).join('') || '<div class="empty">स्टॉक खाली है</div>'}
    <button class="fab" onclick="showStockForm()">+</button>`;
}
async function showStockForm(editId) {
  const v = view();
  const items = await api('GET', '/api/inventory');
  const s = editId ? items.find(x => x.id == editId) : null;
  v.innerHTML = `
    <button class="back" onclick="go('stock')">← स्टॉक</button>
    <h2 class="ptitle">${s ? 'कपड़ा बदलो' : 'नया कपड़ा'}</h2>
    <div class="card">
      <label class="fl">नाम *</label><input id="sname" value="${esc(s?.name || '')}" placeholder="जैसे: Raymond R250">
      <label class="fl">टाइप</label><select id="stype">${FABRIC_TYPES.map(t => `<option ${s?.fabric_type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <label class="fl">शेड/रंग</label><input id="sshade" value="${esc(s?.shade || '')}">
      <div class="grid2">
        <div><label class="fl">मीटर</label><input id="sqty" type="number" inputmode="decimal" value="${s?.quantity_meters ?? ''}" ${s ? 'disabled' : ''}></div>
        <div><label class="fl">रेट ₹/मीटर</label><input id="srate" type="number" inputmode="decimal" value="${s?.rate_per_meter ?? ''}"></div>
      </div>
      <label class="fl">कम स्टॉक चेतावनी (मीटर)</label><input id="slow" type="number" inputmode="decimal" value="${s?.low_stock_meters ?? 2}">
      <button class="btn" onclick="saveStock(${s ? s.id : 'null'})">सेव करो</button>
      ${s ? `<button class="btn danger" onclick="if(confirm('हटाएं?'))delStock(${s.id})">हटाओ</button>` : ''}
    </div>`;
}
async function saveStock(id) {
  const body = {
    name: $('#sname').value.trim(), fabric_type: $('#stype').value,
    shade: $('#sshade').value.trim(), rate_per_meter: parseFloat($('#srate').value) || 0,
    low_stock_meters: parseFloat($('#slow').value) || 0,
  };
  if (!id) body.quantity_meters = parseFloat($('#sqty').value) || 0;
  try {
    if (id) await api('PUT', '/api/inventory/' + id, body);
    else await api('POST', '/api/inventory', body);
    go('stock');
  } catch (e) { alert(e.message); }
}
async function delStock(id) {
  await api('DELETE', '/api/inventory/' + id);
  go('stock');
}
async function openStock(id) {
  const v = view();
  const items = await api('GET', '/api/inventory');
  const s = items.find(x => x.id == id);
  const moves = await api('GET', `/api/inventory/${id}/movements`);
  v.innerHTML = `
    <button class="back" onclick="go('stock')">← स्टॉक</button>
    <h2 class="ptitle">🧵 ${esc(s.name)}</h2>
    <div class="card">
      <div class="kv"><span>टाइप</span><b>${esc(s.fabric_type || '—')}</b></div>
      <div class="kv"><span>शेड</span><b>${esc(s.shade || '—')}</b></div>
      <div class="kv"><span>मौजूदा</span><b class="money">${esc(s.quantity_meters)} मीटर</b></div>
      <div class="kv"><span>रेट</span><b>₹${esc(s.rate_per_meter)}/m</b></div>
      <div class="kv"><span>कुल कीमत</span><b class="money">${rs(s.quantity_meters * s.rate_per_meter)}</b></div>
      <div class="toolbar" style="margin-top:10px">
        <button class="btn small green" onclick="adjustStock(${s.id},1)">+ मीटर जोड़ो</button>
        <button class="btn small danger" onclick="adjustStock(${s.id},-1)">− मीटर घटाओ</button>
        <button class="btn small ghost" onclick="showStockForm(${s.id})">बदलो</button>
      </div>
    </div>
    <div class="card"><h3>📜 हिसाब (movement)</h3>
      ${moves.map(m => `<div class="kv"><span>${esc(new Date(m.created_at).toLocaleString('en-IN'))} · ${esc(m.note || '')}</span>
        <b style="color:${m.delta_meters >= 0 ? 'var(--green)' : 'var(--red)'}">${m.delta_meters >= 0 ? '+' : ''}${esc(m.delta_meters)} m</b></div>`).join('') || '<div class="empty">—</div>'}
    </div>`;
}
function adjustStock(id, sign) {
  const d = prompt(sign > 0 ? 'कितने मीटर जोड़े?' : 'कितने मीटर घटाए (कटा)?', '');
  if (d === null || d === '') return;
  const note = prompt('नोट', sign > 0 ? 'खरीद' : 'कटाई/बिक्री') || '';
  api('POST', `/api/inventory/${id}/adjust`, { delta_meters: sign * (parseFloat(d) || 0), note })
    .then(() => openStock(id)).catch(e => alert(e.message));
}

// ============ कारीगर ============
async function vArtisans(v) {
  const list = await api('GET', '/api/artisans');
  v.innerHTML = `
    <h2 class="ptitle">✂️ कारीगर</h2>
    ${list.map(a => `
      <div class="card" onclick="openArtisan(${a.id})" style="cursor:pointer;${a.active ? '' : 'opacity:.55'}">
        <div class="list-item" style="border:0;padding:0">
          <div><div class="t">${esc(a.name)}</div>
          <div class="s">${esc(a.specialty || '—')}${a.phone ? ' · 📞 ' + esc(a.phone) : ''}</div></div>
          <div style="text-align:right"><div class="s">मजदूरी ${rs(a.totalLabor)}</div>
          <div class="money" style="color:${a.due > 0 ? 'var(--red)' : 'var(--green)'}">बाकी ${rs(a.due)}</div></div>
        </div></div>`).join('') || '<div class="empty">कोई कारीगर नहीं</div>'}
    <button class="fab" onclick="showArtisanForm()">+</button>`;
}
async function showArtisanForm(editId) {
  const v = view();
  const list = await api('GET', '/api/artisans');
  const a = editId ? list.find(x => x.id == editId) : null;
  v.innerHTML = `
    <button class="back" onclick="go('artisans')">← कारीगर</button>
    <h2 class="ptitle">${a ? 'कारीगर बदलो' : 'नया कारीगर'}</h2>
    <div class="card">
      <label class="fl">नाम *</label><input id="aname" value="${esc(a?.name || '')}">
      <label class="fl">मोबाइल</label><input id="aphone" inputmode="tel" value="${esc(a?.phone || '')}">
      <label class="fl">स्पेशलिटी (शर्ट/पैंट/कोट…)</label><input id="aspec" value="${esc(a?.specialty || '')}">
      <label class="fl"><input type="checkbox" id="aactive" ${!a || a.active ? 'checked' : ''} style="width:auto"> एक्टिव</label>
      <button class="btn" onclick="saveArtisan(${a ? a.id : 'null'})">सेव करो</button>
      ${a ? `<button class="btn danger" onclick="if(confirm('हटाएं?'))delArtisan(${a.id})">हटाओ</button>` : ''}
    </div>`;
}
async function saveArtisan(id) {
  const body = { name: $('#aname').value.trim(), phone: $('#aphone').value.trim(), specialty: $('#aspec').value.trim(), active: $('#aactive').checked };
  try {
    if (id) await api('PUT', '/api/artisans/' + id, body);
    else await api('POST', '/api/artisans', body);
    go('artisans');
  } catch (e) { alert(e.message); }
}
async function delArtisan(id) {
  await api('DELETE', '/api/artisans/' + id);
  go('artisans');
}
async function openArtisan(id) {
  const v = view();
  const list = await api('GET', '/api/artisans');
  const a = list.find(x => x.id == id);
  const pays = await api('GET', `/api/artisans/${id}/payments`);
  v.innerHTML = `
    <button class="back" onclick="go('artisans')">← कारीगर</button>
    <h2 class="ptitle">✂️ ${esc(a.name)}</h2>
    <div class="card">
      <div class="kv"><span>स्पेशलिटी</span><b>${esc(a.specialty || '—')}</b></div>
      <div class="kv"><span>📞</span><b>${esc(a.phone || '—')}</b></div>
      <div class="kv"><span>कुल मजदूरी</span><b class="money">${rs(a.totalLabor)}</b></div>
      <div class="kv"><span>दे चुके</span><b class="money" style="color:var(--green)">${rs(a.paidTotal)}</b></div>
      <div class="kv"><span>बाकी देना</span><b class="money" style="color:var(--red)">${rs(a.due)}</b></div>
      <div class="toolbar" style="margin-top:10px">
        <button class="btn small green" onclick="payArtisan(${a.id})">+ पेमेंट दो</button>
        <button class="btn small ghost" onclick="showArtisanForm(${a.id})">बदलो</button>
      </div>
    </div>
    <div class="card"><h3>💵 दी हुई पेमेंट</h3>
      ${pays.map(p => `<div class="kv"><span>${esc(p.date)} · ${esc(p.note || '')}</span>
        <span><b class="money">${rs(p.amount)}</b> <button class="btn small danger" onclick="if(confirm('हटाएं?'))delAPay(${p.id},${a.id})">✕</button></span></div>`).join('') || '<div class="empty">—</div>'}
    </div>`;
}
function payArtisan(id) {
  const amt = prompt('कितने ₹ दिए?');
  if (amt === null || amt === '') return;
  const note = prompt('नोट', '') || '';
  api('POST', `/api/artisans/${id}/payments`, { amount: parseFloat(amt) || 0, note, date: todayISO() })
    .then(() => openArtisan(id)).catch(e => alert(e.message));
}
async function delAPay(pid, aid) {
  await api('DELETE', '/api/artisan-payments/' + pid);
  openArtisan(aid);
}

// ============ हिसाब (Ledger) ============
async function vLedger(v) {
  const d = await api('GET', '/api/ledger');
  const net = d.totalIncome - d.totalExpense;
  v.innerHTML = `
    <h2 class="ptitle">💰 हिसाब</h2>
    <div class="row">
      <div class="stat"><div class="v green">${rs(d.totalIncome)}</div><div class="l">आमदनी</div></div>
      <div class="stat"><div class="v red">${rs(d.totalExpense)}</div><div class="l">खर्च</div></div>
      <div class="stat"><div class="v ${net >= 0 ? 'green' : 'red'}">${rs(net)}</div><div class="l">बचत</div></div>
    </div>
    <div class="card"><h3>नई एंट्री</h3>
      <div class="grid2">
        <select id="ltype"><option value="income">आमदनी +</option><option value="expense">खर्च −</option></select>
        <input id="lamt" type="number" inputmode="decimal" placeholder="₹ रकम">
      </div>
      <input id="lcat" placeholder="कैटेगरी (जैसे: कपड़ा खरीद, बिजली)">
      <input id="lnote" placeholder="नोट">
      <input id="ldate" type="date" value="${todayISO()}">
      <button class="btn" onclick="addLedger()">जोड़ो</button>
    </div>
    <div class="card"><h3>पुरानी एंट्री</h3>
      ${d.entries.map(e => `
        <div class="list-item">
          <div><div class="t" style="color:${e.type === 'income' ? 'var(--green)' : 'var(--red)'}">${e.type === 'income' ? '+' : '−'} ${rs(e.amount)}</div>
          <div class="s">${esc(e.date)} · ${esc(e.category || '')} ${esc(e.note || '')}</div></div>
          <button class="btn small danger" onclick="if(confirm('हटाएं?'))delLedger(${e.id})">✕</button>
        </div>`).join('') || '<div class="empty">—</div>'}
    </div>`;
}
async function addLedger() {
  const amt = parseFloat($('#lamt').value) || 0;
  if (!amt) { alert('रकम लिखो'); return; }
  await api('POST', '/api/ledger', {
    type: $('#ltype').value, amount: amt,
    category: $('#lcat').value.trim(), note: $('#lnote').value.trim(), date: $('#ldate').value || todayISO(),
  }).catch(e => alert(e.message));
  render();
}
async function delLedger(id) {
  await api('DELETE', '/api/ledger/' + id);
  render();
}

// ---- start ----
render();
