import mongoose from 'mongoose';

/**
 * Persistent mapping of original PII <-> vault token.
 * lookupKey is a normalized unique key so the same PII always reuses its token.
 */
const vaultEntrySchema = new mongoose.Schema(
  {
    originalValue: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    type: {
      type: String,
      required: true,
      enum: ['NAME', 'EMAIL', 'PHONE'],
    },
    lookupKey: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export const VaultEntry =
  mongoose.models.VaultEntry ?? mongoose.model('VaultEntry', vaultEntrySchema);
