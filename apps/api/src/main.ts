import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { StrictValidationPipe } from './common/pipes/zod-validation.pipe';

async function bootstrap() {
  const logger = WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, context }) =>
            `${timestamp} [${context ?? 'App'}] ${level}: ${message}`,
          ),
        ),
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      }),
    ],
  });

  const app = await NestFactory.create(AppModule, { logger });

  const config = app.get(ConfigService);
  const reflector = app.get(Reflector);

  // ── Security ────────────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(compression());

  app.enableCors({
    origin: config.get<string>('app.frontendUrl'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  });

  // ── Global Pipes / Filters / Guards / Interceptors ──────────────────────────
  app.useGlobalPipes(new StrictValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalGuards(new JwtAuthGuard(reflector), new RolesGuard(reflector));
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // ── API prefix ───────────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1', { exclude: ['/health', '/metrics'] });

  // ── Swagger (disabled in production) ────────────────────────────────────────
  if (config.get<string>('app.env') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Vilar DS API')
      .setDescription('SaaS Platform — CRM · Facturation · RH')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Tenant-ID' }, 'tenantId')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get<number>('app.port', 4000);
  await app.listen(port);

  console.log(`\n🚀 Vilar DS API running on http://localhost:${port}/api/v1`);
  if (config.get<string>('app.env') !== 'production') {
    console.log(`📖 Swagger UI: http://localhost:${port}/api/docs\n`);
  }
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
