import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const departments = await prisma.department.findMany();
  console.log('Departments:', JSON.stringify(departments, null, 2));
  const employees = await prisma.employee.findMany();
  console.log('Employees (Sample):', JSON.stringify(employees.slice(0, 3), null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
