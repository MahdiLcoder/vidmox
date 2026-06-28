import { Module, Global } from '@nestjs/common';
import { LRUCache } from 'lru-cache';

export const LRU_CACHE = 'LRU_CACHE';

export interface CacheInterface {
  user_id: string;
  public_id?: string;
  last_used?: string;
}

@Global()
@Module({
  providers: [
    {
      provide: LRU_CACHE,
      useValue: new LRUCache<string, CacheInterface>({
        max: 10000,
        ttl: 1000 * 60 * 5,
        updateAgeOnGet: true,
        updateAgeOnHas: true,
        allowStale: false,
      }),
    },
  ],
  exports: [LRU_CACHE],
})
export class CacheModule {}
