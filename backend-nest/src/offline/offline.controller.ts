import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OfflineService, OfflineSnapshotDto } from './offline.service';

@Controller('api/offline')
@UseGuards(JwtAuthGuard)
export class OfflineController {
  constructor(private offlineService: OfflineService) {}

  @Get('snapshot')
  @Header('Cache-Control', 'no-store')
  async snapshot(): Promise<{ data: OfflineSnapshotDto }> {
    return { data: await this.offlineService.getSnapshot() };
  }
}
