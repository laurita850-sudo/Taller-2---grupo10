import { Router } from 'express';
import { deanonymizeMessage } from '../services/anonymizer.js';

export const deanonymizeRouter = Router();

/**
 * POST /deanonymize
 * Body: { "anonymizedMessage": "text that contains NAME_/EMAIL_/PHONE_ tokens" }
 * Returns: { "message": "original text with PII restored from the vault" }
 */
deanonymizeRouter.post('/deanonymize', async (req, res, next) => {
  try {
    const { anonymizedMessage } = req.body ?? {};

    if (typeof anonymizedMessage !== 'string' || anonymizedMessage.trim() === '') {
      return res.status(400).json({
        error: 'Field "anonymizedMessage" is required and must be a non-empty string',
      });
    }

    const message = await deanonymizeMessage(anonymizedMessage);
    return res.status(200).json({ message });
  } catch (error) {
    next(error);
  }
});
