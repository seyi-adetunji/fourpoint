"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button 
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-[#8a8d91] hover:bg-primary/5 hover:text-primary transition-colors w-full"
    >
      <LogOut className="w-5 h-5" />
      Sign Out
    </button>
  );
}
