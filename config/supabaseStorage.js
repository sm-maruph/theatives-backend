const { createClient } = require('@supabase/supabase-js');

let storageClient;

exports.getStorageClient = () => {
  if (storageClient) return storageClient;
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error('SUPABASE_URL and server-only SUPABASE_SECRET_KEY must be configured for Storage uploads.');
  }
  storageClient = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return storageClient;
};
