const crypto = require('crypto');

const getKey = () => {
  const encoded = process.env.FIELD_ENCRYPTION_KEY;
  if (!encoded) throw new Error('FIELD_ENCRYPTION_KEY is required to save project email credentials.');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('FIELD_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
};

exports.encryptField = (value) => {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
};

exports.decryptField = (value) => {
  if (!value) return '';
  // Allows legacy rows to be read, but new writes always use authenticated encryption.
  if (!value.startsWith('v1:')) return value;
  const [, ivText, tagText, ciphertextText] = value.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivText, 'base64'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};
