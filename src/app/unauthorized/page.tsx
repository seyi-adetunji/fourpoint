import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-6">
        <ShieldX className="w-8 h-8 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-primary mb-2">Access Denied</h1>
      <p className="text-muted-foreground text-sm max-w-md mb-6">
        You do not have the required permissions to access this page. 
        Please contact your administrator if you believe this is an error.
      </p>
      <Link href="/" className="btn-primary">
        Go to Dashboard
      </Link>
    </div>
  );
}
