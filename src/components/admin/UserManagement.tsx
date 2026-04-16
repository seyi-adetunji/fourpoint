'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Shield, User, Mail, Building2, Trash2, Edit2, Loader2 } from 'lucide-react';
import { Role } from '@prisma/client';
import { useSession } from 'next-auth/react';

interface UserWithData {
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeId?: number | null;
  departmentId?: number | null;
  employee?: { fullName: string; empCode: string } | null;
  department?: { name: string } | null;
  isActive: boolean;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            className="input pl-10 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-primary w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Create New User
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase border-b border-border bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Connection</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-gray-500">Loading users...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {user.name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        user.role === 'SUPER_ADMIN' ? 'bg-red-100 text-red-700' :
                        user.role === 'HR_ADMIN' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'HOD' ? 'bg-blue-100 text-blue-700' :
                        user.role === 'DEPT_ADMIN' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        <Shield className="w-3 h-3" />
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.employee ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-700">{user.employee.fullName}</span>
                          <span className="text-[10px] text-gray-500 uppercase">{user.employee.empCode}</span>
                        </div>
                      ) : user.department ? (
                        <span className="text-xs text-gray-600">Dept: {user.department.name}</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="p-1.5 text-gray-400 hover:text-primary transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <CreateUserModal 
          onClose={() => setShowAddModal(false)} 
          onSuccess={() => {
            setShowAddModal(false);
            fetchUsers();
          }} 
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE' as Role,
    employeeId: '',
    departmentId: '',
  });
  const [allEmployees, setAllEmployees] = useState<{id: number, fullName: string, empCode: string, departmentId?: number | null}[]>([]);
  const [departments, setDepartments] = useState<{id: number, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { data: session } = useSession() as any;
  const currentRole = session?.user?.role;

  useEffect(() => {
    async function loadData() {
      try {
        const [empRes, deptRes] = await Promise.all([
          fetch('/api/employees'),
          fetch('/api/departments')
        ]);
        const [empData, deptData] = await Promise.all([empRes.json(), deptRes.json()]);
        // Guard: API may return an error object instead of an array
        setAllEmployees(Array.isArray(empData) ? empData : []);
        setDepartments(Array.isArray(deptData) ? deptData : []);
      } catch (e) {
        console.error('Failed to load form data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter employees by selected department (if one is chosen)
  const filteredEmployees = formData.departmentId
    ? allEmployees.filter(e => String(e.departmentId) === formData.departmentId)
    : allEmployees;

  // When department changes, clear any employee selection that doesn't belong
  function handleDepartmentChange(deptId: string) {
    const empStillValid = allEmployees.find(
      e => String(e.id) === formData.employeeId && String(e.departmentId) === deptId
    );
    setFormData(prev => ({
      ...prev,
      departmentId: deptId,
      employeeId: deptId && !empStillValid ? '' : prev.employeeId,
    }));
  }

  // Auto-fill department when employee is selected
  function handleEmployeeChange(empId: string) {
    const emp = allEmployees.find(e => String(e.id) === empId);
    setFormData(prev => ({
      ...prev,
      employeeId: empId,
      departmentId: emp?.departmentId ? String(emp.departmentId) : prev.departmentId,
    }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create user');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Roles that require a department assignment
  const deptRequiredRoles = ['HOD', 'DEPT_ADMIN', 'SUPERVISOR'];
  const isDeptRequired = deptRequiredRoles.includes(formData.role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-6 border-b border-border bg-gray-50/50">
          <h3 className="text-xl font-bold text-gray-900">Create New User</h3>
          <p className="text-sm text-gray-500 mt-1">Assign roles and link to employee profiles</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-sm bg-red-50 text-red-600 rounded-lg border border-red-100 flex items-start gap-2">
              <span className="text-red-400 mt-0.5">⚠</span>
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Full Name *</label>
              <input
                required
                className="input w-full"
                placeholder="e.g. John Doe"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Email Address *</label>
              <input
                required
                type="email"
                className="input w-full"
                placeholder="user@fourpoints.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="col-span-2 space-y-1">
              <label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Password *</label>
              <input
                required
                type="password"
                className="input w-full"
                placeholder="Min 6 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Role *</label>
              <select
                className="input w-full"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="SUPERVISOR">Supervisor</option>
                <option value="HOD">HOD</option>
                <option value="DEPT_ADMIN">Dept Admin (Assistant)</option>
                <option value="HR_ADMIN">HR Admin</option>
                {currentRole === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">Super Admin</option>}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
                Department {isDeptRequired && <span className="text-red-400">*</span>}
              </label>
              <select
                required={isDeptRequired}
                className="input w-full"
                value={formData.departmentId}
                onChange={(e) => handleDepartmentChange(e.target.value)}
                disabled={loading}
              >
                <option value="">{loading ? 'Loading...' : 'N/A (All-access)'}</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
              Link to Employee Profile
              <span className="ml-1 text-gray-400 font-normal normal-case text-[10px]">
                {formData.departmentId && filteredEmployees.length !== allEmployees.length
                  ? `(${filteredEmployees.length} in selected dept)`
                  : `(${allEmployees.length} total)`}
              </span>
            </label>
            <select
              className="input w-full"
              value={formData.employeeId}
              onChange={(e) => handleEmployeeChange(e.target.value)}
              disabled={loading}
            >
              <option value="">{loading ? 'Loading employees...' : 'Not linked'}</option>
              {filteredEmployees.map(e => (
                <option key={e.id} value={e.id}>{e.fullName} ({e.empCode})</option>
              ))}
            </select>
            {formData.departmentId && filteredEmployees.length === 0 && !loading && (
              <p className="text-[10px] text-amber-600 font-semibold mt-1">
                ⚠ No employees found in this department
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loading}
              className="btn-primary"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
