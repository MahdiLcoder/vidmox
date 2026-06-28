import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Request } from 'express';
import { ClerkAuthGuard } from 'src/guards/clerk.guard';
import { ApiKeyService } from 'src/services/apiKeyService.service';

@Controller('api-key')
@ApiTags('API Keys')
@UseGuards(ClerkAuthGuard)
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
    return this.apiKeyService.listApikeys(req.user!.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'API KEY LAST USED' })
  async apiKeyLastUsed(@Req() req: any, @Param('id') id: string) {
    return this.apiKeyService.apiKeyLastUsed(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key' })
  async deleteApiKey(@Req() req: any, @Param('id') id: string) {
    return this.apiKeyService.deleteApiKey(req.user!.id, id);
  }

  @Post(':id/regenerate')
  @ApiOperation({ summary: 'Regenerate an API key' })
  async regenerateApiKey(@Req() req: any, @Param('id') id: string) {
    return this.apiKeyService.regenerateApiKey(req.user!.id, id);
  }
}
