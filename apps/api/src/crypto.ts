import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const generateStreamKey = () => randomBytes(32).toString('base64url');
export const hashStreamKey = (key: string) => createHash('sha256').update(key).digest('hex');
export const keysMatch = (provided: string, expectedHash: string) => {
  const actual = Buffer.from(hashStreamKey(provided), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

