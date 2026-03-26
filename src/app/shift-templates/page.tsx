import prisma from "@/lib/prisma";

export default async function ShiftTemplatesPage() {
  const templates = await prisma.shiftTemplate.findMany({
    include: { _count: { select: { assignments: true } } },
    orderBy: { code: "asc" },
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shift Templates</h1>
          <p className="page-subtitle">Configure shift definitions and time windows</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map(t => (
          <div key={t.id} className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: t.color }}>
                {t.code}
              </div>
              <span className="text-xs text-muted-foreground">{t._count.assignments} assignments</span>
            </div>
            <h3 className="font-semibold text-primary mb-2">{t.name}</h3>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">{t.startTime}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">{t.endTime}</span>
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span>Grace Late: {t.graceLate}m</span>
              <span>Grace Early: {t.graceEarly}m</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
