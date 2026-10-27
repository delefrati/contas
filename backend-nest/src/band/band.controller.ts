import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { BandDto, BandService, MAX_LOGO_BYTES } from './band.service';
import { RequestContextService } from '../common/request-context.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LogService } from '../log/log.service';

@Controller('api/band')
export class BandController {
  constructor(
    private bandService: BandService,
    private requestContext: RequestContextService,
    private logService: LogService,
  ) {}

  @Get()
  async current(): Promise<{ data: BandDto }> {
    const band = await this.bandService.findById(this.requestContext.requireBandId());
    if (!band) throw new NotFoundException('Band not found');
    return { data: band };
  }

  // Public: the login page shows it. The URL in BandDto.logoUrl changes on every upload.
  @Get('logo')
  async logo(@Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const logo = await this.bandService.getLogo(this.requestContext.requireBandId());
    if (!logo) throw new NotFoundException('Band has no logo');
    // Only the image itself may be cached for good, never the 404
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return new StreamableFile(logo.data, { type: logo.type, length: logo.data.length });
  }

  @Put('logo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('logo', { limits: { fileSize: MAX_LOGO_BYTES, files: 1 } }))
  async uploadLogo(@UploadedFile() file?: { buffer: Buffer }): Promise<{ data: BandDto }> {
    if (!file) throw new BadRequestException('Send the image in the "logo" field');
    const data = await this.bandService.setLogo(this.requestContext.requireBandId(), file.buffer);
    await this.logService.log('UPDATE', 'band_logo', data.id, { bytes: file.buffer.length });
    return { data };
  }

  @Delete('logo')
  @UseGuards(JwtAuthGuard)
  async removeLogo(): Promise<{ data: BandDto }> {
    const data = await this.bandService.removeLogo(this.requestContext.requireBandId());
    await this.logService.log('DELETE', 'band_logo', data.id);
    return { data };
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
