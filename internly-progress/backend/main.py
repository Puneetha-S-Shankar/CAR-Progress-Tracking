"""
main.py — FastAPI backend for CAR Progress Tracking.

All DB I/O goes through database.py helpers.
Business logic lives in recalculate_and_save_snapshot() only.
Routes are intentionally thin.
"""

import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
import uvicorn

import database as db
from database import db_cursor, db_pool
import admin_router


# ─────────────────────────────────────────────
# Lifespan
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[CAR] Starting CAR Progress Tracking Backend…")
    yield
    print("[CAR] Shutting down…")
    if db_pool:
        db_pool.closeall()
        print("[CAR] DB pool closed.")


app = FastAPI(title="CAR Progress Tracking", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router.router)

@app.middleware("http")
async def log_timing(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    print(f"[TIMING] {request.method} {request.url.path} → {duration:.3f}s")
    return response


# ─────────────────────────────────────────────
# Enum Constants (mirrors schema.ts)
# ─────────────────────────────────────────────

DRIVE_TYPE_ENUM       = {"full_time", "internship", "capstone"}
PLACEMENT_TYPE_ENUM   = {"full_time", "internship", "capstone", "higher_studies"}
OFFER_STATUS_ENUM     = {"offered", "accepted", "rejected"}


# ─────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────

class CompanyCreate(BaseModel):
    company_name: str

class DriveCreate(BaseModel):
    company_id: int
    email: str
    drive_date: Optional[str] = None          # ISO date string, optional
    drive_type: str
    min_package_lpa: Optional[float] = None
    max_package_lpa: Optional[float] = None
    is_rvce_drive: bool = False

    @field_validator("drive_type")
    @classmethod
    def validate_drive_type(cls, v: str) -> str:
        if v not in DRIVE_TYPE_ENUM:
            raise ValueError(f"drive_type must be one of {DRIVE_TYPE_ENUM}")
        return v

class PlacementCreate(BaseModel):
    student_id: int
    email: str
    drive_id: Optional[int] = None
    placement_type: str
    package_lpa: Optional[float] = None
    offer_status: str
    is_self_placed: bool = False

    @field_validator("placement_type")
    @classmethod
    def validate_placement_type(cls, v: str) -> str:
        if v not in PLACEMENT_TYPE_ENUM:
            raise ValueError(f"placement_type must be one of {PLACEMENT_TYPE_ENUM}")
        return v

    @field_validator("offer_status")
    @classmethod
    def validate_offer_status(cls, v: str) -> str:
        if v not in OFFER_STATUS_ENUM:
            raise ValueError(f"offer_status must be one of {OFFER_STATUS_ENUM}")
        return v

class PlacementStatusUpdate(BaseModel):
    offer_status: str

    @field_validator("offer_status")
    @classmethod
    def validate_offer_status(cls, v: str) -> str:
        if v not in OFFER_STATUS_ENUM:
            raise ValueError(f"offer_status must be one of {OFFER_STATUS_ENUM}")
        return v


# ─────────────────────────────────────────────
# PRISM Calculation
# ─────────────────────────────────────────────

def recalculate_and_save_snapshot(officer_id: int, month: int, year: int) -> dict:
    """
    Core PRISM engine. Called after every placement insert or status change.
    Returns the full snapshot dict including promotion_recommended (not persisted).
    """

    # ── Step 1: Starting Pool ──────────────────
    existing = db.get_snapshot(officer_id, month, year)

    if existing:
        # Locked at month start — never recalculate
        starting_pool = int(existing["starting_pool"])
    else:
        # Sum of total_eligible_students across all officer's assigned programs
        programs = db.get_officer_programs(officer_id)
        total_eligible = sum(
            int(p["total_eligible_students"] or 0) for p in programs
        )

        # Subtract students who were accepted BEFORE this month (cumulative)
        with db_cursor() as cur:
            cur.execute(
                """
                SELECT COUNT(DISTINCT student_id) AS cnt
                FROM placements
                WHERE officer_id = %s
                  AND offer_status = 'accepted'
                  AND (
                        placement_year < %s
                        OR (placement_year = %s AND placement_month < %s)
                      )
                """,
                (officer_id, year, year, month),
            )
            row = cur.fetchone()
            prev_placed = int(row["cnt"]) if row else 0

        starting_pool = max(0, total_eligible - prev_placed)

    # ── Step 2: Target ─────────────────────────
    target = starting_pool * 0.10

    # ── Step 3: Placed this month ──────────────
    placed = db.count_placements_for_officer(officer_id, month, year)

    # ── Step 4: PRISM Credits ──────────────────
    prism_credits = 0.0

    if placed > target:
        # Fetch all accepted placements this month with credit_weightage
        with db_cursor() as cur:
            cur.execute(
                """
                SELECT pl.placement_id, pl.package_lpa, pl.is_self_placed,
                       pr.credit_weightage
                FROM placements pl
                JOIN students  st ON st.student_id  = pl.student_id
                JOIN programs  pr ON pr.program_id  = st.program_id
                WHERE pl.officer_id       = %s
                  AND pl.offer_status     = 'accepted'
                  AND pl.placement_month  = %s
                  AND pl.placement_year   = %s
                ORDER BY pl.placement_id ASC
                """,
                (officer_id, month, year),
            )
            accepted = cur.fetchall()

        # Only the "extra" placements beyond the target count for credits
        extra_count = int(placed - target)
        extra_placements = accepted[-extra_count:] if extra_count > 0 else []

        for p in extra_placements:
            pkg  = float(p["package_lpa"]) if p["package_lpa"] else 0.0
            cw   = int(p["credit_weightage"]) if p["credit_weightage"] else 1
            self_ = bool(p["is_self_placed"])

            if pkg > 10:
                prism_credits += 3          # universal override
            elif self_:
                prism_credits += cw * 0.5
            else:
                prism_credits += cw

    # ── Step 5: PRISM Score ────────────────────
    prism_score = 0  # Deprecated

    # ── Step 6: Save ──────────────────────────
    snapshot = db.upsert_snapshot(
        officer_id=officer_id,
        month=month,
        year=year,
        starting_pool=starting_pool,
        target=target,
        placed=placed,
        prism_credits=prism_credits,
        prism_score=prism_score,
    )

    promotion_recommended = (prism_credits >= 50) and (placed >= target)

    return {
        **dict(snapshot),
        "promotion_recommended": promotion_recommended,
    }


# ─────────────────────────────────────────────
# Health
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "ok", "app": "CAR Progress Tracking"}

