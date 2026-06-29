import { Router } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import config from '../config/index.js';
import chatService from '../services/chatService.js';
import storageService from '../services/storageService.js';
import db from '../db/index.js';
import logger from '../utils/logger.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/** Accept user, trader, or admin JWT for order chat routes */
function authOrderChatAccess(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), config.jwt.secret, { algorithms: ['HS256'] });
    if (payload.role === 'user') {
      req.userId = payload.sub;
    } else if (payload.role === 'trader') {
      req.traderId = payload.sub;
    } else if (payload.role === 'admin') {
      req.adminId = payload.sub;
    } else {
      return res.status(403).json({ error: 'Not authorized for order chat' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** POST routes: wallet users and traders only */
function authOrderParticipant(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing auth token' });
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), config.jwt.secret, { algorithms: ['HS256'] });
    if (payload.role === 'user') {
      req.userId = payload.sub;
    } else if (payload.role === 'trader') {
      req.traderId = payload.sub;
    } else {
      return res.status(403).json({ error: 'Only wallet users and traders can access order chat' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * GET /api/v1/chat/:transactionId/messages
 */
router.get('/:transactionId/messages', authOrderChatAccess, async (req, res, next) => {
  try {
    const { before, limit } = req.query;
    const messages = await chatService.listMessages(
      req.params.transactionId,
      { userId: req.userId, traderId: req.traderId, adminId: req.adminId },
      { before: before || null, limit: parseInt(limit, 10) || 100 }
    );
    res.json({ success: true, data: messages });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

/**
 * POST /api/v1/chat/:transactionId/messages
 * Body: { message: string }
 */
router.post('/:transactionId/messages', authOrderParticipant, async (req, res, next) => {
  try {
    const row = await chatService.sendMessage(
      req.params.transactionId,
      { userId: req.userId, traderId: req.traderId },
      { message: req.body.message, type: 'text' }
    );
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

/**
 * POST /api/v1/chat/:transactionId/messages/image
 * Multipart: file (payment proof screenshot)
 */
router.post(
  '/:transactionId/messages/image',
  authOrderParticipant,
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Image file is required' });
      }

      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Only JPEG, PNG, or WebP images are allowed' });
      }

      await chatService.assertParticipant(req.params.transactionId, {
        userId: req.userId,
        traderId: req.traderId,
      });

      const ext = req.file.originalname?.split('.').pop() || 'jpg';
      const storageKey = await storageService.saveChatImage(
        req.file.buffer,
        `proof.${ext}`,
        req.params.transactionId
      );

      const signedUrl = await storageService.getSignedUrl(storageKey, 60 * 60 * 24 * 7);

      const row = await chatService.sendMessage(
        req.params.transactionId,
        { userId: req.userId, traderId: req.traderId },
        { message: 'Payment proof image', type: 'image', imageUrl: signedUrl }
      );

      res.status(201).json({ success: true, data: { ...row, image_url: signedUrl } });
    } catch (err) {
      if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
      logger.error('[Chat] Image upload failed:', err.message);
      next(err);
    }
  }
);

export default router;
