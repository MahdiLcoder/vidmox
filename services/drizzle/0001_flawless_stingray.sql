CREATE TABLE "playlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"playlist_limit" integer NOT NULL,
	"total_videos" integer DEFAULT 0,
	"created_at" timestamp with time zone
);
