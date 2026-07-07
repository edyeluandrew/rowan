import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import { sendTestnetUsdc } from '../services/testnetFaucet.js';
import logger from '../utils/logger.js';

const router = Router();

const faucetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many testnet funding requests. Try again later.' },
});

/**
 * POST /api/v1/testnet/fund-usdc
 * Body: { publicKey: "G..." }
 *
 * Testnet pilot only — sends starter USDC so wallets are ready to test immediately.
 * No auth required (wallet may not be registered yet); rate-limited by IP + pubkey cooldown.
 */
router.post('/fund-usdc', faucetLimiter, async (req, res) => {
  if (config.stellar.network !== 'testnet') {
    return res.status(404).json({ error: 'Not available on mainnet' });
  }

  const { publicKey } = req.body || {};
  if (!publicKey || typeof publicKey !== 'string') {
    return res.status(400).json({ error: 'publicKey is required' });
  }

  try {
    const result = await sendTestnetUsdc(publicKey.trim());

    if (!result) {
      return res.status(503).json({
        error: 'Testnet faucet is not configured',
        hint: 'Set TESTNET_FAUCET_SECRET_KEY or MARKET_MAKER_SECRET_KEY on the backend',
      });
    }

    if (result.skipped === 'already_has_usdc') {
      return res.json({
        skipped: true,
        usdcAmount: result.usdcAmount,
        publicKey: result.publicKey,
      });
    }

    return res.json({
      usdcAmount: result.usdcAmount,
      publicKey: result.publicKey,
      txHash: result.txHash,
      source: result.source,
      issuer: result.issuer,
    });
  } catch (err) {
    logger.warn(`[TestnetFaucet] fund-usdc failed for ${publicKey}: ${err.message}`);
    const status = err.message.includes('recently') ? 429 : 400;
    return res.status(status).json({ error: err.message || 'Could not send test USDC' });
  }
});

export default router;
