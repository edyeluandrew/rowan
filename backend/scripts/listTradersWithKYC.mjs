import db from '../src/db/index.js';

const result = await db.query(
  `SELECT 
     t.id, t.name, t.email, t.verification_status,
     tv.legal_name, tv.id_document_type, tv.binance_username,
     tv.agreement_check, tv.momo_check,
     tv.created_at as kyc_submitted_at
   FROM traders t
   LEFT JOIN trader_verifications tv ON t.id = tv.trader_id
   ORDER BY t.created_at DESC`
);

console.log('\n📊 Traders with KYC Data:\n');

if (result.rows.length === 0) {
  console.log('❌ No traders found\n');
} else {
  result.rows.forEach((row, i) => {
    console.log(`${i + 1}. ${row.name}`);
    console.log(`   Email: ${row.email}`);
    console.log(`   Status: ${row.verification_status}`);
    console.log(`   KYC Legal Name: ${row.legal_name || 'NOT SUBMITTED'}`);
    console.log(`   ID Type: ${row.id_document_type || 'N/A'}`);
    console.log(`   Binance User: ${row.binance_username || 'N/A'}`);
    console.log(`   Agreement: ${row.agreement_check || 'PENDING'}`);
    console.log(`   MoMo: ${row.momo_check || 'PENDING'}`);
    console.log(`   KYC Submitted: ${row.kyc_submitted_at ? new Date(row.kyc_submitted_at).toLocaleString() : 'Never'}\n`);
  });
}

process.exit(0);
