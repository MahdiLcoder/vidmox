import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";


export const REDIS_CLIENT = 'REDIS_CLIENT'

export interface RedisInterface {
    
}

@Global()
@Module({
    providers:[
        {
            provide: REDIS_CLIENT,
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => {
               const redis = new Redis({
                   host: configService.get<string>('REDIS_HOST', 'localhost'),
                   port: configService.get<number>('REDIS_PORT', 6379),
                   password: configService.get<string>('REDIS_PASSWORD') || undefined,
                   db: configService.get<number>('REDIS_DB', 0),
                   retryStrategy: (times) => {
                       if (times > 3) return null
                       return Math.min(times * 200, 2000)
                   }
               })
                redis.on('connect', () => {
                    console.log('Redis Connected')
                })

                redis.on('error', (err) => {
                    console.error('Redis Error', err)
                })

                redis.on('end', () => {
                    console.log('Redis Disconnected')
                })  

               return redis
            },
        },
    ],
    exports: [REDIS_CLIENT],
})
export class RedisModule {}