---
title: Implement Health Checks for Microservices
impact: MEDIUM-HIGH
impactDescription: Health checks enable orchestrators to manage service lifecycle
tags: microservices, health-checks, terminus, kubernetes
---

## Implement Health Checks for Microservices

Implement liveness and readiness probes using `@nestjs/terminus`. Liveness checks determine if the service should be restarted. Readiness checks determine if the service can accept traffic. Proper health checks enable Kubernetes and load balancers to route traffic correctly.

Keep liveness cheap and local. If liveness checks the database, a short database outage makes Kubernetes restart every pod at once, which makes the outage worse. Put dependency checks in readiness.

**Incorrect (simple ping that doesn't check dependencies):**

```typescript
// Simple ping that doesn't check dependencies
@Controller('health')
export class HealthController {
  @Get()
  check(): string {
    return 'OK'; // Service might be unhealthy but returns OK
  }
}

// Health check that blocks on slow dependencies
@Controller('health')
export class HealthController {
  @Get()
  async check(): Promise<string> {
    // If database is slow, health check times out
    await this.userRepo.findOne({ where: { id: '1' } });
    await this.redis.ping();
    await this.externalApi.healthCheck();
    return 'OK';
  }
}

// Checking Redis with an HTTP ping - Redis does not speak HTTP, so this always fails
() => this.http.pingCheck('redis', 'http://redis:6379');

// Old custom indicator API (extends HealthIndicator + throws HealthCheckError).
// Current Terminus uses HealthIndicatorService instead.
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  async isHealthy(key: string) {
    throw new HealthCheckError('Redis check failed', this.getStatus(key, false));
  }
}
```

**Correct (use @nestjs/terminus for comprehensive health checks):**

```typescript
// Use @nestjs/terminus for comprehensive health checks
import {
  HealthCheckService,
  HttpHealthIndicator,
  TypeOrmHealthIndicator,
  HealthCheck,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private db: TypeOrmHealthIndicator,
    private disk: DiskHealthIndicator,
    private memory: MemoryHealthIndicator,
    private redis: RedisHealthIndicator,
    private queue: QueueHealthIndicator,
    private shutdownService: ShutdownService,
  ) {}

  // Liveness probe - is the process alive? Local checks only.
  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024), // 200MB
    ]);
  }

  // Readiness probe - can the service handle traffic right now?
  @Get('ready')
  @HealthCheck()
  readiness() {
    // Fail readiness during shutdown so the load balancer stops sending traffic
    if (this.shutdownService.isShutdown()) {
      throw new ServiceUnavailableException('Shutting down');
    }

    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1000 }),
      () => this.redis.isHealthy('redis'),
      () => this.queue.isHealthy('job-queue'),
      () => this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }

  // Deep health check for debugging (do not use as a probe)
  @Get('deep')
  @HealthCheck()
  deepCheck() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
      () => this.disk.checkStorage('disk', { path: '/', thresholdPercent: 0.9 }),
      () => this.http.pingCheck('external-api', 'https://api.example.com/health'),
    ]);
  }
}

// Custom indicators use HealthIndicatorService (current Terminus API)
import { HealthIndicatorService } from '@nestjs/terminus';

// Redis: send a real Redis PING, never an HTTP request
@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const pong = await Promise.race([
        this.redis.ping(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000)),
      ]);
      return pong === 'PONG' ? indicator.up() : indicator.down({ reply: pong });
    } catch (error) {
      // Catch and return down(): an uncaught throw here gives a 500 instead of a 503
      return indicator.down({ message: error instanceof Error ? error.message : String(error) });
    }
  }
}

// Business-specific indicator
@Injectable()
export class QueueHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly queueService: QueueService,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    const stats = await this.queueService.getStats();
    const details = {
      waiting: stats.waitingCount,
      active: stats.activeCount,
      failed: stats.failedCount,
    };

    return stats.failedCount < 100 ? indicator.up(details) : indicator.down(details);
  }
}

// health.module.ts
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, QueueHealthIndicator],
})
export class HealthModule {}

// Shutdown state shared with the readiness probe
@Injectable()
// beforeApplicationShutdown runs while the server still accepts requests.
// onApplicationShutdown runs after it closed, which is too late for a probe.
export class ShutdownService implements BeforeApplicationShutdown {
  private isShuttingDown = false;

  isShutdown(): boolean {
    return this.isShuttingDown;
  }

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.isShuttingDown = true;
    // Give the load balancer time to see the failing readiness probe
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
```

### Kubernetes Configuration

```yaml
# Kubernetes deployment with probes
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
spec:
  template:
    spec:
      containers:
        - name: api
          image: api-service:latest
          ports:
            - containerPort: 3000
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 5
            failureThreshold: 30
```

Reference: [NestJS Terminus](https://docs.nestjs.com/reliability/terminus)
