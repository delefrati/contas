import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContextService } from '../common/request-context.service';
import { BandService } from '../band/band.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private requestContext: RequestContextService,
    private bandService: BandService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    let memberId: number | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        // Decode payload without verification (JwtAuthGuard handles verification)
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
        );
        if (typeof payload?.memberId === 'number') {
          memberId = payload.memberId;
        }
      } catch {
        // Malformed token — context will have no memberId
      }
    }

    let bandId: number | undefined;
    try {
      const slug = this.bandService.resolveSlug(req.headers.host);
      bandId = slug ? (await this.bandService.findBySlug(slug))?.id : undefined;
    } catch (error) {
      next(error);
      return;
    }

    this.requestContext.run({ memberId, bandId }, () => next());
  }
}
