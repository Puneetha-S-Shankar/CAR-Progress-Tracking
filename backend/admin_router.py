from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
from pydantic import BaseModel
import database as db

router = APIRouter(prefix="/admin", tags=["admin"])

def verify_admin(email: str = Query(...)):
    """Dependency to check if user is admin."""
    with db.db_cursor() as cur:
        cur.execute('SELECT role FROM "user" WHERE email = %s', (email,))
        row = cur.fetchone()
        if not row or row["role"] != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        return email

class SchoolCreate(BaseModel):
    school_name: str

class ProgramCreate(BaseModel):
    school_id: int
    program_name: str
    credit_weightage: float
    total_eligible_students: int

class OfficerUpdate(BaseModel):
    name: str
    phone: Optional[str] = None

class StudentCreate(BaseModel):
    name: str
    usn: str
    school_id: int
    program_id: int
    batch: str
    is_active: bool = True

# --- Schools ---
@router.get("/schools")
def get_schools(email: str = Depends(verify_admin)):
    return db.get_all_schools()

@router.post("/schools", status_code=201)
def create_school(body: SchoolCreate, email: str = Depends(verify_admin)):
    return db.create_school(body.school_name)

@router.delete("/schools/{school_id}")
def delete_school(school_id: int, email: str = Depends(verify_admin)):
    success = db.delete_school(school_id)
    if not success:
        raise HTTPException(status_code=404, detail="School not found")
    return {"status": "ok"}

# --- Programs ---
@router.get("/programs")
def get_programs(email: str = Depends(verify_admin)):
    return db.get_all_programs()

@router.post("/programs", status_code=201)
def create_program(body: ProgramCreate, email: str = Depends(verify_admin)):
    return db.create_program(body.school_id, body.program_name, body.credit_weightage, body.total_eligible_students)

@router.delete("/programs/{program_id}")
def delete_program(program_id: int, email: str = Depends(verify_admin)):
    success = db.delete_program(program_id)
    if not success:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"status": "ok"}

# --- Officers ---
@router.get("/officers")
def get_officers(email: str = Depends(verify_admin)):
    return db.get_all_officers()

@router.put("/officers/{officer_id}")
def update_officer(officer_id: int, body: OfficerUpdate, email: str = Depends(verify_admin)):
    res = db.update_officer(officer_id, body.name, body.phone)
    if not res:
        raise HTTPException(status_code=404, detail="Officer not found")
    return res

@router.delete("/officers/{officer_id}")
def delete_officer(officer_id: int, email: str = Depends(verify_admin)):
    success = db.delete_officer(officer_id)
    if not success:
        raise HTTPException(status_code=404, detail="Officer not found")
    return {"status": "ok"}

# --- Officer-Program Assignments ---
@router.post("/officers/{officer_id}/programs/{program_id}", status_code=201)
def assign_program(officer_id: int, program_id: int, email: str = Depends(verify_admin)):
    db.assign_officer_to_program(officer_id, program_id)
    return {"status": "assigned"}

@router.delete("/officers/{officer_id}/programs/{program_id}")
def unassign_program(officer_id: int, program_id: int, email: str = Depends(verify_admin)):
    db.unassign_officer_from_program(officer_id, program_id)
    return {"status": "unassigned"}

@router.get("/officers/{officer_id}/programs")
def get_officer_programs(officer_id: int, email: str = Depends(verify_admin)):
    return db.get_officer_programs(officer_id)

# --- Students ---
@router.get("/students")
def get_students(email: str = Depends(verify_admin)):
    return db.get_all_students(active_only=False)

@router.post("/students", status_code=201)
def create_student(body: StudentCreate, email: str = Depends(verify_admin)):
    return db.create_student(body.name, body.usn, body.school_id, body.program_id, body.batch, body.is_active)

@router.delete("/students/{student_id}")
def delete_student(student_id: int, email: str = Depends(verify_admin)):
    success = db.delete_student(student_id)
    if not success:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"status": "ok"}
