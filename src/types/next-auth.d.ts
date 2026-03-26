import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: string;
    employeeId?: string | null;
    departmentId?: string | null;
  }

  interface Session {
    user: User & {
      id: string;
      role: string;
      employeeId?: string | null;
      departmentId?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    employeeId?: string | null;
    departmentId?: string | null;
  }
}
