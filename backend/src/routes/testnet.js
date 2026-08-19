import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import { sendTestnetUsdc, activateWalletAccount } from '../services/testnetFaucet.js';
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
 * POST /api/v1/testnet/activate-account
 * Body: { publicKey: "G..." }
 *
 * Sponsors account + USDC reserves so the user cannot withdraw that XLM.
 * Returns an XDR the wallet co-signs. No auth — called during wallet create.
 */
router.post('/activate-account', faucetLimiter, async (req, res) => {
  if (config.stellar.network !== 'testnet') {
    return res.status(404).json({ error: 'Not available on mainnet' });
  }

  const { publicKey } = req.body || {};
  if (!publicKey || typeof publicKey !== 'string') {
    return res.status(400).json({ error: 'publicKey is required' });
  }

  try {
    const result = await activateWalletAccount(publicKey.trim());

    if (!result) {
      return res.status(503).json({
        error: 'Wallet activation is not configured',
        hint: 'Set WALLET_ACTIVATION_SECRET_KEY on the backend',
      });
    }

    return res.json(result);
  } catch (err) {
    logger.warn(`[WalletActivate] failed for ${publicKey}: ${err.message}`);
    const status = /in progress/i.test(err.message) ? 429 : 400;
    return res.status(status).json({ error: err.message || 'Could not activate wallet' });
  }
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
        hint: 'Set WALLET_ACTIVATION_SECRET_KEY on the backend',
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
