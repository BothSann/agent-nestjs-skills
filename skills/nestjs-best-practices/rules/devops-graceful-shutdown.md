---
title: Implement Graceful Shutdown
impact: MEDIUM-HIGH
impactDescription: Proper shutdown handling ensures zero-downtime deployments
tags: devops, graceful-shutdown, lifecycle, kubernetes
---

## Implement Graceful Shutdown

Handle SIGTERM and SIGINT signals to gracefully shutdown your NestJS application. Stop accepting new requests, wait for in-flight requests to complete, close database connections, and clean up resources. This prevents data loss and connection errors during deployments.

**Incorrect (ignoring shutdown signals):**

```typescript
// Ignore shutdown signals
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  // App crashes immediately on SIGTERM
  // In-flight requests fail
  // Database connections are abruptly closed
}

// Long-running tasks without cancellation
@Injectable()
export class ProcessingService {
  async processLargeFile(file: File): Promise<void> {
    // No way to interrupt this during shutdown
    for (let i = 0; i < file.chunks.length; i++) {
      await this.processChunk(file.chunks[i]);
      // May run for minutes, blocking shutdown
    }
  }
}
```

**Correct (let Nest run the shutdown, drain in the right hook):**

```typescript
// main.ts: one line. Nest listens for SIGTERM/SIGINT, runs the hooks, closes the server.
// Do not add your own process.on('SIGTERM') as well: shutdown would run twice.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(3000);
}

// Shutdown order (from the docs):
//   1. onModuleDestroy()
//   2. beforeApplicationShutdown(signal)  <- server still accepts requests here
//   3. HTTP server closes, in-flight requests finish
//   4. onApplicationShutdown(signal)      <- server is already closed here

// Step 2: fail readiness, then wait so the load balancer stops sending traffic
@Injectable()
export class ShutdownService implements BeforeApplicationShutdown {
  private shuttingDown = false;

  isShutdown(): boolean {
    return this.shuttingDown;
  }

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.shuttingDown = true;
    // Must be longer than readiness periodSeconds * failureThreshold
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly shutdown: ShutdownService,
  ) {}

  @Get('ready')
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    if (this.shutdown.isShutdown()) {
      throw new ServiceUnavailableException('Shutting down'); // 503
    }
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}

// Step 1: stop taking new background work before the server closes
@Processor('reports')
export class ReportsProcessor extends WorkerHost implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.worker.close(); // waits for the running job, takes no new ones
  }

  async process(job: Job): Promise<void> {
    await this.generate(job.data);
  }
}

// Step 4: close pools and clients last, after requests have finished
@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  constructor(private readonly pool: Pool) {}

  async onApplicationShutdown(signal?: string): Promise<void> {
    await this.pool.end();
  }
}
```

Set the Kubernetes `terminationGracePeriodSeconds` longer than the readiness wait plus your slowest request, or the pod is killed mid-shutdown. If idle keep-alive connections hold the process open, see `forceCloseConnections` in the docs FAQ, but it also cuts requests still running, so keep the readiness wait. On Windows, `SIGTERM` is never delivered (see the docs warning), so test shutdown on Linux or in a container.

Reference: [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)
