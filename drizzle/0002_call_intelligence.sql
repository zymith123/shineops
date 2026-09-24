CREATE TYPE "public"."call_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."call_outcome" AS ENUM('booked', 'follow_up_needed', 'resolved', 'lost', 'no_action');--> statement-breakpoint
CREATE TYPE "public"."call_type" AS ENUM('new_lead', 'booking', 'reschedule', 'complaint', 'cancellation', 'billing', 'service_question', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('new', 'contacted', 'quoted', 'booked', 'lost');--> statement-breakpoint
ALTER TYPE "public"."task_source" ADD VALUE 'call';--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"external_id" text,
	"direction" "call_direction" NOT NULL,
	"caller_name" text DEFAULT '' NOT NULL,
	"caller_phone" text NOT NULL,
	"rep_id" uuid,
	"client_id" uuid,
	"lead_id" uuid,
	"started_at" timestamp with time zone NOT NULL,
	"duration_sec" integer NOT NULL,
	"transcript" text NOT NULL,
	"type" "call_type",
	"type_confidence" integer,
	"summary" text,
	"outcome" "call_outcome",
	"score" integer,
	"rubric" jsonb,
	"coaching_tip" text,
	"missed_opportunity" text,
	"analyzed_by" text,
	"analyzed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"service_requested" text DEFAULT '' NOT NULL,
	"stage" "lead_stage" DEFAULT 'new' NOT NULL,
	"owner_id" uuid,
	"next_step" text DEFAULT '' NOT NULL,
	"next_step_due" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_rep_id_users_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calls_company_started_idx" ON "calls" USING btree ("company_id","started_at");--> statement-breakpoint
CREATE INDEX "calls_client_idx" ON "calls" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calls_external_idx" ON "calls" USING btree ("company_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_company_phone_idx" ON "leads" USING btree ("company_id","phone");--> statement-breakpoint
CREATE INDEX "leads_company_stage_idx" ON "leads" USING btree ("company_id","stage");