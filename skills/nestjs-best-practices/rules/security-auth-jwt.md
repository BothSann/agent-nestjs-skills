---
title: Implement Secure JWT Authentication
impact: CRITICAL
impactDescription: Essential for secure APIs
tags: security, jwt, authentication, tokens
---

## Implement Secure JWT Authentication

For new apps, start with the official `@nestjs/authentication` package: it ships password hashing (scrypt), sessions, JWT bearer tokens, refresh token rotation with reuse detection, and MFA (see the docs link below). If you build it yourself with `@nestjs/jwt` and `@nestjs/passport`, follow this rule. Store secrets securely, use appropriate token lifetimes, implement refresh tokens, and validate tokens properly. Never expose sensitive data in JWT payloads.

**Incorrect (insecure JWT implementation):**

```typescript
// Hardcode secrets
@Module({
  imports: [
    JwtModule.register({
      secret: 'my-secret-key', // Exposed in code
      signOptions: { expiresIn: '7d' }, // Too long
    }),
  ],
})
export class AuthModule {}

// Store sensitive data in JWT
async login(user: User): Promise<{ accessToken: string }> {
  const payload = {
    sub: user.id,
    email: user.email,
    password: user.password, // NEVER include password!
    ssn: user.ssn, // NEVER include sensitive data!
    isAdmin: user.isAdmin, // Can be tampered if not verified
  };
  return { accessToken: this.jwtService.sign(payload) };
}

// Skip token validation
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: 'my-secret',
    });
  }

  async validate(payload: any): Promise<any> {
    return payload; // No validation of user existence
  }
}
```

**Correct (secure JWT with refresh tokens):**

```typescript
// Secure JWT configuration
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: '15m', // Short-lived access tokens
          issuer: config.get<string>('JWT_ISSUER'),
          audience: config.get<string>('JWT_AUDIENCE'),
        },
      }),
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
})
export class AuthModule {}

// Minimal JWT payload
@Injectable()
export class AuthService {
  async login(user: User): Promise<TokenResponse> {
    // Only include necessary, non-sensitive data
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles: user.roles,
      // iat and exp are added by jwtService.sign(); do not set them by hand
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.createRefreshToken(user.id);

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  private async createRefreshToken(userId: string, familyId = randomUUID()): Promise<string> {
    // 256 random bits. Store only a SHA-256 hash: it can be looked up, and a stolen
    // DB copy cannot be replayed. (bcrypt is for passwords: salted, so no lookup.)
    const token = randomBytes(32).toString('base64url');

    await this.refreshTokenRepo.save({
      userId,
      familyId,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      usedAt: null,
    });

    return token;
  }

  // Rotate on every use. A token used twice means it was stolen: revoke its whole family.
  async refresh(token: string): Promise<TokenResponse> {
    const hash = createHash('sha256').update(token).digest('hex');
    const stored = await this.refreshTokenRepo.findOne({ where: { tokenHash: hash } });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException();
    }
    // Mark used only if still unused, in one statement, so two parallel calls cannot both win
    const { affected } = await this.refreshTokenRepo.update(
      { id: stored.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );
    if (!affected) {
      await this.refreshTokenRepo.delete({ familyId: stored.familyId });
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(stored.userId);
    return {
      accessToken: this.jwtService.sign({ sub: user.id, roles: user.roles }),
      refreshToken: await this.createRefreshToken(user.id, stored.familyId),
      expiresIn: 900,
    };
  }
}

// Proper JWT strategy with validation
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET'),
      ignoreExpiration: false,
      issuer: config.get<string>('JWT_ISSUER'),
      audience: config.get<string>('JWT_AUDIENCE'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    // Verify user still exists and is active
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Verify token wasn't issued before password change
    if (user.passwordChangedAt) {
      const tokenIssuedAt = new Date(payload.iat * 1000);
      if (tokenIssuedAt < user.passwordChangedAt) {
        throw new UnauthorizedException('Token invalidated by password change');
      }
    }

    return user;
  }
}
```

Reference: [NestJS Authentication](https://docs.nestjs.com/security/authentication)
