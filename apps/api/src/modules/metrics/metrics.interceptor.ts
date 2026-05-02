import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';
import { Request, Response } from 'express';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method } = request;
    const route = (request.route?.path as string | undefined) ?? request.url;
    const end = this.metrics.httpRequestDuration.startTimer({ method, route });

    this.metrics.httpRequestsInFlight.inc();

    return next.handle().pipe(
      tap({
        next: () => {
          const statusCode = String(response.statusCode);
          end({ status_code: statusCode });
          this.metrics.httpRequestsTotal.inc({ method, route, status_code: statusCode });
          this.metrics.httpRequestsInFlight.dec();
        },
        error: () => {
          end({ status_code: '500' });
          this.metrics.httpRequestsTotal.inc({ method, route, status_code: '500' });
          this.metrics.httpRequestsInFlight.dec();
        },
      }),
    );
  }
}
