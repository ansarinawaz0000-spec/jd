// server.js — Express server + JSON APIs. Run: npm install && npm start
const express = require('express');
const path = require('path');
const { db, initSchema, dbPath } = require('./db');

initSchema();

const app = express();
app.use(express.json());

// ---- helpers ----
const row = (sql, ...p) => db.prepare(sql).get(...p);
const all = (sql, ...p) => db.prepare(sql).all(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

function assignmentsFor(orderId) {
  return all('SELECT * FROM order_assignments WHERE order_id = ? ORDER BY id', orderId);
}
function measurementsFor(customerId) {
  return all('SELECT * FROM measurements WHERE customer_id = ? ORDER BY id', customerId);
}
function orderWithDetails(o) {
  return { ...o, assignments: assignmentsFor(o.id) };
}

// ---- Dashboard (Ghar) ----
app.get('/api/dashboard', (req, res) => {
  const s = row(`SELECT
      COALESCE(SUM(total_amount),0) AS totalSale,
      COALESCE(SUM(customer_paid),0) AS received
    FROM orders`);
  const due = num(s.totalSale) - num(s.received);
  res.json({
    totalSale: num(s.totalSale),
    received: num(s.received),
    due,
    counts: {
      customers: row('SELECT COUNT(*) c FROM customers').c,
      orders: row('SELECT COUNT(*) c FROM orders').c,
      artisans: row('SELECT COUNT(*) c FROM artisans WHERE active = 1').c,
      lowStock: row('SELECT COUNT(*) c FROM inventory WHERE quantity_meters <= low_stock_meters').c,
    },
    recentOrders: all('SELECT * FROM orders ORDER BY id DESC LIMIT 5').map(orderWithDetails),
  });
});

// ---- Customers (Grahak) ----
app.get('/api/customers', (req, res) => {
  const list = all('SELECT * FROM customers ORDER BY name');
  res.json(list.map(c => ({ ...c, measurements: measurementsFor(c.id) })));
});
app.get('/api/customers/:id', (req, res) => {
  const c = row('SELECT * FROM customers WHERE id = ?', req.params.id);
  if (!c) return res.status(404).json({ error: 'nahi mila' });
  res.json({ ...c, measurements: measurementsFor(c.id) });
});
app.post('/api/customers', (req, res) => {
  const { name, phone, notes } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'naam zaroori hai' });
  const r = run('INSERT INTO customers (name, phone, notes) VALUES (?,?,?)',
    String(name).trim(), phone || null, notes || null);
  res.json({ id: Number(r.lastInsertRowid) });
});
app.put('/api/customers/:id', (req, res) => {
  const { name, phone, notes } = req.body || {};
  run('UPDATE customers SET name=?, phone=?, notes=? WHERE id=?',
    String(name || '').trim(), phone || null, notes || null, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/customers/:id', (req, res) => {
  run('DELETE FROM measurements WHERE customer_id=?', req.params.id);
  run('DELETE FROM customers WHERE id=?', req.params.id);
  res.json({ ok: true });
});

// Measurements — IMPORTANT: edit hamesha UPDATE hota hai (id se), duplicate nahi banta
app.post('/api/customers/:id/measurements', (req, res) => {
  const { label, value } = req.body || {};
  if (!label) return res.status(400).json({ error: 'label zaroori hai' });
  const r = run('INSERT INTO measurements (customer_id, label, value) VALUES (?,?,?)',
    req.params.id, String(label), String(value ?? ''));
  res.json({ id: Number(r.lastInsertRowid) });
});
app.put('/api/measurements/:id', (req, res) => {
  const { label, value } = req.body || {};
  run('UPDATE measurements SET label=?, value=? WHERE id=?',
    label, String(value ?? ''), req.params.id);
  res.json({ ok: true });
});
app.delete('/api/measurements/:id', (req, res) => {
  run('DELETE FROM measurements WHERE id=?', req.params.id);
  res.json({ ok: true });
});

// ---- Artisans (Karigar) ----
app.get('/api/artisans', (req, res) => {
  const list = all('SELECT * FROM artisans ORDER BY name');
  res.json(list.map(a => {
    const labor = row('SELECT COALESCE(SUM(labor_amount),0) l, COALESCE(SUM(artisan_paid),0) p FROM order_assignments WHERE artisan_id=?', a.id);
    const direct = row('SELECT COALESCE(SUM(amount),0) d FROM artisan_payments WHERE artisan_id=?', a.id).d;
    const totalLabor = num(labor.l), paidTotal = num(labor.p) + num(direct);
    return { ...a, totalLabor, paidTotal, due: totalLabor - paidTotal };
  }));
});
app.post('/api/artisans', (req, res) => {
  const { name, phone, specialty } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'naam zaroori hai' });
  const r = run('INSERT INTO artisans (name, phone, specialty) VALUES (?,?,?)',
    String(name).trim(), phone || null, specialty || null);
  res.json({ id: Number(r.lastInsertRowid) });
});
app.put('/api/artisans/:id', (req, res) => {
  const { name, phone, specialty, active } = req.body || {};
  run('UPDATE artisans SET name=?, phone=?, specialty=?, active=? WHERE id=?',
    String(name || '').trim(), phone || null, specialty || null, active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});
app.delete('/api/artisans/:id', (req, res) => {
  run('DELETE FROM artisans WHERE id=?', req.params.id);
  res.json({ ok: true });
});
app.get('/api/artisans/:id/payments', (req, res) => {
  res.json(all('SELECT * FROM artisan_payments WHERE artisan_id=? ORDER BY id DESC', req.params.id));
});
app.post('/api/artisans/:id/payments', (req, res) => {
  const { amount, note, date } = req.body || {};
  run('INSERT INTO artisan_payments (artisan_id, amount, note, date) VALUES (?,?,?,?)',
    req.params.id, num(amount), note || null, date || new Date().toISOString().slice(0, 10));
  res.json({ ok: true });
});
app.delete('/api/artisan-payments/:id', (req, res) => {
  run('DELETE FROM artisan_payments WHERE id=?', req.params.id);
  res.json({ ok: true });
});

// ---- Inventory (Stock — kapda, meter me) ----
app.get('/api/inventory', (req, res) => {
  res.json(all('SELECT * FROM inventory ORDER BY name'));
});
app.post('/api/inventory', (req, res) => {
  const { name, fabric_type, shade, quantity_meters, rate_per_meter, low_stock_meters } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'naam zaroori hai' });
  const r = run(`INSERT INTO inventory (name, fabric_type, shade, quantity_meters, rate_per_meter, low_stock_meters)
                 VALUES (?,?,?,?,?,?)`,
    String(name).trim(), fabric_type || null, shade || null,
    num(quantity_meters), num(rate_per_meter), num(low_stock_meters));
  const id = Number(r.lastInsertRowid);
  if (num(quantity_meters) > 0)
    run('INSERT INTO stock_movements (inventory_id, delta_meters, note) VALUES (?,?,?)', id, num(quantity_meters), 'shuruati stock');
  res.json({ id });
});
app.put('/api/inventory/:id', (req, res) => {
  const { name, fabric_type, shade, rate_per_meter, low_stock_meters } = req.body || {};
  run('UPDATE inventory SET name=?, fabric_type=?, shade=?, rate_per_meter=?, low_stock_meters=?, updated_at=datetime(\'now\') WHERE id=?',
    String(name || '').trim(), fabric_type || null, shade || null, num(rate_per_meter), num(low_stock_meters), req.params.id);
  res.json({ ok: true });
});
// Stock adjust: delta + ya - meter me
app.post('/api/inventory/:id/adjust', (req, res) => {
  const { delta_meters, note } = req.body || {};
  const d = num(delta_meters);
  if (!d) return res.status(400).json({ error: 'meter likho' });
  run('UPDATE inventory SET quantity_meters = quantity_meters + ?, updated_at=datetime(\'now\') WHERE id=?', d, req.params.id);
  run('INSERT INTO stock_movements (inventory_id, delta_meters, note) VALUES (?,?,?)', req.params.id, d, note || null);
  const item = row('SELECT * FROM inventory WHERE id=?', req.params.id);
  res.json(item);
});
app.get('/api/inventory/:id/movements', (req, res) => {
  res.json(all('SELECT * FROM stock_movements WHERE inventory_id=? ORDER BY id DESC LIMIT 50', req.params.id));
});
app.delete('/api/inventory/:id', (req, res) => {
  run('DELETE FROM stock_movements WHERE inventory_id=?', req.params.id);
  run('DELETE FROM inventory WHERE id=?', req.params.id);
  res.json({ ok: true });
});

