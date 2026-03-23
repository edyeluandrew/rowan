import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  // Ensure migration tracking table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  // Get already-applied migrations
  const applied = await db.query(`SELECT filename FROM schema_migrations`);
  const appliedSet = new Set(applied.rows.map(r => r.filename));

  let ranCount = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`[Migration] Skipping (already applied): ${file}`);
      continue;
    }

    console.log(`[Migration] Running: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    try {
      await db.query(sql);
      await db.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
      console.log(`[Migration] ✓ ${file}`);
      ranCount++;
    } catch (err) {
      console.error(`[Migration] ✗ ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log(`[Migration] Complete — ${ranCount} new, ${files.length - ranCount} skipped`);
  await db.pool.end();
  process.exit(0);
}

runMigrations();
