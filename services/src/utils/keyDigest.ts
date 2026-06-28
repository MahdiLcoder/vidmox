import * as crypto from 'crypto'

const REDIS_KEY_SECRET = process.env.REDIS_KEY_SECRET || 'api_key:'

export const digest = (plainKey: string) => {
    return crypto.createHmac('sha256', REDIS_KEY_SECRET)
                    .update(plainKey)
                    .digest('hex')
}