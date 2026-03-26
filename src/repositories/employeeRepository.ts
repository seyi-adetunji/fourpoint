import prisma from "@/lib/prisma";
import { Employee, Prisma } from "@prisma/client";

export class EmployeeRepository {
  static async findById(id: string): Promise<Employee | null> {
    return prisma.employee.findUnique({
      where: { id },
    });
  }

  static async findByEmpCode(empCode: string): Promise<Employee | null> {
    return prisma.employee.findUnique({
      where: { empCode },
    });
  }

  static async findAll(where?: Prisma.EmployeeWhereInput): Promise<Employee[]> {
    return prisma.employee.findMany({
      where,
      orderBy: { fullName: "asc" },
    });
  }

  static async create(data: Prisma.EmployeeCreateInput): Promise<Employee> {
    return prisma.employee.create({ data });
  }

  static async update(id: string, data: Prisma.EmployeeUpdateInput): Promise<Employee> {
    return prisma.employee.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string): Promise<Employee> {
    return prisma.employee.delete({
      where: { id },
    });
  }
}
