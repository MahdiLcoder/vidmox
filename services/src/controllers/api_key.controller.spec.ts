import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyController } from './api_key.controller';
import { ApiKeyService } from 'src/services/apiKeyService.service';
import { ClerkAuthGuard } from 'src/guards/clerk.guard';

describe('ApiKeyController', () => {
  let controller: ApiKeyController;
  let service: jest.Mocked<ApiKeyService>;

  const userId = 'user_123';
  const keyId = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';

  const mockRequest = (): any => ({
    user: { id: userId },
  });

  beforeEach(async () => {
    const mockService = {
      createApiKey: jest.fn(),
      listApikeys: jest.fn(),
      apiKeyLastUsed: jest.fn(),
      deleteApiKey: jest.fn(),
      regenerateApiKey: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeyController],
      providers: [{ provide: ApiKeyService, useValue: mockService }],
    })
      .overrideGuard(ClerkAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ApiKeyController>(ApiKeyController);
    service = module.get(ApiKeyService);
  });

  describe('create', () => {
    it('should call service.createApiKey with user id and name', async () => {
      const result = { key: 'VMX_abc_xyz' };
      service.createApiKey.mockResolvedValue(result);

      const response = await controller.create(mockRequest(), 'test-key');

      expect(service.createApiKey).toHaveBeenCalledWith(userId, 'test-key');
      expect(response).toEqual(result);
    });
  });

  describe('listApikeys', () => {
    it('should call service.listApikeys with user id', async () => {
      const result = [{ id: keyId, prefix: 'VMX_abc...' }];
      service.listApikeys.mockResolvedValue(result);

      const response = await controller.listApikeys(mockRequest());

      expect(service.listApikeys).toHaveBeenCalledWith(userId);
      expect(response).toEqual(result);
    });
  });

  describe('apiKeyLastUsed', () => {
    it('should call service.apiKeyLastUsed with the key id', async () => {
      const lastUsed = new Date('2025-01-01');
      service.apiKeyLastUsed.mockResolvedValue(lastUsed);

      const response = await controller.apiKeyLastUsed(mockRequest(), keyId);

      expect(service.apiKeyLastUsed).toHaveBeenCalledWith(keyId);
      expect(response).toEqual(lastUsed);
    });
  });

  describe('deleteApiKey', () => {
    it('should call service.deleteApiKey with user id and key id', async () => {
      service.deleteApiKey.mockResolvedValue(undefined);

      await controller.deleteApiKey(mockRequest(), keyId);

      expect(service.deleteApiKey).toHaveBeenCalledWith(userId, keyId);
    });
  });

  describe('regenerateApiKey', () => {
    it('should call service.regenerateApiKey with user id and key id', async () => {
      const result = { key: 'VMX_new_newsecret' };
      service.regenerateApiKey.mockResolvedValue(result);

      const response = await controller.regenerateApiKey(mockRequest(), keyId);

      expect(service.regenerateApiKey).toHaveBeenCalledWith(userId, keyId);
      expect(response).toEqual(result);
    });
  });
});
