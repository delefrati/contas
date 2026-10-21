import { Injectable, NotFoundException } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  memberId?: number;
  bandId?: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class RequestContextService {
  run(context: RequestContext, callback: () => void): void {
    storage.run(context, callback);
  }

  getMemberId(): number | undefined {
    return storage.getStore()?.memberId;
  }

  getBandId(): number | undefined {
    return storage.getStore()?.bandId;
  }

  // Band resolved from the request host; every band-scoped query goes through this.
  requireBandId(): number {
    const bandId = this.getBandId();
    if (!bandId) {
      throw new NotFoundException('Band not found');
    }
    return bandId;
  }
}
