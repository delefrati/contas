import { Controller, Get, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { LogService, LogDto } from './log.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/logs')
@UseGuards(JwtAuthGuard)
export class LogController {
  constructor(private logService: LogService) {}

  @Get()
  async findAll(@Query('limit') limit?: string): Promise<{ data: LogDto[] }> {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const data = await this.logService.findAll(limitNum);
    return { data };
  }

  @Get('resource/:resource')
  async findByResource(
    @Param('resource') resource: string,
    @Query('resourceId', new ParseIntPipe({ optional: true })) resourceId?: number,
    @Query('limit') limit?: string,
  ): Promise<{ data: LogDto[] }> {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const data = await this.logService.findByResource(resource, resourceId, limitNum);
    return { data };
  }

  @Get('action/:action')
  async findByAction(
    @Param('action') action: string,
    @Query('limit') limit?: string,
  ): Promise<{ data: LogDto[] }> {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const data = await this.logService.findByAction(action, limitNum);
    return { data };
  }
}
