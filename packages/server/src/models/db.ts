import pg from 'pg';
import dotenv from 'dotenv';
import { dbLogger } from '../lib/logger.js';

dotenv.config({ path: '../../.env' });

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'abetahta',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  dbLogger.error({ err }, 'Beklenmeyen pool hatası');
});

pool.on('connect', () => {
  dbLogger.info('PostgreSQL bağlantısı kuruldu');
});

// Yardımcı: Tek sorgu
export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),

  // Transaction helper
  async transaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Bağlantı testi
  async testConnection(): Promise<boolean> {
    try {
      const result = await pool.query('SELECT NOW()');
      dbLogger.info({ time: result.rows[0].now }, 'Bağlantı testi başarılı');
      return true;
    } catch (err) {
      dbLogger.error({ err }, 'Bağlantı testi başarısız');
      return false;
    }
  },
};
