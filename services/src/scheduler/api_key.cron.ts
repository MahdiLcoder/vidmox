import { Inject, Injectable } from "@nestjs/common";
import { DRIZZLE_DB } from "src/db/db.module";
import * as schema from "src/db/schema";
import { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { Cron } from "@nestjs/schedule";
import Redis from "ioredis";
import { REDIS_CLIENT } from "src/infra/redis.module";
import { LAST_USED_HASH } from "src/configs/constanst";
import { sql } from "drizzle-orm";


@Injectable()
export class ApiKeyUsageCron {
    constructor(
        @Inject(DRIZZLE_DB) private readonly db: NeonHttpDatabase<typeof schema>,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
    ) {}

    @Cron('*/5 * * * *')
    async flushLastUsed() {
        const map = await this.redis.hgetall(LAST_USED_HASH)
        if (!map || Object.keys(map).length === 0) return;
        
        await this.redis.del(LAST_USED_HASH);

        const entries = Object.entries(map).map(([keyId, ts]) => ({
            keyId: keyId,
            ts: new Date(Number(ts)),
        })).filter((x) => x.keyId && x.ts instanceof Date && !isNaN(x.ts.getTime()))

        if (entries.length === 0) return;

        const valueSql = sql.join(entries.map((e) => sql`(${e.keyId}, ${e.ts})`),
        sql`,`
        )
        

        await this.db.execute(sql`
            UPDATE api_key
            SET last_used_at = v.ts
            FROM (VALUES ${valueSql}) AS v(key_id, ts)
            WHERE api_key.id = v.key_id
        `)
        
    }
}