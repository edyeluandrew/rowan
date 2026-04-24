import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { authTrader } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import verificationService from '../services/traderVerificationService.js';
import otpService from '../services/otpService.js';
import storageService from '../services/storageService.js';

const router = Router();

// Multer: memory storage (files buffered, then saved via storageService)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per file
});

/**
 * POST /api/v1/trader/onboarding/submit
 * Trader submits identity documents, Binance P2P info, and MoMo accounts.
 *
 * Multipart form fields:
 *   - legalName (text)
 *   - idDocumentType (text: NATIONAL_ID | PASSPORT)
 *   - idDocumentNumber (text)
 *   - binanceUsername (text)
 *   - binanceP2pTrades (text → int)
 *   - binanceCompletionRate (text → float)
 *   - momoAccounts (text → JSON array: [{ network, phoneNumber, accountName }])
 *
 * Files:
 *   - idFront (image)
 *   - idBack (image)
 *   - selfie (image)
 *   - p2pScreenshot (image)
 */
router.post(
  '/submit',
  authTrader,
  upload.fields([
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
    { name: 'p2pScreenshot', maxCount: 1 },
  ]),
  async (req, res, next) => {
    try {
      const traderId = req.traderId;
      const {
        legalName, idDocumentType, idDocumentNumber,
        binanceUsername, binanceP2pTrades, binanceCompletionRate,
        momoAccounts: momoAccountsJson,
      } = req.body;

      // Validate required text fields
      if (!legalName || !idDocumentType || !idDocumentNumber) {
        return res.status(400).json({ error: 'legalName, idDocumentType, and idDocumentNumber are required' });
      }
      if (!binanceUsername || !binanceP2pTrades || !binanceCompletionRate) {
        return res.status(400).json({ error: 'binanceUsername, binanceP2pTrades, and binanceCompletionRate are required' });
      }
      if (!['NATIONAL_ID', 'PASSPORT'].includes(idDocumentType)) {
        return res.status(400).json({ error: 'idDocumentType must be NATIONAL_ID or PASSPORT' });
      }

      // Validate files
      const files = req.files || {};
      if (!files.idFront?.[0] || !files.idBack?.[0] || !files.selfie?.[0] || !files.p2pScreenshot?.[0]) {
        return res.status(400).json({ error: 'All four files required: idFront, idBack, selfie, p2pScreenshot' });
      }

      // Save files to Supabase Storage
      const idDocumentFrontKey = await storageService.saveFile(files.idFront[0].buffer, files.idFront[0].originalname, traderId);
      const idDocumentBackKey = await storageService.saveFile(files.idBack[0].buffer, files.idBack[0].originalname, traderId);
      const selfieKey = await storageService.saveFile(files.selfie[0].buffer, files.selfie[0].originalname, traderId);
      const binanceScreenshotKey = await storageService.saveFile(files.p2pScreenshot[0].buffer, files.p2pScreenshot[0].originalname, traderId);

      // Submit documents to verification service
      const result = await verificationService.submitDocuments(traderId, {
        legalName,
        idDocumentType,
        idDocumentNumber,
        idDocumentFrontKey,
        idDocumentBackKey,
        selfieKey,
        binanceUsername,
        binanceP2pTrades: parseInt(binanceP2pTrades),
        binanceCompletionRate: parseFloat(binanceCompletionRate),
        binanceScreenshotKey,
      });

      // Register MoMo accounts if provided
      let momoAccounts = [];
      if (momoAccountsJson) {
        try {
          const parsed = JSON.parse(momoAccountsJson);
          for (const acct of parsed) {
            if (!acct.network || !acct.phoneNumber) continue;
            const phoneHash = crypto.createHash('sha256').update(acct.phoneNumber).digest('hex');
            const saved = await verificationService.addMomoAccount(traderId, {
              network: acct.network,
              phoneHash,
              accountName: acct.accountName || null,
              method: 'OTP',
            });
            momoAccounts.push(saved);
          }
        } catch (parseErr) {
          return res.status(400).json({ error: 'momoAccounts must be valid JSON array' });
        }
      }

      res.status(200).json({
        message: 'Documents submitted. Please confirm your agreement and verify your MoMo accounts.',
        verification: {
          status: result.verification.verification_status,
          warnings: result.warnings,
        },
        momoAccounts,
        nextSteps: [
          'POST /api/v1/trader/onboarding/confirm-agreement',
          'POST /api/v1/trader/onboarding/momo/request-otp',
          'POST /api/v1/trader/onboarding/momo/verify-otp',
        ],
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/trader/onboarding/confirm-agreement
 * Trader confirms they have read and accept the trader agreement.
 * Body: { agreementVersion: 'v1.0' }
 */
router.post(
  '/confirm-agreement',
  authTrader,
  validate(['agreementVersion']),
  async (req, res, next) => {
    try {
      const result = await verificationService.confirmAgreement(
        req.traderId,
        req.body.agreementVersion
      );
      res.json({
        message: 'Agreement accepted.',
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/trader/onboarding/momo/request-otp
 * Request an OTP for a specific MoMo account.
 * Body: { network, phoneNumber }
 *
 * The phone number is hashed for storage/lookup, but the raw number
 * is passed to Africa's Talking for SMS delivery.
 * In dev mode, the OTP is returned in the response for testing.
 */
router.post(
  '/momo/request-otp',
  authTrader,
  validate(['network', 'phoneNumber']),
  async (req, res, next) => {
    try {
      const { network, phoneNumber } = req.body;
      const phoneHash = crypto.createHash('sha256').update(phoneNumber).digest('hex');

      const result = await otpService.generateOtp(req.traderId, network, phoneHash, phoneNumber);
      res.json(result);
    } catch (err) {
      // Rate limit errors should be 429
      if (err.message.includes('already sent')) {
        return res.status(429).json({ error: err.message });
      }
      next(err);
    }
  }
);

/**
 * POST /api/v1/trader/onboarding/momo/verify-otp
 * Verify the OTP code for a MoMo account.
 * Body: { network, phoneNumber, code }
 */
router.post(
  '/momo/verify-otp',
  authTrader,
  validate(['network', 'phoneNumber', 'code']),
  async (req, res, next) => {
    try {
      const { network, phoneNumber, code } = req.body;
      const phoneHash = crypto.createHash('sha256').update(phoneNumber).digest('hex');

      const otpResult = await otpService.verifyOtp(req.traderId, network, phoneHash, code);

      if (!otpResult.verified) {
        return res.status(400).json({ error: otpResult.reason });
      }

      // Mark MoMo account as verified in the DB
      await verificationService.markMomoVerified(req.traderId, network, phoneHash);

      res.json({
        verified: true,
        message: `${network} account verified successfully.`,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/trader/onboarding/status
 * Get current verification status and pre-activation checklist.
 */
router.get('/status', authTrader, async (req, res, next) => {
  try {
    const checklist = await verificationService.getPreActivationChecklist(req.traderId);
    if (!checklist) {
      // No verification record yet — trader hasn't started onboarding.
      // Return 200 with NOT_STARTED so the frontend can route to the wizard
      // without producing a misleading 404 in the console.
      return res.json({
        traderId: req.traderId,
        verificationStatus: 'NOT_STARTED',
        status: 'NOT_STARTED',
        ready: false,
        blocking: 0,
        total: 0,
        checklist: [],
      });
    }
    res.json(checklist);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/trader/onboarding/agreement
 * Returns the current trader agreement text and version.
 */
router.get('/agreement', authTrader, async (req, res, next) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const version = (await import('../config/index.js')).default.traderVerification.agreementVersion;
    const agreementPath = path.resolve(`static/trader-agreement-${version}.md`);

    if (!fs.existsSync(agreementPath)) {
      return res.status(404).json({ error: 'Agreement file not found' });
    }

    const text = fs.readFileSync(agreementPath, 'utf8');
    res.json({ version, text });
  } catch (err) {
    next(err);
  }
});

export default router;
