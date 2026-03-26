import { PrismaClient } from '@prisma/client'
import { addDays, subMinutes, addMinutes, setHours, setMinutes } from 'date-fns'

const prisma = new PrismaClient()

// Seed Data
const departmentsList = [
  { name: 'Operations' },
  { name: 'Housekeeping' },
  { name: 'Front Office' },
  { name: 'Kitchen' },
  { name: 'Human Resources' },
  { name: 'IT' },
]

const employees = [
  { code: 'EMP001', name: 'VALENTINE ASHIOMA', department: 'Operations' },
  { code: 'EMP002', name: 'EDET ASEQUO', department: 'Housekeeping' },
  { code: 'EMP003', name: 'ANGELA', department: 'Front Office' },
  { code: 'EMP004', name: 'MUSTAPHA', department: 'Kitchen' },
  { code: 'EMP005', name: 'SAMUEL', department: 'Operations' },
  { code: 'EMP006', name: 'KADIRI', department: 'IT' },
  { code: 'EMP007', name: 'DAMILOLA', department: 'Human Resources' },
  { code: 'EMP008', name: 'ABIMBOLA', department: 'Front Office' },
]

const templates = [
  { code: 'A', name: 'Shift A (AM)', startTime: '08:00', endTime: '15:00' },
  { code: 'B', name: 'Shift B (PM)', startTime: '14:00', endTime: '22:00' },
  { code: 'N', name: 'Shift N (Night)', startTime: '22:00', endTime: '06:00' },
]

// Normalizing the rota parsing
const rawRota = [
  { name: 'VALENTINE ASHIOMA', schedule: ['A', 'A', 'A', 'A', 'A', 'OFF', 'OFF'] },
  { name: 'EDET ASEQUO', schedule: ['OFF', 'A', 'B', 'OFF', 'A', 'B', 'B'] },
  { name: 'ANGELA', schedule: ['B', 'B', 'B', 'B', 'B', 'OFF', 'OFF'] },
  { name: 'MUSTAPHA', schedule: ['A', 'A', 'A', 'A', 'OFF', 'OFF', 'A'] },
  { name: 'SAMUEL', schedule: ['N', 'N', 'N', 'N', 'N', 'OFF', 'OFF'] },
  { name: 'KADIRI', schedule: ['OFF', 'A', 'A', 'A', 'A', 'A', 'OFF'] },
  { name: 'DAMILOLA', schedule: ['B', 'B', 'B', 'B', 'B', 'OFF', 'OFF'] },
  { name: 'ABIMBOLA', schedule: ['A', 'A', 'A', 'A', 'A', 'OFF', 'OFF'] },
]

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log('Seeding Database...')

  // 0. Create Departments
  for (const d of departmentsList) {
    await prisma.department.upsert({
      where: { name: d.name },
      update: {},
      create: d,
    })
  }

  // 1. Create Shift Templates
  const templateMap: Record<string, any> = {}
  for (const t of templates) {
    const created = await prisma.shiftTemplate.upsert({
      where: { code: t.code },
      update: {},
      create: t,
    })
    templateMap[t.code] = created
  }

  // 2. Create Employees
  const employeeMap: Record<string, any> = {}
  for (const e of employees) {
    const created = await prisma.employee.upsert({
      where: { code: e.code },
      update: { department: e.department },
      create: e,
    })
    employeeMap[e.name] = created
  }

  // 3. Create Assignments & Mock Punches
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);

  // We assign a week starting from tomorrow
  const startDate = addDays(baseDate, -baseDate.getDay() + 1); // Get Monday of current week

  for (let i = 0; i < rawRota.length; i++) {
    const row = rawRota[i];
    const employee = employeeMap[row.name];
    
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const shiftVal = row.schedule[dayIndex];
      if (shiftVal === 'OFF') continue;

      const date = addDays(startDate, dayIndex);
      const shifts = shiftVal.split(','); // simple comma logic if double shifts were represented

      for (let seq = 0; seq < shifts.length; seq++) {
        const code = shifts[seq].trim();
        const template = templateMap[code];

        if (!template) continue;

        const assignment = await prisma.shiftAssignment.upsert({
          where: {
            employeeId_date_sequence: {
              employeeId: employee.id,
              date: date,
              sequence: seq + 1,
            }
          },
          update: {
            shiftTemplateId: template.id,
          },
          create: {
            employeeId: employee.id,
            shiftTemplateId: template.id,
            date: date,
            sequence: seq + 1,
          }       
        });

        // Create Punches (realistic variation)
        const [startH, startM] = template.startTime.split(':').map(Number);
        const [endH, endM] = template.endTime.split(':').map(Number);
        
        let shiftStart = setMinutes(setHours(date, startH), startM);
        let shiftEnd = setMinutes(setHours(date, endH), endM);
        
        if (code === 'N') {
           // Night shift ends on the next day
           shiftEnd = addDays(shiftEnd, 1);
        }

        // Mock punch variations
        // randomly early, late, on time, missed punch.
        const r = Math.random();
        let actualIn = null;
        let actualOut = null;

        if (r > 0.05) { // 95% chance punched IN
           // Arrive 15 min early to 15 min late
           const diff = getRandomInt(-15, 15);
           actualIn = addMinutes(shiftStart, diff);
        }

        if (r > 0.1 || (actualIn && r > 0.05)) { // high chance punched out
           // Leave 5 min early to 30 min late
           const diff = getRandomInt(-5, 30);
           actualOut = addMinutes(shiftEnd, diff);
        }

        if (actualIn) {
            await prisma.attendancePunch.create({
                data: {
                    employeeId: employee.id,
                    timestamp: actualIn,
                    type: "IN"
                }
            })
        }
        
        if (actualOut) {
             await prisma.attendancePunch.create({
                data: {
                    employeeId: employee.id,
                    timestamp: actualOut,
                    type: "OUT"
                }
            })
        }
      }
    }
  }

  console.log('Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
