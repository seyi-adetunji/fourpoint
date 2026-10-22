import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

async function runCmd(cmd: string, cwd: string, timeout = 12000): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { cwd, timeout });
    return stdout.trim();
  } catch (err: any) {
    return (err?.stdout || err?.stderr || err?.message || "").toString().trim();
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = (session.user as any).role;
    if (!["SUPER_ADMIN", "HR_ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cwd = process.cwd();

    // Fetch latest from GitHub origin/main (non-blocking if offline)
    await runCmd("git fetch origin main", cwd, 8000);

    const [localInfo, remoteInfo, behindCountStr, statusOutput] = await Promise.all([
      runCmd('git log -1 --format="%h|%H|%s|%ci"', cwd),
      runCmd('git log origin/main -1 --format="%h|%H|%s|%ci"', cwd),
      runCmd("git rev-list HEAD..origin/main --count", cwd),
      runCmd("git status --short", cwd),
    ]);

    const [localShort = "", localFull = "", localSubject = "", localDate = ""] = localInfo.split("|");
    const [remoteShort = "", remoteFull = "", remoteSubject = "", remoteDate = ""] = remoteInfo.split("|");
    const commitsBehind = parseInt(behindCountStr, 10) || 0;

    // Check Windows Scheduled Task for auto-update
    const taskCheck = await runCmd(
      'powershell -NoProfile -Command "Get-ScheduledTask | Where-Object { $_.TaskPath -notmatch \'\\\\Microsoft\\\\\' -and ($_.TaskName -match \'FourPoints|git|fourpoint|workforce|update|pull|sync\') } | ForEach-Object { $info = Get-ScheduledTaskInfo -TaskName $_.TaskName -TaskPath $_.TaskPath -ErrorAction SilentlyContinue; [PSCustomObject]@{ TaskName = $_.TaskName; State = $_.State.ToString(); LastRunTime = if ($info.LastRunTime) { $info.LastRunTime.ToString(\'yyyy-MM-dd HH:mm:ss\') } else { \'Never\' }; LastTaskResult = $info.LastTaskResult } } | ConvertTo-Json -Compress"',
      cwd,
      6000
    );

    let scheduledTasks: any[] = [];
    if (taskCheck && (taskCheck.startsWith("[") || taskCheck.startsWith("{"))) {
      try {
        const parsed = JSON.parse(taskCheck);
        scheduledTasks = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        scheduledTasks = [];
      }
    }

    // Read last 25 lines of auto-update.log if present
    const logPath = path.join(cwd, "auto-update.log");
    let recentLogs: string[] = [];
    if (fs.existsSync(logPath)) {
      try {
        const raw = fs.readFileSync(logPath, "utf-8");
        recentLogs = raw
          .split(/\r?\n/)
          .filter(Boolean)
          .slice(-25);
      } catch {
        recentLogs = [];
      }
    }

    return NextResponse.json({
      workingDirectory: cwd,
      upToDate: localShort === remoteShort && commitsBehind === 0,
      commitsBehind,
      local: {
        shortSha: localShort,
        fullSha: localFull,
        subject: localSubject,
        date: localDate,
      },
      remote: {
        shortSha: remoteShort,
        fullSha: remoteFull,
        subject: remoteSubject,
        date: remoteDate,
      },
      modifiedFiles: statusOutput ? statusOutput.split(/\r?\n/).filter(Boolean) : [],
      scheduledTasks,
      recentLogs,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to inspect system update status" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = (session.user as any).role;
    if (!["SUPER_ADMIN", "HR_ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "pull";
    const cwd = process.cwd();
    const logPath = path.join(cwd, "auto-update.log");

    if (action === "install-task") {
      const scriptPath = path.join(cwd, "auto-update.bat");
      const out = await runCmd(
        `schtasks /Create /SC MINUTE /MO 3 /TN "FourPoints-GitHub-AutoUpdate" /TR "\\"${scriptPath}\\"" /F`,
        cwd,
        10000
      );
      fs.appendFileSync(
        logPath,
        `[${new Date().toISOString()}] [TASK-INSTALL] Registered FourPoints-GitHub-AutoUpdate (every 3 mins): ${out}\r\n`
      );
      return NextResponse.json({
        success: true,
        message: "Scheduled Task 'FourPoints-GitHub-AutoUpdate' installed to run every 3 minutes.",
        output: out,
      });
    }

    // Default action: "pull" — fetch & sync working tree to origin/main
    const lockPath = path.join(cwd, ".git", "index.lock");
    if (fs.existsSync(lockPath)) {
      try {
        fs.unlinkSync(lockPath);
      } catch {}
    }

    const fetchOut = await runCmd("git fetch origin main", cwd, 15000);
    const resetOut = await runCmd("git reset --hard origin/main", cwd, 15000);
    const newHead = await runCmd('git log -1 --format="%h - %s"', cwd, 5000);

    fs.appendFileSync(
      logPath,
      `[${new Date().toISOString()}] [WEB-UPDATE] Pulled latest GitHub main -> ${newHead}\r\n`
    );

    return NextResponse.json({
      success: true,
      message: `Updated successfully to ${newHead}`,
      details: `${fetchOut}\n${resetOut}`.trim(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to execute system update" },
      { status: 500 }
    );
  }
}
