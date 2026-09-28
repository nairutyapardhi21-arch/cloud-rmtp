import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: process.env.AWS_REGION });

/** Resolves a destination URL without ever returning it from an HTTP route. */
export async function resolveDestinationUrl(platform: string, secretReference: string | null) {
  if (secretReference) {
    const value = await client.send(new GetSecretValueCommand({ SecretId: secretReference }));
    if (!value.SecretString) throw new Error(`Secret ${secretReference} has no string value`);
    return value.SecretString;
  }
  const local = process.env[`${platform.toUpperCase()}_RTMP_URL`];
  if (!local) throw new Error(`No secret configured for ${platform}`);
  return local;
}

