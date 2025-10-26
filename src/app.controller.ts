import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded';
  timestamp: string;
  database: 'connected' | 'disconnected';
  uptime: string;
  memory: {
    rss: string;
    heapTotal: string;
    heapUsed: string;
    external: string;
  };
  environment: string;
  nodeVersion: string;
  platform: string;
}

@ApiTags('System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get API information' })
  @ApiResponse({ status: 200, description: 'Returns API information' })
  getHello() {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: 'Check system health' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns system health status',
    type: Object as () => HealthCheckResponse,
  })
  healthCheck() {
    const health = this.appService.getHealth();
    return health as HealthCheckResponse;
  }
}
