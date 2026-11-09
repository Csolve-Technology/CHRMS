import { ConfigService } from '@nestjs/config';

export function authConfig(config: ConfigService) {
  const mode = config.get<string>('AUTH_MODE') ?? 'local';
  if (mode !== 'local' && mode !== 'keycloak') {
    throw new Error('AUTH_MODE must be local or keycloak.');
  }
  const url = (
    config.get<string>('KEYCLOAK_URL') ?? 'https://auth.chirocity.gov.et'
  ).replace(/\/$/, '');
  const realm = config.get<string>('KEYCLOAK_REALM') ?? 'chrms';
  const clientId = config.get<string>('KEYCLOAK_CLIENT_ID') ?? 'chrms-web';
  const audience = config.get<string>('KEYCLOAK_AUDIENCE') ?? 'chrms-api';
  if (mode === 'keycloak') {
    const parsed = new URL(url);
    if (
      !['https:', 'http:'].includes(parsed.protocol) ||
      (config.get<string>('NODE_ENV') === 'production' &&
        parsed.protocol !== 'https:') ||
      !/^[A-Za-z0-9._-]+$/.test(realm) ||
      !clientId ||
      !audience
    ) {
      throw new Error(
        'Invalid Keycloak configuration; production requires HTTPS.',
      );
    }
  }
  return {
    mode,
    url,
    realm,
    clientId,
    audience,
    issuer: `${url}/realms/${realm}`,
  };
}
