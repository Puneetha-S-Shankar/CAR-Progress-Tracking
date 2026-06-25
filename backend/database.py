"""
database.py — Backend database layer for Job Intelligence Engine.

Architecture:
- Reads DATABASE_URL from the shared frontend/.env file.
- Uses a psycopg2 SimpleConnectionPool to manage connections efficiently.
- Provides typed query helpers for every table in the schema,
  mirroring the Drizzle ORM schema in frontend/src/db/schema.ts.

Tables (in dependency order):
  schools, programs, program_officer_assignments,
  "user", placement_officers,
  students, companies,
  drives, placements,
  officer_monthly_snapshot
"""

import os
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool
from dotenv import load_dotenv


# ---------------------------------------------------------------------------
# Environment & Pool Setup
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_ENV_PATH = BASE_DIR / "frontend" / ".env"

if FRONTEND_ENV_PATH.exists():
    print(f"[DB] Loading environment from {FRONTEND_ENV_PATH}")
    load_dotenv(dotenv_path=FRONTEND_ENV_PATH)
else:
    print(f"[DB] Warning: .env not found at {FRONTEND_ENV_PATH}. Falling back to system env.")
    load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

db_pool: Optional[SimpleConnectionPool] = None

if DATABASE_URL:
    try:
        db_pool = SimpleConnectionPool(minconn=1, maxconn=10, dsn=DATABASE_URL)
        print("[DB] Connection pool initialized successfully.")
    except Exception as exc:
        print(f"[DB] Failed to initialize connection pool: {exc}")
else:
    print("[DB] DATABASE_URL is not set. Pool not initialized.")


# ---------------------------------------------------------------------------
# Connection Utilities
# ---------------------------------------------------------------------------

def get_db_connection():
    """Acquire a connection from the pool."""
    if not db_pool:
        raise RuntimeError("Database pool is not initialized.")
    return db_pool.getconn()


def release_db_connection(conn):
    """Return a connection to the pool."""
    if db_pool and conn:
        db_pool.putconn(conn)


@contextmanager
def db_cursor(dict_cursor: bool = True):
    """
    Context manager that acquires a connection + cursor, commits on exit,
    and always releases the connection back to the pool.

    Usage:
        with db_cursor() as cur:
            cur.execute("SELECT ...")
            rows = cur.fetchall()
    """
    conn = get_db_connection()
    cursor_factory = RealDictCursor if dict_cursor else None
    try:
        cur = conn.cursor(cursor_factory=cursor_factory)
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        release_db_connection(conn)


# ---------------------------------------------------------------------------
# Schema Reference
# (mirrors frontend/src/db/schema.ts — keep in sync)
# ---------------------------------------------------------------------------

# Enum values — mirrors pgEnum definitions in schema.ts
ROLE_ENUM          = ("admin", "officer", "viewer")
DRIVE_TYPE_ENUM    = ("full_time", "internship", "capstone")
PLACEMENT_TYPE_ENUM = ("full_time", "internship", "capstone", "higher_studies")
OFFER_STATUS_ENUM  = ("offered", "accepted", "rejected")


# ---------------------------------------------------------------------------
# Table: schools
# Columns: school_id (PK), school_name
# ---------------------------------------------------------------------------

def get_all_schools() -> list[dict]:
    with db_cursor() as cur:
        cur.execute("SELECT school_id, school_name FROM schools ORDER BY school_name")
        return cur.fetchall()


def get_school_by_id(school_id: int) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute("SELECT school_id, school_name FROM schools WHERE school_id = %s", (school_id,))
        return cur.fetchone()


def create_school(school_name: str) -> dict:
    with db_cursor() as cur:
        cur.execute("INSERT INTO schools (school_name) VALUES (%s) RETURNING *", (school_name,))
        return cur.fetchone()


def update_school(school_id: int, school_name: str) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute("UPDATE schools SET school_name = %s WHERE school_id = %s RETURNING *", (school_name, school_id))
        return cur.fetchone()


def delete_school(school_id: int) -> bool:
    with db_cursor() as cur:
        cur.execute("DELETE FROM schools WHERE school_id = %s", (school_id,))
        return cur.rowcount > 0


# ---------------------------------------------------------------------------
# Table: programs
# Columns: program_id (PK), school_id (FK), program_name,
#          credit_weightage, total_eligible_students
# ---------------------------------------------------------------------------

