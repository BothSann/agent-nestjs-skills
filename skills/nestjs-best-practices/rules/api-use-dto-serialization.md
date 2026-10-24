---
title: Use DTOs and Serialization for API Responses
impact: MEDIUM
impactDescription: Response DTOs prevent accidental data exposure and ensure consistency
tags: api, dto, serialization, class-transformer
---

## Use DTOs and Serialization for API Responses

Never send entity objects to the client as they are. What goes out must be a response DTO whose `@Expose()` fields are the full list of what the client may see, converted with `excludeExtraneousValues: true`. A handler may return an entity only when `@SerializeOptions({ type: SomeResponseDto, excludeExtraneousValues: true })` is on it, so `ClassSerializerInterceptor` turns the entity into that DTO before it is sent. Otherwise convert it yourself with `plainToInstance(SomeResponseDto, entity, { excludeExtraneousValues: true })`. Without that option, class-transformer copies every field of the source object, so `@Expose()` alone does not hide `passwordHash`. This prevents accidental exposure of sensitive fields and provides a stable API contract.

**Incorrect (returning entities, manual spreading, or `@Expose()` without `excludeExtraneousValues`):**

```typescript
// Return entities directly
@Controller('users')
export class UsersController {
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User> {
    return this.usersService.findById(id);
    // Returns: { id, email, passwordHash, ssn, internalNotes, ... }
    // Exposes sensitive data!
  }
}

// Manual object spreading (error-prone)
@Get(':id')
async findOne(@Param('id') id: string) {
  const user = await this.usersService.findById(id);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    // Easy to forget to exclude sensitive fields
    // Hard to maintain across endpoints
  };
}

// @Expose() fields, but converted without excludeExtraneousValues
@Get()
async findAll(): Promise<UserResponseDto[]> {
  const users = await this.usersService.findAll();
  return users.map((u) => plainToInstance(UserResponseDto, u));
  // Returns: { id, email, name, passwordHash, ssn, ... }
  // Every source field is copied; @Expose() only renames or adds
}
```

**Correct (response DTOs, converted with `excludeExtraneousValues: true`):**

```typescript
// main.ts: turn the returned value into JSON with its class-transformer decorators applied
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  await app.listen(3000);
}

// Response DTOs: each @Expose() field is allowed out. Nothing else is.
export class PostResponseDto {
  @Expose()
  id: string;

  @Expose()
  title: string;
}

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  name: string;

  // toClassOnly: compute from the source once. Without it, the interceptor runs the
  // transform again on the DTO, where `posts` may not exist, and sends 0.
  @Expose()
  @Transform(({ obj }) => obj.posts?.length ?? 0, { toClassOnly: true })
  postCount: number;
}

export class UserDetailResponseDto extends UserResponseDto {
  @Expose()
  createdAt: Date;

  @Expose()
  @Type(() => PostResponseDto) // nested objects are cut down to PostResponseDto's fields too
  posts: PostResponseDto[];
}

@Controller('users')
export class UsersController {
  // The interceptor turns each returned User into a UserResponseDto, keeping only @Expose() fields
  @Get()
  @SerializeOptions({ type: UserResponseDto, excludeExtraneousValues: true })
  async findAll(): Promise<User[]> {
    return this.usersService.findAll(); // [{ id, email, name, postCount }]
  }

  @Get(':id')
  @SerializeOptions({ type: UserDetailResponseDto, excludeExtraneousValues: true })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.usersService.findByIdWithPosts(id); // { id, email, name, postCount, createdAt, posts: [{ id, title }] }
  }
}

// Converting yourself (in a service, or outside HTTP) works the same way. Always pass the option:
const dto = plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });
```

Do not set `excludeExtraneousValues: true` as a global interceptor default: a handler that returns a plain object like `{ ok: true }` would then send `{}`. Set it per handler or per controller with `@SerializeOptions()`.

**Groups (different fields for different callers):**

Put `groups` in the same `@SerializeOptions()` as `type`. The interceptor uses the groups both when it builds the DTO and when it writes the JSON. A DTO you build yourself without the groups has already dropped the grouped fields.

```typescript
export class UserDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose({ groups: ['admin'] })
  email: string;

  @Expose({ groups: ['admin', 'owner'] })
  settings: UserSettings;
}

@Controller('users')
export class UsersController {
  @Get()
  @SerializeOptions({ type: UserDto, excludeExtraneousValues: true })
  async findAllPublic(): Promise<User[]> {
    return this.usersService.findAll(); // [{ id, name }]
  }

  @Get('admin')
  @UseGuards(AdminGuard)
  @SerializeOptions({ type: UserDto, excludeExtraneousValues: true, groups: ['admin'] })
  async findAllAdmin(): Promise<User[]> {
    return this.usersService.findAll(); // [{ id, name, email, settings }]
  }

  @Get('me')
  @SerializeOptions({ type: UserDto, excludeExtraneousValues: true, groups: ['owner'] })
  async getProfile(@CurrentUser() user: User): Promise<User> {
    return user; // { id, name, settings }
  }
}
```

**Second guard on the entity (not a replacement for the DTO):**

Also mark secret columns with `@Exclude()`. If an entity is ever returned without `@SerializeOptions({ type })`, the interceptor still drops these fields. With `type` set, the entity's own decorators are ignored and only the DTO's `@Expose()` list counts. Other fields, like a new column added next month, still go out, which is why the response DTO stays the main guard.

```typescript
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  name: string;

  @Column()
  @Exclude()
  passwordHash: string;

  @Column({ nullable: true })
  @Exclude()
  ssn: string;

  @Column({ default: false })
  @Exclude() // Never accept it from request bodies either: input DTOs with whitelist: true leave it out
  isAdmin: boolean;
}
```

Test it: give the serializer a source object with `passwordHash` and assert the JSON has no `passwordHash` key.

Reference: [NestJS Serialization](https://docs.nestjs.com/application/serialization), [class-transformer: enforcing type-safe instance](https://github.com/typestack/class-transformer#enforcing-type-safe-instance)
