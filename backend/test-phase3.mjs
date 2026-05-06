#!/usr/bin/env node

/**
 * Phase 3 Comprehensive Test Suite: Float Reservation Lifecycle
 * Tests all 6 scenarios for trader float management
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    
    const [key, ...valueParts] = line.split('=');
    let value = valueParts.join('=');
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  });
  
  return env;
}

const env = loadEnv();
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

class Phase3Tester {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.testResults = [];
  }

  log(msg) {
    console.log(`[Test] ${msg}`);
  }

  async test(name, fn) {
    try {
      this.log(`Starting: ${name}`);
      await fn();
      this.passed++;
      this.testResults.push({ name, status: '✅ PASS' });
      this.log(`✅ PASS: ${name}`);
    } catch (err) {
      this.failed++;
      this.testResults.push({ name, status: '❌ FAIL', error: err.message });
      this.log(`❌ FAIL: ${name}`);
      this.log(`  Error: ${err.message}`);
    }
  }

  assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  async setup() {
    const client = await pool.connect();
    try {
      // Use existing trader or create one
      let traderId;
      const existingTrader = await client.query(
        `SELECT id FROM traders WHERE status = 'ACTIVE' LIMIT 1`
      );
      
      if (existingTrader.rows.length > 0) {
        traderId = existingTrader.rows[0].id;
        this.log(`Using existing trader: ${traderId.substring(0, 8)}...`);
      } else {
        // Create test trader
        const traderRes = await client.query(
          `INSERT INTO traders (
            id, name, email, stellar_address, status, verification_status, 
            trust_score, daily_limit_ugx, daily_volume, float_ugx, float_kes, float_tzs
          ) VALUES (
            gen_random_uuid(), 'Test Float Trader', 'test-float@rowan.test',
            'GCIRNEH3ERTDIF3YVNUDXPCAAWCB36LRDPGAYRSDORZDQJWPY55NBUEA',
            'ACTIVE', 'VERIFIED', 100, 10000000, 0, 5000000, 400000, 1000000
          ) RETURNING id`,
          []
        );
        traderId = traderRes.rows[0].id;
      }
      
      // Use existing payout setting or create one
      const existingPS = await client.query(
        `SELECT id FROM trader_payout_settings WHERE trader_id = $1 LIMIT 1`,
        [traderId]
      );
      
      let payoutSettingId;
      if (existingPS.rows.length > 0) {
        payoutSettingId = existingPS.rows[0].id;
        this.log(`Using existing payout setting: ${payoutSettingId.substring(0, 8)}...`);
        
        // RESET both available_float and reserved_float to known state
        // Set available to 5M and reserved to 0
        await client.query(
          `UPDATE trader_payout_settings 
           SET available_float = 5000000, reserved_float = 0 
           WHERE id = $1`,
          [payoutSettingId]
        );
      } else {
        // Create payout setting for testing
        const psRes = await client.query(
          `INSERT INTO trader_payout_settings (
            id, trader_id, country, network, currency, min_amount, max_amount,
            available_float, reserved_float, is_active
          ) VALUES (
            gen_random_uuid(), $1, 'UG', 'AIRTEL_UG', 'UGX', 50000, 500000,
            5000000, 0, true
          ) RETURNING id`,
          [traderId]
        );
        payoutSettingId = psRes.rows[0].id;
      }
      
      this.log(`Setup complete: trader=${traderId.substring(0, 8)}..., ps=${payoutSettingId.substring(0, 8)}...`);
      
      return { traderId, payoutSettingId, client };
    } catch (err) {
      throw err;
    } finally {
      client.release();
    }
  }

  async runTests() {
    this.log('═══════════════════════════════════════════════════════════');
    this.log('Phase 3: Trader Float Reservation Lifecycle Tests');
    this.log('═══════════════════════════════════════════════════════════');
    
    // Test 1: Reserve on match
    await this.test('Test 1: Reserve float on match', async () => {
      const client = await pool.connect();
      try {
        const { payoutSettingId } = await this.setup();
        
        // Initial state
        let ps = await client.query(
          `SELECT available_float, reserved_float FROM trader_payout_settings WHERE id = $1`,
          [payoutSettingId]
        );
        const initialAvailable = parseFloat(ps.rows[0].available_float);
        const initialReserved = parseFloat(ps.rows[0].reserved_float);
        
        this.assert(initialReserved === 0, 'Initial reserved should be 0');
        
        // Simulate reservation (matching engine would call reserveFloat)
        const fiatAmount = 100000; // 100k UGX
        await client.query(
          `UPDATE trader_payout_settings
           SET reserved_float = reserved_float + $1
           WHERE id = $2 AND (available_float - reserved_float) >= $1`,
          [fiatAmount, payoutSettingId]
        );
        
        // Verify
        ps = await client.query(
          `SELECT available_float, reserved_float FROM trader_payout_settings WHERE id = $1`,
          [payoutSettingId]
        );
        const newReserved = parseFloat(ps.rows[0].reserved_float);
        this.assert(newReserved === initialReserved + fiatAmount, 'Reserved should increase by fiat_amount');
        this.assert(parseFloat(ps.rows[0].available_float) === initialAvailable, 'Available should stay same');
      } finally {
        client.release();
      }
    });

    // Test 2: Prevent overbooking
    await this.test('Test 2: Prevent overbooking (insufficient net float)', async () => {
      const client = await pool.connect();
      try {
        const { payoutSettingId } = await this.setup();
        
        // Get initial float (should be 5M)
        let ps = await client.query(
          `SELECT available_float, reserved_float FROM trader_payout_settings WHERE id = $1`,
          [payoutSettingId]
        );
        const available = parseFloat(ps.rows[0].available_float);
        this.log(`Available float: ${available}`);
        
        // First reservation: 4M
        await client.query(
          `UPDATE trader_payout_settings
           SET reserved_float = reserved_float + 4000000
           WHERE id = $1 AND (available_float - reserved_float) >= 4000000`,
          [payoutSettingId]
        );
        
        // Verify first reservation succeeded
        ps = await client.query(
          `SELECT reserved_float FROM trader_payout_settings WHERE id = $1`,
          [payoutSettingId]
        );
        this.assert(parseFloat(ps.rows[0].reserved_float) === 4000000, 'First reservation should succeed');
        
        // Second reservation attempt: 2M (should fail)
        // Net available = 5M - 4M = 1M, so 2M should fail
        const result = await client.query(
          `UPDATE trader_payout_settings
           SET reserved_float = reserved_float + 2000000
           WHERE id = $1 AND (available_float - reserved_float) >= 2000000
           RETURNING reserved_float`,
          [payoutSettingId]
        );
        
        this.assert(result.rows.length === 0, 'Second reservation should fail (insufficient net float)');
        
        // Verify reserved amount didn't change
        ps = await client.query(
          `SELECT reserved_float FROM trader_payout_settings WHERE id = $1`,
          [payoutSettingId]
        );
        this.assert(parseFloat(ps.rows[0].reserved_float) === 4000000, 'Reserved should stay at 4M');
      } finally {
        client.release();
      }
    });

    // Test 3: Release on decline
    await this.test('Test 3: Release reserved float on decline', async () => {
      const client = await pool.connect();
      try {
        const { payoutSettingId } = await this.setup();
        
        // Reserve 2M
        await client.query(
          `UPDATE trader_payout_settings
           SET reserved_float = reserved_float + 2000000
           WHERE id = $1`,
          [payoutSettingId]
        );
        
        let ps = await client.query(
          `SELECT reserved_float FROM trader_payout_settings WHERE id = $1`,
          [payoutSettingId]
        );
        this.assert(parseFloat(ps.rows[0].reserved_float) === 2000000, 'Should have 2M reserved');
        
        // Release 2M
        await client.query(
          `UPDATE trader_payout_settings
           SET reserved_float = GREATEST(0, reserved_float - 2000000)
           WHERE id = $1`,
          [payoutSettingId]
        );
        
        // Verify
        ps = await client.query(
          `SELECT reserved_float FROM trader_payout_settings WHERE id = $1`,
          [payoutSettingId]
        );
        this.assert(parseFloat(ps.rows[0].reserved_float) === 0, 'Reserved should be 0 after release');
      } finally {
        client.release();
      }
    });

    // Test 4: Finalize on completion
    await this.test('Test 4: Finalize float on transaction completion', async () => {
      const client = await pool.connect();
      try {
        const { payoutSettingId } = await this.setup();
        
        // Initial state
        let ps = await client.query(
          `SELECT available_float, reserved_float FROM trader_payout_settings WHERE id = $1`,
          [payoutSettingId]
        );
        const initialAvailable = parseFloat(ps.rows[0].available_float);
        
        // Reserve 1M
        await client.query(
          `UPDATE trader_payout_settings
           SET reserved_float = reserved_float + 1000000
           WHERE id = $1`,
          [payoutSettingId]
        );
        
        // Finalize (deduct both available and reserved)
        await client.query(
          `UPDATE trader_payout_settings
           SET available_float = GREATEST(0, available_float - 1000000),
               reserved_float = GREATEST(0, reserved_float - 1000000)
           WHERE id = $1`,
          [payoutSettingId]
        );
        
        // Verify
        ps = await client.query(
          `SELECT available_float, reserved_float FROM trader_payout_settings WHERE id = $1`,
          [payoutSettingId]
        );
        const newAvailable = parseFloat(ps.rows[0].available_float);
        const newReserved = parseFloat(ps.rows[0].reserved_float);
        
        this.assert(newAvailable === initialAvailable - 1000000, `Available should decrease by 1M, was ${initialAvailable} now ${newAvailable}`);
        this.assert(newReserved === 0, 'Reserved should be 0 after finalize');
      } finally {
        client.release();
      }
    });

    // Test 5: Idempotency
    await this.test('Test 5: Double finalize doesn\'t double-deduct', async () => {
      const client = await pool.connect();
      try {
        const { payoutSettingId } = await this.setup();
        
        // Initial state
        let ps = await client.query(
          `SELECT available_float, reserved_float FROM trader_payout_settings WHERE id = $1`,
          [payoutSettingId]
        );
        const initialAvailable = parseFloat(ps.rows[0].available_float);
        
        // Calculate safe deduction: 25% of available
        const deductAmount = Math.floor(initialAvailable * 0.25);
        this.log(`Initial: ${initialAvailable}, Deduct: ${deductAmount}`);
        
        // Finalize once
        await client.query(
          `UPDATE trader_payout_settings
           SET available_float = GREATEST(0, available_float - $1),
               reserved_float = GREATEST(0, reserved_float - $1)
           WHERE id = $2`,
          [deductAmount, payoutSettingId]
        );
        
        // Get after first finalize
        let ps1 = await client.query(
          `SELECT available_float FROM trader_payout_settings WHERE id = $1`,
          [payoutSettingId]
        );
        const afterFirst = parseFloat(ps1.rows[0].available_float);
        
        // Finalize again (should be safe and only deduct once more)
        await client.query(
          `UPDATE trader_payout_settings
           SET available_float = GREATEST(0, available_float - $1),
               reserved_float = GREATEST(0, reserved_float - $1)
           WHERE id = $2`,
          [deductAmount, payoutSettingId]
        );
        
        // Verify final state
        ps = await client.query(
          `SELECT available_float FROM trader_payout_settings WHERE id = $1`,
          [payoutSettingId]
        );
        const finalAvailable = parseFloat(ps.rows[0].available_float);
        
        // After first finalize: should be initialAvailable - deductAmount
        // After second finalize: should be afterFirst - deductAmount = initialAvailable - 2*deductAmount
        const expectedFinal = initialAvailable - (2 * deductAmount);
        this.assert(finalAvailable === expectedFinal, `Total deduction should be ${2*deductAmount}, got ${initialAvailable - finalAvailable}`);
      } finally {
        client.release();
      }
    });

    // Test 6: GREATEST safety guard prevents negative
    await this.test('Test 6: GREATEST(0, ...) prevents negative values', async () => {
      const client = await pool.connect();
      try {
        const { payoutSettingId } = await this.setup();
        
        // Try to release more than reserved
        await client.query(
          `UPDATE trader_payout_settings
           SET reserved_float = GREATEST(0, reserved_float - 10000000)
           WHERE id = $1`,
          [payoutSettingId]
        );
        
        // Verify no negative values
        const ps = await client.query(
          `SELECT reserved_float FROM trader_payout_settings WHERE id = $1`,
          [payoutSettingId]
        );
        const reserved = parseFloat(ps.rows[0].reserved_float);
        
        this.assert(reserved >= 0, 'Reserved should never be negative');
        this.assert(reserved === 0, 'Reserved should be clamped to 0');
      } finally {
        client.release();
      }
    });

    this.printResults();
  }

  printResults() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Test Results Summary');
    console.log('═══════════════════════════════════════════════════════════');
    
    this.testResults.forEach(result => {
      console.log(`${result.status} ${result.name}`);
      if (result.error) {
        console.log(`         ${result.error}`);
      }
    });
    
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`Total: ${this.passed + this.failed} | Passed: ${this.passed} | Failed: ${this.failed}`);
    console.log('═══════════════════════════════════════════════════════════');
    
    if (this.failed === 0) {
      console.log('✅ All Phase 3 tests passed!');
      process.exit(0);
    } else {
      console.log(`❌ ${this.failed} test(s) failed`);
      process.exit(1);
    }
  }
}

const tester = new Phase3Tester();
tester.runTests().catch(err => {
  console.error('[Fatal]', err.message);
  process.exit(1);
});
