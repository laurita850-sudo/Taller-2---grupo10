import mongoose from 'mongoose';

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
