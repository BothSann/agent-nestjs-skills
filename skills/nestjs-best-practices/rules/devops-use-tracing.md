---
title: Trace Requests with OpenTelemetry
impact: MEDIUM
impactDescription: Shows where a slow or failed request spent its time, across services and the database
tags: devops, observability, opentelemetry, tracing
---

## Trace Requests with OpenTelemetry

**Impact: MEDIUM (shows where a slow or failed request spent its time, across services and the database)**

Logs tell you what happened. A trace tells you where the time went: which HTTP call, which query, which service. Use OpenTelemetry, the vendor-neutral standard: your traces can go to Jaeger, Grafana Tempo, Datadog, Honeycomb, or any other OTLP backend without code changes.

The instrumentation must load **before** Nest and the libraries it patches. Importing it inside `AppModule`, or after `@nestjs/core`, records nothing.

**Incorrect (SDK started too late, spans never ended):**

```typescript
// main.ts
import { NestFactory } from '@nestjs/core'; // already loaded: http, express, pg are not patched
import { otelSdk } from './instrumentation';
otelSdk.start();

// pricing.service.ts
async quote(cart: Cart) {
  const span = tracer.startSpan('quote');
  const result = await this.calculate(cart); // if this throws, the span is never ended
  span.end();
  return result;
}
```

**Correct (load on the command line, end every span, flush on shutdown):**

```bash
# Zero-code: auto-instruments http, fetch, express, pg, mysql2, mongodb, ...
npm i --save @opentelemetry/api @opentelemetry/auto-instrumentations-node

# CommonJS build
OTEL_SERVICE_NAME=orders-api OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318 \
  node --require @opentelemetry/auto-instrumentations-node/register dist/main.js

# ES module build (default for `nest new` on Nest 12): also needs the loader hook
OTEL_SERVICE_NAME=orders-api OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318 \
  node --experimental-loader=@opentelemetry/instrumentation/hook.mjs \
  --import @opentelemetry/auto-instrumentations-node/register dist/main.js
```

```typescript
// Your own spans inside providers (not traced automatically)
import { SpanStatusCode, trace } from '@opentelemetry/api';

const tracer = trace.getTracer('orders-api');

@Injectable()
export class PricingService {
  async quote(cart: Cart) {
    return tracer.startActiveSpan('PricingService.quote', async (span) => {
      try {
        span.setAttribute('cart.items', cart.items.length); // ids and counts, never personal data
        return await this.calculate(cart);
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end(); // always
      }
    });
  }
}

// If you start the SDK yourself (NodeSDK), flush the last batch on shutdown
@Injectable()
export class TracingShutdown implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await otelSdk.shutdown(); // needs app.enableShutdownHooks()
  }
}
```

Notes:

- Can't change the start command? Put the same flags in `NODE_OPTIONS`.
- At the time of writing, `@opentelemetry/instrumentation-nestjs-core` supports `@nestjs/core` below 12. On Nest 12 you still get HTTP and DB spans, but not the controller spans. Check the version you install.
- Put the trace id in your logs so a log line leads to its trace (see `devops-use-logging`).

Reference: [NestJS OpenTelemetry](https://docs.nestjs.com/observability/opentelemetry) · [OpenTelemetry Node.js](https://opentelemetry.io/docs/languages/js/)
