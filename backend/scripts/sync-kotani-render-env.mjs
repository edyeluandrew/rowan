/**
 * Sync Kotani Pay env vars from backend/.env.staging → Render staging service.
 *
 * Requires:
 *   RENDER_API_KEY   — from Render Dashboard → Account Settings → API Keys
 *   RENDER_SERVICE_ID — rowan-backend-staging service ID (from service URL in dashboard)
 *
 * Usage:
 *   set RENDER_API_KEY=rnd_...
 *   set RENDER_SERVICE_ID=srv_...
 *   node scripts/sync-kotani-render-env.mjs
 *
 * Without API credentials, prints the vars to paste manually in Render → Environment.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const stagingPath = path.join(backendDir, '.env.staging');

const KOTANI_KEYS = [
  'KOTANI_PAY_ENABLED',
  'KOTANI_PAY_BASE_URL',
  'KOTANI_PAY_API_KEY',
  'KOTANI_PAY_JWT',
  'KOTANI_PAY_WEBHOOK_SECRET',
  'KOTANI_PAY_SENDER_STELLAR',
  'KOTANI_PAY_CALLBACK_URL',
  'KOTANI_PAY_CORRIDORS',
];

function parseEnv(raw) {
  const map = new Map();
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    map.set(line.slice(0, eq).trim(), line.slice(eq + 1));
  }
  return map;
}

if (!fs.existsSync(stagingPath)) {
  console.error('Missing backend/.env.staging');
  process.exit(1);
}

const env = parseEnv(fs.readFileSync(stagingPath, 'utf8'));
const kotaniVars = KOTANI_KEYS.filter((k) => env.has(k) && env.get(k));

if (kotaniVars.length === 0) {
  console.error('No Kotani vars found in .env.staging');
  process.exit(1);
}

const apiKey = process.env.RENDER_API_KEY;
const serviceId = process.env.RENDER_SERVICE_ID;

async function listEnvVars() {
  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Render list env-vars failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return body;
}

async function upsertEnvVar(key, value) {
  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ envVar: { key, value } }),
  });

  if (res.status === 409) {
    const existing = await listEnvVars();
    const row = (existing || []).find((r) => r.envVar?.key === key);
    if (!row?.envVar?.id) {
      throw new Error(`Env var ${key} exists but could not resolve id for update`);
    }
    const put = await fetch(
      `https://api.render.com/v1/services/${serviceId}/env-vars/${row.envVar.id}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value }),
      },
    );
    if (!put.ok) {
      throw new Error(`Render update ${key} failed: ${put.status} ${await put.text()}`);
    }
    return 'updated';
  }

  if (!res.ok) {
    throw new Error(`Render create ${key} failed: ${res.status} ${await res.text()}`);
  }
  return 'created';
}

async function main() {
  console.log('Kotani vars in .env.staging:', kotaniVars.join(', '));

  if (!apiKey || !serviceId) {
    console.log('\nRender API credentials not set — paste these in rowan-backend-staging → Environment:\n');
    for (const key of kotaniVars) {
      console.log(`${key}=*** (${env.get(key).length} chars)`);
    }
    console.log('\nSet RENDER_API_KEY + RENDER_SERVICE_ID to sync automatically.');
    return;
  }

  for (const key of kotaniVars) {
    const action = await upsertEnvVar(key, env.get(key));
    console.log(`${key}: ${action}`);
  }

  console.log('\nDone. Trigger a manual deploy on Render (or push to deploy branch) to pick up env changes.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