// ---- Orders ----
app.get('/api/orders', (req, res) => {
  res.json(all('SELECT * FROM orders ORDER BY id DESC').map(orderWithDetails));
});
app.get('/api/orders/:id', (req, res) => {
  const o = row('SELECT * FROM orders WHERE id=?', req.params.id);
  if (!o) return res.status(404).json({ error: 'nahi mila' });
  o.assignments = assignmentsFor(o.id);
  o.payments = all('SELECT * FROM customer_payments WHERE order_id=? ORDER BY id DESC', o.id);
  res.json(o);
});
app.post('/api/orders', (req, res) => {
  const b = req.body || {};
  const r = run(`INSERT INTO orders (customer_id, customer_name, garment, description, order_date, due_date, total_amount, customer_paid, status)
                 VALUES (?,?,?,?,?,?,?,?,?)`,
    b.customer_id || null, b.customer_name || null, b.garment || null, b.description || null,
    b.order_date || new Date().toISOString().slice(0, 10), b.due_date || null,
    num(b.total_amount), num(b.customer_paid), b.status || 'new');
  const id = Number(r.lastInsertRowid);
  if (num(b.customer_paid) > 0)
    run('INSERT INTO customer_payments (order_id, amount, note, date) VALUES (?,?,?,?)',
      id, num(b.customer_paid), 'advance', b.order_date || new Date().toISOString().slice(0, 10));
  res.json({ id });
});
app.put('/api/orders/:id', (req, res) => {
  const b = req.body || {};
  run(`UPDATE orders SET customer_id=?, customer_name=?, garment=?, description=?, order_date=?, due_date=?, total_amount=?, status=? WHERE id=?`,
    b.customer_id || null, b.customer_name || null, b.garment || null, b.description || null,
    b.order_date || null, b.due_date || null, num(b.total_amount), b.status || 'new', req.params.id);
  res.json({ ok: true });
});
app.delete('/api/orders/:id', (req, res) => {
  run('DELETE FROM customer_payments WHERE order_id=?', req.params.id);
  run('DELETE FROM order_assignments WHERE order_id=?', req.params.id);
  run('DELETE FROM orders WHERE id=?', req.params.id);
  res.json({ ok: true });
});
// Ek order me MULTIPLE karigar: har kapde ke liye alag karigar + mazdoori
app.post('/api/orders/:id/assignments', (req, res) => {
  const { artisan_id, artisan_name, garment, labor_amount } = req.body || {};
  const r = run(`INSERT INTO order_assignments (order_id, artisan_id, artisan_name, garment, labor_amount)
                 VALUES (?,?,?,?,?)`,
    req.params.id, artisan_id || null, artisan_name || null, garment || null, num(labor_amount));
  res.json({ id: Number(r.lastInsertRowid) });
});
app.put('/api/assignments/:id', (req, res) => {
  const { artisan_id, artisan_name, garment, labor_amount, artisan_paid } = req.body || {};
  run('UPDATE order_assignments SET artisan_id=?, artisan_name=?, garment=?, labor_amount=?, artisan_paid=? WHERE id=?',
    artisan_id || null, artisan_name || null, garment || null, num(labor_amount), num(artisan_paid), req.params.id);
  res.json({ ok: true });
});
app.delete('/api/assignments/:id', (req, res) => {
  run('DELETE FROM order_assignments WHERE id=?', req.params.id);
  res.json({ ok: true });
});
// Grahak se payment lena
app.post('/api/orders/:id/payments', (req, res) => {
  const { amount, note, date } = req.body || {};
  const a = num(amount);
  if (a <= 0) return res.status(400).json({ error: 'rakam likho' });
  run('INSERT INTO customer_payments (order_id, amount, note, date) VALUES (?,?,?,?)',
    req.params.id, a, note || null, date || new Date().toISOString().slice(0, 10));
  run('UPDATE orders SET customer_paid = customer_paid + ? WHERE id=?', a, req.params.id);
  res.json({ ok: true });
});

