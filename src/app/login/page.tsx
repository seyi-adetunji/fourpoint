"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2, Shield, Clock, Users, BarChart3 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (res?.error) {
      setError("Invalid credentials. Please try again.");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  const features = [
    { icon: Clock, title: "Real-Time Attendance", desc: "Biometric punch tracking with instant status updates" },
    { icon: Users, title: "Shift Management", desc: "Smart rota scheduling with double-shift support" },
    { icon: Shield, title: "RBAC Security", desc: "Role-based access for HR, HOD, and staff" },
    { icon: BarChart3, title: "Enterprise Reports", desc: "12+ compliance and operational reports" },
  ];

  return (
    <div className="flex min-h-screen">
      {/* ─── Left Panel: Branding ─── */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-gradient-to-br from-[#0F1D2F] via-[#1F3A5F] to-[#162d4a] p-12 flex-col justify-between overflow-hidden">
        {/* Abstract pattern overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        
        {/* Glowing orbs */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-32 left-16 w-48 h-48 bg-secondary/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center backdrop-blur-sm">
              <span className="text-accent font-bold text-xl">W</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">WorkforceOps</span>
          </div>
          <p className="text-gray-400 text-sm font-medium tracking-wide uppercase">
            Hotel Workforce Management Platform
          </p>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Streamline Your<br />
              <span className="text-accent">Hotel Operations</span>
            </h1>
            <p className="text-gray-300 text-lg leading-relaxed max-w-md">
              Enterprise-grade workforce scheduling, biometric attendance tracking, 
              and operational reporting — built for hotel teams.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={i}
                  className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-4 hover:bg-white/[0.08] transition-all duration-300 group"
                >
                  <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center mb-3 group-hover:bg-accent/25 transition-colors">
                    <Icon className="w-[18px] h-[18px] text-accent" />
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-1">{feature.title}</h3>
                  <p className="text-gray-400 text-xs leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-gray-500 text-xs">
            © {new Date().getFullYear()} WorkforceOps — Four Points by Sheraton
          </p>
        </div>
      </div>

      {/* ─── Right Panel: Login Form ─── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-[420px] animate-fade-in">
          {/* Mobile branding (shown only on small screens) */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <span className="text-accent font-bold text-xl">W</span>
            </div>
            <span className="text-primary font-bold text-xl tracking-tight">WorkforceOps</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back</h2>
            <p className="text-gray-500 text-sm mt-2">
              Sign in to access your workforce management dashboard.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 flex items-center gap-2 animate-slide-up">
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 text-xs font-bold">!</span>
              </div>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-[18px] w-[18px] text-gray-400" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input input-with-icon"
                  placeholder="admin@fourpoints.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Password
                </label>
                <button type="button" className="text-xs text-accent hover:text-accent-light font-medium transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-[18px] w-[18px] text-gray-400" />
                </div>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input input-with-icon"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input 
                id="remember-me"
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20 cursor-pointer"
              />
              <label htmlFor="remember-me" className="text-sm text-gray-600 cursor-pointer select-none">
                Remember me
              </label>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:bg-primary-dark 
                         transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 
                         shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-xs text-gray-400">
              Secure enterprise system. Unauthorized access is strictly prohibited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