def get_all_programs() -> list[dict]:
    with db_cursor() as cur:
        cur.execute("""
            SELECT p.program_id, p.school_id, s.school_name,
                   p.program_name, p.credit_weightage, p.total_eligible_students
            FROM programs p
            JOIN schools s ON s.school_id = p.school_id
            ORDER BY s.school_name, p.program_name
        """)
        return cur.fetchall()


def get_programs_by_school(school_id: int) -> list[dict]:
    with db_cursor() as cur:
        cur.execute("""
            SELECT program_id, program_name, credit_weightage, total_eligible_students
            FROM programs WHERE school_id = %s ORDER BY program_name
        """, (school_id,))
        return cur.fetchall()


def get_program_by_id(program_id: int) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute("""
            SELECT p.program_id, p.school_id, s.school_name,
                   p.program_name, p.credit_weightage, p.total_eligible_students
            FROM programs p
            JOIN schools s ON s.school_id = p.school_id
            WHERE p.program_id = %s
        """, (program_id,))
        return cur.fetchone()


def create_program(school_id: int, program_name: str, credit_weightage: float, total_eligible_students: int) -> dict:
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO programs (school_id, program_name, credit_weightage, total_eligible_students)
            VALUES (%s, %s, %s, %s)
            RETURNING *
        """, (school_id, program_name, credit_weightage, total_eligible_students))
        return cur.fetchone()


def update_program(program_id: int, school_id: int, program_name: str, credit_weightage: float, total_eligible_students: int) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute("""
            UPDATE programs 
            SET school_id = %s, program_name = %s, credit_weightage = %s, total_eligible_students = %s
            WHERE program_id = %s
            RETURNING *
        """, (school_id, program_name, credit_weightage, total_eligible_students, program_id))
        return cur.fetchone()


def delete_program(program_id: int) -> bool:
    with db_cursor() as cur:
        cur.execute("DELETE FROM programs WHERE program_id = %s", (program_id,))
        return cur.rowcount > 0


# ---------------------------------------------------------------------------
# Table: program_officer_assignments
# Columns: program_id (FK, PK), officer_id (FK, PK)  — composite PK
# ---------------------------------------------------------------------------

def get_officer_programs(officer_id: int) -> list[dict]:
    with db_cursor() as cur:
        cur.execute("""
            SELECT poa.program_id, poa.officer_id,
                   p.program_name, p.credit_weightage, p.total_eligible_students, s.school_name
            FROM program_officer_assignments poa
            JOIN programs p ON p.program_id = poa.program_id
            JOIN schools  s ON s.school_id  = p.school_id
            WHERE poa.officer_id = %s
        """, (officer_id,))
        return cur.fetchall()


def assign_officer_to_program(officer_id: int, program_id: int) -> None:
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO program_officer_assignments (program_id, officer_id)
            VALUES (%s, %s)
            ON CONFLICT DO NOTHING
        """, (program_id, officer_id))


def unassign_officer_from_program(officer_id: int, program_id: int) -> None:
    with db_cursor() as cur:
        cur.execute("""
            DELETE FROM program_officer_assignments
            WHERE program_id = %s AND officer_id = %s
        """, (program_id, officer_id))


# ---------------------------------------------------------------------------
# Table: "user" (Better-Auth)
# Columns: id (PK, text), email (UNIQUE), role, createdAt, etc.
# ---------------------------------------------------------------------------

def get_user_by_email(email: str) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute('SELECT * FROM "user" WHERE email = %s', (email,))
        return cur.fetchone()


def get_user_by_id(user_id: str) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute('SELECT id, email, role, "createdAt" FROM "user" WHERE id = %s', (user_id,))
        return cur.fetchone()


