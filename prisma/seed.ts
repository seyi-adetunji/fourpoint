import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🏨 Seeding FourPoints WorkforceOps...\n')

  // ─── 1. Shift Templates ──────────────────────────────────────────────────
  const templates = [
    { code: 'A', name: 'Shift A (Morning)',  startTime: '08:00', endTime: '15:00', color: '#059669', graceLate: 15, graceEarly: 15 },
    { code: 'B', name: 'Shift B (Afternoon)', startTime: '14:00', endTime: '22:00', color: '#2563EB', graceLate: 15, graceEarly: 15 },
    { code: 'N', name: 'Shift N (Night)',    startTime: '22:00', endTime: '06:00', color: '#7C3AED', graceLate: 15, graceEarly: 15 },
    { code: 'D', name: 'Day Shift (Full)',   startTime: '07:00', endTime: '18:00', color: '#D97706', graceLate: 30, graceEarly: 30 },
  ]

  for (const t of templates) {
    await prisma.shiftTemplate.upsert({
      where: { code: t.code },
      update: { name: t.name, startTime: t.startTime, endTime: t.endTime, color: t.color },
      create: t,
    })
  }
  console.log(`✅ ${templates.length} shift templates seeded`)

  // ─── 2. Leave Types ──────────────────────────────────────────────────────
  const leaveTypes = [
    { name: 'Annual Leave',    code: 'AL', description: 'Paid annual leave entitlement' },
    { name: 'Sick Leave',      code: 'SL', description: 'Medical / sick leave' },
    { name: 'Casual Leave',    code: 'CL', description: 'Short personal / casual leave' },
    { name: 'Maternity Leave', code: 'ML', description: 'Maternity / paternity leave' },
    { name: 'Unpaid Leave',    code: 'UL', description: 'Leave without pay' },
    { name: 'Study Leave',     code: 'STL', description: 'Approved study or exam leave' },
  ]

  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {},
      create: lt,
    })
  }
  console.log(`✅ ${leaveTypes.length} leave types seeded`)

  // ─── 3. Public Holidays ──────────────────────────────────────────────────
  const year = new Date().getFullYear()
  const holidays = [
    { name: "New Year's Day",          holidayDate: new Date(year,  0,  1), description: "New Year's Day" },
    { name: 'Democracy Day',           holidayDate: new Date(year,  5, 12), description: 'Nigerian Democracy Day' },
    { name: 'Independence Day',        holidayDate: new Date(year,  9,  1), description: 'Nigerian Independence Day' },
    { name: 'Christmas Day',           holidayDate: new Date(year, 11, 25), description: 'Christmas Holiday' },
    { name: 'Boxing Day',              holidayDate: new Date(year, 11, 26), description: 'Boxing Day' },
    { name: 'Workers Day',             holidayDate: new Date(year,  4,  1), description: "International Workers' Day" },
    { name: 'National Day (Oct 1)',     holidayDate: new Date(year,  9,  2), description: 'National Day Holiday' },
  ]

  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { holidayDate: h.holidayDate },
      update: {},
      create: h,
    })
  }
  console.log(`✅ ${holidays.length} public holidays seeded`)

  // ─── 4. System Users (no employeeId — platform accounts) ─────────────
  // NOTE: employeeId and departmentId reference public.personnel_employee
  // and public.personnel_department respectively. System/admin accounts have no
  // corresponding BioTime employee record, so these are left null.
  const passwordHash = await bcrypt.hash('password123', 10)

  const systemUsers: {
    name: string
    email: string
    role: Role
    employeeId?: number | null
    departmentId?: number | null
  }[] = [
    {
      name:           'Super Admin',
      email:          'admin@fourpoints.com',
      role:           'SUPER_ADMIN',
      employeeId:  null,
      departmentId: null,
    },
    {
      name:           'HR Manager',
      email:          'hr@fourpoints.com',
      role:           'HR_ADMIN',
      employeeId:  null,
      departmentId: null,
    },
    {
      name:           'Attendance Officer',
      email:          'attendance@fourpoints.com',
      role:           'SUPERVISOR',
      employeeId:  null,
      departmentId: null,
    },
  ]

  for (const u of systemUsers) {
    await prisma.user.upsert({
      where:  { email: u.email },
      update: { name: u.name, role: u.role, isActive: true },
      create: {
        name:            u.name,
        email:           u.email,
        passwordHash,
        role:            u.role,
        employeeId:   u.employeeId ?? null,
        departmentId: u.departmentId ?? null,
        isActive:        true,
      },
    })
  }
  console.log(`✅ ${systemUsers.length} system user accounts seeded`)

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log('\n🎉 Seeding complete!\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📋 System Login Credentials (password: password123)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Super Admin:        admin@fourpoints.com')
  console.log('  HR Admin:           hr@fourpoints.com')
  console.log('  Attendance Officer: attendance@fourpoints.com')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n💡 BioTime employees (public.personnel_employee) are')
  console.log('   linked via employeeId — no local copies needed.')
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
