import { anonymizeMessage, deanonymizeMessage, findTokens } from './anonymizer.js';
import { OpenAICompletionClient } from './openaiService.js';

/**
 * Anonymize a prompt, send only that text to the model, and restore
 * the tokens that this request itself produced.
 *
 * @param {string} prompt
 * @param {{
 *   anonymize?: (message: string) => Promise<string>,
 *   complete?: (anonymizedPrompt: string) => Promise<string>,
 *   deanonymize?: (text: string, options: { allowedTokens: Set<string> }) => Promise<string>,
 * }} [dependencies]
 * @returns {Promise<string>}
 */
export async function secureChat(prompt, dependencies = {}) {
  const anonymize = dependencies.anonymize ?? anonymizeMessage;
  const complete = dependencies.complete ?? ((text) => new OpenAICompletionClient().complete(text));
  const deanonymize = dependencies.deanonymize ?? deanonymizeMessage;

  const anonymizedPrompt = await anonymize(prompt);
  const modelReply = await complete(anonymizedPrompt);

  if (typeof modelReply !== 'string') {
    const error = new Error('The model request failed');
    error.code = 'OPENAI_UPSTREAM';
    throw error;
  }

  const allowedTokens = new Set(findTokens(anonymizedPrompt));
  return deanonymize(modelReply, { allowedTokens });
}
