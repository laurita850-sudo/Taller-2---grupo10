import { Router } from 'express';
import { anonymizeMessage } from '../services/anonymizer.js';

export const anonymizeRouter = Router();

/**
 * POST /anonymize
 * Body: { "message": "text that may contain PII" }
 * Returns: { "anonymizedMessage": "..." }
 */
anonymizeRouter.post('/anonymize', async (req, res, next) => {
  try {
    const { message } = req.body ?? {};

    if (typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({
        error: 'Field "message" is required and must be a non-empty string',
      });
    }

    const anonymizedMessage = await anonymizeMessage(message);
    return res.status(200).json({ anonymizedMessage });
  } catch (error) {
    next(error);
  }
});
