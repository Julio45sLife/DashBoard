import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiExcludeController } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { Public } from '../../common/decorators/roles.decorator';

@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private metricsService: MetricsService) {}

  @Get()
  @Public()
  async metrics(@Res() res: Response) {
    const [body, contentType] = await Promise.all([
      this.metricsService.getMetrics(),
      Promise.resolve(this.metricsService.getContentType()),
    ]);

    res.setHeader('Content-Type', contentType);
    res.end(body);
  }
}
