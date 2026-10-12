// seed.js — asli data import karo: npm run seed
// Data file: ~/workspace/your_files/dukan-hisab-data-export.json
// (SEED_FILE env var ya pehla argument se badal sakte ho)
const fs = require('fs');
const path = require('path');
const { db, initSchema } = require('./db');

const seedFile = process.argv[2] || process.env.SEED_FILE ||
  path.join(__dirname, '..', 'your_files', 'dukan-hisab-data-export.json');

if (!fs.existsSync(seedFile)) {
  console.error('Data file nahi mili:', seedFile);
  console.error('SEED_FILE env var se sahi path do.');
  process.exit(1);
}

initSchema();
const data = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

db.exec('BEGIN');
try {
  // Karigar
  for (const a of data.artisans || []) {
    db.prepare(`INSERT OR REPLACE INTO artisans (id, name, phone, specialty, active, created_at)
                VALUES (?,?,?,?,?,?)`)
      .run(a.id, a.name, a.phone || null, a.specialty || null, a.active ? 1 : 0, a.createdAt || new Date().toISOString());
  }
  // Grahak + unke naap
  for (const c of data.customers || []) {
    db.prepare('INSERT OR REPLACE INTO customers (id, name, phone, notes, created_at) VALUES (?,?,?,?,?)')
      .run(c.id, c.name, c.phone || null, c.notes || null, c.createdAt || new Date().toISOString());
    db.prepare('DELETE FROM measurements WHERE customer_id=?').run(c.id);
    for (const m of c.measurements || []) {
      db.prepare('INSERT INTO measurements (customer_id, label, value) VALUES (?,?,?)')
        .run(c.id, m.label, String(m.value ?? ''));
    }
  }
  // Stock (kapda)
  for (const s of data.inventory || []) {
    db.prepare(`INSERT OR REPLACE INTO inventory
      (id, name, fabric_type, shade, quantity_meters, rate_per_meter, low_stock_meters, updated_at)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(s.id, s.name, s.fabricType || null, s.shade || null, num(s.quantityMeters),
        num(s.ratePerMeter), num(s.lowStockMeters), s.updatedAt || new Date().toISOString());
  }
  // Orders + karigar assignments
  for (const o of data.orders || []) {
    db.prepare(`INSERT OR REPLACE INTO orders
      (id, customer_id, customer_name, garment, description, order_date, due_date, total_amount, customer_paid, status, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(o.id, o.customerId || null, o.customerName || null, o.garment || null, o.description || null,
        (o.createdAt || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
        o.dueDate || null, num(o.totalAmount), num(o.customerPaid), o.status || 'new',
        o.createdAt || new Date().toISOString());
    db.prepare('DELETE FROM order_assignments WHERE order_id=?').run(o.id);
    for (const as of o.assignments || []) {
      db.prepare(`INSERT INTO order_assignments
        (order_id, artisan_id, artisan_name, garment, labor_amount, artisan_paid)
        VALUES (?,?,?,?,?,?)`)
        .run(o.id, as.artisanId || null, as.artisanName || null, as.garment || null,
          num(as.laborAmount), num(as.artisanPaid));
    }
    // purana advance payment history me darj karo
    db.prepare('DELETE FROM customer_payments WHERE order_id=?').run(o.id);
    if (num(o.customerPaid) > 0) {
      db.prepare('INSERT INTO customer_payments (order_id, amount, note, date) VALUES (?,?,?,?)')
        .run(o.id, num(o.customerPaid), 'purana hisab (import)', (o.createdAt || '').slice(0, 10));
    }
  }
  db.exec('COMMIT');
  console.log('Seed ho gaya!');
  console.log(' karigar:', (data.artisans || []).length,
    '| grahak:', (data.customers || []).length,
    '| stock items:', (data.inventory || []).length,
    '| orders:', (data.orders || []).length);
} catch (e) {
  db.exec('ROLLBACK');
  console.error('Seed fail:', e.message);
  process.exit(1);
}
