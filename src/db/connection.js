import mongoose from 'mongoose';

/** The only database that automated tests may write to or wipe. */
export const TEST_DB_NAME = 'privacy_vault_test';

/**
 * Database name in the path of a mongodb:// or mongodb+srv:// URI ('' when absent).
 * @param {string} uri
 * @returns {string}
 */
export function databaseNameFromUri(uri) {
  const match = /^mongodb(?:\+srv)?:\/\/[^/?]+\/([^?]*)/.exec(uri.trim());
  if (!match) {
    return '';
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return '';
  }
}

/**
 * Stop the tests before connecting unless TEST_MONGO_URI is set, is not MONGO_URI,
 * and names exactly the privacy_vault_test database.
 * Messages never include the URI, so credentials are not printed.
 *
 * @param {string | undefined} testUri value of TEST_MONGO_URI
 * @param {string | undefined} mainUri value of MONGO_URI
 * @returns {string} the validated test URI
 */
export function assertTestDatabaseUri(testUri, mainUri) {
  if (!testUri || testUri.trim() === '') {
    throw new Error('TEST_MONGO_URI is missing. MongoDB tests stopped; no data was modified.');
  }
  if (mainUri && testUri.trim() === mainUri.trim()) {
    throw new Error('TEST_MONGO_URI must differ from MONGO_URI. MongoDB tests stopped; no data was modified.');
  }
  if (databaseNameFromUri(testUri) !== TEST_DB_NAME) {
    throw new Error(
      `TEST_MONGO_URI must point exactly to /${TEST_DB_NAME}. MongoDB tests stopped; no data was modified.`,
    );
  }
  return testUri.trim();
}

/**
 * Open a single mongoose connection to MongoDB Atlas.
 * MONGO_URI must include the database name (privacy_vault).
 */
export async function connectDb(uri = process.env.MONGO_URI) {
  if (!uri) {
    throw new Error('MONGO_URI is required');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function disconnectDb() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
