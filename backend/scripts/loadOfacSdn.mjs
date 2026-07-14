/**
 * Loads the US Treasury OFAC SDN (Specially Designated Nationals) list into the
 * sanctioned_entities table (source = 'OFAC_SDN'). The list is public + free.
 *
 * Usage:
 *   node scripts/loadOfacSdn.mjs                 # download live from treasury.gov
 *   node scripts/loadOfacSdn.mjs ./sdn.csv ./alt.csv   # load from local files
 *
 * Re-runnable: upserts by (source, external_id). Safe to schedule (e.g. weekly).
 */
import dotenv from 'dotenv';
import fs from 'fs';
import pg from 'pg';

dotenv.config();

const SDN_URL = 'https://www.treasury.gov/ofac/downloads/sdn.csv';
const ALT_URL = 'https://www.treasury.gov/ofac/downloads/alt.csv';

function normalizeName(input) {
  if (!input) return '';
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Minimal CSV parser handling quoted fields + embedded commas/quotes. */
function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = (v) => {
  const s = (v ?? '').trim();
  return s === '-0-' || s === '' ? null : s;
};

async function getText(sourceArg, url) {
  if (sourceArg) {
    console.log(`  reading local file ${sourceArg}`);
    return fs.readFileSync(sourceArg, 'utf8');
  }
  console.log(`  downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function main() {
  const [sdnArg, altArg] = process.argv.slice(2);

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // 1) Alt names -> alias map keyed by ent_num
  const aliasMap = new Map();
  try {
    const altText = await getText(altArg, ALT_URL);
    for (const cols of parseCsv(altText)) {
      const entNum = clean(cols[0]);
      const altName = clean(cols[3]);
      if (!entNum || !altName) continue;
      if (!aliasMap.has(entNum)) aliasMap.set(entNum, []);
      aliasMap.get(entNum).push(altName);
    }
    console.log(`  parsed aliases for ${aliasMap.size} entities`);
  } catch (e) {
    console.warn(`  ⚠ could not load alt names (${e.message}) — continuing without aliases`);
  }

  // 2) SDN primary rows
  const sdnText = await getText(sdnArg, SDN_URL);
  const sdnRows = parseCsv(sdnText);
  console.log(`  parsed ${sdnRows.length} SDN rows`);

  let upserted = 0;
  for (const cols of sdnRows) {
    const entNum = clean(cols[0]);
    const name = clean(cols[1]);
    if (!entNum || !name) continue;
    const sdnType = (clean(cols[2]) || '').toLowerCase();
    const program = clean(cols[3]);
    const remarks = clean(cols[11]);

    const entityType = sdnType === 'individual' ? 'INDIVIDUAL'
      : sdnType === 'vessel' || sdnType === 'aircraft' ? 'VESSEL'
      : 'ENTITY';
    const aliases = aliasMap.get(entNum) || [];
    const programs = program ? [program] : [];

    await client.query(
      `INSERT INTO sanctioned_entities
         (source, external_id, entity_type, full_name, normalized_name, aliases, programs, remarks)
       VALUES ('OFAC_SDN', $1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL
       DO UPDATE SET entity_type = EXCLUDED.entity_type,
                     full_name = EXCLUDED.full_name,
                     normalized_name = EXCLUDED.normalized_name,
                     aliases = EXCLUDED.aliases,
                     programs = EXCLUDED.programs,
                     remarks = EXCLUDED.remarks,
                     is_active = TRUE,
                     updated_at = NOW()`,
      [entNum, entityType, name, normalizeName(name), aliases, programs, remarks]
    );
    upserted++;
    if (upserted % 1000 === 0) console.log(`  ...${upserted} upserted`);
  }

  const count = await client.query(`SELECT COUNT(*)::int AS c FROM sanctioned_entities WHERE source = 'OFAC_SDN' AND is_active = TRUE`);
  console.log(`\n✓ Done. Upserted ${upserted} SDN entries. Active OFAC_SDN rows: ${count.rows[0].c}`);

  await client.end();
}

main().catch((err) => {
  console.error('✗ OFAC load failed:', err.message);
  process.exit(1);
});
