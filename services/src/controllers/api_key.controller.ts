import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Request } from 'express';
import { ApiKeyService } from 'src/services/apiKeyService.service';

@Controller('api-key')
@ApiTags('API Keys')
@ApiBearerAuth()
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new API key' })
  async create(@Req() req: any, @Body('name') name: string) {
    return this.apiKeyService.createApiKey(req.user!.id, name);
  }

  @Get()
  @ApiOperation({ summary: 'List all API keys' })
  async listApikeys(@Req() req: any) {
    return this.apiKeyService.listApikeys(req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key' })
  async deleteApiKey(@Param('id') id: string) {
    return this.apiKeyService.deleteApiKey(id);
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'Regenerate an API key' })
  async regenerateApiKey(@Req() req: any, @Param('id') id: string) {
    return this.apiKeyService.regenerateApiKey(req.user.id, id);
  }
}
