---
title: Consider the Fastify Adapter, and Stay Platform-Agnostic
impact: MEDIUM
impactDescription: Faster HTTP layer for request-heavy APIs, and code that keeps working if you switch
tags: performance, fastify, express, http, platform
---

## Consider the Fastify Adapter, and Stay Platform-Agnostic

**Impact: MEDIUM (faster HTTP layer for request-heavy APIs, and code that keeps working if you switch)**

Nest uses Express by default. The docs note that Fastify reaches nearly twice Express's benchmark results. Switching is one line in `main.ts`, but only if your code does not depend on Express: `@Res()` with Express methods, Express-only middleware packages, or `import { Request } from 'express'` everywhere. The gain only matters when the HTTP layer is a real share of request time; most APIs spend their time in the database.

**Incorrect (Express details spread through the app):**

```typescript
import { Request, Response } from 'express';

@Controller('files')
export class FilesController {
  @Get(':id')
  download(@Param('id') id: string, @Res() res: Response) {
    res.download(`/data/${id}`); // Express-only API; also turns off interceptors for this route
  }
}

// In a filter: Express-only response methods
response.status(status).json(body);

// Fastify listens on localhost only, so this is unreachable inside a container
await app.listen(3000);
```

**Correct (Fastify adapter, platform-agnostic code):**

```typescript
// main.ts
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0'); // listen on all interfaces in containers
}

// Return values instead of writing to the response object
@Controller('files')
export class FilesController {
  @Get(':id')
  download(@Param('id', ParseUUIDPipe) id: string): StreamableFile {
    return new StreamableFile(this.files.openStream(id)); // works on Express and Fastify
  }
}

// In filters, reply through HttpAdapterHost (see error-use-exception-filters)
httpAdapter.reply(ctx.getResponse(), body, status);
```

Notes:

- CORS: Fastify's default allows only `GET`, `HEAD`, `POST`. List `methods` in `enableCors()` yourself.
- Use Fastify plugins (`@fastify/compress`, `@fastify/static`, ...) instead of Express middleware. Nest middleware gets the raw Node `req`/`res`, not Fastify's wrappers.
- Built-in features such as `useSecurityHeaders()`, `enableCsrfProtection()`, versioning, guards, pipes and interceptors work the same on both.
- Measure your own endpoints before and after; do not switch for a benchmark alone.

Reference: [NestJS Performance (Fastify)](https://docs.nestjs.com/http/performance) · [NestJS Platform Agnosticism](https://docs.nestjs.com/fundamentals/platform-agnosticism)
