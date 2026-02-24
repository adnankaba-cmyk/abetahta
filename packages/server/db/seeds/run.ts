import bcrypt from 'bcryptjs';
import { pool } from '../../src/models/db.js';

async function runSeeds() {
  console.log('[Seed] Başlatılıyor...');

  try {
    const passwordHash = await bcrypt.hash('admin123', 12);

    // Admin kullanıcı
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO UPDATE SET password_hash = $2
       RETURNING id`,
      ['adnan.kaba@abeerp.com', passwordHash, 'Adnan Kaba']
    );

    const userId = userResult.rows[0].id;

    // Demo proje
    const projectResult = await pool.query(
      `INSERT INTO projects (name, description, owner_id, color)
       VALUES ('Demo Proje', 'İlk test projesi', $1, '#3B82F6')
       RETURNING id`,
      [userId]
    );

    const projectId = projectResult.rows[0].id;

    // Proje üyeliği
    await pool.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT DO NOTHING`,
      [projectId, userId]
    );

    // Demo tahta
    const boardResult = await pool.query(
      `INSERT INTO boards (project_id, name, created_by)
       VALUES ($1, 'Ana Tahta', $2)
       RETURNING id`,
      [projectId, userId]
    );

    const boardId = boardResult.rows[0].id;

    // Demo elemanlar
    const demoElements = [
      {
        type: 'note',
        x: 100, y: 100, width: 250, height: 180,
        fill_color: '#FEF3C7',
        content: { title: 'Hoş Geldiniz!', body: 'Bu ilk tahtanız. Elemanları sürükleyerek düzenleyebilirsiniz.', color: 'yellow' },
      },
      {
        type: 'flowchart_node',
        x: 500, y: 100, width: 200, height: 80,
        fill_color: '#DBEAFE',
        content: { label: 'Başlangıç', node_type: 'start' },
      },
      {
        type: 'flowchart_node',
        x: 500, y: 250, width: 200, height: 80,
        fill_color: '#F3F4F6',
        content: { label: 'Veri İşle', node_type: 'process' },
      },
      {
        type: 'flowchart_node',
        x: 500, y: 400, width: 200, height: 80,
        fill_color: '#D1FAE5',
        content: { label: 'Bitiş', node_type: 'end' },
      },
      {
        type: 'checklist',
        x: 100, y: 350, width: 280, height: 200,
        fill_color: '#FFFFFF',
        content: {
          title: 'Yapılacaklar',
          items: [
            { text: 'Proje yapısını incele', done: true },
            { text: 'npm install çalıştır', done: false },
            { text: 'Docker compose başlat', done: false },
            { text: 'İlk tahtayı oluştur', done: false },
          ],
        },
      },
    ];

    for (const el of demoElements) {
      await pool.query(
        `INSERT INTO elements (board_id, type, x, y, width, height, fill_color, content, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [boardId, el.type, el.x, el.y, el.width, el.height, el.fill_color, JSON.stringify(el.content), userId]
      );
    }

    // Demo bağlantılar (flowchart okları)
    const nodes = await pool.query(
      `SELECT id, content->>'node_type' as node_type FROM elements WHERE board_id = $1 AND type = 'flowchart_node' ORDER BY y`,
      [boardId]
    );

    if (nodes.rows.length >= 3) {
      await pool.query(
        `INSERT INTO connections (board_id, source_id, target_id) VALUES ($1, $2, $3)`,
        [boardId, nodes.rows[0].id, nodes.rows[1].id]
      );
      await pool.query(
        `INSERT INTO connections (board_id, source_id, target_id) VALUES ($1, $2, $3)`,
        [boardId, nodes.rows[1].id, nodes.rows[2].id]
      );
    }

    console.log('[Seed] Demo veriler oluşturuldu.');
    console.log(`  Admin: adnan.kaba@abeerp.com / admin123`);
    console.log(`  Proje: ${projectId}`);
    console.log(`  Tahta: ${boardId}`);
  } catch (err) {
    console.error('[Seed] HATA:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSeeds();
