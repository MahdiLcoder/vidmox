export const VERSION = 'v1';
export const REDIS_HARD_TTL = 10 * 60;
export const LRU_SOFT_TTL_MS = 5 * 60 * 1000;
export const LAST_USED_DEBOUNCE_SECONDS = 60;
export const LAST_USED_HASH = 'vmx:api_key:last_used:' + VERSION;
export const DEFAULT_PLAYLIST_LIMIT = 10;

export interface CacheKey {
  userId: string;
  apiKeyDigest: string;
  expiredAt: number;
}
