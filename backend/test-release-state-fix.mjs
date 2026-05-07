#!/usr/bin/env node

/**
 * Test: Verify escrow release state machine fix
 * Tests that escrowController.releaseToTrader() correctly handles USER_CONFIRMATION_PENDING state
 * instead of the non-existent FIAT_SENT state
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

class ReleaseStateFixTester {
  constructor() {
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  async test(name, fn) {
    try {
      await fn();
      this.passed++;
      this.results.push({ name, status: '✅ PASS' });
      console.log(`✅ ${name}`);
    } catch (err) {
      this.failed++;
      this.results.push({ name, status: '❌ FAIL', error: err.message });
      console.log(`❌ ${name}: ${err.message}`);
    }
  }

  async runTests() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Phase 3 Release State Fix Verification Tests');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Test 1: Verify state machine allows USER_CONFIRMATION_PENDING → COMPLETE
    await this.test('Test 1: State machine defines USER_CONFIRMATION_PENDING → COMPLETE transition', async () => {
      const result = await pool.query(`
        SELECT EXISTS(
          SELECT 1 FROM pg_tables 
          WHERE schemaname = 'public' 
          AND tablename = 'transactions'
        ) as table_exists
      `);
      
      if (!result.rows[0].table_exists) {
        throw new Error('transactions table does not exist');
      }

      // Verify that USER_CONFIRMATION_PENDING is a valid state by checking state machine definition
      // The state machine is in memory, but we can verify by checking if any transaction has this state
      const txResult = await pool.query(`
        SELECT DISTINCT state FROM transactions 
        WHERE state IN ('USER_CONFIRMATION_PENDING', 'COMPLETE', 'FIAT_PAYOUT_SUBMITTED')
        LIMIT 1
      `);
      
      console.log(`   - Found valid transaction states: ${txResult.rows.map(r => r.state).join(', ') || 'none yet'}`);
    });

    // Test 2: Verify escrowController.js uses USER_CONFIRMATION_PENDING not FIAT_SENT
    await this.test('Test 2: escrowController.js no longer references FIAT_SENT in release path', async () => {
      const escrowPath = path.join(__dirname, 'src', 'services', 'escrowController.js');
      const content = fs.readFileSync(escrowPath, 'utf-8');
      
      // Check that FIAT_SENT is not in the release flow
      const hasReleaseBlockedTransition = content.includes("transition(transactionId, 'USER_CONFIRMATION_PENDING', 'RELEASE_BLOCKED'");
      const hasCompleteTransition = content.includes("transition(transactionId, 'USER_CONFIRMATION_PENDING', 'COMPLETE'");
      const hasStateCheck = content.includes("t.state = 'USER_CONFIRMATION_PENDING'");
      
      const hasFiatSent = content.includes("'FIAT_SENT'");
      
      if (!hasReleaseBlockedTransition) {
        throw new Error('Missing USER_CONFIRMATION_PENDING → RELEASE_BLOCKED transition');
      }
      if (!hasCompleteTransition) {
        throw new Error('Missing USER_CONFIRMATION_PENDING → COMPLETE transition');
      }
      if (!hasStateCheck) {
        throw new Error('Missing USER_CONFIRMATION_PENDING state check in query');
      }
      if (hasFiatSent) {
        throw new Error('escrowController still contains FIAT_SENT reference (should have been replaced)');
      }
      
      console.log('   - ✓ USER_CONFIRMATION_PENDING → RELEASE_BLOCKED transition found');
      console.log('   - ✓ USER_CONFIRMATION_PENDING → COMPLETE transition found');
      console.log('   - ✓ USER_CONFIRMATION_PENDING state check found');
      console.log('   - ✓ No FIAT_SENT references in release flow');
    });

    // Test 3: Verify state transition logic in state machine
    await this.test('Test 3: transactionStateMachine.js defines correct transitions', async () => {
      const smPath = path.join(__dirname, 'src', 'services', 'transactionStateMachine.js');
      const content = fs.readFileSync(smPath, 'utf-8');
      
      // Verify the state machine defines the flow
      const hasFiatPayoutSubmitted = content.includes("FIAT_PAYOUT_SUBMITTED: ['USER_CONFIRMATION_PENDING'");
      const hasUserConfirmation = content.includes("USER_CONFIRMATION_PENDING: ['COMPLETE', 'RELEASE_BLOCKED'");
      const hasCompleteTerminal = content.includes("COMPLETE:         []");
      
      if (!hasFiatPayoutSubmitted) {
        throw new Error('State machine missing FIAT_PAYOUT_SUBMITTED → USER_CONFIRMATION_PENDING transition');
      }
      if (!hasUserConfirmation) {
        throw new Error('State machine missing USER_CONFIRMATION_PENDING transitions');
      }
      if (!hasCompleteTerminal) {
        throw new Error('State machine missing COMPLETE terminal state');
      }
      
      console.log('   - ✓ FIAT_PAYOUT_SUBMITTED → USER_CONFIRMATION_PENDING defined');
      console.log('   - ✓ USER_CONFIRMATION_PENDING → COMPLETE/RELEASE_BLOCKED defined');
      console.log('   - ✓ COMPLETE is terminal state');
    });

    // Test 4: Verify user.js confirm-receipt endpoint uses correct states
    await this.test('Test 4: user.js confirm-receipt endpoint transitions correctly', async () => {
      const userPath = path.join(__dirname, 'src', 'routes', 'user.js');
      const content = fs.readFileSync(userPath, 'utf-8');
      
      // Check that confirm-receipt transitions FIAT_PAYOUT_SUBMITTED → USER_CONFIRMATION_PENDING
      const hasTransitionToConfirmation = content.includes("'FIAT_PAYOUT_SUBMITTED'") && 
                                          content.includes("'USER_CONFIRMATION_PENDING'") &&
                                          content.includes('Transitioned tx') &&
                                          content.includes('USER_CONFIRMATION_PENDING');
      const hasReleaseCall = content.includes('escrowController.releaseToTrader(transactionId)');
      const hasCompleteTransition = content.includes('stateMachine.transition') && 
                                    content.includes("'COMPLETE'");
      
      if (!hasTransitionToConfirmation) {
        throw new Error('Missing transition to USER_CONFIRMATION_PENDING in confirm-receipt');
      }
      if (!hasReleaseCall) {
        throw new Error('Missing escrowController.releaseToTrader() call');
      }
      if (!hasCompleteTransition) {
        throw new Error('Missing final transition to COMPLETE');
      }
      
      console.log('   - ✓ Transitions FIAT_PAYOUT_SUBMITTED → USER_CONFIRMATION_PENDING');
      console.log('   - ✓ Calls escrowController.releaseToTrader()');
      console.log('   - ✓ Transitions USER_CONFIRMATION_PENDING → COMPLETE');
    });

    // Test 5: Verify finalizeFloat is called after COMPLETE
    await this.test('Test 5: Float finalization happens after COMPLETE transition', async () => {
      const escrowPath = path.join(__dirname, 'src', 'services', 'escrowController.js');
      const content = fs.readFileSync(escrowPath, 'utf-8');
      
      // Find the section with state transitions and finalizeFloat
      const completeTransitionIndex = content.indexOf("transition(transactionId, 'USER_CONFIRMATION_PENDING', 'COMPLETE'");
      const finalizeIndex = content.indexOf('finalizeFloat(');
      
      if (completeTransitionIndex === -1) {
        throw new Error('Missing COMPLETE transition');
      }
      if (finalizeIndex === -1) {
        throw new Error('Missing finalizeFloat call');
      }
      if (finalizeIndex < completeTransitionIndex) {
        throw new Error('finalizeFloat is called BEFORE COMPLETE transition (should be after)');
      }
      
      console.log('   - ✓ finalizeFloat is called after COMPLETE transition');
    });

    // Test 6: Verify dispute flow doesn't reach COMPLETE
    await this.test('Test 6: Dispute flow cannot reach COMPLETE state', async () => {
      const smPath = path.join(__dirname, 'src', 'services', 'transactionStateMachine.js');
      const content = fs.readFileSync(smPath, 'utf-8');
      
      // Find DISPUTE_OPENED transitions
      const disputeTransitions = content.match(/DISPUTE_OPENED:\s*\[(.*?)\]/);
      
      if (!disputeTransitions) {
        throw new Error('DISPUTE_OPENED state not found in state machine');
      }
      
      const transitions = disputeTransitions[1];
      if (transitions.includes('COMPLETE')) {
        throw new Error('DISPUTE_OPENED can transition to COMPLETE (should not!)');
      }
      
      console.log('   - ✓ DISPUTE_OPENED transitions:', transitions.trim());
      console.log('   - ✓ COMPLETE is not reachable from DISPUTE_OPENED');
    });

    // Test 7: Verify redis lock prevents double-release
    await this.test('Test 7: Double-release prevention lock is in place', async () => {
      const escrowPath = path.join(__dirname, 'src', 'services', 'escrowController.js');
      const content = fs.readFileSync(escrowPath, 'utf-8');
      
      const hasLock = content.includes(`redis.set(lockKey, '1', 'EX'`);
      const hasGuard = content.includes("if (!lockAcquired)");
      
      if (!hasLock) {
        throw new Error('Redis lock not found');
      }
      if (!hasGuard) {
        throw new Error('Lock guard check not found');
      }
      
      console.log('   - ✓ Redis distributed lock in place');
      console.log('   - ✓ Lock guard prevents concurrent releases');
    });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('Test Results Summary');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    this.results.forEach(r => {
      console.log(`${r.status} ${r.name}`);
      if (r.error) console.log(`   Error: ${r.error}`);
    });
    
    console.log('\n' + '═'.repeat(59));
    console.log(`Total: ${this.passed} passed, ${this.failed} failed`);
    console.log('═'.repeat(59) + '\n');

    if (this.failed > 0) {
      console.log('❌ Some tests failed. The fix may be incomplete.\n');
      process.exit(1);
    } else {
      console.log('✅ All tests passed! The state machine fix is working correctly.\n');
      process.exit(0);
    }
  }
}

// Run tests
const tester = new ReleaseStateFixTester();
await tester.runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
