import { detectPii } from './piiDetector.js';
import { getOrCreateToken, revealMany } from './vault.js';

/** Tokens emitted by this vault: NAME_abc, EMAIL_abc, PHONE_abc */
const TOKEN_RE = /\b(?:NAME|EMAIL|PHONE)_[0-9a-f]+\b/g;

/**
 * Replace each detected PII span with a vault token persisted in MongoDB.
 *
 * @param {string} message
 * @returns {Promise<string>}
 */
export async function anonymizeMessage(message) {
  const spans = detectPii(message);
  let result = message;

  for (const span of spans) {
    const replacement = await getOrCreateToken(span.value, span.type);
    result = result.slice(0, span.start) + replacement + result.slice(span.end);
  }

  return result;
}

/**
 * Replace vault tokens with the original PII stored in MongoDB.
 * Unknown tokens are left unchanged (no mapping yet).
 *
 * @param {string} anonymizedMessage
 * @returns {Promise<string>}
 */
export async function deanonymizeMessage(anonymizedMessage) {
  const tokens = [...anonymizedMessage.matchAll(TOKEN_RE)].map((match) => match[0]);
  const originals = await revealMany(tokens);

  return anonymizedMessage.replace(TOKEN_RE, (token) => originals.get(token) ?? token);
}
