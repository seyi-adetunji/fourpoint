-- Create the workforce schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS workforce;

-- 1. Create Shift Templates
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

-- 2. Create Shift Assignments (Rota)
CREATE TABLE IF NOT EXISTS workforce."ShiftAssignment" (
    "id" TEXT PRIMARY KEY,
    "employeeId" INTEGER NOT NULL,
    "shiftTemplateId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "status" TEXT DEFAULT 'SCHEDULED',
    "sequence" INTEGER DEFAULT 1,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Attendance Punches (Overrides/Manual)
CREATE TABLE IF NOT EXISTS workforce."AttendancePunch" (
    "id" TEXT PRIMARY KEY,
    "employeeId" INTEGER NOT NULL,
    "punchTime" TIMESTAMP(3) NOT NULL,
    "deviceName" TEXT,
    "source" TEXT DEFAULT 'BIOMETRIC',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Attendance Results (Calculated Data)
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
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create Attendance Corrections (Manual Edits)
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
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create Attendance Exceptions
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
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);
