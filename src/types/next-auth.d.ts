import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    employeeId?: number | null;   // → public.personnel_employee.id (Int)
    departmentId?: number | null; // → public.personnel_department.id (Int)
  }

  interface Session {
    user: User & {
      id: string;
      role: string;
      employeeId?: number | null;
      departmentId?: number | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    employeeId?: number | null;
    departmentId?: number | null;
  }
}
