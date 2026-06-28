import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { PlaylistService } from './playlist.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClerkAuthGuard } from 'src/guards/clerk.guard';

@Controller('playlist')
@ApiTags('Playlists')
@UseGuards(ClerkAuthGuard)
@ApiBearerAuth()
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Post()
  create(@Req() req: any, @Body() createPlaylistDto: CreatePlaylistDto) {
    return this.playlistService.create(req.user.id, createPlaylistDto);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.playlistService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.playlistService.findOne(req.user.id, id);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() updatePlaylistDto: UpdatePlaylistDto) {
    return this.playlistService.update(req.user.id, id, updatePlaylistDto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.playlistService.remove(req.user.id, id);
  }
}
