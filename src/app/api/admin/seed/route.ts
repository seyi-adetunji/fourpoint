import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { addDays, subDays, setHours, setMinutes, addMinutes } from "date-fns";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("🏨 On-demand Seeding Started...");

    const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    // ─── 1. Departments (Read-Only from ZKBio) ─────────────────────────────
    const existingDepts = await prisma.department.findMany();
    const deptMap: Record<string, any> = {};
    for (const dept of existingDepts) {
      deptMap[dept.name] = dept;
    }

    // ─── 2. Shift Templates ────────────────────────────────────────────────
    const templates = [
      { code: "A", name: "Shift A (AM)", startTime: "08:00", endTime: "15:00", color: "#059669" },
      { code: "B", name: "Shift B (PM)", startTime: "14:00", endTime: "22:00", color: "#2563EB" },
      { code: "N", name: "Shift N (Night)", startTime: "22:00", endTime: "06:00", color: "#7C3AED" },
    ];

    const templateMap: Record<string, any> = {};
    for (const t of templates) {
      const tmpl = await prisma.shiftTemplate.upsert({
        where: { code: t.code },
        update: { name: t.name, startTime: t.startTime, endTime: t.endTime, color: t.color },
        create: t,
      });
      templateMap[t.code] = tmpl;
    }

    // ─── 3. Leave Types ────────────────────────────────────────────────────
    const leaveTypes = [
      { name: "Annual Leave", code: "AL", description: "Paid annual leave" },
      { name: "Sick Leave", code: "SL", description: "Medical sick leave" },
      { name: "Casual Leave", code: "CL", description: "Casual/personal leave" },
      { name: "Maternity Leave", code: "ML", description: "Maternity/paternity leave" },
      { name: "Unpaid Leave", code: "UL", description: "Leave without pay" },
    ];

    const leaveTypeMap: Record<string, any> = {};
    for (const lt of leaveTypes) {
      const created = await prisma.leaveType.upsert({
        where: { code: lt.code },
        update: {},
        create: lt,
      });
      leaveTypeMap[lt.code] = created;
    }

    // ─── 4. Holidays ───────────────────────────────────────────────────────
    const year = new Date().getFullYear();
    const holidays = [
      { name: "Independence Day", holidayDate: new Date(year, 9, 1), description: "Nigeria Independence Day" },
      { name: "Christmas Day", holidayDate: new Date(year, 11, 25), description: "Christmas Holiday" },
      { name: "New Year", holidayDate: new Date(year, 0, 1), description: "New Year Day" },
    ];

    for (const h of holidays) {
      await prisma.holiday.upsert({
        where: { holidayDate: h.holidayDate },
        update: {},
        create: h,
      });
    }

    // ─── 5. Employees (Read-Only from ZKBio) ───────────────────────────────
    const existingEmployees = await prisma.employee.findMany();
    const empMap: Record<string, any> = {};
    for (const e of existingEmployees) {
      empMap[e.empCode] = e;
    }

    // ─── 6. Users (login accounts) ─────────────────────────────────────────
    const passwordHash = await bcrypt.hash("password123", 10);

    const users = [
      { name: "Admin User", email: "admin@fourpoints.com", role: "SUPER_ADMIN" as Role, employeeId: null, departmentId: null },
      { name: "HR Manager", email: "hr@fourpoints.com", role: "HR_ADMIN" as Role, employeeId: empMap["EMP007"]?.id, departmentId: deptMap["Human Resources"]?.id },
      { name: "Valentine Ashioma", email: "valentine@fourpoints.com", role: "HOD" as Role, employeeId: empMap["EMP001"]?.id, departmentId: deptMap["Operations"]?.id },
      { name: "Chidinma Eze", email: "chidinma@fourpoints.com", role: "SUPERVISOR" as Role, employeeId: empMap["EMP009"]?.id, departmentId: deptMap["Housekeeping"]?.id },
      { name: "Angela Okafor", email: "angela@fourpoints.com", role: "EMPLOYEE" as Role, employeeId: empMap["EMP003"]?.id, departmentId: deptMap["Front Office"]?.id },
      { name: "Mustapha Ibrahim", email: "mustapha@fourpoints.com", role: "EMPLOYEE" as Role, employeeId: empMap["EMP004"]?.id, departmentId: deptMap["Kitchen"]?.id },
      { name: "Funke Adeyemi", email: "funke@fourpoints.com", role: "HOD" as Role, employeeId: empMap["EMP011"]?.id, departmentId: deptMap["Operations"]?.id },
    ];

    for (const u of users) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: {
          name: u.name,
          role: u.role,
          employeeId: u.employeeId,
          departmentId: u.departmentId,
        },
        create: {
          ...u,
          passwordHash,
        },
      });
    }

    // ─── 7. Shift Assignments (7-day rota) ─────────────────────────────────
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);
    const monday = subDays(baseDate, (baseDate.getDay() + 6) % 7); // Get Monday

    const rota: Record<string, string[]> = {
      EMP001: ["A", "A", "A", "A", "A", "OFF", "OFF"],
      EMP002: ["OFF", "A", "B", "OFF", "A", "B", "B"],
      EMP003: ["B", "B", "B", "B", "B", "OFF", "OFF"],
      EMP004: ["A", "A", "A", "A", "OFF", "OFF", "A"],
      EMP005: ["N", "N", "N", "N", "N", "OFF", "OFF"],
      EMP006: ["OFF", "A", "A", "A", "A", "A", "OFF"],
      EMP007: ["A", "A", "A", "A", "A", "OFF", "OFF"],
      EMP008: ["A", "A", "A", "A", "A", "OFF", "OFF"],
      EMP009: ["A", "A", "A,B", "A", "A", "OFF", "OFF"],
      EMP010: ["A", "A", "A", "OFF", "B", "B", "OFF"],
      EMP011: ["A,B", "A", "A", "A", "A", "OFF", "OFF"],
      EMP012: ["B", "B", "B", "B", "OFF", "OFF", "B"],
      EMP013: ["N", "N", "N", "N", "N", "OFF", "OFF"],
      EMP014: ["A", "A", "A", "A", "A", "OFF", "OFF"],
      EMP015: ["A", "A", "A", "OFF", "A", "A", "OFF"],
    };

    for (const [empCode, schedule] of Object.entries(rota)) {
      const employee = empMap[empCode];
      if (!employee) continue;

      for (let day = 0; day < 7; day++) {
        const dateVal = addDays(monday, day);
        const shifts = schedule[day].split(",").map((s) => s.trim());

        for (let seq = 0; seq < shifts.length; seq++) {
          const code = shifts[seq];
          if (code === "OFF") continue;

          const template = templateMap[code];
          if (!template) continue;

          await prisma.shiftAssignment.upsert({
            where: {
              employeeId_workDate_sequence: {
                employeeId: employee.id,
                workDate: dateVal,
                sequence: seq + 1,
              },
            },
            update: { shiftTemplateId: template.id },
            create: {
              employeeId: employee.id,
              shiftTemplateId: template.id,
              workDate: dateVal,
              sequence: seq + 1,
              status: "SCHEDULED",
            },
          });
        }
      }
    }

    // ─── 8. Attendance Punches (Read-Only from ZKBio) ─────────────────────
    // Punches are read-only, so we do not seed them here.
    // They are populated by the biometric devices directly.

    return NextResponse.json({ message: "Seeding complete!" });
  } catch (error: any) {
    console.error("Seeding error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
