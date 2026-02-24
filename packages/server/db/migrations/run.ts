import { readFileSync } from 'fs';
import { resolve } from 'path';
import { pool } from '../../src/models/db.js';

async function runMigrations() {
  console.log('[Migration] Başlatılıyor...');

  try {
    // Monorepo yapısından root docs/ klasöre erişmek için
    const schemaPath = resolve(import.meta.dirname, '../../../../docs/database-schema.sql');
    const sql = readFileSync(schemaPath, 'utf-8');

    await pool.query(sql);
    console.log('[Migration] Schema başarıyla uygulandı.');
  } catch (err) {
    console.error('[Migration] HATA:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
