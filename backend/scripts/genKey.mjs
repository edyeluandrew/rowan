import('@stellar/stellar-sdk').then(({ Keypair }) => {
  const kp = Keypair.random();
  console.log('PUBLIC=' + kp.publicKey());
  console.log('SECRET=' + kp.secret());
});