@app.get("/health")
def health():
    return {"status": "healthy"}


# ─────────────────────────────────────────────
# Companies
# ─────────────────────────────────────────────

@app.get("/companies")
def list_companies():
    try:
        return db.get_all_companies()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/companies", status_code=201)
def add_company(body: CompanyCreate):
    if not body.company_name.strip():
        raise HTTPException(status_code=400, detail="company_name cannot be empty.")
    try:
        return db.create_company(body.company_name.strip())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─────────────────────────────────────────────
# Drives
# ─────────────────────────────────────────────

@app.get("/drives")
def list_drives(company_id: Optional[int] = Query(None)):
    try:
        return db.get_all_drives(company_id=company_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/drives", status_code=201)
def add_drive(body: DriveCreate):
    try:
        officer_id = db.get_or_create_officer_by_email(body.email)
        
        # Parse optional date string → datetime
        drive_date = None
        if body.drive_date:
            try:
                drive_date = datetime.fromisoformat(body.drive_date)
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid drive_date format. Use ISO 8601 (YYYY-MM-DD).")

        created = db.create_drive(
            company_id=body.company_id,
            drive_type=body.drive_type,
            drive_date=drive_date,
            min_package_lpa=body.min_package_lpa,
            max_package_lpa=body.max_package_lpa,
            is_rvce_drive=body.is_rvce_drive,
        )
        return created
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─────────────────────────────────────────────
# Students
# ─────────────────────────────────────────────

@app.get("/students/usn/{usn}")
def get_student_by_usn(usn: str):
    try:
        student = db.get_student_by_usn(usn.strip().upper())
        if not student:
            raise HTTPException(status_code=404, detail=f"No student found with USN '{usn}'.")
        return {
            "student_id":   student["student_id"],
            "name":         student["name"],
            "usn":          student["usn"],
            "school_name":  student["school_name"],
            "program_name": student["program_name"],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─────────────────────────────────────────────
# Placements
# ─────────────────────────────────────────────

@app.get("/placements")
def list_placements(email: str = Query(...)):
    try:
        officer_id = db.get_or_create_officer_by_email(email)
        return db.get_placements_by_officer(officer_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/placements", status_code=201)
def add_placement(body: PlacementCreate):
    try:
        officer_id = db.get_or_create_officer_by_email(body.email)
        
        now = datetime.now()
        placement_month = now.month
        placement_year  = now.year

        placement = db.create_placement(
            student_id=body.student_id,
            officer_id=officer_id,
            placement_type=body.placement_type,
            offer_status=body.offer_status,
            placement_month=placement_month,
            placement_year=placement_year,
            drive_id=body.drive_id,
            package_lpa=body.package_lpa,
            is_self_placed=body.is_self_placed,
        )

        snapshot = recalculate_and_save_snapshot(officer_id, placement_month, placement_year)

        return {
            "placement":            dict(placement),
            "prism_score":          snapshot["prism_score"],
            "prism_credits":        snapshot["prism_credits"],
            "promotion_recommended": snapshot["promotion_recommended"],
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.put("/placements/{placement_id}/status")
def update_placement_status(placement_id: int, body: PlacementStatusUpdate):
    try:
        # Update status and fetch updated row in one trip
        with db_cursor() as cur:
            cur.execute(
                """
                UPDATE placements
                SET offer_status = %s
                WHERE placement_id = %s
                RETURNING placement_id, officer_id, placement_month, placement_year, offer_status
                """,
                (body.offer_status, placement_id),
            )
            updated = cur.fetchone()

        if not updated:
            raise HTTPException(status_code=404, detail=f"Placement {placement_id} not found.")

        snapshot = recalculate_and_save_snapshot(
            officer_id=updated["officer_id"],
            month=updated["placement_month"],
            year=updated["placement_year"],
        )

        return {
            "placement_id":  updated["placement_id"],
            "offer_status":  updated["offer_status"],
            "snapshot":      snapshot,
        }
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────

@app.get("/dashboard/me")
def get_my_dashboard(
    email: str = Query(...),
    month: int = Query(..., ge=1, le=12),
    year: int  = Query(..., ge=2020),
):
    try:
        officer_id = db.get_or_create_officer_by_email(email)
        snapshot = db.get_snapshot(officer_id, month, year)

        if not snapshot:
            # Generate fresh on first access
            snapshot = recalculate_and_save_snapshot(officer_id, month, year)
        else:
            snapshot = dict(snapshot)

        promotion_recommended = (
            float(snapshot.get("prism_credits", 0) or 0) >= 50
            and int(snapshot.get("placed", 0) or 0) >= float(snapshot.get("target", 0) or 0)
            and int(snapshot.get("starting_pool", 0) or 0) > 0
        )

        return {
            "current_pool":         snapshot["starting_pool"],
            "target":               snapshot["target"],
            "placed_this_month":    snapshot["placed"],
            "minimum_hit":          (int(snapshot.get("placed", 0) or 0) >= float(snapshot.get("target", 0) or 0)) if int(snapshot.get("starting_pool", 0) or 0) > 0 else False,
            "prism_credits":        snapshot["prism_credits"],
            "prism_score":          snapshot["prism_score"],
            "promotion_flag":       promotion_recommended,
            "promotion_recommended": promotion_recommended,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/dashboard/me/history")
def get_my_history(
    email: str = Query(...),
    year: int = Query(..., ge=2020),
):
    try:
        officer_id = db.get_or_create_officer_by_email(email)
        rows = db.get_officer_history(officer_id, year)
        return [
            {
                "month":         r["month"],
                "starting_pool": r["starting_pool"],
                "target":        r["target"],
                "placed":        r["placed"],
                "prism_credits": r["prism_credits"],
                "score":         r["prism_score"],
            }
            for r in rows
        ]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
