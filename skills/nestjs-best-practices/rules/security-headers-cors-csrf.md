---
title: Set Security Headers, a Strict CORS Policy, and CSRF Protection
impact: HIGH
impactDescription: Blocks clickjacking, cross-site request forgery, and reads of your API from untrusted sites
tags: security, helmet, headers, cors, csrf
---

## Set Security Headers, a Strict CORS Policy, and CSRF Protection

**Impact: HIGH (blocks clickjacking, cross-site request forgery, and reads of your API from untrusted sites)**

Three browser protections, all set once in `main.ts`, right after `NestFactory.create()`:

- **Security headers** (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, ...) turn on browser defenses. Since NestJS v12.1, `app.useSecurityHeaders()` sets the Helmet 8 defaults on Express and Fastify with no extra package. On older versions, use the `helmet` package.
- **CORS** decides which other sites may read your API's responses. Never reflect every origin while allowing credentials.
- **CSRF** stops another site from making a signed-in user's browser send a state-changing request. Since v12.1, `app.enableCsrfProtection()` rejects cross-origin `POST`/`PUT`/`PATCH`/`DELETE` using the browser's `Sec-Fetch-Site` and `Origin` headers. You need it when you authenticate with cookies. Pure bearer-token APIs are not exposed to CSRF, but the check does no harm: non-browser clients send neither header and are let through.

**Incorrect (open CORS with credentials, no headers, cookie auth without CSRF):**

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Any site can make a signed-in user's browser call the API AND read the answer
  app.enableCors({ origin: true, credentials: true });

  // Session cookie auth, but nothing stops a cross-site POST /account/email
  app.use(session({ secret: process.env.SESSION_SECRET, cookie: { sameSite: 'none', secure: true } }));

  await app.listen(3000);
}

// State changes on GET can never be protected by CSRF checks
@Get('orders/:id/cancel')
cancel(@Param('id') id: string) {
  return this.orders.cancel(id);
}
```

**Correct (headers, an origin allowlist, CSRF on, state changes only on unsafe methods):**

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Call these first: middleware added with app.use() before them runs before them
  app.useSecurityHeaders(); // NestJS >= 12.1; older: app.use(helmet())
  app.enableCsrfProtection({
    trustedOrigins: config.getOrThrow<string>('TRUSTED_ORIGINS').split(','), // e.g. https://admin.example.com
    exclude: [{ path: 'webhooks/stripe', method: RequestMethod.POST }], // signed by the sender instead
  });

  app.enableCors({
    origin: config.getOrThrow<string>('CORS_ORIGINS').split(','), // exact list, never `true` or '*' with credentials
    credentials: true,
    // List methods yourself: Fastify's default allows only GET, HEAD, POST
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  await app.listen(3000);
}

// GET, HEAD and OPTIONS are never CSRF-checked, so they must not change state
@Post('orders/:id/cancel')
cancel(@Param('id', ParseUUIDPipe) id: string) {
  return this.orders.cancel(id);
}
```

Notes:

- Serving Swagger UI or a GraphQL IDE? The default CSP blocks their inline scripts. Loosen CSP for those routes only (see the docs), not for the whole app.
- Behind a proxy that rewrites `Host`, older browsers fail the `Origin`/`Host` fallback with a 403. Keep `Host` or add your public origin to `trustedOrigins`.
- WebSocket upgrades are not CSRF-checked. If gateways use cookies, check the handshake `Origin` yourself.
- Cookies: `HttpOnly`, `Secure`, and `SameSite=Lax` (or `Strict`) unless you really need cross-site cookies.

Reference: [NestJS Security Headers](https://docs.nestjs.com/security/helmet) · [NestJS CORS](https://docs.nestjs.com/security/cors) · [NestJS CSRF Protection](https://docs.nestjs.com/security/csrf) · [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
