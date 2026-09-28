function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

// Lazy getters so a missing variable only fails when it is actually used
// (keeps `next build` and tests from needing a full environment).
export const env = {
  get databaseUrl() {
    return required('DATABASE_URL');
  },
  get verifyToken() {
    return required('WHATSAPP_VERIFY_TOKEN');
  },
  get appSecret() {
    return required('WHATSAPP_APP_SECRET');
  },
  get accessToken() {
    return required('WHATSAPP_ACCESS_TOKEN');
  },
  get phoneNumberId() {
    return required('WHATSAPP_PHONE_NUMBER_ID');
  },
  get sessionSecret() {
    const v = required('SESSION_SECRET');
    if (v.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
    return v;
  },
  get apiVersion() {
    return process.env.WHATSAPP_API_VERSION ?? 'v21.0';
  },
};
