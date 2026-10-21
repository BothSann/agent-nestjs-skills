---
title: Use Structured Logging
impact: MEDIUM-HIGH
impactDescription: Structured logging enables effective debugging and monitoring
tags: devops, logging, structured-logs, pino
---

## Use Structured Logging

Use the built-in `ConsoleLogger` with `json: true` in production (no extra package needed). Include contextual information (request ID, user ID, operation) to trace requests across services. Avoid console.log and implement proper log levels.

**Incorrect (using console.log in production):**

```typescript
// Use console.log in production
@Injectable()
export class UsersService {
  async createUser(dto: CreateUserDto): Promise<User> {
    console.log('Creating user:', dto);
    // Not structured, no levels, lost in production logs

    try {
      const user = await this.repo.save(dto);
      console.log('User created:', user.id);
      return user;
    } catch (error) {
      console.log('Error:', error); // Using log for errors
      throw error;
    }
  }
}

// Log sensitive data
console.log('Login attempt:', { email, password }); // SECURITY RISK!

// Inconsistent log format
logger.log('User ' + userId + ' created at ' + new Date());
// Hard to parse, no structure
```

**Correct (use structured logging with context):**

```typescript
// main.ts: the built-in ConsoleLogger writes one JSON object per line to stdout.
// Let the platform (Docker, Kubernetes, ECS) collect and ship it. No log files in the app.
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      json: process.env.NODE_ENV === 'production',
      logLevels:
        process.env.NODE_ENV === 'production'
          ? ['log', 'warn', 'error', 'fatal']
          : ['log', 'warn', 'error', 'fatal', 'debug', 'verbose'],
    }),
  });
  await app.listen(3000);
}

// Use Nest's Logger with a context and structured params (objects after the message).
// In JSON mode they land under "params" (or at the root with flattenParams: true).
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  async createUser(dto: CreateUserDto): Promise<User> {
    try {
      const user = await this.repo.save(dto);
      this.logger.log('User created', { userId: user.id }); // ids, not emails or passwords
      return user;
    } catch (error) {
      // error(message, stack) puts the stack in its own "stack" field
      this.logger.error('Failed to create user', error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }
}

// Request id on every line: keep it in AsyncLocalStorage with nestjs-cls
import { ClsModule, ClsService } from 'nestjs-cls';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        // Reuse the caller's id if it sent one, so logs join up across services
        idGenerator: (req: Request) => (req.headers['x-request-id'] as string) ?? randomUUID(),
      },
    }),
  ],
})
export class AppModule {}

// Middleware runs BEFORE guards, so req.user is not set yet there.
// Add the user id after authentication, e.g. at the end of your auth guard:
//   this.cls.set('userId', request.user.id);

// Logger that adds the request id and user id to each line
@Injectable()
export class AppLogger {
  private readonly logger = new Logger();

  constructor(private readonly cls: ClsService) {}

  log(message: string, context: string, params: Record<string, unknown> = {}): void {
    this.logger.log(message, { ...params, requestId: this.cls.getId(), userId: this.cls.get('userId') }, context);
  }
}

// Need redaction, many transports, or very high volume? Use Pino instead

import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        redact: ['req.headers.authorization', 'req.body.password'],
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            query: req.query,
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
      },
    }),
  ],
})
export class AppModule {}

// Usage with Pino
@Injectable()
export class UsersService {
  constructor(private logger: PinoLogger) {
    this.logger.setContext(UsersService.name);
  }

  async findOne(id: string): Promise<User> {
    this.logger.info({ userId: id }, 'Finding user');
    // Pino uses first arg for data, second for message
  }
}
```

Reference: [NestJS Logger](https://docs.nestjs.com/application/logger)
