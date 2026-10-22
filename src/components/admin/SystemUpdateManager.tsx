"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  DownloadCloud,
  Terminal,
  Clock,
  GitBranch,
  Play,
} from "lucide-react";

interface CommitInfo {
  shortSha: string;
  fullSha: string;
  subject: string;
  date: string;
}

interface ScheduledTaskInfo {
  TaskName: string;
  State: string;
  LastRunTime: string;
  LastTaskResult: number;
}

interface UpdateStatus {
  workingDirectory: string;
  upToDate: boolean;
  commitsBehind: number;
  local: CommitInfo;
  remote: CommitInfo;
  modifiedFiles: string[];
  scheduledTasks: ScheduledTaskInfo[];
  recentLogs: string[];
  checkedAt: string;
}

export default function SystemUpdateManager() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [installingTask, setInstallingTask] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/system-update", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setStatus(data);
      } else {
        setFeedback({ type: "error", text: data.error || "Failed to check status" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Network error checking update status" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handlePullNow = async () => {
    setPulling(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/system-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pull" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", text: data.message });
        await checkStatus();
      } else {
        setFeedback({ type: "error", text: data.error || "Pull failed" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to pull latest update" });
    } finally {
      setPulling(false);
    }
  };

  const handleInstallAutoTask = async () => {
    setInstallingTask(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/system-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install-task" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: "success", text: data.message });
        await checkStatus();
      } else {
        setFeedback({ type: "error", text: data.error || "Failed to register scheduled task" });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err?.message || "Failed to install auto-update task" });
    } finally {
      setInstallingTask(false);
    }
  };

  return (
    <div id="system-update" className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border bg-gray-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <GitBranch className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold text-primary">
              GitHub Auto-Update & Sync Diagnostics
            </h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Verify whether this server is synced with GitHub (<code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">origin/main</code>) and manage the automatic 3-minute pull task.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={checkStatus}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Check Status
          </button>

          <button
            onClick={handlePullNow}
            disabled={pulling || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            <DownloadCloud className={`w-4 h-4 ${pulling ? "animate-bounce" : ""}`} />
            {pulling ? "Pulling from GitHub..." : "Pull Latest Update Now"}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {feedback && (
          <div
            className={`p-3.5 rounded-lg text-sm font-medium flex items-center gap-2.5 ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {status && (
          <>
            {/* Status Banner */}
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                status.upToDate
                  ? "bg-emerald-50/70 border-emerald-200"
                  : "bg-amber-50/80 border-amber-300"
              }`}
            >
              <div className="flex items-start gap-3">
                {status.upToDate ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h3
                    className={`text-sm font-bold ${
                      status.upToDate ? "text-emerald-900" : "text-amber-900"
                    }`}
                  >
                    {status.upToDate
                      ? "System is 100% Up to Date with GitHub (origin/main)"
                      : `Update Pending: This server is ${status.commitsBehind} commit(s) behind GitHub`}
                  </h3>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Server Folder: <code className="font-mono bg-white/80 px-1.5 py-0.5 rounded">{status.workingDirectory}</code>
                  </p>
                </div>
              </div>

              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                  status.upToDate
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-200 text-amber-900"
                }`}
              >
                {status.upToDate ? "SYNCED" : `${status.commitsBehind} BEHIND`}
              </span>
            </div>

            {/* Commit Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    Local Intranet Server (HEAD)
                  </span>
                  <code className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs font-bold">
                    {status.local.shortSha || "N/A"}
                  </code>
                </div>
                <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                  {status.local.subject || "Unknown"}
                </p>
                <p className="text-xs text-gray-500">{status.local.date}</p>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    GitHub Repository (origin/main)
                  </span>
                  <code className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-xs font-bold">
                    {status.remote.shortSha || "N/A"}
                  </code>
                </div>
                <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                  {status.remote.subject || "Unknown"}
                </p>
                <p className="text-xs text-gray-500">{status.remote.date}</p>
              </div>
            </div>

            {/* Windows Scheduled Task Status */}
            <div className="p-4 rounded-xl border border-gray-200 bg-white space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-bold text-gray-900">
                    Windows Automatic Pull Task (Background Scheduler)
                  </h4>
                </div>
                <button
                  onClick={handleInstallAutoTask}
                  disabled={installingTask}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  {installingTask
                    ? "Registering Task..."
                    : "Register / Repair 3-Min Auto-Pull Task"}
                </button>
              </div>

              {status.scheduledTasks.length === 0 ? (
                <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  No active <code className="font-mono">FourPoints-GitHub-AutoUpdate</code> task was detected in Windows Task Scheduler on this machine. Click{" "}
                  <strong>&ldquo;Register / Repair 3-Min Auto-Pull Task&rdquo;</strong> above (or run{" "}
                  <code className="font-mono">setup-auto-update.bat</code> in{" "}
                  <code className="font-mono">C:\workforce\fourpoint</code>) to enable automatic updates every 3 minutes.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500">
                        <th className="py-2 pr-4 font-semibold">Task Name</th>
                        <th className="py-2 pr-4 font-semibold">State</th>
                        <th className="py-2 pr-4 font-semibold">Last Run Time</th>
                        <th className="py-2 font-semibold">Last Result Code</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {status.scheduledTasks.map((t, idx) => (
                        <tr key={idx}>
                          <td className="py-2 pr-4 font-mono font-semibold text-gray-900">
                            {t.TaskName}
                          </td>
                          <td className="py-2 pr-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                t.State === "Ready" || t.State === "Running"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {t.State}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-gray-600">{t.LastRunTime}</td>
                          <td className="py-2 font-mono text-gray-700">
                            {t.LastTaskResult === 0 ? "0 (Success)" : t.LastTaskResult}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Auto-update.log viewer */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                <Terminal className="w-4 h-4 text-gray-500" />
                Recent Auto-Update Logs (<code className="font-mono">auto-update.log</code>)
              </div>
              <div className="bg-gray-900 text-gray-100 rounded-xl p-4 font-mono text-xs max-h-48 overflow-y-auto space-y-1">
                {status.recentLogs.length === 0 ? (
                  <p className="text-gray-400 italic">
                    No entries in auto-update.log yet.
                  </p>
                ) : (
                  status.recentLogs.map((line, i) => (
                    <div key={i} className="leading-relaxed break-all">
                      {line}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
