import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { count } from 'console';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { DRIZZLE_DB } from 'src/db/db.module';
import { apiKey } from 'src/db/schema';

@Injectable()
export class ApiKeyService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: any) {}

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
      name,
      value: hash,
      prefix,
    });

    return { key: plaintextkey };
  }

  async listApikeys(userId: string) {}

  async deleteApiKey(id: string) {}

  async regenerateApiKey(userId: string, id: string) {}
}
