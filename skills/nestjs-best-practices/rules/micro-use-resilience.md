---
title: Put Timeouts, Retries, and Circuit Breakers on Calls to Other Services
impact: HIGH
impactDescription: One slow or failing dependency stops dragging the whole API down with it
tags: reliability, resilience, timeout, retry, circuit-breaker, bulkhead
---

## Put Timeouts, Retries, and Circuit Breakers on Calls to Other Services

**Impact: HIGH (one slow or failing dependency stops dragging the whole API down with it)**

Every call to another service can hang or fail. Without a timeout, a hung call holds a request (and its DB connection) until the client gives up. Without a circuit breaker, every request keeps hitting a service that is already down. Hand-made retry loops often retry `POST`s, retry client errors, and stack retries at several layers.

Use `@nestjs/resilience`: register named presets once (usually one per dependency), then apply them with decorators on handlers or with a policy object in services. Retries are skipped on unsafe methods unless you say the handler is safe to repeat.

**Incorrect (no timeout, retry loop with no backoff, retries a POST):**

```typescript
@Injectable()
export class ShippingService {
  async createShipment(order: Order) {
    for (let i = 0; i < 5; i++) {
      try {
        // No timeout: a hung carrier holds this request forever
        return await fetch(`${CARRIER_URL}/shipments`, { method: 'POST', body: JSON.stringify(order) });
      } catch {
        // Retries at once, even on 4xx, and may book the shipment five times
      }
    }
  }
}
```

**Correct (one preset per dependency, signal passed to every I/O call):**

```typescript
// app.module.ts
@Module({
  imports: [
    ResilienceModule.forRoot({
      defaults: {
        timeout: '5s',
        retry: { attempts: 3, backoff: { delay: '200ms', maxDelay: '2s' } }, // exponential, with jitter
      },
      presets: {
        carrier: {
          timeout: '2s',
          retry: { attempts: 2 },
          circuitBreaker: { failureRateThreshold: 50, minimumCalls: 10, openDuration: '30s' },
        },
      },
    }),
  ],
})
export class AppModule {}

// shipping.controller.ts
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get('quotes')
  @Resilience('carrier')
  @Fallback('flatRateQuotes', { handleIf: (error) => error instanceof CircuitOpenError })
  getQuotes(@Query('orderId') orderId: string, @Signal() signal: AbortSignal) {
    return this.shipping.getQuotes(orderId, signal); // pass the signal down to fetch()
  }

  flatRateQuotes() {
    return this.shipping.flatRateQuotes(); // cheap, and never calls the carrier
  }

  @Post('shipments')
  @Idempotent() // client retries (see micro-use-idempotency-keys)
  @Resilience('carrier')
  @Retry({ idempotent: true }) // only because the carrier dedupes by order id
  createShipment(@Body('orderId') orderId: string, @Signal() signal: AbortSignal) {
    return this.shipping.createShipment(orderId, signal);
  }
}

// Inside a service or job (not an entrypoint): use a policy object
@Injectable()
export class RepricingService {
  private readonly carrier: ResiliencePolicy;

  constructor(resilience: ResilienceService, private readonly client: CarrierClient) {
    this.carrier = resilience.preset('carrier'); // shares the same breaker
  }

  quote(order: Order) {
    return this.carrier.execute(({ signal }) => this.client.getQuotes(order, signal));
  }
}
```

Rules of thumb (from the docs checklist):

- Time per attempt x attempts + backoff must fit inside your client's and load balancer's timeouts.
- Retry at one layer only. Turn off retries in the SDK or HTTP client underneath.
- Give every breaker a timeout: a call that hangs never counts as a failure.
- Breaker state is per process. With 5 instances there are 5 breakers.
- Alert when a breaker opens.

Reference: [NestJS Resilience](https://docs.nestjs.com/reliability/resilience)
