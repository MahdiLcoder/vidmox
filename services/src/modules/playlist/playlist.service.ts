import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DB } from 'src/db/db.module';
import * as schema from '../../db/schema';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { and, count, eq, max } from 'drizzle-orm';
import { DEFAULT_PLAYLIST_LIMIT } from 'src/configs/constanst';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';

@Injectable()
export class PlaylistService {
  constructor(@Inject(DRIZZLE_DB) private db: NeonHttpDatabase<typeof schema>) {}

  async create(userId: string, createPlaylistDto: CreatePlaylistDto) {
    const [result] = await this.db
      .select({
        count: count(),
        limit: max(schema.playlist.limit),
      })
      .from(schema.playlist)
      .where(eq(schema.playlist.user_id, userId));

    const effectiveLimit = result.limit ?? DEFAULT_PLAYLIST_LIMIT;

    if (result.count >= effectiveLimit) {
      throw new BadRequestException(
        `You have reached the maximum number of playlists, which is ${effectiveLimit}.`,
      );
    }
      
    const [created] = await this.db.insert(schema.playlist).values({
        user_id: userId,
        name: createPlaylistDto.name,
        description: createPlaylistDto.description,
        limit: DEFAULT_PLAYLIST_LIMIT,
        created_at: new Date(),
    }).returning();

    return created;
  }
    
    async findAll(userId: string) {
        return await this.db.select().from(schema.playlist).where(eq(schema.playlist.user_id, userId));
    }
    
    async findOne(userId: string, id: string) {
        const record = await this.db.query.playlist.findFirst({
            where: (p) => and(
                eq(p.id, id),
                eq(p.user_id, userId)
            )
        });
        if(!record) {
            throw new NotFoundException(`Playlist not found`);
        }
        return record;
    }

    async update(userId: string, id: string, updatePlaylistDto: UpdatePlaylistDto) {
        await this.findOne(userId, id);
        const [updated] = await this.db.update(schema.playlist).set({
            name: updatePlaylistDto.name,
            description: updatePlaylistDto.description,            
        }).where(and(
            eq(schema.playlist.id, id),
            eq(schema.playlist.user_id, userId)
        )).returning();

        return updated;
    }
    
    async remove(userId: string, id: string) {
        await this.findOne(userId, id);
        const [deleted] = await this.db.delete(schema.playlist).where(and(
            eq(schema.playlist.id, id),
            eq(schema.playlist.user_id, userId)
        )).returning();
        return deleted;
    }
    
}
