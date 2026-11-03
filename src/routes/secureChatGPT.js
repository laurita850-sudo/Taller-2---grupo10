import { Router } from 'express';
import { secureChat } from '../services/secureChat.js';

/**
 * @param {{ secureChat?: (prompt: string) => Promise<string> }} [dependencies]
 */
export function createSecureChatRouter(dependencies = {}) {
  const router = Router();
  const run = dependencies.secureChat ?? secureChat;

  /**
   * POST /secureChatGPT
   * Body: { "prompt": "text that may contain PII" }
   * Returns: { "response": "model reply with this request's PII restored" }
   */
  router.post('/secureChatGPT', async (req, res, next) => {
    try {
      const { prompt } = req.body ?? {};

      if (typeof prompt !== 'string' || prompt.trim() === '') {
        return res.status(400).json({
          error: 'Field "prompt" is required and must be a non-empty string',
        });
      }

      const response = await run(prompt);
      return res.status(200).json({ response });
    } catch (error) {
      if (error?.code === 'OPENAI_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'OpenAI is not configured' });
      }
      if (error?.code === 'OPENAI_UPSTREAM') {
        console.error('OpenAI request failed');
        return res.status(502).json({ error: 'The model request failed' });
      }
      next(error);
    }
  });

  return router;
}

export const secureChatGPTRouter = createSecureChatRouter();