// ---- Ledger (Hisab) ----
app.get('/api/ledger', (req, res) => {
  const list = all('SELECT * FROM ledger ORDER BY date DESC, id DESC LIMIT 200');
  const t = row('SELECT COALESCE(SUM(CASE WHEN type=\'income\' THEN amount ELSE 0 END),0) income, COALESCE(SUM(CASE WHEN type=\'expense\' THEN amount ELSE 0 END),0) expense FROM ledger');
  res.json({ entries: list, totalIncome: num(t.income), totalExpense: num(t.expense) });
});
app.post('/api/ledger', (req, res) => {
  const { type, amount, category, note, date } = req.body || {};
  const r = run('INSERT INTO ledger (type, amount, category, note, date) VALUES (?,?,?,?,?)',
    type === 'expense' ? 'expense' : 'income', num(amount), category || null, note || null,
    date || new Date().toISOString().slice(0, 10));
  res.json({ id: Number(r.lastInsertRowid) });
});
app.delete('/api/ledger/:id', (req, res) => {
  run('DELETE FROM ledger WHERE id=?', req.params.id);
  res.json({ ok: true });
});

// ---- Static files + PWA ----
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dukan Hisab chal raha hai: http://localhost:${PORT}`);
  console.log(`Database: ${dbPath}`);
});
