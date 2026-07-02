# CAR Progress Tracking (Job Intelligence Engine)

A comprehensive full-stack application designed to track and manage student placements, drives, and officer assignments across schools and programs.

## Project Structure

This repository is organized as a monorepo containing both the frontend and backend applications:

- `/frontend` - Next.js 15 web application.
- `/backend` - FastAPI Python server.
- `docker-compose.yml` - Local database infrastructure.

## Tech Stack

### Frontend
- **Framework**: Next.js (React 19)
- **Styling**: Tailwind CSS v4
- **Animations**: GSAP
- **Authentication**: Better-Auth
- **Database ORM**: Drizzle ORM
- **Language**: TypeScript

### Backend
- **Framework**: FastAPI
- **Package Manager**: uv
- **Database Driver**: psycopg2-binary
- **Task Scheduling**: APScheduler
- **Language**: Python 3.12+

### Database
- PostgreSQL 15 (managed via Docker)

## Database Schema Highlights
The application tracks the following core entities:
- **Institutions**: Schools, Programs, Students
- **Roles**: Users, Placement Officers, Program Officer Assignments
- **Placement Data**: Companies, Drives (Full-time, Internship, Capstone), Placements, Offers
- **Analytics**: Officer Monthly Snapshots

---

## Getting Started

### 1. Start the Database
The project uses Docker Compose to run a local PostgreSQL instance.

```bash
docker-compose up -d
```
*This will spin up a Postgres DB named `job_intelligence_db` on port 5432.*

### 2. Run the Backend
The backend requires `uv` for fast dependency management. Make sure you have python 3.12+ installed.

```bash
cd backend

# Install dependencies (handled by uv automatically during run)
# Run the FastAPI server
uv run uvicorn main:app --reload
```
*The backend server will run at `http://127.0.0.1:8000`.*

### 3. Run the Frontend
The frontend uses npm for dependency management.

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```
*The frontend application will be accessible at `http://localhost:3000`.*

## Environment Variables
Ensure you have the necessary `.env` files set up.
- **Frontend**: Contains `DATABASE_URL` (which the backend also reads).
- **Backend**: Shares the `DATABASE_URL` with the frontend to connect to the database.

> [!NOTE]
> The backend connects to the database utilizing a connection pool via `psycopg2`. Database I/O is routed through `backend/database.py` which mirrors the schemas defined in `frontend/src/db/schema.ts` via Drizzle.
