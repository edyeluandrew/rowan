import { buildAndSignUsdcPayment, submitTransaction } from '../../wallet/utils/stellar'
import { verifyUsdcLock } from '../api/trader'

/**
 * Sign and send USDC from the trader's on-device Rowan wallet into Rowan escrow.
 */
export async function lockUsdcToEscrow({
  secretKey,
  escrowAddress,
  usdcAmount,
  memo,
  horizonUrl,
  transactionId,
}) {
  if (!secretKey || !escrowAddress || !memo || !(Number(usdcAmount) > 0)) {
    throw new Error('Missing escrow details for this order')
  }
  const signed = await buildAndSignUsdcPayment({
    sourceSecretKey: secretKey,
    destinationAddress: escrowAddress,
    usdcAmount,
    memo,
    horizonUrl,
  })
  await submitTransaction(signed, horizonUrl)
  return verifyUsdcLock(transactionId)
}
