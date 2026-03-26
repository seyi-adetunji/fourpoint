"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";

type ResolveButtonProps = {
  exceptionId: string;
};

export function ResolveExceptionButton({ exceptionId }: ResolveButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const handleResolve = async (action: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/exceptions/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exceptionId,
          action,
          resolutionNotes: `Resolved via quick action: ${action}`
        }),
      });

      if (!res.ok) throw new Error("Failed to resolve exception");
      
      setShowOptions(false);
      router.refresh(); // Refresh current page to remove from list
    } catch (error) {
      console.error(error);
      alert("Error resolving exception");
    } finally {
      setLoading(false);
    }
  };

  if (showOptions) {
    return (
      <div className="flex items-center gap-2 justify-end">
        <button 
          onClick={() => handleResolve("IGNORE")}
          disabled={loading}
          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition-colors"
          title="Mark resolved but keep status as is"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Ignore"}
        </button>
        <button 
          onClick={() => handleResolve("OVERRIDE_STATUS_PRESENT")}
          disabled={loading}
          className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded hover:bg-emerald-200 transition-colors"
          title="Mark resolved AND set status to PRESENT"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : "Override (Present)"}
        </button>
        <button 
          onClick={() => setShowOptions(false)}
          className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={() => setShowOptions(true)}
      className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-md hover:bg-primary/90 transition-colors shadow-sm"
    >
      Resolve
    </button>
  );
}
