#!/usr/bin/env node
/**
 * Instawards Phase 1 — SEP-10 evidence helper (testnet only).
 *
 * Usage (from backend/):
 *   set SEP10_EVIDENCE_SECRET=S...your_testnet_secret
 *   node scripts/sep10EvidenceFlow.mjs
 *
 * Optional: pass a existing G-address to reuse an account
 *   node scripts/sep10EvidenceFlow.mjs GCLFWZD56SRB4HCDN3MPGDFPDUC6DEC3UGVXAV53NQVXDMKXUXFFHIOG
 *
 * Prints signed XDR + masked JWT. Never commit secrets.
 */
import StellarSdk from '@stellar/stellar-sdk';

const API = process.env.API_URL || 'https://rowan-1-9crb.onrender.com';
const secret = process.env.SEP10_EVIDENCE_SECRET;

if (!secret || !secret.startsWith('S')) {
  console.error('Set SEP10_EVIDENCE_SECRET to your testnet secret (S...) in this terminal only.');
  console.error('Example (PowerShell): $env:SEP10_EVIDENCE_SECRET="S..."');
  process.exit(1);
}

const kp = StellarSdk.Keypair.fromSecret(secret);
const account = process.argv[2]?.startsWith('G') ? process.argv[2] : kp.publicKey();

if (account !== kp.publicKey()) {
  console.error('Public account argument does not match SEP10_EVIDENCE_SECRET keypair.');
  process.exit(1);
}

const chRes = await fetch(`${API}/api/v1/auth/challenge?account=${account}`);
const chBody = await chRes.json();
if (chRes.status !== 200) {
  console.error('Challenge failed:', chRes.status, chBody);
  process.exit(1);
}

const tx = new StellarSdk.Transaction(chBody.transaction, chBody.networkPassphrase);
tx.sign(kp);
const signedXdr = tx.toXDR();

console.log('\n=== SIGNED XDR (paste into POST body "transaction" field) ===\n');
console.log(signedXdr);
console.log('\n=== Length check ===');
console.log('unsigned:', chBody.transaction.length, 'signed:', signedXdr.length);

const phoneHash = `instawards-phase1-${Date.now()}`;
let res = await fetch(`${API}/api/v1/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ transaction: signedXdr, phoneHash }),
});

let body = await res.json();
if (res.status === 409) {
  res = await fetch(`${API}/api/v1/auth/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: signedXdr }),
  });
  body = await res.json();
}

console.log('\n=== API RESULT ===');
console.log('status:', res.status);
if (body.token) {
  console.log('token:', body.token.slice(0, 24) + '...[REDACTED]');
  console.log('user:', body.user?.id || body.sub || '(login)');
} else {
  console.log('error:', body.error || body);
}

console.log('\nScreenshot POST response with token masked for 05-sep10-post-jwt-masked.png\n');
