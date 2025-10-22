import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): object {
    return {
      message: 'Welcome to Wildberries A/B Testing API',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        docs: '/api/docs (coming soon)',
      },
    };
  }
}
