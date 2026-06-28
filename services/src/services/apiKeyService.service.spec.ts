import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ApiKeyService } from './apiKeyService.service';
import { DRIZZLE_DB } from 'src/db/db.module';
import { REDIS_CLIENT } from 'src/infra/redis.module';
import { LAST_USED_HASH, VERSION } from 'src/configs/constanst';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed_value'),
  verify: jest.fn(),
  argon2id: 2,
}));

import * as argon2 from 'argon2';

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  const mockQuery = {
    where: jest.fn(),
    from: jest.fn(),
  };

  const mockDb = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    query: {
      apiKey: {
        findFirst: jest.fn(),
      },
    },
  };

  const mockRedis = {
    hget: jest.fn(),
    hgetall: jest.fn(),
    hset: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    set: jest.fn(),
  };

  const userId = 'user_123';
  const keyId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
  const name = 'My API Key';

  beforeEach(async () => {
    jest.clearAllMocks();

    mockQuery.from.mockReturnThis();
    mockQuery.where.mockResolvedValue([]);
    mockDb.select.mockReturnValue(mockQuery);
    mockDb.insert.mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined),
    });
    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(undefined),
    });

    jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(keyId);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        { provide: DRIZZLE_DB, useValue: mockDb },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createApiKey', () => {
    it('should create an API key and return the plaintext key', async () => {
      mockQuery.where.mockResolvedValue([{ count: 0 }]);
      const insertValuesMock = jest.fn().mockResolvedValue(undefined);
      mockDb.insert.mockReturnValue({ values: insertValuesMock });

      const result = await service.createApiKey(userId, name);

      expect(result).toHaveProperty('key');
      expect(result.key).toMatch(/^VMX_/);
      expect(argon2.hash).toHaveBeenCalledWith(
        expect.stringContaining('VMX_'),
        expect.objectContaining({ type: 2 }),
      );
      expect(insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: userId,
          id: keyId.replace(/-/g, ''),
        }),
      );
    });

    it('should throw BadRequestException when user has 5 or more keys', async () => {
      mockQuery.where.mockResolvedValue([{ count: 5 }]);

      await expect(service.createApiKey(userId, name)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createApiKey(userId, name)).rejects.toThrow(
        'You have reached the maximum number of API keys (5)',
      );
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('listApikeys', () => {
    it('should return list of API keys for the user', async () => {
      const mockKeys = [
        {
          id: keyId,
          prefix: 'VMX_a1b2...',
          createdAt: new Date(),
          last_used_at: null,
          revoked_at: null,
        },
      ];
      mockQuery.where.mockResolvedValue(mockKeys);

      const result = await service.listApikeys(userId);

      expect(result).toEqual(mockKeys);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockQuery.where).toHaveBeenCalled();
    });
  });

  describe('apiKeyLastUsed', () => {
    it('should return last used date from Redis when available', async () => {
      const now = Date.now();
      mockRedis.hget.mockResolvedValue(now.toString());

      const result = await service.apiKeyLastUsed(keyId);

      expect(result).toEqual(new Date(now));
      expect(mockRedis.hget).toHaveBeenCalledWith(LAST_USED_HASH, keyId);
      expect(mockDb.query.apiKey.findFirst).not.toHaveBeenCalled();
    });

    it('should return last used date from DB when not in Redis', async () => {
      mockRedis.hget.mockResolvedValue(null);
      const lastUsed = new Date('2025-01-01');
      mockDb.query.apiKey.findFirst.mockResolvedValue({
        last_used_at: lastUsed,
      });

      const result = await service.apiKeyLastUsed(keyId);

      expect(result).toEqual(lastUsed);
      expect(mockDb.query.apiKey.findFirst).toHaveBeenCalled();
    });

    it('should return null when no last used date is found', async () => {
      mockRedis.hget.mockResolvedValue(null);
      mockDb.query.apiKey.findFirst.mockResolvedValue({ last_used_at: null });

      const result = await service.apiKeyLastUsed(keyId);

      expect(result).toBeNull();
    });
  });

  describe('deleteApiKey', () => {
    it('should revoke the API key and clear cache entries', async () => {
      const updateWhereMock = jest.fn().mockResolvedValue(undefined);
      const updateSetMock = jest
        .fn()
        .mockReturnValue({ where: updateWhereMock });
      mockDb.update.mockReturnValue({ set: updateSetMock });

      await service.deleteApiKey(userId, keyId);

      expect(updateSetMock).toHaveBeenCalledWith({
        revoked_at: expect.any(Date),
      });
      expect(updateWhereMock).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith(
        `vmx:api_key:${VERSION}:${keyId}`,
      );
    });
  });

  describe('regenerateApiKey', () => {
    it('should regenerate an API key and return new plaintext key', async () => {
      const updateWhereMock = jest.fn().mockResolvedValue(undefined);
      const updateSetMock = jest
        .fn()
        .mockReturnValue({ where: updateWhereMock });
      mockDb.update.mockReturnValue({ set: updateSetMock });

      const result = await service.regenerateApiKey(userId, keyId);

      expect(result).toHaveProperty('key');
      expect(result.key).toMatch(/^VMX_/);
      expect(argon2.hash).toHaveBeenCalled();
      expect(updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'hashed_value',
          prefix: expect.any(String),
        }),
      );
      expect(updateWhereMock).toHaveBeenCalled();
    });
  });
});
