import OpenAI from 'openai';

const DEFAULT_MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = [
  'Respondes al usuario en el mismo idioma de su mensaje.',
  'El mensaje puede contener tokens de privacidad con la forma NAME_<hex>, EMAIL_<hex> o PHONE_<hex>.',
  'Cuando te refieras a esas personas o datos, copia el token exactamente, carácter por carácter.',
  'No intentes adivinar el nombre, el correo ni el teléfono reales.',
].join(' ');

/**
 * Chat completion client. The caller must pass already-anonymized text.
 */
export class OpenAICompletionClient {
  /**
   * @param {{ client?: { chat: { completions: { create: Function } } }, apiKey?: string, model?: string }} [options]
   */
  constructor(options = {}) {
    this.client = options.client ?? null;
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  }

  /**
   * @param {string} anonymizedPrompt
   * @returns {Promise<string>}
   */
  async complete(anonymizedPrompt) {
    if (!this.client && this.apiKey.trim() === '') {
      const error = new Error('OPENAI_API_KEY is required');
      error.code = 'OPENAI_NOT_CONFIGURED';
      throw error;
    }

    const client = this.client ?? new OpenAI({ apiKey: this.apiKey, timeout: 30_000 });

    try {
      const completion = await client.chat.completions.create({
        model: this.model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: anonymizedPrompt },
        ],
      });
      const text = completion.choices?.[0]?.message?.content;
      if (typeof text !== 'string' || text.trim() === '') {
        const error = new Error('The model request failed');
        error.code = 'OPENAI_UPSTREAM';
        throw error;
      }
      return text;
    } catch (error) {
      if (error?.code === 'OPENAI_UPSTREAM' || error?.code === 'OPENAI_NOT_CONFIGURED') {
        throw error;
      }
      // Do not attach the SDK error: it can echo the prompt.
      const wrapped = new Error('The model request failed');
      wrapped.code = 'OPENAI_UPSTREAM';
      throw wrapped;
    }
  }
}
