/**
 * Role-Based Access Control (RBAC) Utilities
 * 
 * Defines permissions, route access, and helper functions for role-based
 * authorization throughout the application.
 */

import { Role } from '@prisma/client';

// ─── Permission definitions ────────────────────────────────────────────────────
export const PERMISSIONS = {
  // Employee management
  EMPLOYEES_VIEW: 'employees:view',
  EMPLOYEES_MANAGE: 'employees:manage',
  EMPLOYEES_VIEW_DEPARTMENT: 'employees:view_department',
  
  // Shift management
  SHIFTS_VIEW: 'shifts:view',
  SHIFTS_MANAGE: 'shifts:manage',
  SHIFTS_VIEW_DEPARTMENT: 'shifts:view_department',
  
  // Attendance
  ATTENDANCE_VIEW: 'attendance:view',
  ATTENDANCE_PROCESS: 'attendance:process',
  ATTENDANCE_VIEW_DEPARTMENT: 'attendance:view_department',
  
  // Exceptions
  EXCEPTIONS_VIEW: 'exceptions:view',
  EXCEPTIONS_RESOLVE: 'exceptions:resolve',
  EXCEPTIONS_VIEW_DEPARTMENT: 'exceptions:view_department',
  
  // Leave
  LEAVE_VIEW_ALL: 'leave:view_all',
  LEAVE_APPROVE: 'leave:approve',
  LEAVE_REQUEST_OWN: 'leave:request_own',
  
  // Reports
  REPORTS_VIEW_ALL: 'reports:view_all',
  REPORTS_VIEW_DEPARTMENT: 'reports:view_department',
  
  // Settings / Admin
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_MANAGE: 'settings:manage',
  
  // Self-service
  SELF_SERVICE: 'self_service',
  
  // Dashboard
  DASHBOARD_ADMIN: 'dashboard:admin',
  DASHBOARD_HOD: 'dashboard:hod',
  DASHBOARD_EMPLOYEE: 'dashboard:employee',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ─── Role → Permissions map ────────────────────────────────────────────────────
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),  // Full access
  
  HR_ADMIN: [
    PERMISSIONS.EMPLOYEES_VIEW,
    PERMISSIONS.EMPLOYEES_MANAGE,
    PERMISSIONS.SHIFTS_VIEW,
    PERMISSIONS.SHIFTS_MANAGE,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.ATTENDANCE_PROCESS,
    PERMISSIONS.EXCEPTIONS_VIEW,
    PERMISSIONS.EXCEPTIONS_RESOLVE,
    PERMISSIONS.LEAVE_VIEW_ALL,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.REPORTS_VIEW_ALL,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.DASHBOARD_ADMIN,
    PERMISSIONS.SELF_SERVICE,
  ],
  
  HOD: [
    PERMISSIONS.EMPLOYEES_VIEW_DEPARTMENT,
    PERMISSIONS.SHIFTS_VIEW_DEPARTMENT,
    PERMISSIONS.SHIFTS_MANAGE,
    PERMISSIONS.ATTENDANCE_VIEW_DEPARTMENT,
    PERMISSIONS.EXCEPTIONS_VIEW_DEPARTMENT,
    PERMISSIONS.EXCEPTIONS_RESOLVE,
    PERMISSIONS.LEAVE_APPROVE,
    PERMISSIONS.LEAVE_REQUEST_OWN,
    PERMISSIONS.REPORTS_VIEW_DEPARTMENT,
    PERMISSIONS.DASHBOARD_HOD,
    PERMISSIONS.SELF_SERVICE,
  ],
  
  SUPERVISOR: [
    PERMISSIONS.EMPLOYEES_VIEW_DEPARTMENT,
    PERMISSIONS.SHIFTS_VIEW_DEPARTMENT,
    PERMISSIONS.ATTENDANCE_VIEW_DEPARTMENT,
    PERMISSIONS.EXCEPTIONS_VIEW_DEPARTMENT,
    PERMISSIONS.REPORTS_VIEW_DEPARTMENT,
    PERMISSIONS.LEAVE_REQUEST_OWN,
    PERMISSIONS.DASHBOARD_HOD,
    PERMISSIONS.SELF_SERVICE,
  ],
  
  EMPLOYEE: [
    PERMISSIONS.LEAVE_REQUEST_OWN,
    PERMISSIONS.DASHBOARD_EMPLOYEE,
    PERMISSIONS.SELF_SERVICE,
  ],
};

// ─── Sidebar navigation items ──────────────────────────────────────────────────
export interface NavItem {
  name: string;
  href: string;
  icon: string;  // Lucide icon name
  permissions: Permission[];
  children?: NavItem[];
}

