import { Controller, Get, NotFoundException, Query } from '@nestjs/common';
import { BandDto, BandService } from './band.service';
import { RequestContextService } from '../common/request-context.service';

@Controller('api/band')
export class BandController {
  constructor(
    private bandService: BandService,
    private requestContext: RequestContextService,
  ) {}

  @Get()
  async current(): Promise<{ data: BandDto }> {
    const band = await this.bandService.findById(this.requestContext.requireBandId());
    if (!band) throw new NotFoundException('Band not found');
    return { data: band };
  }

  // Caddy on-demand TLS "ask" endpoint: only issue certificates for existing bands.
  @Get('tls-check')
  async tlsCheck(@Query('domain') domain: string): Promise<{ status: string }> {
    const slug = this.bandService.slugFromHost(domain);
    if (!slug || !(await this.bandService.findBySlug(slug))) {
      throw new NotFoundException('Unknown band domain');
    }
    return { status: 'ok' };
  }
}
