---
title: Use Message Queues for Background Jobs
impact: MEDIUM-HIGH
impactDescription: Queues enable reliable background processing
tags: microservices, queues, bullmq, background-jobs
---

## Use Message Queues for Background Jobs

Use `@nestjs/bullmq` for background job processing. Queues decouple long-running tasks from HTTP requests, enable retry logic, and distribute workload across workers. Use them for emails, file processing, notifications, and any task that shouldn't block user requests.

Note: `@nestjs/bullmq` is not the same API as the older `@nestjs/bull`. In BullMQ, a consumer class extends `WorkerHost` and implements one `process()` method. The Bull-style `@Process('name')` handler decorator and `@OnQueueActive()` / `@OnQueueCompleted()` / `@OnQueueFailed()` do not work with BullMQ. Switch on `job.name` inside `process()`, and listen to worker events with `@OnWorkerEvent()`.

**Incorrect (long-running tasks in HTTP handlers):**

```typescript
// Long-running tasks in HTTP handlers
@Controller('reports')
export class ReportsController {
  @Post()
  async generate(@Body() dto: GenerateReportDto): Promise<Report> {
    // This blocks the request for potentially minutes
    const data = await this.fetchLargeDataset(dto);
    const report = await this.processData(data); // Slow!
    await this.sendEmail(dto.email, report); // Can fail!
    return report; // Client times out
  }
}

// Fire-and-forget without retry
@Injectable()
export class EmailService {
  async sendWelcome(email: string): Promise<void> {
    // If this fails, email is never sent
    await this.mailer.send({ to: email, template: 'welcome' });
    // No retry, no tracking, no visibility
  }
}

// Use setInterval for scheduled tasks
setInterval(async () => {
  await cleanupOldRecords();
}, 60000); // No error handling, runs on every instance

// Bull (old package) API used with BullMQ - these handlers never run
@Processor('reports')
export class ReportsProcessor {
  @Process('generate') // Not supported by @nestjs/bullmq
  async generate(job: Job) {}

  @OnQueueFailed() // From @nestjs/bull, not @nestjs/bullmq
  onFailed(job: Job, error: Error) {}
}
```

**Correct (use BullMQ for background processing):**

```typescript
// Configure BullMQ
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: 'localhost',
        port: 6379,
      },
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'reports' },
      { name: 'maintenance' },
    ),
  ],
  providers: [ReportsProcessor, EmailProcessor, MaintenanceProcessor],
})
export class QueueModule {}

// Producer: Add jobs to queue
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class ReportsService {
  constructor(@InjectQueue('reports') private readonly reportsQueue: Queue) {}

  async requestReport(dto: GenerateReportDto): Promise<{ jobId: string }> {
    // Return immediately, process in background
    const job = await this.reportsQueue.add('generate', dto, {
      priority: dto.urgent ? 1 : 10,
      delay: dto.scheduledFor ? Math.max(0, Date.parse(dto.scheduledFor) - Date.now()) : 0,
    });

    return { jobId: job.id! };
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    const job = await this.reportsQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return {
      status: await job.getState(),
      progress: job.progress,
      result: job.returnvalue,
    };
  }
}

// Consumer: extend WorkerHost and implement process()
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('reports', { concurrency: 2 }) // run up to 2 jobs at once per instance
export class ReportsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportsProcessor.name);

  async process(job: Job<GenerateReportDto>): Promise<Report> {
    switch (job.name) {
      case 'generate':
        return this.generateReport(job);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  private async generateReport(job: Job<GenerateReportDto>): Promise<Report> {
    await job.updateProgress(10);

    const data = await this.fetchData(job.data);
    await job.updateProgress(50);

    const report = await this.processData(data);
    await job.updateProgress(90);

    await this.saveReport(report);
    await job.updateProgress(100);

    return report; // stored as job.returnvalue
  }

  // Worker events use @OnWorkerEvent, inside the processor class
  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} (${job.name})`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(`Job ${job?.id} failed: ${error.message}`, error.stack);
  }
}

// Email queue: throwing makes BullMQ retry, using the job's attempts/backoff
@Processor('email')
export class EmailProcessor extends WorkerHost {
  constructor(private readonly mailer: MailerService) {
    super();
  }

  async process(job: Job<SendEmailDto>): Promise<void> {
    const { to, template, data } = job.data;
    await this.mailer.send({ to, template, context: data });
  }
}

// Usage
@Injectable()
export class NotificationService {
  constructor(@InjectQueue('email') private readonly emailQueue: Queue) {}

  async sendWelcome(user: User): Promise<void> {
    await this.emailQueue.add(
      'send',
      {
        to: user.email,
        template: 'welcome',
        data: { name: user.name },
      },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
  }
}

// Scheduled jobs: job schedulers (BullMQ 5.16+) replace the old `repeat` option.
// upsertJobScheduler is safe to call on every startup - it updates, never duplicates.
@Injectable()
export class ScheduledJobsService implements OnModuleInit {
  constructor(@InjectQueue('maintenance') private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // Clean up old reports daily at midnight
    await this.queue.upsertJobScheduler(
      'daily-cleanup',
      { pattern: '0 0 * * *' },
      { name: 'cleanup', data: {} },
    );

    // Send digest every hour
    await this.queue.upsertJobScheduler(
      'hourly-digest',
      { every: 60 * 60 * 1000 },
      { name: 'digest', data: {} },
    );
  }
}

@Processor('maintenance')
export class MaintenanceProcessor extends WorkerHost {
  constructor(@InjectQueue('email') private readonly emailQueue: Queue) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'cleanup':
        await this.cleanupOldReports();
        await this.cleanupExpiredSessions();
        return;
      case 'digest': {
        const users = await this.getUsersForDigest();
        // One bulk call instead of one Redis round trip per user
        await this.emailQueue.addBulk(
          users.map((user) => ({ name: 'send', data: { to: user.email, template: 'digest' } })),
        );
        return;
      }
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }
}

// Queue monitoring with Bull Board
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/admin/queues', // protect this route with an admin guard
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'email',
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'reports',
      adapter: BullMQAdapter,
    }),
  ],
})
export class AdminModule {}
```

Reference: [NestJS Queues](https://docs.nestjs.com/application/queues) · [BullMQ Job Schedulers](https://docs.bullmq.io/guide/job-schedulers)
