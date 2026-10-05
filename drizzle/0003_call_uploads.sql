ALTER TABLE "calls" ADD COLUMN "audio_file_name" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "transcription_status" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "transcription_job_id" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "transcription_error" text;