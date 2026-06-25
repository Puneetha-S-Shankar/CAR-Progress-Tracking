import { 
  pgTable, 
  text, 
  integer, 
  boolean, 
  numeric, 
  timestamp, 
  pgEnum,
  primaryKey,
  unique
} from "drizzle-orm/pg-core";

// Enums
export const roleEnum = pgEnum('role', ['admin', 'officer', 'viewer']);
export const driveTypeEnum = pgEnum('drive_type', ['full_time', 'internship', 'capstone']);
export const placementTypeEnum = pgEnum('placement_type', ['full_time', 'internship', 'capstone', 'higher_studies']);
export const offerStatusEnum = pgEnum('offer_status', ['offered', 'accepted', 'rejected']);

export const schools = pgTable('schools', {
  school_id: integer('school_id').primaryKey().generatedAlwaysAsIdentity(),
  school_name: text('school_name').notNull(),
});

export const programs = pgTable('programs', {
  program_id: integer('program_id').primaryKey().generatedAlwaysAsIdentity(),
  school_id: integer('school_id').references(() => schools.school_id).notNull(),
  program_name: text('program_name').notNull(),
  credit_weightage: integer('credit_weightage').notNull(),
  total_eligible_students: integer('total_eligible_students'),
});

export const programOfficerAssignments = pgTable('program_officer_assignments', {
  program_id: integer('program_id').references(() => programs.program_id).notNull(),
  officer_id: integer('officer_id').references(() => placementOfficers.officer_id).notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.program_id, table.officer_id] }),
  };
});

// Removed duplicate 'users' table

export const placementOfficers = pgTable('placement_officers', {
  officer_id: integer('officer_id').primaryKey().generatedAlwaysAsIdentity(),
  user_id: text('user_id').references(() => user.id).notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
});

export const students = pgTable('students', {
  student_id: integer('student_id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  usn: text('usn').unique().notNull(),
  school_id: integer('school_id').references(() => schools.school_id).notNull(),
  program_id: integer('program_id').references(() => programs.program_id).notNull(),
  batch: integer('batch').notNull(),
  is_active: boolean('is_active').default(true).notNull(),
});

export const companies = pgTable('companies', {
  company_id: integer('company_id').primaryKey().generatedAlwaysAsIdentity(),
  company_name: text('company_name').notNull(),
  industry: text('industry'),
});

export const drives = pgTable('drives', {
  drive_id: integer('drive_id').primaryKey().generatedAlwaysAsIdentity(),
  company_id: integer('company_id').references(() => companies.company_id).notNull(),
  drive_date: timestamp('drive_date'),
  drive_type: driveTypeEnum('drive_type').notNull(),
  min_package_lpa: numeric('min_package_lpa'),
  max_package_lpa: numeric('max_package_lpa'),
  is_rvce_drive: boolean('is_rvce_drive').default(false).notNull(),
});

export const placements = pgTable('placements', {
  placement_id: integer('placement_id').primaryKey().generatedAlwaysAsIdentity(),
  student_id: integer('student_id').references(() => students.student_id).notNull(),
  officer_id: integer('officer_id').references(() => placementOfficers.officer_id),
  drive_id: integer('drive_id').references(() => drives.drive_id),
  placement_type: placementTypeEnum('placement_type').notNull(),
  package_lpa: numeric('package_lpa'),
  offer_status: offerStatusEnum('offer_status').notNull(),
  is_self_placed: boolean('is_self_placed').default(false).notNull(),
  placement_month: integer('placement_month').notNull(),
  placement_year: integer('placement_year').notNull(),
});

export const officerMonthlySnapshot = pgTable('officer_monthly_snapshot', {
  snapshot_id: integer('snapshot_id').primaryKey().generatedAlwaysAsIdentity(),
  officer_id: integer('officer_id').references(() => placementOfficers.officer_id).notNull(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  starting_pool: integer('starting_pool').notNull(),
  target: numeric('target'),
  placed: integer('placed').default(0).notNull(),
  prism_credits: numeric('prism_credits').default('0').notNull(),
  prism_score: numeric('prism_score').default('0').notNull(),
}, (t) => {
  return {
    uniqueSnapshot: unique().on(t.officer_id, t.month, t.year),
  };
});

// Better Auth Tables
export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('emailVerified').notNull(),
	image: text('image'),
	role: roleEnum('role').default("officer").notNull(),
	createdAt: timestamp('createdAt').notNull(),
	updatedAt: timestamp('updatedAt').notNull()
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp('expiresAt').notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('createdAt').notNull(),
	updatedAt: timestamp('updatedAt').notNull(),
	ipAddress: text('ipAddress'),
	userAgent: text('userAgent'),
	userId: text('userId').notNull().references(() => user.id)
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text('accountId').notNull(),
	providerId: text('providerId').notNull(),
	userId: text('userId').notNull().references(() => user.id),
	accessToken: text('accessToken'),
	refreshToken: text('refreshToken'),
	idToken: text('idToken'),
	accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
	refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('createdAt').notNull(),
	updatedAt: timestamp('updatedAt').notNull()
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expiresAt').notNull(),
	createdAt: timestamp('createdAt'),
	updatedAt: timestamp('updatedAt')
});

