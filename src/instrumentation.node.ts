function required(name: string, minimumLength = 1): string {
  const value = process.env[name];
  if (!value || value.length < minimumLength) {
    throw new Error(`${name} обязателен в production${minimumLength > 1 ? ` и должен содержать минимум ${minimumLength} символа` : ''}`);
  }
  return value;
}

function validateHostedProduction(): void {
  const hostedProduction = Boolean(process.env.RAILWAY_ENVIRONMENT) || process.env.VERCEL_ENV === 'production';
  if (!hostedProduction) return;

  if (process.env.LOCALY_REPO !== 'supabase') {
    throw new Error('Hosted production требует LOCALY_REPO=supabase');
  }
  required('NEXT_PUBLIC_SUPABASE_URL');
  required('SUPABASE_SERVICE_ROLE_KEY', 32);
  required('LOCALY_SESSION_SECRET', 32);
  required('LOCALY_OTP_SECRET', 32);
  required('LOCALY_DEMO_PASSWORD', 12);

  const smsWebhook = required('LOCALY_SMS_WEBHOOK_URL');
  if (!smsWebhook.startsWith('https://')) throw new Error('LOCALY_SMS_WEBHOOK_URL должен использовать HTTPS');

  const actionKey = required('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY');
  const decoded = Buffer.from(actionKey, 'base64');
  if (decoded.length !== 32) throw new Error('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY должен содержать ровно 32 байта в base64');
}

/** Fail-fast: неверно настроенный hosted-инстанс завершается и не принимает трафик. */
export function registerNode(): void {
  try {
    validateHostedProduction();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[localy] Ошибка production-конфигурации: ${message}\n`);
    process.exit(1);
  }
}