def create_user(email: str, name: str, role: str) -> dict:
    if role not in ROLE_ENUM:
        raise ValueError(f"Invalid role '{role}'. Must be one of {ROLE_ENUM}")
    import uuid
    new_id = str(uuid.uuid4())
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
            VALUES (%s, %s, %s, FALSE, %s, NOW(), NOW())
            RETURNING id as user_id, email, role, "createdAt"
        """, (new_id, name, email, role))
        return cur.fetchone()


# ---------------------------------------------------------------------------
# Table: placement_officers
# Columns: officer_id (PK), user_id (FK), name, phone, school_id (FK)
# ---------------------------------------------------------------------------

def get_all_officers() -> list[dict]:
    with db_cursor() as cur:
        cur.execute("""
            SELECT po.officer_id, po.name, po.phone,
                   u.email, u.role
            FROM placement_officers po
            JOIN "user"  u ON u.id      = po.user_id
            ORDER BY po.name
        """)
        return cur.fetchall()


def get_officer_by_id(officer_id: int) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute("""
            SELECT po.officer_id, po.name, po.phone,
                   u.email
            FROM placement_officers po
            JOIN "user"  u ON u.id      = po.user_id
            WHERE po.officer_id = %s
        """, (officer_id,))
        return cur.fetchone()


def update_officer(officer_id: int, name: str, phone: Optional[str]) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute("""
            UPDATE placement_officers 
            SET name = %s, phone = %s
            WHERE officer_id = %s
            RETURNING *
        """, (name, phone, officer_id))
        return cur.fetchone()


def delete_officer(officer_id: int) -> bool:
    with db_cursor() as cur:
        cur.execute("DELETE FROM placement_officers WHERE officer_id = %s", (officer_id,))
        return cur.rowcount > 0


def get_or_create_officer_by_email(email: str, name: str = "Officer") -> int:
    """
    Finds the officer ID for a given email. If not found, auto-provisions:
    1. A default school (if none exists)
    2. A user record in 'users'
    3. A 'placement_officers' record.
    """
    with db_cursor() as cur:
        # Check if officer already exists for this email
        cur.execute("""
            SELECT po.officer_id 
            FROM placement_officers po
            JOIN "user" u ON u.id = po.user_id
            WHERE u.email = %s
        """, (email,))
        row = cur.fetchone()
        if row:
            return row["officer_id"]
            
        # 1. Ensure user exists
        cur.execute('SELECT id as user_id FROM "user" WHERE email = %s', (email,))
        user_row = cur.fetchone()
        if user_row:
            user_id = user_row["user_id"]
        else:
            import uuid
            user_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt") 
                VALUES (%s, %s, %s, FALSE, 'officer', NOW(), NOW()) 
                RETURNING id as user_id
            """, (user_id, name, email))
            user_id = cur.fetchone()["user_id"]
            
        # 2. Create placement officer
        cur.execute("""
            INSERT INTO placement_officers (user_id, name)
            VALUES (%s, %s)
            RETURNING officer_id
        """, (user_id, name))
        
        return cur.fetchone()["officer_id"]


def create_student(name: str, usn: str, school_id: int, program_id: int, batch: str, is_active: bool = True) -> dict:
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO students (name, usn, school_id, program_id, batch, is_active)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (name, usn, school_id, program_id, batch, is_active))
        return cur.fetchone()


def update_student(student_id: int, name: str, usn: str, school_id: int, program_id: int, batch: str, is_active: bool) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute("""
            UPDATE students 
            SET name = %s, usn = %s, school_id = %s, program_id = %s, batch = %s, is_active = %s
            WHERE student_id = %s
            RETURNING *
        """, (name, usn, school_id, program_id, batch, is_active, student_id))
        return cur.fetchone()


def delete_student(student_id: int) -> bool:
    with db_cursor() as cur:
        cur.execute("DELETE FROM students WHERE student_id = %s", (student_id,))
        return cur.rowcount > 0


# ---------------------------------------------------------------------------
# Table: students
# Columns: student_id (PK), name, usn (UNIQUE), school_id (FK),
#          program_id (FK), batch, is_active
# ---------------------------------------------------------------------------

def get_all_students(active_only: bool = True) -> list[dict]:
    with db_cursor() as cur:
        query = """
            SELECT st.student_id, st.name, st.usn, st.batch, st.is_active,
                   st.school_id, sc.school_name,
                   st.program_id, pr.program_name, pr.credit_weightage
            FROM students st
            JOIN schools  sc ON sc.school_id  = st.school_id
            JOIN programs pr ON pr.program_id = st.program_id
        """
        if active_only:
            query += " WHERE st.is_active = TRUE"
        query += " ORDER BY st.name"
        cur.execute(query)
        return cur.fetchall()


def get_student_by_id(student_id: int) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute("""
            SELECT st.student_id, st.name, st.usn, st.batch, st.is_active,
                   st.school_id, sc.school_name,
                   st.program_id, pr.program_name, pr.credit_weightage
            FROM students st
            JOIN schools  sc ON sc.school_id  = st.school_id
            JOIN programs pr ON pr.program_id = st.program_id
            WHERE st.student_id = %s
        """, (student_id,))
        return cur.fetchone()


