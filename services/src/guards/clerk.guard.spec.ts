import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ClerkAuthGuard } from './clerk.guard';
import { DRIZZLE_DB } from 'src/db/db.module';
import { REDIS_CLIENT } from 'src/infra/redis.module';
import { ConfigService } from '@nestjs/config';

const mockVerifyToken = jest.fn();
const mockExtractKeyId = jest.fn();
const mockDigest = jest.fn();

jest.mock('@clerk/backend', () => ({
  verifyToken: (...args: any[]) => mockVerifyToken(...args),
}));

jest.mock('src/utils/extractKeyVerifier', () => ({
  extractKeyId: (...args: any[]) => mockExtractKeyId(...args),
}));

jest.mock('src/utils/keyDigest', () => ({
  digest: (...args: any[]) => mockDigest(...args),
}));

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
  argon2id: 2,
}));

import * as argon2 from 'argon2';

describe('ClerkAuthGuard', () => {
  let guard: ClerkAuthGuard;

  const mockDb = {
    query: {
      apiKey: {
        findFirst: jest.fn(),
      },
    },
  };

  const mockRedis = {
    hgetall: jest.fn(),
    hset: jest.fn(),
    expire: jest.fn(),
    set: jest.fn(),
    hget: jest.fn(),
    del: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const userId = 'user_123';
  const digestValue = 'mock_digest_value';

  function mockExecutionContext(
    headers: Record<string, string>,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
        }),
      }),
    } as any;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('clerk_secret_key');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClerkAuthGuard,
        { provide: DRIZZLE_DB, useValue: mockDb },
        { provide: REDIS_CLIENT, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    guard = module.get<ClerkAuthGuard>(ClerkAuthGuard);
  });

  describe('API key authentication', () => {
    it('should throw UnauthorizedException when API key has invalid format', async () => {
      mockExtractKeyId.mockReturnValue(null);

      await expect(
        guard.canActivate(mockExecutionContext({ 'x-api-key': 'invalid_key' })),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when Redis has invalid flag', async () => {
      mockExtractKeyId.mockReturnValue('key_invalid_flag');
      mockDigest.mockReturnValue(digestValue);
      mockRedis.hgetall.mockResolvedValue({ invalid: '1' });

      await expect(
        guard.canActivate(
          mockExecutionContext({ 'x-api-key': 'VMX_key_invalid_flag_secret' }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when Redis digest mismatches', async () => {
      mockExtractKeyId.mockReturnValue('key_digest_mismatch');
      mockDigest.mockReturnValue(digestValue);
      mockRedis.hgetall.mockResolvedValue({ apiKeyDigest: 'wrong_digest' });

      await expect(
        guard.canActivate(
          mockExecutionContext({
            'x-api-key': 'VMX_key_digest_mismatch_secret',
          }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should authenticate from Redis when user_id is present', async () => {
      mockExtractKeyId.mockReturnValue('key_redis_auth');
      mockDigest.mockReturnValue(digestValue);
      mockRedis.hgetall.mockResolvedValue({
        user_id: userId,
        apiKeyDigest: digestValue,
      });
      mockRedis.set.mockResolvedValue('OK');

      const result = await guard.canActivate(
        mockExecutionContext({ 'x-api-key': 'VMX_key_redis_auth_secret' }),
      );

      expect(result).toBe(true);
    });

    it('should authenticate from DB when Redis has digest match but no user_id and argon2 verify passes', async () => {
      mockExtractKeyId.mockReturnValue('key_db_auth');
      mockDigest.mockReturnValue(digestValue);
      mockRedis.hgetall.mockResolvedValue({ apiKeyDigest: digestValue });
      mockDb.query.apiKey.findFirst.mockResolvedValue({
        value: 'hashed_key',
        user_id: userId,
        revoked_at: null,
      });
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await guard.canActivate(
        mockExecutionContext({ 'x-api-key': 'VMX_key_db_auth_secret' }),
      );

      expect(result).toBe(true);
      expect(argon2.verify).toHaveBeenCalledWith(
        'hashed_key',
        'VMX_key_db_auth_secret',
      );
    });

    it('should throw UnauthorizedException when DB find returns null', async () => {
      mockExtractKeyId.mockReturnValue('key_db_not_found');
      mockDigest.mockReturnValue(digestValue);
      mockRedis.hgetall.mockResolvedValue({ apiKeyDigest: digestValue });
      mockDb.query.apiKey.findFirst.mockResolvedValue(null);

      await expect(
        guard.canActivate(
          mockExecutionContext({ 'x-api-key': 'VMX_key_db_not_found_secret' }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when argon2 verify fails', async () => {
      mockExtractKeyId.mockReturnValue('key_argon2_fail');
      mockDigest.mockReturnValue(digestValue);
      mockRedis.hgetall.mockResolvedValue({ apiKeyDigest: digestValue });
      mockDb.query.apiKey.findFirst.mockResolvedValue({
        value: 'hashed_key',
        user_id: userId,
        revoked_at: null,
      });
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await expect(
        guard.canActivate(
          mockExecutionContext({ 'x-api-key': 'VMX_key_argon2_fail_secret' }),
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockRedis.hset).toHaveBeenCalledWith(
        'vmx:api_key:v1:key_argon2_fail',
        { invalid: '1' },
      );
    });

    it('should populate LRU cache on Redis auth and hit it on subsequent call', async () => {
      mockExtractKeyId.mockReturnValue('key_lru_test');
      mockDigest.mockReturnValue(digestValue);
      mockRedis.set.mockResolvedValue('OK');

      // First call: Redis has user_id, populates LRU cache
      mockRedis.hgetall.mockResolvedValueOnce({
        user_id: userId,
        apiKeyDigest: digestValue,
      });

      const result1 = await guard.canActivate(
        mockExecutionContext({ 'x-api-key': 'VMX_key_lru_test_secret' }),
      );
      expect(result1).toBe(true);

      // Second call: should hit LRU cache without touching Redis
      const result2 = await guard.canActivate(
        mockExecutionContext({ 'x-api-key': 'VMX_key_lru_test_secret' }),
      );
      expect(result2).toBe(true);
    });

    it('should track last used via Redis', async () => {
      mockExtractKeyId.mockReturnValue('key_track_used');
      mockDigest.mockReturnValue(digestValue);
      mockRedis.hgetall.mockResolvedValue({
        user_id: userId,
        apiKeyDigest: digestValue,
      });
      mockRedis.set.mockResolvedValue('OK');

      await guard.canActivate(
        mockExecutionContext({ 'x-api-key': 'VMX_key_track_used_secret' }),
      );

      expect(mockRedis.set).toHaveBeenCalledWith(
        'vmx:api_key:last_used_lock:key_track_used',
        '1',
        'EX',
        expect.any(Number),
        'NX',
      );
    });
  });

  describe('JWT token authentication', () => {
    it('should throw UnauthorizedException when no token is provided', async () => {
      await expect(guard.canActivate(mockExecutionContext({}))).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      mockVerifyToken.mockRejectedValue(new Error('Invalid token'));

      await expect(
        guard.canActivate(
          mockExecutionContext({ authorization: 'Bearer invalid_token' }),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should authenticate with valid Clerk JWT token', async () => {
      const payload = { sub: userId };
      mockVerifyToken.mockResolvedValue(payload);

      const result = await guard.canActivate(
        mockExecutionContext({ authorization: 'Bearer valid_token' }),
      );

      expect(result).toBe(true);
      expect(mockVerifyToken).toHaveBeenCalledWith('valid_token', {
        secretKey: 'clerk_secret_key',
      });
    });
  });
});
