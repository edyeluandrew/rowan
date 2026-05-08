/**
 * Setup Diverse Test Traders from .env Configuration
 * 
 * Reads TEST_TRADERS_CONFIG from .env file and creates traders with:
 * - Email/password authentication
 * - Diverse payout methods (MTB, Airtel, MTN, Mpesa)
 * - 50,000,000 float per network per trader
 * 
 * Usage: node setup-test-traders-from-env.mjs
 */

import db from './src/db/index.js';
import logger from './src/utils/logger.js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Simple password hash (md5 for testing - NOT for production!)
function hashPassword(password) {
  return crypto.createHash('md5').update(password).digest('hex');
}

// Parse traders from .env format
function parseTraderConfig() {
  const config = process.env.TEST_TRADERS_CONFIG;
  const floatPerNetwork = parseInt(process.env.TEST_TRADERS_FLOAT_PER_NETWORK || '50000000', 10);

  if (!config) {
    throw new Error('TEST_TRADERS_CONFIG not found in .env');
  }

  const traders = [];
  const parts = config.split('|');

  for (let i = 0; i < parts.length; i += 4) {
    if (i + 3 >= parts.length) break;

    traders.push({
      email: parts[i].trim(),
      password: parts[i + 1].trim(),
      name: parts[i + 2].trim(),
      methods: parts[i + 3].trim().split(',').map(m => m.trim()),
      float: floatPerNetwork,
    });
  }

  return traders;
}

async function setupTraders() {
  try {
    const traders = parseTraderConfig();

    console.log(`🚀 Creating ${traders.length} test traders from .env config...\n`);

    for (const traderData of traders) {
      // 1. Hash password
      const passwordHash = hashPassword(traderData.password);

      // 2. Create trader user with email and password
      const userResult = await db.query(
        `INSERT INTO users (email, name, user_type, password_hash, created_at, updated_at)
         VALUES ($1, $2, 'trader', $3, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE SET name = $2, password_hash = $3, updated_at = NOW()
         RETURNING id, email, name`,
        [traderData.email, traderData.name, passwordHash]
      );
      const userId = userResult.rows[0].id;

      console.log(`✅ User created/updated:`);
      console.log(`   Email:    ${traderData.email}`);
      console.log(`   Password: ${traderData.password}`);
      console.log(`   Name:     ${traderData.name}`);

      // 3. Create trader record
      const traderResult = await db.query(
        `INSERT INTO traders (user_id, trust_score, daily_volume, created_at, updated_at)
         VALUES ($1, 100, 0, NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET daily_volume = 0, trust_score = 100, updated_at = NOW()
         RETURNING id`,
        [userId]
      );
      const traderId = traderResult.rows[0].id;

      console.log(`   Trader ID: ${traderId}`);

      // 4. Create payout settings for each method with 50M float
      for (const method of traderData.methods) {
        const payoutResult = await db.query(
          `INSERT INTO trader_payout_settings (
            trader_id,
            payout_method,
            account_holder,
            account_number,
            bank_code,
            float_xlm,
            daily_limit_xlm,
            is_active,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
          ON CONFLICT (trader_id, payout_method) DO UPDATE SET
            float_xlm = $6,
            daily_limit_xlm = $7,
            is_active = true,
            updated_at = NOW()
          RETURNING id`,
          [
            traderId,
            method,
            traderData.name,
            `${method}-account`,
            method.toUpperCase(),
            traderData.float,
            traderData.float * 2, // daily limit = 2x float
          ]
        );
        const settingId = payoutResult.rows[0].id;
        console.log(`   ✓ ${method}: ${traderData.float} stroops float (50M XLM equivalent)`);
      }

      console.log('');
    }

    // Show summary
    const allTraders = await db.query(
      `SELECT 
        u.email,
        u.name,
        COUNT(DISTINCT ps.payout_method) as payout_count,
        STRING_AGG(DISTINCT ps.payout_method, ', ') as methods,
        SUM(ps.float_xlm) as total_float_xlm
       FROM traders t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN trader_payout_settings ps ON ps.trader_id = t.id AND ps.is_active
       WHERE u.email LIKE '%@test.com'
       GROUP BY u.id, u.email, u.name
       ORDER BY u.created_at DESC`
    );

    console.log('📊 Setup Summary:\n');
    console.table(allTraders.rows);

    console.log('\n✅ All test traders ready!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

setupTraders();
