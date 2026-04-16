-- 1. INITIALIZE SCHEMA
CREATE SCHEMA IF NOT EXISTS workforce;

-- 2. CREATE ROLES ENUM
DO $$ BEGIN
    CREATE TYPE workforce."Role" AS ENUM ('SUPER_ADMIN', 'HR_ADMIN', 'HOD', 'SUPERVISOR', 'EMPLOYEE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. CREATE USERS TABLE
CREATE TABLE IF NOT EXISTS workforce."User" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT UNIQUE NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" workforce."Role" DEFAULT 'EMPLOYEE',
    "employeeId" INTEGER UNIQUE,
    "departmentId" INTEGER,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- 4. SHIFT TEMPLATES
CREATE TABLE IF NOT EXISTS workforce."ShiftTemplate" (
    "id" TEXT PRIMARY KEY,
    "code" TEXT UNIQUE NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "color" TEXT DEFAULT '#6B7280',
    "graceLate" INTEGER DEFAULT 15,
    "graceEarly" INTEGER DEFAULT 15,
    "breakMinutes" INTEGER DEFAULT 60,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- 5. SHIFT ASSIGNMENTS (ROTA)
CREATE TABLE IF NOT EXISTS workforce."ShiftAssignment" (
    "id" TEXT PRIMARY KEY,
    "employeeId" INTEGER NOT NULL,
    "shiftTemplateId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "sequence" INTEGER DEFAULT 1,
    "status" TEXT DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "assignedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES workforce."User"("id") ON DELETE SET NULL,
    CONSTRAINT "ShiftAssignment_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES workforce."ShiftTemplate"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShiftAssignment_employeeId_workDate_sequence_key" ON workforce."ShiftAssignment"("employeeId", "workDate", "sequence");

-- 6. ATTENDANCE PUNCHES
CREATE TABLE IF NOT EXISTS workforce."AttendancePunch" (
    "id" TEXT PRIMARY KEY,
    "employeeId" INTEGER NOT NULL,
    "punchTime" TIMESTAMP(3) NOT NULL,
    "deviceName" TEXT,
    "source" TEXT DEFAULT 'BIOMETRIC',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- 7. ATTENDANCE RESULTS
CREATE TABLE IF NOT EXISTS workforce."AttendanceResult" (
    "id" TEXT PRIMARY KEY,
    "employeeId" INTEGER NOT NULL,
    "workDate" DATE NOT NULL,
    "shiftTemplateId" TEXT,
    "shiftAssignmentId" TEXT,
    "sequence" INTEGER DEFAULT 1,
    "actualIn" TIMESTAMP(3),
    "actualOut" TIMESTAMP(3),
    "workedMinutes" INTEGER DEFAULT 0,
    "lateMinutes" INTEGER DEFAULT 0,
    "earlyExitMinutes" INTEGER DEFAULT 0,
    "overtimeMinutes" INTEGER DEFAULT 0,
    "breakMinutes" INTEGER DEFAULT 0,
    "status" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceResult_shiftAssignmentId_fkey" FOREIGN KEY ("shiftAssignmentId") REFERENCES workforce."ShiftAssignment"("id") ON DELETE SET NULL,
    CONSTRAINT "AttendanceResult_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES workforce."ShiftTemplate"("id") ON DELETE SET NULL
);

-- 8. ATTENDANCE EXCEPTIONS
CREATE TABLE IF NOT EXISTS workforce."AttendanceException" (
    "id" TEXT PRIMARY KEY,
    "employeeId" INTEGER NOT NULL,
    "workDate" DATE NOT NULL,
    "attendanceResultId" TEXT,
    "type" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT DEFAULT 'PENDING',
    "assignedToUserId" TEXT,
    "resolvedByUserId" TEXT,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceException_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES workforce."User"("id") ON DELETE SET NULL,
    CONSTRAINT "AttendanceException_attendanceResultId_fkey" FOREIGN KEY ("attendanceResultId") REFERENCES workforce."AttendanceResult"("id") ON DELETE SET NULL,
    CONSTRAINT "AttendanceException_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES workforce."User"("id") ON DELETE SET NULL
);

-- 9. ATTENDANCE CORRECTIONS
CREATE TABLE IF NOT EXISTS workforce."AttendanceCorrection" (
    "id" TEXT PRIMARY KEY,
    "employeeId" INTEGER NOT NULL,
    "workDate" DATE NOT NULL,
    "attendanceResultId" TEXT,
    "type" TEXT NOT NULL,
    "correctedTime" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "status" TEXT DEFAULT 'PENDING',
    "approvedByUserId" TEXT,
    "approvalNote" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceCorrection_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES workforce."User"("id") ON DELETE SET NULL,
    CONSTRAINT "AttendanceCorrection_attendanceResultId_fkey" FOREIGN KEY ("attendanceResultId") REFERENCES workforce."AttendanceResult"("id") ON DELETE SET NULL,
    CONSTRAINT "AttendanceCorrection_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES workforce."User"("id") ON DELETE RESTRICT
);

-- 10. LEAVE MANAGEMENT
CREATE TABLE IF NOT EXISTS workforce."LeaveType" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT UNIQUE NOT NULL,
    "code" TEXT UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workforce."LeaveRequest" (
    "id" TEXT PRIMARY KEY,
    "employeeId" INTEGER NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES workforce."User"("id") ON DELETE SET NULL,
    CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES workforce."LeaveType"("id") ON DELETE RESTRICT,
    CONSTRAINT "LeaveRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES workforce."User"("id") ON DELETE RESTRICT
);

-- 11. HOLIDAYS
CREATE TABLE IF NOT EXISTS workforce."Holiday" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "holidayDate" DATE UNIQUE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- 12. AUDIT LOGS
CREATE TABLE IF NOT EXISTS workforce."AuditLog" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES workforce."User"("id") ON DELETE RESTRICT
);

-- 13. SEED INITIAL ADMIN USER
-- Password hash for 'password123'
INSERT INTO workforce."User" ("id", "name", "email", "passwordHash", "role", "isActive")
VALUES ('admin-init', 'System Admin', 'admin@fourpoints.com', '$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgNI9X9697Rwr.5wL05L6E5v6u', 'SUPER_ADMIN', true)
ON CONFLICT ("email") DO NOTHING;
