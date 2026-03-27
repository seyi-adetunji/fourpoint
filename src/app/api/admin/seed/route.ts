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

    // ─── 1. Departments ────────────────────────────────────────────────────
    const departments = [
      { name: "Operations", code: "OPS" },
      { name: "Housekeeping", code: "HSK" },
      { name: "Front Office", code: "FO" },
      { name: "Kitchen", code: "KIT" },
      { name: "Human Resources", code: "HR" },
      { name: "Maintenance", code: "MNT" },
    ];

    const deptMap: Record<string, any> = {};
    for (const d of departments) {
      const dept = await prisma.department.upsert({
        where: { code: d.code },
        update: { name: d.name },
        create: d,
      });
      deptMap[d.name] = dept;
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

    // ─── 5. Employees ──────────────────────────────────────────────────────
    const employeeData = [
      { empCode: "EMP001", fullName: "Valentine Ashioma", dept: "Operations", designation: "Operations Manager" },
      { empCode: "EMP002", fullName: "Edet Asequo", dept: "Housekeeping", designation: "Room Attendant" },
      { empCode: "EMP003", fullName: "Angela Okafor", dept: "Front Office", designation: "Receptionist" },
      { empCode: "EMP004", fullName: "Mustapha Ibrahim", dept: "Kitchen", designation: "Chef de Partie" },
      { empCode: "EMP005", fullName: "Samuel Adebayo", dept: "Operations", designation: "Concierge" },
      { empCode: "EMP006", fullName: "Kadiri Musa", dept: "Maintenance", designation: "Maintenance Technician" },
      { empCode: "EMP007", fullName: "Damilola Ogundimu", dept: "Human Resources", designation: "HR Officer" },
      { empCode: "EMP008", fullName: "Abimbola Fashola", dept: "Front Office", designation: "Guest Relations" },
      { empCode: "EMP009", fullName: "Chidinma Eze", dept: "Housekeeping", designation: "Housekeeping Supervisor" },
      { empCode: "EMP010", fullName: "Ibrahim Suleiman", dept: "Kitchen", designation: "Sous Chef" },
      { empCode: "EMP011", fullName: "Funke Adeyemi", dept: "Operations", designation: "Duty Manager" },
      { empCode: "EMP012", fullName: "Tunde Bakare", dept: "Maintenance", designation: "Electrician" },
      { empCode: "EMP013", fullName: "Grace Nwosu", dept: "Front Office", designation: "Night Auditor" },
      { empCode: "EMP014", fullName: "Olayinka Popoola", dept: "Housekeeping", designation: "Laundry Attendant" },
      { empCode: "EMP015", fullName: "Ahmed Bello", dept: "Kitchen", designation: "Kitchen Porter" },
    ];

    const empMap: Record<string, any> = {};
    for (const e of employeeData) {
      const created = await prisma.employee.upsert({
        where: { empCode: e.empCode },
        update: { fullName: e.fullName, departmentId: deptMap[e.dept].id, designation: e.designation },
        create: {
          empCode: e.empCode,
          fullName: e.fullName,
          departmentId: deptMap[e.dept].id,
          designation: e.designation,
        },
      });
      empMap[e.empCode] = created;
    }

    // ─── 6. Users (login accounts) ─────────────────────────────────────────
    const passwordHash = await bcrypt.hash("password123", 10);

    const users = [
      { name: "Admin User", email: "admin@fourpoints.com", role: "SUPER_ADMIN" as Role, employeeId: null, departmentId: null },
      { name: "HR Manager", email: "hr@fourpoints.com", role: "HR_ADMIN" as Role, employeeId: empMap["EMP007"].id, departmentId: deptMap["Human Resources"].id },
      { name: "Valentine Ashioma", email: "valentine@fourpoints.com", role: "HOD" as Role, employeeId: empMap["EMP001"].id, departmentId: deptMap["Operations"].id },
      { name: "Chidinma Eze", email: "chidinma@fourpoints.com", role: "SUPERVISOR" as Role, employeeId: empMap["EMP009"].id, departmentId: deptMap["Housekeeping"].id },
      { name: "Angela Okafor", email: "angela@fourpoints.com", role: "EMPLOYEE" as Role, employeeId: empMap["EMP003"].id, departmentId: deptMap["Front Office"].id },
      { name: "Mustapha Ibrahim", email: "mustapha@fourpoints.com", role: "EMPLOYEE" as Role, employeeId: empMap["EMP004"].id, departmentId: deptMap["Kitchen"].id },
      { name: "Funke Adeyemi", email: "funke@fourpoints.com", role: "HOD" as Role, employeeId: empMap["EMP011"].id, departmentId: deptMap["Operations"].id },
    ];

    for (const u of users) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: { 
          role: u.role, 
          departmentId: u.departmentId,
          passwordHash 
        },
        create: { ...u, passwordHash },
      });
    }

    return NextResponse.json({ message: "Seeding complete!" });
  } catch (error: any) {
    console.error("Seeding error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
