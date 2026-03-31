"use client";

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Loader2 } from "lucide-react";
import Link from "next/link";

export default function AddEmployeePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/departments")
      .then((res) => res.json())
      .then((data) => setDepartments(data))
      .catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      code: formData.get("code") as string,
      name: formData.get("name") as string,
      department: formData.get("department") as string,
    };

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to create employee");
      }

      router.push("/employees");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto flex flex-col items-stretch">
      <div className="flex items-center gap-4">
        <Link href="/employees" className="p-2 bg-white rounded-full border border-border hover:bg-gray-50 transition-colors shadow-sm text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
            Add New Employee
          </h1>
          <p className="text-gray-500 mt-1">
            Register a new staff member into the system.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {error && (
            <div className="p-3 text-sm text-red-800 bg-red-100 rounded-md border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1">
                Employee Code (e.g., EMP042) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="code"
                name="code"
                required
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors text-sm"
                placeholder="Unique identifier"
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors text-sm"
                placeholder="First Lastname"
              />
            </div>

            <div>
              <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                id="department"
                name="department"
                required
                className="w-full px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors text-sm bg-white"
              >
                <option value="">Select a department...</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex flex-col sm:flex-row justify-end gap-3">
            <Link 
              href="/employees"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-border rounded-md hover:bg-gray-50 transition-colors text-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Save Employee
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