def get_student_by_usn(usn: str) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute("""
            SELECT st.student_id, st.name, st.usn, st.batch, st.is_active,
                   st.school_id, sc.school_name,
                   st.program_id, pr.program_name, pr.credit_weightage
            FROM students st
            JOIN schools  sc ON sc.school_id  = st.school_id
            JOIN programs pr ON pr.program_id = st.program_id
            WHERE st.usn = %s
        """, (usn,))
        return cur.fetchone()


def get_unplaced_students_for_officer(officer_id: int, month: int, year: int) -> int:
    """
    Count active students under this officer's programs who have NOT
    received an 'accepted' placement in the given month/year.
    """
    with db_cursor() as cur:
        cur.execute("""
            SELECT COUNT(DISTINCT st.student_id)
            FROM students st
            JOIN program_officer_assignments poa ON poa.program_id = st.program_id
            WHERE poa.officer_id = %s
              AND st.is_active = TRUE
              AND st.student_id NOT IN (
                  SELECT student_id FROM placements
                  WHERE offer_status = 'accepted'
                    AND placement_month = %s
                    AND placement_year  = %s
              )
        """, (officer_id, month, year))
        row = cur.fetchone()
        return int(row["count"]) if row else 0


# ---------------------------------------------------------------------------
# Table: companies
# Columns: company_id (PK), company_name, industry
# ---------------------------------------------------------------------------

def get_all_companies() -> list[dict]:
    with db_cursor() as cur:
        cur.execute("SELECT company_id, company_name, industry FROM companies ORDER BY company_name")
        return cur.fetchall()


def get_company_by_id(company_id: int) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute("SELECT company_id, company_name, industry FROM companies WHERE company_id = %s", (company_id,))
        return cur.fetchone()


def create_company(company_name: str, industry: Optional[str] = None) -> dict:
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO companies (company_name, industry)
            VALUES (%s, %s)
            RETURNING company_id, company_name, industry
        """, (company_name, industry))
        return cur.fetchone()


# ---------------------------------------------------------------------------
# Table: drives
# Columns: drive_id (PK), company_id (FK), drive_date, drive_type,
#          min_package_lpa, max_package_lpa, is_rvce_drive
# ---------------------------------------------------------------------------

def get_all_drives(company_id: Optional[int] = None) -> list[dict]:
    with db_cursor() as cur:
        query = """
            SELECT d.drive_id, d.company_id, c.company_name,
                   d.drive_date, d.drive_type,
                   d.min_package_lpa, d.max_package_lpa,
                   d.is_rvce_drive
            FROM drives d
            JOIN companies c ON c.company_id = d.company_id
        """
        if company_id is not None:
            cur.execute(query + " WHERE d.company_id = %s ORDER BY d.drive_date DESC", (company_id,))
        else:
            cur.execute(query + " ORDER BY d.drive_date DESC")
        return cur.fetchall()


def get_drive_by_id(drive_id: int) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute("""
            SELECT d.drive_id, d.company_id, c.company_name,
                   d.drive_date, d.drive_type,
                   d.min_package_lpa, d.max_package_lpa,
                   d.is_rvce_drive
            FROM drives d
            JOIN companies c ON c.company_id = d.company_id
            WHERE d.drive_id = %s
        """, (drive_id,))
        return cur.fetchone()


def create_drive(
    company_id: int,
    drive_type: str,
    drive_date: Optional[datetime] = None,
    min_package_lpa: Optional[float] = None,
    max_package_lpa: Optional[float] = None,
    is_rvce_drive: bool = False,
) -> dict:
    if drive_type not in DRIVE_TYPE_ENUM:
        raise ValueError(f"Invalid drive_type '{drive_type}'. Must be one of {DRIVE_TYPE_ENUM}")
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO drives
                (company_id, drive_date, drive_type, min_package_lpa, max_package_lpa, is_rvce_drive)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING drive_id, company_id, drive_date, drive_type,
                      min_package_lpa, max_package_lpa, is_rvce_drive
        """, (company_id, drive_date, drive_type, min_package_lpa, max_package_lpa, is_rvce_drive))
        return cur.fetchone()


