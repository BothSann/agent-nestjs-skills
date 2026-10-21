---
title: Use Exception Filters for Error Handling
impact: HIGH
impactDescription: Consistent, centralized error handling
tags: error-handling, exception-filters, consistency
---

## Use Exception Filters for Error Handling

Never catch exceptions and manually format error responses in controllers. Use NestJS exception filters to handle errors consistently across your application. Create custom exception filters for specific error types and a global filter for unhandled exceptions.

**Incorrect (manual error handling in controllers):**

```typescript
// Manual error handling in controllers
@Controller('users')
export class UsersController {
  @Get(':id')
  async findOne(@Param('id') id: string, @Res() res: Response) {
    try {
      const user = await this.usersService.findById(id);
      if (!user) {
        return res.status(404).json({
          statusCode: 404,
          message: 'User not found',
        });
      }
      return res.json(user);
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        statusCode: 500,
        message: 'Internal server error',
      });
    }
  }
}
```

**Correct (exception filters with consistent handling):**

```typescript
// Use built-in and custom exceptions
@Controller('users')
export class UsersController {
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }
}

// Custom domain exception
export class UserNotFoundException extends NotFoundException {
  constructor(userId: string) {
    super({
      statusCode: 404,
      error: 'Not Found',
      message: `User with ID "${userId}" not found`,
      code: 'USER_NOT_FOUND',
    });
  }
}

// Domain errors know nothing about HTTP; the filter maps them to a status
export abstract class DomainException extends Error {
  abstract readonly code: string;
}
export class OrderAlreadyPlacedError extends DomainException {
  readonly code = 'ORDER_ALREADY_PLACED';
}

const DOMAIN_STATUS: Record<string, number> = {
  ORDER_ALREADY_PLACED: HttpStatus.CONFLICT,
};

// One global catch-all filter. It uses HttpAdapterHost, so it works on Express and Fastify.
// Handling domain errors here too avoids relying on the order of several global filters.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const path = httpAdapter.getRequestUrl(ctx.getRequest());

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = { message: 'Internal server error' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      // Keep the full body, e.g. the array of ValidationPipe messages
      body = typeof res === 'string' ? { message: res } : (res as Record<string, unknown>);
    } else if (exception instanceof DomainException) {
      status = DOMAIN_STATUS[exception.code] ?? HttpStatus.BAD_REQUEST;
      body = { code: exception.code, message: exception.message };
    }

    // Log only real server errors with the stack; never send the stack to the client
    if (status >= 500) {
      this.logger.error(`Unhandled error on ${path}`, exception instanceof Error ? exception.stack : String(exception));
    }

    httpAdapter.reply(
      ctx.getResponse(),
      { statusCode: status, ...body, timestamp: new Date().toISOString(), path },
      status,
    );
  }
}

// Register globally through DI, so the filter can inject HttpAdapterHost
@Module({
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
```

Reference: [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
