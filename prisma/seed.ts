import { PrismaClient, Role } from '@prisma/client'
import { addDays, subDays, setHours, setMinutes, addMinutes } from 'date-fns'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main() {
  console.log('🏨 Seeding WorkforceOps Database...\n')

  // ─── 1. Departments ────────────────────────────────────────────────────
  const departments = [
    { name: 'Operations', code: 'OPS' },
    { name: 'Housekeeping', code: 'HSK' },
    { name: 'Front Office', code: 'FO' },
    { name: 'Kitchen', code: 'KIT' },
    { name: 'Human Resources', code: 'HR' },
    { name: 'Maintenance', code: 'MNT' },
  ]

  const deptMap: Record<string, any> = {}
  for (const d of departments) {
    const dept = await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name },
      create: d,
    })
    deptMap[d.name] = dept
  }
  console.log(`✅ ${departments.length} departments created`)

  // ─── 2. Shift Templates ────────────────────────────────────────────────
  const templates = [
    { code: 'A', name: 'Shift A (AM)', startTime: '08:00', endTime: '15:00', color: '#059669' },
    { code: 'B', name: 'Shift B (PM)', startTime: '14:00', endTime: '22:00', color: '#2563EB' },
    { code: 'N', name: 'Shift N (Night)', startTime: '22:00', endTime: '06:00', color: '#7C3AED' },
  ]

  const templateMap: Record<string, any> = {}
  for (const t of templates) {
    const tmpl = await prisma.shiftTemplate.upsert({
      where: { code: t.code },
      update: { name: t.name, startTime: t.startTime, endTime: t.endTime, color: t.color },
      create: t,
    })
    templateMap[t.code] = tmpl
  }
  console.log(`✅ ${templates.length} shift templates created`)

  // ─── 3. Leave Types ────────────────────────────────────────────────────
  const leaveTypes = [
    { name: 'Annual Leave', code: 'AL', description: 'Paid annual leave' },
    { name: 'Sick Leave', code: 'SL', description: 'Medical sick leave' },
    { name: 'Casual Leave', code: 'CL', description: 'Casual/personal leave' },
    { name: 'Maternity Leave', code: 'ML', description: 'Maternity/paternity leave' },
    { name: 'Unpaid Leave', code: 'UL', description: 'Leave without pay' },
  ]

  const leaveTypeMap: Record<string, any> = {}
  for (const lt of leaveTypes) {
    const created = await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {},
      create: lt,
    })
    leaveTypeMap[lt.code] = created
  }
  console.log(`✅ ${leaveTypes.length} leave types created`)

  // ─── 4. Holidays ───────────────────────────────────────────────────────
  const year = new Date().getFullYear()
  const holidays = [
    { name: 'Independence Day', holidayDate: new Date(year, 9, 1), description: 'Nigeria Independence Day' },
    { name: 'Christmas Day', holidayDate: new Date(year, 11, 25), description: 'Christmas Holiday' },
    { name: 'New Year', holidayDate: new Date(year, 0, 1), description: 'New Year Day' },
  ]

  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { holidayDate: h.holidayDate },
      update: {},
      create: h,
    })
  }
  console.log(`✅ ${holidays.length} holidays created`)

  // ─── 5. Employees ──────────────────────────────────────────────────────
  const employeeData = [
    { empCode: 'EMP001', fullName: 'Valentine Ashioma', dept: 'Operations', designation: 'Operations Manager' },
    { empCode: 'EMP002', fullName: 'Edet Asequo', dept: 'Housekeeping', designation: 'Room Attendant' },
    { empCode: 'EMP003', fullName: 'Angela Okafor', dept: 'Front Office', designation: 'Receptionist' },
    { empCode: 'EMP004', fullName: 'Mustapha Ibrahim', dept: 'Kitchen', designation: 'Chef de Partie' },
    { empCode: 'EMP005', fullName: 'Samuel Adebayo', dept: 'Operations', designation: 'Concierge' },
    { empCode: 'EMP006', fullName: 'Kadiri Musa', dept: 'Maintenance', designation: 'Maintenance Technician' },
    { empCode: 'EMP007', fullName: 'Damilola Ogundimu', dept: 'Human Resources', designation: 'HR Officer' },
    { empCode: 'EMP008', fullName: 'Abimbola Fashola', dept: 'Front Office', designation: 'Guest Relations' },
    { empCode: 'EMP009', fullName: 'Chidinma Eze', dept: 'Housekeeping', designation: 'Housekeeping Supervisor' },
    { empCode: 'EMP010', fullName: 'Ibrahim Suleiman', dept: 'Kitchen', designation: 'Sous Chef' },
    { empCode: 'EMP011', fullName: 'Funke Adeyemi', dept: 'Operations', designation: 'Duty Manager' },
    { empCode: 'EMP012', fullName: 'Tunde Bakare', dept: 'Maintenance', designation: 'Electrician' },
    { empCode: 'EMP013', fullName: 'Grace Nwosu', dept: 'Front Office', designation: 'Night Auditor' },
    { empCode: 'EMP014', fullName: 'Olayinka Popoola', dept: 'Housekeeping', designation: 'Laundry Attendant' },
    { empCode: 'EMP015', fullName: 'Ahmed Bello', dept: 'Kitchen', designation: 'Kitchen Porter' },
  ]

  const empMap: Record<string, any> = {}
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
    })
    empMap[e.empCode] = created
  }
  console.log(`✅ ${employeeData.length} employees created`)

  // ─── 6. Users (login accounts) ─────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 10)

  const users = [
    { name: 'Admin User', email: 'admin@fourpoints.com', role: 'SUPER_ADMIN' as Role, employeeId: null, departmentId: null },
    { name: 'HR Manager', email: 'hr@fourpoints.com', role: 'HR_ADMIN' as Role, employeeId: empMap['EMP007'].id, departmentId: deptMap['Human Resources'].id },
    { name: 'Valentine Ashioma', email: 'valentine@fourpoints.com', role: 'HOD' as Role, employeeId: empMap['EMP001'].id, departmentId: deptMap['Operations'].id },
    { name: 'Chidinma Eze', email: 'chidinma@fourpoints.com', role: 'SUPERVISOR' as Role, employeeId: empMap['EMP009'].id, departmentId: deptMap['Housekeeping'].id },
    { name: 'Angela Okafor', email: 'angela@fourpoints.com', role: 'EMPLOYEE' as Role, employeeId: empMap['EMP003'].id, departmentId: deptMap['Front Office'].id },
    { name: 'Mustapha Ibrahim', email: 'mustapha@fourpoints.com', role: 'EMPLOYEE' as Role, employeeId: empMap['EMP004'].id, departmentId: deptMap['Kitchen'].id },
    { name: 'Funke Adeyemi', email: 'funke@fourpoints.com', role: 'HOD' as Role, employeeId: empMap['EMP011'].id, departmentId: deptMap['Operations'].id },
  ]

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { 
        role: u.role, 
        departmentId: u.departmentId,
        passwordHash 
      },
      create: { ...u, passwordHash },
    })
  }
  console.log(`✅ ${users.length} user accounts created`)

  // ─── 7. Shift Assignments (7-day rota) ─────────────────────────────────
  const baseDate = new Date()
  baseDate.setHours(0, 0, 0, 0)
  const monday = subDays(baseDate, (baseDate.getDay() + 6) % 7) // Get Monday

  // Rota: empCode → 7-day schedule (comma = double shift)
  const rota: Record<string, string[]> = {
    EMP001: ['A',   'A',   'A',   'A',   'A',   'OFF', 'OFF'],
    EMP002: ['OFF', 'A',   'B',   'OFF', 'A',   'B',   'B'],
    EMP003: ['B',   'B',   'B',   'B',   'B',   'OFF', 'OFF'],
    EMP004: ['A',   'A',   'A',   'A',   'OFF', 'OFF', 'A'],
    EMP005: ['N',   'N',   'N',   'N',   'N',   'OFF', 'OFF'],
    EMP006: ['OFF', 'A',   'A',   'A',   'A',   'A',   'OFF'],
    EMP007: ['A',   'A',   'A',   'A',   'A',   'OFF', 'OFF'],
    EMP008: ['A',   'A',   'A',   'A',   'A',   'OFF', 'OFF'],
    EMP009: ['A',   'A',   'A,B', 'A',   'A',   'OFF', 'OFF'],  // Double shift on Wed
    EMP010: ['A',   'A',   'A',   'OFF', 'B',   'B',   'OFF'],
    EMP011: ['A,B', 'A',   'A',   'A',   'A',   'OFF', 'OFF'],  // Double shift on Mon
    EMP012: ['B',   'B',   'B',   'B',   'OFF', 'OFF', 'B'],
    EMP013: ['N',   'N',   'N',   'N',   'N',   'OFF', 'OFF'],
    EMP014: ['A',   'A',   'A',   'A',   'A',   'OFF', 'OFF'],
    EMP015: ['A',   'A',   'A',   'OFF', 'A',   'A',   'OFF'],
  }

  let assignmentCount = 0
  for (const [empCode, schedule] of Object.entries(rota)) {
    const employee = empMap[empCode]
    if (!employee) continue

    for (let day = 0; day < 7; day++) {
      const dateVal = addDays(monday, day)
      const shifts = schedule[day].split(',').map(s => s.trim())

      for (let seq = 0; seq < shifts.length; seq++) {
        const code = shifts[seq]
        if (code === 'OFF') continue

        const template = templateMap[code]
        if (!template) continue

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
            status: 'SCHEDULED',
          },
        })
        assignmentCount++
      }
    }
  }
  console.log(`✅ ${assignmentCount} shift assignments created`)

  // ─── 8. Attendance Punches (realistic mock data) ───────────────────────
  let punchCount = 0
  // Only create punches for past days (not future)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  for (const [empCode, schedule] of Object.entries(rota)) {
    const employee = empMap[empCode]
    if (!employee) continue

    for (let day = 0; day < 7; day++) {
      const dateVal = addDays(monday, day)
      if (dateVal > today) continue  // Skip future dates

      const shifts = schedule[day].split(',').map(s => s.trim())

      for (const code of shifts) {
        if (code === 'OFF') continue
        const template = templateMap[code]
        if (!template) continue

        const [startH, startM] = template.startTime.split(':').map(Number)
        const [endH, endM] = template.endTime.split(':').map(Number)

        let shiftStart = setMinutes(setHours(dateVal, startH), startM)
        let shiftEnd = setMinutes(setHours(dateVal, endH), endM)
        if (code === 'N') shiftEnd = addDays(shiftEnd, 1)

        const r = Math.random()

        // Scenario controls per employee
        let actualIn: Date | null = null
        let actualOut: Date | null = null

        if (empCode === 'EMP002' && day === 3) {
          // EMP002 Wed: No show (absent)
          continue
        } else if (empCode === 'EMP004' && day === 1) {
          // EMP004 Tue: Very late arrival (30 min)
          actualIn = addMinutes(shiftStart, 30)
          actualOut = addMinutes(shiftEnd, rand(-5, 10))
        } else if (empCode === 'EMP003' && day === 2) {
          // EMP003 Wed: Early exit (45 min early)
          actualIn = addMinutes(shiftStart, rand(-5, 5))
          actualOut = addMinutes(shiftEnd, -45)
        } else if (empCode === 'EMP006' && day === 4) {
          // EMP006 Fri: Missing OUT punch
          actualIn = addMinutes(shiftStart, rand(-10, 5))
          actualOut = null
        } else if (empCode === 'EMP014' && day === 0) {
          // EMP014 Mon: Overtime (stayed 2 hours extra)
          actualIn = addMinutes(shiftStart, rand(-10, 0))
          actualOut = addMinutes(shiftEnd, 120)
        } else {
          // Normal: arrive within -10 to +15, leave within -5 to +20
          if (r > 0.03) {
            actualIn = addMinutes(shiftStart, rand(-10, 15))
          }
          if (r > 0.05 || actualIn) {
            actualOut = addMinutes(shiftEnd, rand(-5, 20))
          }
        }

        if (actualIn) {
          await prisma.attendancePunch.create({
            data: { employeeId: employee.id, punchTime: actualIn, source: 'BIOMETRIC' },
          })
          punchCount++
        }
        if (actualOut) {
          await prisma.attendancePunch.create({
            data: { employeeId: employee.id, punchTime: actualOut, source: 'BIOMETRIC' },
          })
          punchCount++
        }
      }
    }
  }
  console.log(`✅ ${punchCount} attendance punches created`)

  // ─── 9. Leave Requests (sample) ────────────────────────────────────────
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@fourpoints.com' } })

  if (adminUser) {
    await prisma.leaveRequest.create({
      data: {
        employeeId: empMap['EMP002'].id,
        leaveTypeId: leaveTypeMap['AL'].id,
        startDate: addDays(today, 7),
        endDate: addDays(today, 9),
        reason: 'Family wedding ceremony',
        status: 'PENDING',
        requestedByUserId: adminUser.id,
      },
    })

    await prisma.leaveRequest.create({
      data: {
        employeeId: empMap['EMP008'].id,
        leaveTypeId: leaveTypeMap['SL'].id,
        startDate: addDays(today, 2),
        endDate: addDays(today, 3),
        reason: 'Medical appointment',
        status: 'APPROVED',
        requestedByUserId: adminUser.id,
        approvedByUserId: adminUser.id,
      },
    })

    await prisma.leaveRequest.create({
      data: {
        employeeId: empMap['EMP010'].id,
        leaveTypeId: leaveTypeMap['CL'].id,
        startDate: addDays(today, 5),
        endDate: addDays(today, 5),
        reason: 'Personal errand',
        status: 'PENDING',
        requestedByUserId: adminUser.id,
      },
    })
    console.log('✅ 3 leave requests created')
  }

  // ─── 10. Attendance Exceptions (samples) ───────────────────────────────
  await prisma.attendanceException.create({
    data: {
      employeeId: empMap['EMP002'].id,
      workDate: addDays(monday, 3),
      type: 'NO_SHOW',
      details: 'Employee was absent without notification',
      status: 'PENDING',
    },
  })

  await prisma.attendanceException.create({
    data: {
      employeeId: empMap['EMP006'].id,
      workDate: addDays(monday, 4),
      type: 'MISSING_PUNCH',
      details: 'OUT punch not recorded, device may have been offline',
      status: 'PENDING',
    },
  })

  await prisma.attendanceException.create({
    data: {
      employeeId: empMap['EMP004'].id,
      workDate: addDays(monday, 1),
      type: 'LATE_ARRIVAL',
      details: '30 minutes late for Shift A',
      status: 'PENDING',
    },
  })

  console.log('✅ 3 attendance exceptions created')

  console.log('\n🎉 Seeding complete!')
  console.log('\n📋 Login Credentials:')
  console.log('  Super Admin:  admin@fourpoints.com / password123')
  console.log('  HR Admin:     hr@fourpoints.com / password123')
  console.log('  HOD:          valentine@fourpoints.com / password123')
  console.log('  Supervisor:   chidinma@fourpoints.com / password123')
  console.log('  Employee:     angela@fourpoints.com / password123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
