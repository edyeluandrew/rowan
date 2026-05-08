/**
 * Setup Test Traders with Diverse Payout Settings
 * 
 * Creates 4 test traders:
 * 1. trader-mtb-airtel (MTB, Airtel) - Most flexible
 * 2. trader-airtel-only (Airtel only)
 * 3. trader-mtn-only (MTN only)
 * 4. trader-mpesa-only (Mpesa only)
 * 
 * Usage: node setup-diverse-test-traders.mjs
 */

import db from './src/db/index.js';
import logger from './src/utils/logger.js';

const TEST_TRADERS = [
  {
    phone: '+256701000001',
    name: 'Trader MTB+Airtel',
    methods: ['MTB', 'Airtel'],
    float_kes: 50000,
    daily_limit_kes: 100000,
  },
  {
    phone: '+256701000002',
    name: 'Trader Airtel Only',
    methods: ['Airtel'],
    float_kes: 30000,
    daily_limit_kes: 80000,
  },
  {
    phone: '+256701000003',
    name: 'Trader MTN Only',
    methods: ['MTN'],
    float_kes: 25000,
    daily_limit_kes: 50000,
  },
  {
    phone: '+256701000004',
    name: 'Trader Mpesa Only',
    methods: ['Mpesa'],
    float_kes: 40000,
    daily_limit_kes: 90000,
  },
];

async function setupTraders() {
  try {
    console.log('🚀 Creating diverse test traders...\n');

    for (const traderData of TEST_TRADERS) {
      // 1. Create trader user
      const userResult = await db.query(
        `INSERT INTO users (phone, name, user_type, created_at, updated_at)
         VALUES ($1, $2, 'trader', NOW(), NOW())
         ON CONFLICT (phone) DO UPDATE SET name = $2, updated_at = NOW()
         RETURNING id, phone, name`,
        [traderData.phone, traderData.name]
      );
      const userId = userResult.rows[0].id;
      const userPhone = userResult.rows[0].phone;

      console.log(`✅ User created/updated: ${userPhone} (${traderData.name})`);

      // 2. Create trader record
      const traderResult = await db.query(
        `INSERT INTO traders (user_id, trust_score, daily_volume, created_at, updated_at)
         VALUES ($1, 100, 0, NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE SET daily_volume = 0, updated_at = NOW()
         RETURNING id`,
        [userId]
      );
      const traderId = traderResult.rows[0].id;

      console.log(`   Trader ID: ${traderId}`);

      // 3. Create payout settings for each method
      for (const method of traderData.methods) {
        const payoutResult = await db.query(
          `INSERT INTO trader_payout_settings (
            trader_id,
            payout_method,
            account_holder,
            account_number,
            bank_code,
            float_kes,
            daily_limit_kes,
            is_active,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
          ON CONFLICT (trader_id, payout_method) DO UPDATE SET
            float_kes = $6,
            daily_limit_kes = $7,
            is_active = true,
            updated_at = NOW()
          RETURNING id`,
          [
            traderId,
            method,
            traderData.name,
            method === 'Mpesa' ? traderData.phone : `${method}-${traderData.phone}`,
            method === 'Mpesa' ? 'MPESA' : method.toUpperCase(),
            traderData.float_kes,
            traderData.daily_limit_kes,
          ]
        );
        const settingId = payoutResult.rows[0].id;
        console.log(`   ✓ ${method}: ${traderData.float_kes} KES float, ${traderData.daily_limit_kes} KES daily limit (ID: ${settingId})`);
      }

      console.log('');
    }

    // 4. Query to show all traders
    const allTraders = await db.query(
      `SELECT 
        t.id,
        u.phone,
        u.name,
        t.trust_score,
        COUNT(DISTINCT ps.payout_method) as payout_methods,
        STRING_AGG(DISTINCT ps.payout_method, ', ') as methods,
        SUM(ps.float_kes) as total_float
       FROM traders t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN trader_payout_settings ps ON ps.trader_id = t.id AND ps.is_active
       WHERE u.user_type = 'trader'
       GROUP BY t.id, u.phone, u.name, t.trust_score
       ORDER BY u.created_at DESC
       LIMIT 10`
    );

    console.log('📊 Active Traders:\n');
    console.table(allTraders.rows);

    // 5. Show payout settings details
    const settings = await db.query(
      `SELECT 
        ps.id,
        u.name,
        ps.payout_method,
        ps.float_kes,
        ps.daily_limit_kes,
        ps.is_active
       FROM trader_payout_settings ps
       JOIN traders t ON t.id = ps.trader_id
       JOIN users u ON u.id = t.user_id
       WHERE ps.is_active
       ORDER BY u.created_at DESC`
    );

    console.log('\n🎯 Payout Settings Details:\n');
    console.table(settings.rows);

    console.log('\n✅ Setup complete!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

setupTraders();
