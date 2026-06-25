CREATE TYPE "public"."drive_type" AS ENUM('full_time', 'internship', 'capstone');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('offered', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."placement_type" AS ENUM('full_time', 'internship', 'capstone', 'higher_studies');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'officer', 'viewer');--> statement-breakpoint
CREATE TABLE "companies" (
	"company_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "companies_company_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_name" text NOT NULL,
	"industry" text
);
--> statement-breakpoint
CREATE TABLE "drives" (
	"drive_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "drives_drive_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company_id" integer NOT NULL,
	"drive_date" timestamp,
	"drive_type" "drive_type" NOT NULL,
	"min_package_lpa" numeric,
	"max_package_lpa" numeric
);
--> statement-breakpoint
CREATE TABLE "officer_monthly_snapshot" (
	"snapshot_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "officer_monthly_snapshot_snapshot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"officer_id" integer NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"starting_pool" integer NOT NULL,
	"target" numeric
);
--> statement-breakpoint
CREATE TABLE "placement_officers" (
	"officer_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "placement_officers_officer_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"school_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "placements" (
	"placement_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "placements_placement_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"student_id" integer NOT NULL,
	"officer_id" integer,
	"drive_id" integer,
	"placement_type" "placement_type" NOT NULL,
	"package_lpa" numeric,
	"offer_status" "offer_status" NOT NULL,
	"is_self_placed" boolean DEFAULT false NOT NULL,
	"placement_month" integer NOT NULL,
	"placement_year" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_officer_assignments" (
	"program_id" integer NOT NULL,
	"officer_id" integer NOT NULL,
	CONSTRAINT "program_officer_assignments_program_id_officer_id_pk" PRIMARY KEY("program_id","officer_id")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"program_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "programs_program_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"school_id" integer NOT NULL,
	"program_name" text NOT NULL,
	"credit_weightage" integer NOT NULL,
	"total_eligible_students" integer
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"school_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "schools_school_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"school_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"student_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "students_student_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"usn" text NOT NULL,
	"school_id" integer NOT NULL,
	"program_id" integer NOT NULL,
	"batch" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "students_usn_unique" UNIQUE("usn")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_user_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "drives" ADD CONSTRAINT "drives_company_id_companies_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("company_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officer_monthly_snapshot" ADD CONSTRAINT "officer_monthly_snapshot_officer_id_placement_officers_officer_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."placement_officers"("officer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_officers" ADD CONSTRAINT "placement_officers_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_officers" ADD CONSTRAINT "placement_officers_school_id_schools_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("school_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_student_id_students_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_officer_id_placement_officers_officer_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."placement_officers"("officer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placements" ADD CONSTRAINT "placements_drive_id_drives_drive_id_fk" FOREIGN KEY ("drive_id") REFERENCES "public"."drives"("drive_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_officer_assignments" ADD CONSTRAINT "program_officer_assignments_program_id_programs_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("program_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_officer_assignments" ADD CONSTRAINT "program_officer_assignments_officer_id_placement_officers_officer_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."placement_officers"("officer_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_school_id_schools_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("school_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_schools_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("school_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_program_id_programs_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("program_id") ON DELETE no action ON UPDATE no action;