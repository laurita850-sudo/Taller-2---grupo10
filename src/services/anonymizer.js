import { detectPii } from './piiDetector.js';
import { getOrCreateToken, revealMany } from './vault.js';

/** Tokens emitted by this vault: NAME_abc, EMAIL_abc, PHONE_abc */
function tokenPattern() {
  return /\b(?:NAME|EMAIL|PHONE)_[0-9a-f]+\b/g;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function findTokens(text) {
  return [...text.matchAll(tokenPattern())].map((match) => match[0]);
}

/**
 * Replace known tokens. When allowedTokens is set, every other token stays as-is
 * so a reply cannot reveal PII that was not part of this request.
 *
 * @param {string} text
 * @param {Map<string, string>} originals
 * @param {Set<string>} [allowedTokens]
 * @returns {string}
 */
export function restoreTokens(text, originals, allowedTokens) {
  return text.replace(tokenPattern(), (token) => {
    if (allowedTokens && !allowedTokens.has(token)) {
      return token;
    }
    return originals.get(token) ?? token;
  });
}

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
 * Pass allowedTokens to restore only the tokens produced for the current request.
 *
 * @param {string} anonymizedMessage
 * @param {{ allowedTokens?: Set<string> }} [options]
 * @returns {Promise<string>}
 */
export async function deanonymizeMessage(anonymizedMessage, options = {}) {
  const found = findTokens(anonymizedMessage);
  const allowedTokens = options.allowedTokens;
  const tokens = allowedTokens ? found.filter((token) => allowedTokens.has(token)) : found;
  const originals = await revealMany(tokens);

  return restoreTokens(anonymizedMessage, originals, allowedTokens);
}
