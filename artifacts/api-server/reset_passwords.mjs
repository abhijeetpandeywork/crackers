#!/usr/bin/env node
// Reset admin password hash directly in the database
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://rathinam_user:rathinam_pass@127.0.0.1:5432/rathinam'
});

async function reset() {
  await client.connect();
  
  const adminHash = await bcrypt.hash('Admin@12345', 10);
  const managerHash = await bcrypt.hash('Manager@12345', 10);
  const cashierHash = await bcrypt.hash('admin123', 10);
  const warehouseHash = await bcrypt.hash('Warehouse@12345', 10);
  
  await client.query(`UPDATE users SET password_hash = $1 WHERE username = 'admin'`, [adminHash]);
  await client.query(`UPDATE users SET password_hash = $1 WHERE username = 'manager'`, [managerHash]);
  await client.query(`UPDATE users SET password_hash = $1 WHERE username = 'cashier'`, [cashierHash]);
  await client.query(`UPDATE users SET password_hash = $1 WHERE username = 'warehouse'`, [warehouseHash]);
  
  const result = await client.query(`SELECT username, role FROM users`);
  console.log('Users updated:', result.rows);
  
  await client.end();
  console.log('Done!');
}

reset().catch(e => { console.error(e); process.exit(1); });
