import { Module } from '@nestjs/common';
import { ApiKeyController } from 'src/controllers/api_key.controller';
import { ApiKeyService } from 'src/services/apiKeyService.service';

@Module({
  imports: [],
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
})
export class ApiKeyModule {}
