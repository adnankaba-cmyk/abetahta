const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: 'postgresql://postgres:abetahta_dev_2024@localhost:5432/abetahta' });

async function fix() {
  const hash = await bcrypt.hash('admin123', 10);
  console.log('Generated hash:', hash);
  const res = await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email, password_hash', [hash, 'adnan.kaba@abeerp.com']);
  console.log('Updated:', res.rows[0].email);
  console.log('Hash starts:', res.rows[0].password_hash.substring(0, 20));
  const ok = await bcrypt.compare('admin123', res.rows[0].password_hash);
  console.log('Verify admin123:', ok);
  await pool.end();
}

fix().catch(e => console.error(e));
