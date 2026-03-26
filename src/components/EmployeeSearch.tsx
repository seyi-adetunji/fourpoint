"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

export default function EmployeeSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  
  const [query, setQuery] = useState(initialQuery);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    // Debounce the search input to avoid excessive routing pushes
    clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query) {
        params.set("q", query);
      } else {
        params.delete("q");
      }
      
      router.push(`/employees?${params.toString()}`);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutRef.current);
  }, [query, router, searchParams]);

  return (
    <div className="relative flex-1 max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input 
        type="text" 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or code..." 
        className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
      />
    </div>
  );
}
