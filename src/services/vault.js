import crypto from 'node:crypto';
import { VaultEntry } from '../models/VaultEntry.js';

const SECRET = process.env.VAULT_SECRET ?? 'poc-only-not-for-production';
const TOKEN_LENGTH = 12;

const TOKEN_PREFIX = {
  name: 'NAME',
  email: 'EMAIL',
  phone: 'PHONE',
};

/**
 * Normalize PII before hashing / lookup so equivalent values share a token.
 * @param {string} value
 * @param {'name' | 'email' | 'phone'} type
 * @returns {string}
 */
function normalize(value, type) {
  const trimmed = value.trim();

  if (type === 'email') {
    return trimmed.toLowerCase();
  }

  if (type === 'phone') {
    let digits = trimmed.replace(/\D/g, '');

    // +57 3152319157 and 3152319157 must share the same token.
    if (digits.startsWith('57') && digits.length === 12 && digits[2] === '3') {
      digits = digits.slice(2);
    }

    return digits;
  }

  return trimmed.toLocaleLowerCase('es-CO');
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

/**
 * Return a deterministic alphanumeric token for the given PII.
 * Reads/writes MongoDB so the mapping survives process restarts.
 *
 * @param {string} original Raw PII as it appeared in the message
 * @param {'name' | 'email' | 'phone'} type
 * @returns {Promise<string>} prefixed lowercase hex token
 */
export async function getOrCreateToken(original, type) {
  const lookupKey = `${type}:${normalize(original, type)}`;
  const existing = await VaultEntry.findOne({ lookupKey }).lean();

  if (existing) {
    return existing.token;
  }

  const prefix = TOKEN_PREFIX[type];
  const digest = crypto.createHmac('sha256', SECRET).update(lookupKey).digest('hex');

  let length = TOKEN_LENGTH;
  let token = `${prefix}_${digest.slice(0, length)}`;

  // Extremely rare: another PII already owns this short token.
  while (await VaultEntry.exists({ token })) {
    length += 2;
    token = `${prefix}_${digest.slice(0, length)}`;
  }

  try {
    await VaultEntry.create({
      originalValue: original,
      token,
      type: prefix,
      lookupKey,
    });
    return token;
  } catch (error) {
    // Concurrent request inserted the same PII first — reuse that token.
    if (isDuplicateKeyError(error)) {
      const raced = await VaultEntry.findOne({ lookupKey }).lean();
      if (raced) {
        return raced.token;
      }
    }
    throw error;
  }
}

/**
 * Look up the original PII for a single token.
 * @param {string} token
 * @returns {Promise<string | null>}
 */
export async function reveal(token) {
  const entry = await VaultEntry.findOne({ token }).lean();
  return entry?.originalValue ?? null;
}

/**
 * Batch-resolve tokens to original values (used by deanonymize).
 * @param {string[]} tokens
 * @returns {Promise<Map<string, string>>}
 */
export async function revealMany(tokens) {
  const unique = [...new Set(tokens)];
  if (unique.length === 0) {
    return new Map();
  }

  const entries = await VaultEntry.find({ token: { $in: unique } }).lean();
  return new Map(entries.map((entry) => [entry.token, entry.originalValue]));
}

/**
 * Test helper: wipe vault documents in the connected database.
 */
export async function resetVault() {
  await VaultEntry.deleteMany({});
}
