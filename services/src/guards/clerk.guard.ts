import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common"
import { LRUCache } from "lru-cache"
import {verifyToken} from '@clerk/backend';
import { REDIS_CLIENT } from "src/infra/redis.module";
import redis from 'ioredis'
import { DRIZZLE_DB } from "src/db/db.module";
import { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from '../db/schema';
import { and, eq, isNull } from 'drizzle-orm'
import * as argon2 from 'argon2';
import { extractKeyId } from "src/utils/extractKeyVerifier";
import { ConfigService } from "@nestjs/config";
import { digest } from "src/utils/keyDigest";
import { CacheKey, LAST_USED_DEBOUNCE_SECONDS, LAST_USED_HASH, LRU_SOFT_TTL_MS, REDIS_HARD_TTL, VERSION } from "src/configs/constanst";


const localCache = new LRUCache<string, CacheKey>({
    max: 100_000
})

@Injectable()
export class ClerkAuthGuard implements CanActivate {

    constructor(
        @Inject(DRIZZLE_DB)
        private readonly db: NeonHttpDatabase<typeof schema>,
        @Inject(REDIS_CLIENT)
        private readonly redis: redis,
        private readonly configService: ConfigService,
    ) { }
    
    private async trackApiKeyLastUsed(keyId: string) {
        const lockKey = `vmx:api_key:last_used_lock:${keyId}`
        const ok = await this.redis.set(lockKey, "1", "EX", LAST_USED_DEBOUNCE_SECONDS, "NX")
        if (!ok){
            return;
        }
        await this.redis.hset(LAST_USED_HASH, keyId, Date.now().toString())
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers['x-api-key'];
        if (apiKey) {
            const keyId = extractKeyId(apiKey)
            if (!keyId){
                throw new UnauthorizedException('Invalid api key');
            }
            const d = digest(apiKey)
            const lruKey = `${VERSION}:${keyId}`
            const now = Date.now()

            try {
                const c = localCache.get(lruKey)
                if (c && c.expiredAt > now && c.apiKeyDigest === d){
                    request.user = {id: c.userId, keyId}
                    void this.trackApiKeyLastUsed(keyId)
                    return true
                } 
                const rKeyDigest = `vmx:api_key:${VERSION}:${keyId}`
                const rdigest = await this.redis.hgetall(rKeyDigest)

                if (rdigest?.invalid === "1" || rdigest?.apiKeyDigest !== d ){
                    throw new UnauthorizedException('Unauthorized!');
                }
                if (rdigest?.user_id) {
                    localCache.set(lruKey, {
                        userId: rdigest.user_id,
                        apiKeyDigest: d,
                        expiredAt: now + LRU_SOFT_TTL_MS
                    })
                    request.user = {id: rdigest.user_id, keyId}
                    void this.trackApiKeyLastUsed(keyId)
                    return true
                }
                const record = await this.db.query.apiKey.findFirst({
                   where: (ak)=> and(
                    eq(ak.id, keyId),
                    isNull(ak.revoked_at)
                    ),
                    columns: {
                        value: true,
                        user_id: true,
                        revoked_at: true
                    }
               })
               if (!record){
                throw new UnauthorizedException('Unauthorized!');
               }
               const isValid = await argon2.verify(record.value, apiKey)
               if (!isValid){
                   await this.redis.hset(rKeyDigest, {
                       invalid: "1",
                   })
                   await this.redis.expire(rKeyDigest, REDIS_HARD_TTL)
                   throw new UnauthorizedException('Unauthorized!');
               }
               await this.redis.hset(rKeyDigest, {
                   user_id: record.user_id,
               })
                await this.redis.expire(rKeyDigest, REDIS_HARD_TTL)
                
                request.user = { id: record.user_id, keyId }
                void this.trackApiKeyLastUsed(keyId)
                return true
            } catch (error) {
                console.log(error)
                throw new UnauthorizedException('Unauthorized!');
            }
        }
            const token = request.headers['authorization']?.split(' ')[1];
            if (!token) {
                throw new UnauthorizedException('No token provided');
            }
           try {
            const payload = await verifyToken(token, {
                secretKey: this.configService.get<string>('CLERK_SECRET_KEY'),
            });
               request.user = {
                   id: payload.sub,
                   ...payload
               };
               return true;
           } catch (error) {
            throw new UnauthorizedException('Invalid token');
           }
    }
    
}