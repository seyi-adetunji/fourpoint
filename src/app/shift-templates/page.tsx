import prisma from "@/lib/prisma";
export const dynamic = "force-dynamic";
import ShiftTemplateManager from "@/components/settings/ShiftTemplateManager";

export default async function ShiftTemplatesPage() {
  const templates = await prisma.shiftTemplate.findMany({
    orderBy: { code: "asc" },
  });

  // Convert to plain objects for the client component
  const plainTemplates = templates.map(t => ({
    id: t.id,
    code: t.code,
    name: t.name,
    startTime: t.startTime,
    endTime: t.endTime,
    color: t.color,
    graceLate: t.graceLate,
    graceEarly: t.graceEarly,
  }));

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shift Templates</h1>
          <p className="page-subtitle">Configure shift definitions and time windows</p>
        </div>
      </div>

      <ShiftTemplateManager initialTemplates={plainTemplates} />
    </div>
  );
}
