import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from '../database/entities';
import { UserRole } from '../database/enums';
import { Principal } from './access';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password';

interface TokenClaims {
  sub: string;
  role: UserRole;
  name: string;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  locale: 'en' | 'fil';
}

const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_FAILURES = 10;
const MAX_TRACKED = 10_000;

@Injectable()
export class AuthService {
  /**
   * Failed logins per (email, client IP), in memory (single backend instance).
   * Keyed by IP too, so someone guessing at an officer's email cannot lock
   * the real officer out during an emergency.
   */
  private readonly failures = new Map<
    string,
    { count: number; until: number }
  >();

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly jwt: JwtService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  /** Public sign-up is for citizens only; officers come from the CLI. */
  async registerCitizen(input: {
    email: string;
    password: string;
    displayName: string;
    locale?: 'en' | 'fil';
  }): Promise<PublicUser> {
    return this.createUser({ ...input, role: UserRole.CITIZEN });
  }

  async createUser(input: {
    email: string;
    password: string;
    displayName: string;
    role: UserRole;
    locale?: 'en' | 'fil';
  }): Promise<PublicUser> {
    const email = normalizeEmail(input.email);
    const repo = this.db.getRepository(User);
    if (await repo.existsBy({ email })) {
      throw new ConflictException('an account with this email already exists');
    }
    const user = await repo.save({
      email,
      passwordHash: await hashPassword(input.password),
      displayName: input.displayName.trim(),
      role: input.role,
      locale: input.locale ?? 'fil',
    });
    return toPublic(user);
  }

  async login(
    emailRaw: string,
    password: string,
    clientIp: string,
  ): Promise<{ token: string; user: PublicUser; ttlSec: number }> {
    const email = normalizeEmail(emailRaw);
    const key = `${email}|${clientIp}`;
    const f = this.failures.get(key);
    if (f && f.count >= LOGIN_MAX_FAILURES && f.until > Date.now()) {
      throw new HttpException(
        'too many failed sign-in attempts; try again in a few minutes',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.db.getRepository(User).findOneBy({ email });
    // Verify against a dummy hash when the email is unknown so both paths
    // take the same time.
    const ok = await verifyPassword(
      password,
      user?.passwordHash ?? (await dummyPasswordHash()),
    );
    if (!user || !ok) {
      const prev = f && f.until > Date.now() ? f.count : 0;
      this.trackFailure(key, prev + 1);
      throw new UnauthorizedException('invalid email or password');
    }
    this.failures.delete(key);

    const ttlSec =
      user.role === UserRole.OFFICER
        ? this.config.officerTtlSec
        : this.config.citizenTtlSec;
    const token = await this.jwt.signAsync(
      {
        sub: user.id,
        role: user.role,
        name: user.displayName,
      } satisfies TokenClaims,
      { expiresIn: ttlSec },
    );
    return { token, user: toPublic(user), ttlSec };
  }

  /**
   * Validates a token and re-checks the account still exists with the same
   * role, so deleting or demoting an officer takes effect immediately.
   */
  async principalFromToken(token: string): Promise<Principal | null> {
    let claims: TokenClaims;
    try {
      claims = await this.jwt.verifyAsync<TokenClaims>(token);
    } catch {
      return null;
    }
    const user = await this.db
      .getRepository(User)
      .findOneBy({ id: claims.sub });
    if (!user || user.role !== claims.role) return null;
    return {
      kind: 'user',
      id: user.id,
      role: user.role,
      displayName: user.displayName,
    };
  }

  private trackFailure(key: string, count: number) {
    if (this.failures.size >= MAX_TRACKED) {
      const now = Date.now();
      for (const [k, v] of this.failures)
        if (v.until <= now) this.failures.delete(k);
      // Still full of live entries: drop the oldest inserted.
      if (this.failures.size >= MAX_TRACKED) {
        const oldest = this.failures.keys().next();
        if (!oldest.done) this.failures.delete(oldest.value);
      }
    }
    this.failures.set(key, { count, until: Date.now() + LOGIN_WINDOW_MS });
  }

  async me(id: string): Promise<PublicUser> {
    const user = await this.db.getRepository(User).findOneBy({ id });
    if (!user) throw new UnauthorizedException();
    return toPublic(user);
  }
}

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

function toPublic(u: User): PublicUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    locale: u.locale,
  };
}
