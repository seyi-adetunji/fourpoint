import { EmployeeRepository } from "@/repositories/employeeRepository";
import { Prisma } from "@prisma/client";
import { AuditService } from "./AuditService";

export class EmployeeService {
  static async getAllEmployees(filters?: Prisma.EmployeeWhereInput) {
    return EmployeeRepository.findAll(filters);
  }

  static async getEmployeeById(id: string) {
    return EmployeeRepository.findById(id);
  }

  static async createEmployee(data: Prisma.EmployeeCreateInput, auditUserId?: string) {
    const existing = await EmployeeRepository.findByEmpCode(data.empCode);
    if (existing) {
      throw new Error(`An employee with code ${data.empCode} already exists.`);
    }
    const emp = await EmployeeRepository.create(data);
    
    if (auditUserId) {
      await AuditService.logAction(auditUserId, "CREATE_EMPLOYEE", { employeeId: emp.id, empCode: emp.empCode });
    }
    
    return emp;
  }

  static async updateEmployee(id: string, data: Prisma.EmployeeUpdateInput, auditUserId?: string) {
    const emp = await EmployeeRepository.update(id, data);
    
    if (auditUserId) {
      await AuditService.logAction(auditUserId, "UPDATE_EMPLOYEE", { employeeId: emp.id, changes: data });
    }
    
    return emp;
  }

  static async deleteEmployee(id: string, auditUserId?: string) {
    const emp = await EmployeeRepository.delete(id);
    
    if (auditUserId) {
      await AuditService.logAction(auditUserId, "DELETE_EMPLOYEE", { employeeId: emp.id, empCode: emp.empCode });
    }
    
    return emp;
  }
}
