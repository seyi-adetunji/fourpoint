"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type DataPoint = {
  date: string;
  present: number;
  absent: number;
};

export function AttendanceChart({ data }: { data: DataPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-sm text-gray-500">
        No attendance data available for the selected period.
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            dy={10}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: "#6b7280" }}
          />
          <Tooltip 
            cursor={{ fill: "#f3f4f6" }}
            contentStyle={{ 
              borderRadius: "8px", 
              border: "1px solid #e5e7eb", 
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              fontSize: "14px"
            }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px", fontSize: "14px", color: "#374151" }} />
          <Bar dataKey="present" fill="#10b981" radius={[4, 4, 0, 0]} name="Present/Late" maxBarSize={40} />
          <Bar dataKey="absent" fill="#ef4444" radius={[4, 4, 0, 0]} name="Absent/No Show" maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