export const SIDEBAR_NAV: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: 'LayoutDashboard',
    permissions: [PERMISSIONS.DASHBOARD_ADMIN, PERMISSIONS.DASHBOARD_HOD],
  },
  {
    name: 'Employees',
    href: '/employees',
    icon: 'Users',
    permissions: [PERMISSIONS.EMPLOYEES_VIEW, PERMISSIONS.EMPLOYEES_VIEW_DEPARTMENT],
  },
  {
    name: 'Departments',
    href: '/departments',
    icon: 'Building2',
    permissions: [PERMISSIONS.SETTINGS_VIEW],
  },
  {
    name: 'Shift Templates',
    href: '/shift-templates',
    icon: 'Layers',
    permissions: [PERMISSIONS.SHIFTS_MANAGE],
  },
  {
    name: 'Shift Assignments',
    href: '/shifts',
    icon: 'Calendar',
    permissions: [PERMISSIONS.SHIFTS_VIEW, PERMISSIONS.SHIFTS_VIEW_DEPARTMENT],
  },
  {
    name: 'Attendance',
    href: '/attendance',
    icon: 'Clock',
    permissions: [PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_VIEW_DEPARTMENT],
    children: [
      { name: 'Punches', href: '/attendance/punches', icon: 'Fingerprint', permissions: [PERMISSIONS.ATTENDANCE_VIEW] },
      { name: 'Results', href: '/attendance/results', icon: 'ClipboardCheck', permissions: [PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_VIEW_DEPARTMENT] },
      { name: 'Exceptions', href: '/attendance/exceptions', icon: 'AlertTriangle', permissions: [PERMISSIONS.EXCEPTIONS_VIEW, PERMISSIONS.EXCEPTIONS_VIEW_DEPARTMENT] },
    ],
  },
  {
    name: 'Leave',
    href: '/leave',
    icon: 'CalendarOff',
    permissions: [PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_APPROVE],
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: 'BarChart3',
    permissions: [PERMISSIONS.REPORTS_VIEW_ALL, PERMISSIONS.REPORTS_VIEW_DEPARTMENT],
  },
];

export const EMPLOYEE_NAV: NavItem[] = [
  {
    name: 'My Dashboard',
    href: '/employee/dashboard',
    icon: 'LayoutDashboard',
    permissions: [PERMISSIONS.DASHBOARD_EMPLOYEE],
  },
  {
    name: 'My Shifts',
    href: '/employee/shifts',
    icon: 'Calendar',
    permissions: [PERMISSIONS.SELF_SERVICE],
  },
  {
    name: 'My Attendance',
    href: '/employee/attendance',
    icon: 'Clock',
    permissions: [PERMISSIONS.SELF_SERVICE],
  },
  {
    name: 'Leave Requests',
    href: '/employee/leave',
    icon: 'CalendarOff',
    permissions: [PERMISSIONS.LEAVE_REQUEST_OWN],
  },
  {
    name: 'Corrections',
    href: '/employee/corrections',
    icon: 'FileEdit',
    permissions: [PERMISSIONS.SELF_SERVICE],
  },
];

// ─── Helper functions ───────────────────────────────────────────────────────────

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role | string, permission: Permission): boolean {
  const rolePerms = ROLE_PERMISSIONS[role as Role];
  if (!rolePerms) return false;
  return rolePerms.includes(permission);
}

/**
 * Check if a role has ANY of the specified permissions
 */
export function hasAnyPermission(role: Role | string, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Get accessible nav items for a given role
 */
export function getNavItemsForRole(role: Role | string): NavItem[] {
  if (role === 'EMPLOYEE') {
    return EMPLOYEE_NAV.filter(item => hasAnyPermission(role, item.permissions));
  }
  
  return SIDEBAR_NAV.filter(item => hasAnyPermission(role, item.permissions)).map(item => ({
    ...item,
    children: item.children?.filter(child => hasAnyPermission(role, child.permissions)),
  }));
}

/**
 * Check if user can access a department's data
 */
export function canAccessDepartment(
  role: Role | string,
  userDepartmentId: string | null | undefined,
  targetDepartmentId: string | null | undefined
): boolean {
  // SUPER_ADMIN and HR_ADMIN can access all departments
  if (role === 'SUPER_ADMIN' || role === 'HR_ADMIN') return true;
  
  // HOD and SUPERVISOR can only access their own department
  if (role === 'HOD' || role === 'SUPERVISOR') {
    return userDepartmentId != null && userDepartmentId === targetDepartmentId;
  }
  
  return false;
}

/**
 * Check if the role is an admin-level role
 */
export function isAdminRole(role: Role | string): boolean {
  return role === 'SUPER_ADMIN' || role === 'HR_ADMIN';
}

/**
 * Check if the role is a management-level role (admin + HOD)
 */
export function isManagementRole(role: Role | string): boolean {
  return role === 'SUPER_ADMIN' || role === 'HR_ADMIN' || role === 'HOD';
}

/**
 * Get the redirect path for a role after login
 */
export function getDashboardPath(role: Role | string): string {
  if (role === 'EMPLOYEE') return '/employee/dashboard';
  return '/';
}

/**
 * Route protection configuration  
 * Maps route patterns to required permissions
 */
export const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  '/employees': [PERMISSIONS.EMPLOYEES_VIEW, PERMISSIONS.EMPLOYEES_VIEW_DEPARTMENT],
  '/departments': [PERMISSIONS.SETTINGS_VIEW],
  '/shift-templates': [PERMISSIONS.SHIFTS_MANAGE],
  '/shifts': [PERMISSIONS.SHIFTS_VIEW, PERMISSIONS.SHIFTS_VIEW_DEPARTMENT],
  '/attendance': [PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_VIEW_DEPARTMENT],
  '/leave': [PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_APPROVE],
  '/reports': [PERMISSIONS.REPORTS_VIEW_ALL, PERMISSIONS.REPORTS_VIEW_DEPARTMENT],
  '/settings': [PERMISSIONS.SETTINGS_MANAGE],
  '/employee': [PERMISSIONS.SELF_SERVICE],
  '/profile': [PERMISSIONS.SELF_SERVICE, PERMISSIONS.DASHBOARD_ADMIN, PERMISSIONS.DASHBOARD_HOD],
};
