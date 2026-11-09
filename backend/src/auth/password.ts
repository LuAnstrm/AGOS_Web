import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing with Node's built-in scrypt (no native modules).
 * Stored format: scrypt$N$r$p$<salt b64>$<hash b64>, so parameters can be
 * raised later without breaking existing hashes.
 */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export const MIN_PASSWORD_LENGTH = 10;

function derive(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
  keylen: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      keylen,
      { N: n, r, p, maxmem: 64 * 1024 * 1024 },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P, KEYLEN);
  return [
    'scrypt',
    N,
    R,
    P,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const key = await derive(
    password,
    Buffer.from(saltB64, 'base64'),
    Number(n),
    Number(r),
    Number(p),
    expected.length,
  );
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/**
 * A precomputed hash for a password nobody has, verified against when the
 * email is unknown so a login for a missing account takes as long as one for
 * a real account (no user enumeration by timing).
 */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(24).toString('base64'));
  return dummyHash;
}
