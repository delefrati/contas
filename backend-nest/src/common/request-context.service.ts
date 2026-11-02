import { Injectable, NotFoundException } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

// Who is acting: a band member, or a super admin (not a member of any band)
export interface Identity {
  memberId?: number;
  superAdminId?: number;
}

interface RequestContext extends Identity {
  bandId?: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

@Injectable()
export class RequestContextService {
  run(context: RequestContext, callback: () => void): void {
    storage.run(context, callback);
  }

  // Whoever is authenticated on the current request (empty when nobody is)
  getIdentity(): Identity {
    const store = storage.getStore();
    return { memberId: store?.memberId, superAdminId: store?.superAdminId };
  }

  // Runs fn as if the request had come from the given band, keeping who is acting.
  // Only for the admin panel, whose super admins work on bands chosen by id, not by host.
  withBand<T>(bandId: number, fn: () => T): T {
    return storage.run({ ...storage.getStore(), bandId }, fn);
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
