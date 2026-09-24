ALTER TYPE "public"."role" ADD VALUE 'admin';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "company_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_admin_company_check" CHECK (("users"."role"::text = 'admin') = ("users"."company_id" is null));