# ---------------------------------------------------------------------------
# Table: placements
# Columns: placement_id (PK), student_id (FK), officer_id (FK), drive_id (FK),
#          placement_type, package_lpa, offer_status, is_self_placed,
#          placement_month, placement_year
# ---------------------------------------------------------------------------

def get_placements_by_officer(officer_id: int) -> list[dict]:
    with db_cursor() as cur:
        cur.execute("""
            SELECT pl.placement_id, pl.offer_status, pl.placement_type,
                   pl.package_lpa, pl.is_self_placed,
                   pl.placement_month, pl.placement_year,
                   st.name  AS student_name, st.usn,
                   pr.program_name,
                   co.company_name,
                   dr.drive_type
            FROM placements pl
            JOIN students   st ON st.student_id = pl.student_id
            JOIN programs   pr ON pr.program_id = st.program_id
            LEFT JOIN drives     dr ON dr.drive_id   = pl.drive_id
            LEFT JOIN companies  co ON co.company_id = dr.company_id
            WHERE pl.officer_id = %s
            ORDER BY pl.placement_year DESC, pl.placement_month DESC
        """, (officer_id,))
        return cur.fetchall()


def create_placement(
    student_id: int,
    officer_id: int,
    placement_type: str,
    offer_status: str,
    placement_month: int,
    placement_year: int,
    drive_id: Optional[int] = None,
    package_lpa: Optional[float] = None,
    is_self_placed: bool = False,
) -> dict:
    if placement_type not in PLACEMENT_TYPE_ENUM:
        raise ValueError(f"Invalid placement_type '{placement_type}'.")
    if offer_status not in OFFER_STATUS_ENUM:
        raise ValueError(f"Invalid offer_status '{offer_status}'.")
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO placements
                (student_id, officer_id, drive_id, placement_type,
                 package_lpa, offer_status, is_self_placed,
                 placement_month, placement_year)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            student_id, officer_id, drive_id, placement_type,
            package_lpa, offer_status, is_self_placed,
            placement_month, placement_year,
        ))
        return cur.fetchone()


def count_placements_for_officer(officer_id: int, month: int, year: int) -> int:
    """Count accepted placements for an officer in a given month/year."""
    with db_cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) FROM placements
            WHERE officer_id = %s
              AND offer_status = 'accepted'
              AND placement_month = %s
              AND placement_year  = %s
        """, (officer_id, month, year))
        return int(cur.fetchone()["count"])


# ---------------------------------------------------------------------------
# Table: officer_monthly_snapshot
# Columns: snapshot_id (PK), officer_id (FK), month, year,
#          starting_pool, target, placed, prism_credits, prism_score
# ---------------------------------------------------------------------------

def get_snapshot(officer_id: int, month: int, year: int) -> Optional[dict]:
    with db_cursor() as cur:
        cur.execute("""
            SELECT * FROM officer_monthly_snapshot
            WHERE officer_id = %s AND month = %s AND year = %s
        """, (officer_id, month, year))
        return cur.fetchone()


def upsert_snapshot(
    officer_id: int,
    month: int,
    year: int,
    starting_pool: int,
    target: float,
    placed: int,
    prism_credits: float,
    prism_score: float,
) -> dict:
    """Insert or update the officer's monthly snapshot."""
    with db_cursor() as cur:
        cur.execute("""
            INSERT INTO officer_monthly_snapshot
                (officer_id, month, year, starting_pool, target, placed, prism_credits, prism_score)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (officer_id, month, year)
            DO UPDATE SET
                starting_pool = EXCLUDED.starting_pool,
                target        = EXCLUDED.target,
                placed        = EXCLUDED.placed,
                prism_credits = EXCLUDED.prism_credits,
                prism_score   = EXCLUDED.prism_score
            RETURNING *
        """, (officer_id, month, year, starting_pool, target, placed, prism_credits, prism_score))
        return cur.fetchone()


def get_officer_history(officer_id: int, year: int) -> list[dict]:
    """Fetch all monthly snapshots for a given officer and year, ordered by month."""
    with db_cursor() as cur:
        cur.execute("""
            SELECT month, year, starting_pool, target, placed, prism_credits, prism_score
            FROM officer_monthly_snapshot
            WHERE officer_id = %s AND year = %s
            ORDER BY month
        """, (officer_id, year))
        return cur.fetchall()
