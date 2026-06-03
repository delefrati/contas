import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  memberId?: number;
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
}
