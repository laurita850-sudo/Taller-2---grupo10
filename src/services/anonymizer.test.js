import 'dotenv/config';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { connectDb, disconnectDb } from '../db/connection.js';
import { anonymizeMessage, deanonymizeMessage } from './anonymizer.js';
import { getOrCreateToken, resetVault } from './vault.js';

function testMongoUri() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is required for tests');
  }
  return uri.replace('/privacy_vault', '/privacy_vault_test');
}

before(async () => {
  await connectDb(testMongoUri());
});

beforeEach(async () => {
  await resetVault();
});

after(async () => {
  await disconnectDb();
});

test('anonymizes name (one NAME_ token), email, and Colombian phone', async () => {
  const message =
    'oferta de trabajo para Dago Borda con email dborda@gmail.com y teléfono 3152319157';

  const result = await anonymizeMessage(message);
  const name = await getOrCreateToken('Dago Borda', 'name');
  const email = await getOrCreateToken('dborda@gmail.com', 'email');
  const phone = await getOrCreateToken('3152319157', 'phone');

  assert.equal(
    result,
    `oferta de trabajo para ${name} con email ${email} y teléfono ${phone}`,
  );
  assert.match(name, /^NAME_[0-9a-f]{12}$/);
  assert.match(email, /^EMAIL_[0-9a-f]{12}$/);
  assert.match(phone, /^PHONE_[0-9a-f]{12}$/);
});

test('is deterministic: the same PII always maps to the same token', async () => {
  const first = await anonymizeMessage('Contactar a Ana Perez en ana@banco.com o 3001234567');
  const second = await anonymizeMessage('Contactar a Ana Perez en ana@banco.com o 3001234567');

  assert.equal(first, second);
});

test('accepts optional Colombian phone formats', async () => {
  const dashed = await anonymizeMessage('llamar 315-231-9157');
  const spaced = await anonymizeMessage('llamar 315 231 9157');
  const country = await anonymizeMessage('llamar +57 3152319157');
  const token = await getOrCreateToken('3152319157', 'phone');

  assert.equal(dashed, `llamar ${token}`);
  assert.equal(spaced, `llamar ${token}`);
  assert.equal(country, `llamar ${token}`);
});

test('deanonymize restores the original message from vault tokens', async () => {
  const original =
    'oferta de trabajo para Dago Borda con email dborda@gmail.com y teléfono 3152319157';
  const anonymized = await anonymizeMessage(original);

  assert.equal(await deanonymizeMessage(anonymized), original);
});

test('deanonymize leaves unknown tokens unchanged', async () => {
  const text = 'hola NAME_deadbeefdead con email EMAIL_ffffffffffff';

  assert.equal(await deanonymizeMessage(text), text);
});
