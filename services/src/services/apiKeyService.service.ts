import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { and, count, desc, eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { DRIZZLE_DB } from 'src/db/db.module';
import { apiKey } from 'src/db/schema';
import redis from 'ioredis';
import { REDIS_CLIENT } from 'src/infra/redis.module';
import * as schema from 'src/db/schema';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { CacheKey, LAST_USED_HASH, VERSION } from 'src/configs/constanst';
import { LRUCache } from 'lru-cache';

const localCache = new LRUCache<string, CacheKey>({
  max: 100_000,
});

@Injectable()
export class ApiKeyService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: NeonHttpDatabase<typeof schema>,
    @Inject(REDIS_CLIENT) private readonly redis: redis,
  ) {}

  private generateKey(): { plaintextkey: string; keyId: string } {
    const keyId = crypto.randomUUID().replace(/-/g, '');
    const secret = randomBytes(32).toString('base64url');
    const plaintextkey = `VMX_${keyId}_${secret}`;
    return { plaintextkey, keyId };
  }

  async createApiKey(userId: string, name: string) {
    const [result] = await this.db
      .select({ count: count() })
      .from(apiKey)
      .where(eq(apiKey.user_id, userId));
    if (result.count >= 5) {
      throw new BadRequestException(
        'You have reached the maximum number of API keys (5)',
      );
    }

    const { plaintextkey, keyId } = this.generateKey();
    const hash = await argon2.hash(plaintextkey, {
      type: argon2.argon2id,
      timeCost: 3,
      memoryCost: 1 << 16,
      parallelism: 1,
    });

    const prefix = plaintextkey.substring(0, 18) + '...';

    await this.db.insert(apiKey).values({
      id: keyId,
      user_id: userId,
      value: hash,
      prefix,
    });

    return { key: plaintextkey };
  }

  async listApikeys(userId: string) {
    return this.db
      .select({
        id: apiKey.id,
        prefix: apiKey.prefix,
        createdAt: apiKey.created_at,
        last_used_at: apiKey.last_used_at,
        revoked_at: apiKey.revoked_at,
      })
      .from(apiKey)
      .where(and(eq(apiKey.user_id, userId)));
  }

  async apiKeyLastUsed(keyId: string) {
    const redisValue = await this.redis.hget(LAST_USED_HASH, keyId);
    if (redisValue) return new Date(Number(redisValue));

    const record = await this.db.query.apiKey.findFirst({
      where: (ak) => eq(ak.id, keyId),
      columns: {
        last_used_at: true,
      },
    });

    return record?.last_used_at ?? null;
  }

  async deleteApiKey(userId: string, keyId: string) {
    await this.db
      .update(apiKey)
      .set({
        revoked_at: new Date(),
      })
      .where(and(eq(apiKey.id, keyId), eq(apiKey.user_id, userId)));

    await this.redis.del(`vmx:api_key:${VERSION}:${keyId}`);
    localCache.delete(`${VERSION}:${keyId}`);
  }

  async regenerateApiKey(userId: string, keyId: string) {
    const { plaintextkey, keyId: newKeyId } = this.generateKey();
    const hash = await argon2.hash(plaintextkey, {
      type: argon2.argon2id,
      timeCost: 3,
      memoryCost: 1 << 16,
      parallelism: 1,
    });
    const prefix = plaintextkey.substring(0, 18) + '...';
    await this.db
      .update(apiKey)
      .set({
        value: hash,
        prefix,
        id: newKeyId,
      })
      .where(and(eq(apiKey.user_id, userId), eq(apiKey.id, keyId)));
    return { key: plaintextkey };
  }
}
