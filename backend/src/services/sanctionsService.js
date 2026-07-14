/**
 * Sanctions / PEP screening.
 *
 * Screens a name (KYC applicant or payout counterparty) against a local list of
 * blocked entities (OFAC SDN + an internal blocklist) using fuzzy name matching.
 * A match at/above the configured threshold is a HIT and hard-blocks the action.
 *
 * Provider is pluggable: the default 'local' matcher runs over sanctioned_entities.
 * A paid provider (ComplyAdvantage, Chainalysis, Refinitiv) can be slotted in via
 * config.screening.provider without changing callers — see `providers` below.
 *
 * IMPORTANT (compliance note): name-only matching produces false positives.
 * Screening FLAGS; a human clears/overrides via the admin screening queue.
 */
import db from '../db/index.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

/* ── Name normalization ─────────────────────────────────────── */

export function normalizeName(input) {
  if (!input) return '';
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')    // punctuation -> space
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── String similarity (Jaro-Winkler) ───────────────────────── */

function jaro(s1, s2) {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (
    (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3
  );
}

function jaroWinkler(s1, s2) {
  const j = jaro(s1, s2);
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return j + prefix * 0.1 * (1 - j);
}

/**
 * Similarity that is robust to word reordering (e.g. "Andrew Edyelu" vs
 * "Edyelu Andrew"): the max of raw Jaro-Winkler and token-sorted Jaro-Winkler,
 * with a boost when one name's tokens are fully contained in the other's.
 */
export function nameSimilarity(a, b) {
  if (!a || !b) return 0;
  const raw = jaroWinkler(a, b);

  const ta = a.split(' ').filter(Boolean).sort();
  const tb = b.split(' ').filter(Boolean).sort();
  const sorted = jaroWinkler(ta.join(' '), tb.join(' '));

  const setA = new Set(ta);
  const setB = new Set(tb);
  const smaller = setA.size <= setB.size ? setA : setB;
  const larger = smaller === setA ? setB : setA;
  let contained = 0;
  for (const tok of smaller) if (larger.has(tok)) contained++;
  const containment = smaller.size ? contained / smaller.size : 0;
  // Full containment of a multi-token name is a strong signal.
  const containmentScore = smaller.size >= 2 && containment === 1 ? 0.92 : 0;

  return Math.max(raw, sorted, containmentScore);
}

/* ── Entity cache ────────────────────────────────────────────── */

let _cache = null;
let _cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadEntities(force = false) {
  if (!force && _cache && Date.now() - _cacheLoadedAt < CACHE_TTL_MS) return _cache;
  const result = await db.query(
    `SELECT id, source, entity_type, full_name, normalized_name, aliases, programs, countries, dob
       FROM sanctioned_entities WHERE is_active = TRUE`
  );
  // Precompute the set of normalized candidate strings (name + aliases) per entity.
  _cache = result.rows.map((row) => ({
    ...row,
    candidates: [row.normalized_name, ...(row.aliases || []).map(normalizeName)].filter(Boolean),
  }));
  _cacheLoadedAt = Date.now();
  logger.info(`[Sanctions] Loaded ${_cache.length} active sanctioned entities into cache`);
  return _cache;
}

export function invalidateCache() {
  _cache = null;
  _cacheLoadedAt = 0;
}

/* ── Providers (pluggable) ───────────────────────────────────── */

const providers = {
  /** Built-in matcher over sanctioned_entities. */
  async local(normalizedQuery, { threshold }) {
    const entities = await loadEntities();
    let best = { score: 0, entity: null, matchedName: null };
    for (const entity of entities) {
      for (const cand of entity.candidates) {
        const score = nameSimilarity(normalizedQuery, cand);
        if (score > best.score) best = { score, entity, matchedName: entity.full_name };
        if (best.score >= 0.999) break;
      }
    }
    return {
      match: best.score >= threshold,
      score: Number(best.score.toFixed(4)),
      matchedName: best.entity ? best.matchedName : null,
      matchedSource: best.entity ? best.entity.source : null,
      matchedEntityId: best.entity ? best.entity.id : null,
    };
  },

  /**
   * Stub for a paid provider. Wire the real API here (fetch + map response).
   * Deliberately throws so a misconfiguration fails loudly rather than silently
   * passing everyone through unscreened.
   */
  async external() {
    throw new Error(
      `Screening provider "${config.screening.provider}" is not implemented. ` +
      `Set SCREENING_PROVIDER=local or add the adapter in sanctionsService.js.`
    );
  },
};

/* ── Public API ──────────────────────────────────────────────── */

/**
 * Screen a name and (by default) persist the check to screening_checks.
 * @returns {Promise<{match, score, matchedName, matchedSource, matchedEntityId, checkId, threshold, skipped?}>}
 */
export async function screen({
  name,
  dob = null,
  country = null,
  subjectType = 'MANUAL',
  subjectRef = null,
  userId = null,
  persist = true,
}) {
  const threshold = config.screening.threshold;
  const normalizedQuery = normalizeName(name);

  if (!config.screening.enabled) {
    return { match: false, score: 0, matchedName: null, matchedSource: null, matchedEntityId: null, threshold, skipped: 'disabled' };
  }
  if (!normalizedQuery) {
    return { match: false, score: 0, matchedName: null, matchedSource: null, matchedEntityId: null, threshold, skipped: 'empty_name' };
  }

  const runner = config.screening.provider === 'local' ? providers.local : providers.external;
  const outcome = await runner(normalizedQuery, { threshold });
  const result = outcome.match ? 'HIT' : 'CLEAR';

  let checkId = null;
  if (persist) {
    try {
      const ins = await db.query(
        `INSERT INTO screening_checks
           (subject_type, subject_ref, user_id, query_name, normalized_query, query_dob,
            query_country, result, top_score, matched_entity_id, matched_name, matched_source,
            decision)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [
          subjectType, subjectRef, userId, name, normalizedQuery, dob, country,
          result, outcome.score, outcome.matchedEntityId, outcome.matchedName,
          outcome.matchedSource, outcome.match ? 'BLOCKED' : 'CLEARED',
        ]
      );
      checkId = ins.rows[0].id;
    } catch (err) {
      logger.error('[Sanctions] Failed to persist screening_check', { error: err.message });
    }
  }

  if (outcome.match) {
    logger.warn(`[Sanctions] HIT (${outcome.score}) for "${name}" vs "${outcome.matchedName}" [${outcome.matchedSource}] — subject=${subjectType}:${subjectRef || 'n/a'}`);
  }

  return { ...outcome, result, checkId, threshold };
}

/** Record an admin decision to override a HIT (false positive). */
export async function recordOverride(checkId, adminId, reason) {
  await db.query(
    `UPDATE screening_checks SET decision = 'OVERRIDDEN', decided_by = $1, override_reason = $2
      WHERE id = $3`,
    [adminId, reason, checkId]
  );
}

/** Add an entity to the internal blocklist. */
export async function addInternalEntity({ fullName, entityType = 'INDIVIDUAL', aliases = [], programs = [], countries = [], dob = null, remarks = null, addedBy = null }) {
  const normalized = normalizeName(fullName);
  const result = await db.query(
    `INSERT INTO sanctioned_entities
       (source, entity_type, full_name, normalized_name, aliases, programs, countries, dob, remarks, added_by)
     VALUES ('INTERNAL', $1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, source, entity_type, full_name, created_at`,
    [entityType, fullName, normalized, aliases, programs, countries, dob, remarks, addedBy]
  );
  invalidateCache();
  return result.rows[0];
}

/** Soft-remove an internal entity (only INTERNAL rows can be removed via admin). */
export async function deactivateEntity(id) {
  const result = await db.query(
    `UPDATE sanctioned_entities SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1 AND source = 'INTERNAL'
      RETURNING id`,
    [id]
  );
  invalidateCache();
  return result.rowCount > 0;
}

export default {
  screen,
  recordOverride,
  addInternalEntity,
  deactivateEntity,
  invalidateCache,
  normalizeName,
  nameSimilarity,
};
