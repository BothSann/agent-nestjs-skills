---
title: Use API Versioning for Breaking Changes
impact: MEDIUM
impactDescription: Versioning allows you to evolve APIs without breaking existing clients
tags: api, versioning, breaking-changes, compatibility
---

## Use API Versioning for Breaking Changes

Use NestJS built-in versioning when making breaking changes to your API. Choose a versioning strategy (URI, header, or media type) and apply it consistently. This allows old clients to continue working while new clients use updated endpoints.

**Incorrect (breaking changes without versioning):**

```typescript
// Breaking changes without versioning
@Controller('users')
export class UsersController {
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User> {
    // Original response: { id, name, email }
    // Later changed to: { id, firstName, lastName, emailAddress }
    // Old clients break!
    return this.usersService.findOne(id);
  }
}

// Manual versioning in routes
@Controller('v1/users')
export class UsersV1Controller {}

@Controller('v2/users')
export class UsersV2Controller {}
// Inconsistent, error-prone, hard to maintain
```

**Correct (use NestJS built-in versioning):**

```typescript
// main.ts: pick ONE versioning type. Calling enableVersioning() again replaces the first.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // URI versioning: /v1/users, /v2/users
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Other choices (use instead of URI, not as well):
  //   { type: VersioningType.HEADER, header: 'X-API-Version' }
  //   { type: VersioningType.MEDIA_TYPE, key: 'v=' }   // Accept: application/json;v=1

  await app.listen(3000);
}

// Version a whole controller: put the version in @Controller().
// @Version() is for single route handlers.
@Controller({ path: 'users', version: '1' })
export class UsersV1Controller {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserV1Response> {
    const user = await this.usersService.findOne(id);
    return { id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email };
  }
}

@Controller({ path: 'users', version: '2' })
export class UsersV2Controller {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserV2Response> {
    const user = await this.usersService.findOne(id);
    // Breaking change: name split in two, email renamed
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      emailAddress: user.email,
      createdAt: user.createdAt,
    };
  }
}

// Per-route versioning inside one controller
@Controller('users')
export class UsersController {
  @Get()
  @Version('1')
  findAllV1(): Promise<UserV1Response[]> {
    return this.usersService.findAllV1();
  }

  @Get()
  @Version('2')
  findAllV2(): Promise<UserV2Response[]> {
    return this.usersService.findAllV2();
  }

  @Get(':id')
  @Version(['1', '2']) // Same handler for both versions
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.usersService.findOne(id);
  }

  @Post()
  @Version(VERSION_NEUTRAL) // Matches any version, or none
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.create(dto);
  }
}

// Keep the service version-free. The controller for each version shapes the response,
// so do not read the version header by hand and branch on it in the service.

// Deprecation: tell v1 clients when it goes away
@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse();
    response.setHeader('Deprecation', 'true');
    response.setHeader('Sunset', 'Thu, 31 Dec 2026 23:59:59 GMT'); // a date in the future
    response.setHeader('Link', '</v2/users>; rel="successor-version"');
    return next.handle();
  }
}

@Controller({ path: 'users', version: '1' })
@UseInterceptors(DeprecationInterceptor)
export class UsersV1Controller {}
```

Reference: [NestJS Versioning](https://docs.nestjs.com/http/versioning)
