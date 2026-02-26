import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { pool } from '../../src/models/db.js';

async function runMigrations() {
  console.log('[Migration] Başlatılıyor...');

  try {
    // 1. Ana schema (docs/database-schema.sql) — CREATE IF NOT EXISTS ile guvenli
    const schemaPath = resolve(import.meta.dirname, '../../../../docs/database-schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf-8');
    await pool.query(schemaSql);
    console.log('[Migration] Ana schema uygulandi.');

    // 2. Ek migration dosyalarini sirali calistir
    const migrationsDir = resolve(import.meta.dirname, '../../migrations');
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // 001_, 002_, 003_ ... sirasi

    for (const file of files) {
      const filePath = resolve(migrationsDir, file);
      const sql = readFileSync(filePath, 'utf-8');
      await pool.query(sql);
      console.log(`[Migration] ${file} uygulandi.`);
    }

    console.log(`[Migration] Toplam ${files.length} migration dosyasi basariyla uygulandi.`);
  } catch (err) {
    console.error('[Migration] HATA:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
