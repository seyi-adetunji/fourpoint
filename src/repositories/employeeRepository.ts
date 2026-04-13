import prisma from "@/lib/prisma";
import { Employee, Prisma } from "@prisma/client";

export class EmployeeRepository {
  static async findById(id: string | number): Promise<Employee | null> {
    const numericId = typeof id === "string" ? parseInt(id) : id;
    if (isNaN(numericId)) return null;
    return prisma.employee.findUnique({
      where: { id: numericId },
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

  static async update(id: string | number, data: Prisma.EmployeeUpdateInput): Promise<Employee> {
    const numericId = typeof id === "string" ? parseInt(id) : id;
    return prisma.employee.update({
      where: { id: numericId },
      data,
    });
  }

  static async delete(id: string | number): Promise<Employee> {
    const numericId = typeof id === "string" ? parseInt(id) : id;
    return prisma.employee.delete({
      where: { id: numericId },
    });
  }
}
