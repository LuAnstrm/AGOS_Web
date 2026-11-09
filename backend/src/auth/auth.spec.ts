import { UserRole } from '../database/enums';
import { decideAccess, Principal } from './access';
import { hashPassword, verifyPassword } from './password';

const citizen: Principal = {
  kind: 'user',
  id: 'c',
  role: UserRole.CITIZEN,
  displayName: 'C',
};
const officer: Principal = {
  kind: 'user',
  id: 'o',
  role: UserRole.OFFICER,
  displayName: 'O',
};
const device: Principal = { kind: 'device' };
const anon: Principal = { kind: 'anon' };

describe('decideAccess', () => {
  it('public routes allow everyone', () => {
    for (const p of [anon, citizen, officer, device]) {
      expect(decideAccess({ public: true }, p)).toBe('allow');
    }
  });

  it('officer-only routes', () => {
    const rule = { roles: [UserRole.OFFICER] };
    expect(decideAccess(rule, officer)).toBe('allow');
    expect(decideAccess(rule, citizen)).toBe('forbidden');
    expect(decideAccess(rule, device)).toBe('forbidden');
    expect(decideAccess(rule, anon)).toBe('unauthenticated');
  });

  it('device-only routes (ingestion)', () => {
    const rule = { device: true };
    expect(decideAccess(rule, device)).toBe('allow');
    expect(decideAccess(rule, officer)).toBe('forbidden');
    expect(decideAccess(rule, citizen)).toBe('forbidden');
    expect(decideAccess(rule, anon)).toBe('unauthenticated');
  });

  it('device or role (SOS submission)', () => {
    const rule = { device: true, roles: [UserRole.CITIZEN, UserRole.OFFICER] };
    expect(decideAccess(rule, device)).toBe('allow');
    expect(decideAccess(rule, citizen)).toBe('allow');
    expect(decideAccess(rule, officer)).toBe('allow');
    expect(decideAccess(rule, anon)).toBe('unauthenticated');
  });

  it('no rule means any signed-in user, not devices', () => {
    expect(decideAccess({}, citizen)).toBe('allow');
    expect(decideAccess({}, officer)).toBe('allow');
    expect(decideAccess({}, device)).toBe('forbidden');
    expect(decideAccess({}, anon)).toBe('unauthenticated');
  });
});

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const h = await hashPassword('correct horse battery');
    expect(h.startsWith('scrypt$')).toBe(true);
    await expect(verifyPassword('correct horse battery', h)).resolves.toBe(
      true,
    );
    await expect(verifyPassword('correct horse batterY', h)).resolves.toBe(
      false,
    );
    await expect(verifyPassword('', h)).resolves.toBe(false);
  });

  it('salts: same password hashes differently', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ]);
    expect(a).not.toBe(b);
  });

  it('rejects malformed stored hashes', async () => {
    await expect(verifyPassword('x', 'plaintext')).resolves.toBe(false);
    await expect(verifyPassword('x', 'bcrypt$a$b$c$d$e')).resolves.toBe(false);
  });
});
