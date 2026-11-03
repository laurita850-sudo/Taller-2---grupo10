// Guard tests: they never connect to MongoDB and never read .env.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertTestDatabaseUri, databaseNameFromUri, TEST_DB_NAME } from './connection.js';
import { VaultEntry } from '../models/VaultEntry.js';
import { resetVault } from '../services/vault.js';

// Fictional URIs: no real host or credentials.
const base = 'mongodb+srv://user:secret@cluster0.example.mongodb.net';
const MAIN = `${base}/privacy_vault?retryWrites=true&w=majority`;
const TEST = `${base}/privacy_vault_test?retryWrites=true&w=majority`;

test('databaseNameFromUri reads the path of srv and multi-host URIs', () => {
  assert.equal(databaseNameFromUri(TEST), 'privacy_vault_test');
  assert.equal(databaseNameFromUri(MAIN), 'privacy_vault');
  assert.equal(databaseNameFromUri('mongodb://a:1,b:2/privacy_vault_test?replicaSet=rs'), 'privacy_vault_test');
  assert.equal(databaseNameFromUri(`${base}/?retryWrites=true`), '');
  assert.equal(databaseNameFromUri(base), '');
  assert.equal(databaseNameFromUri('not a uri'), '');
});

test('accepts only a TEST_MONGO_URI that names privacy_vault_test', () => {
  assert.equal(assertTestDatabaseUri(TEST, MAIN), TEST);
  assert.equal(assertTestDatabaseUri(TEST, undefined), TEST);
});

test('stops when TEST_MONGO_URI is missing or blank', () => {
  assert.throws(() => assertTestDatabaseUri(undefined, MAIN), /TEST_MONGO_URI is missing/);
  assert.throws(() => assertTestDatabaseUri('   ', MAIN), /TEST_MONGO_URI is missing/);
});

test('stops when TEST_MONGO_URI points to privacy_vault or any other database', () => {
  for (const uri of [
    MAIN,
    `${base}/privacy_vault`,
    `${base}/`,
    base,
    `${base}/test`,
    `${base}/privacy_vault_test2`,
    `${base}/privacy_vault_testing`,
    `${base}/PRIVACY_VAULT_TEST`,
  ]) {
    assert.throws(() => assertTestDatabaseUri(uri, undefined), new RegExp(TEST_DB_NAME), uri);
  }
});

test('stops when TEST_MONGO_URI equals MONGO_URI', () => {
  assert.throws(() => assertTestDatabaseUri(TEST, TEST), /must differ from MONGO_URI/);
});

test('guard messages never echo the URI or the password', () => {
  for (const [uri, main] of [[MAIN, undefined], [TEST, TEST], [`${base}/x`, MAIN]]) {
    assert.throws(
      () => assertTestDatabaseUri(uri, main),
      (error) => !error.message.includes('secret') && !error.message.includes('cluster0'),
    );
  }
});

test('resetVault refuses to delete unless the connection is privacy_vault_test', async () => {
  const connection = VaultEntry.db;
  const originalName = connection.name;
  let deleteCalls = 0;
  const originalDeleteMany = VaultEntry.deleteMany;
  VaultEntry.deleteMany = async () => {
    deleteCalls += 1;
  };

  try {
    for (const name of [undefined, 'privacy_vault', 'test']) {
      connection.name = name;
      await assert.rejects(() => resetVault(), /no data was modified/);
    }
    assert.equal(deleteCalls, 0);

    connection.name = TEST_DB_NAME;
    await resetVault();
    assert.equal(deleteCalls, 1);
  } finally {
    connection.name = originalName;
    VaultEntry.deleteMany = originalDeleteMany;
  }
});
