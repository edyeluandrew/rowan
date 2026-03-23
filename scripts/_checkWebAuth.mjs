import * as StellarSdk from '@stellar/stellar-sdk';
console.log('WebAuth keys:', Object.keys(StellarSdk.WebAuth || {}));
console.log('buildChallengeTx:', typeof StellarSdk.WebAuth?.buildChallengeTx);
console.log('readChallengeTx:', typeof StellarSdk.WebAuth?.readChallengeTx);
console.log('verifyChallengeTxSigners:', typeof StellarSdk.WebAuth?.verifyChallengeTxSigners);
console.log('verifyChallengeTxThreshold:', typeof StellarSdk.WebAuth?.verifyChallengeTxThreshold);
