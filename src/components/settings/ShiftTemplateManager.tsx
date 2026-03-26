"use client";

import { useState } from "react";
import { Plus, Edit2, Save, X, Trash2 } from "lucide-react";

interface Template {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  graceLate: number;
  graceEarly: number;
}

export default function ShiftTemplateManager({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Template>>({});
  const [loading, setLoading] = useState(false);

  const startEdit = (t: Template) => {
    setEditing(t.id);
    setForm(t);
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({});
  };

  const save = async () => {
    setLoading(true);
    try {
      const isNew = !editing || !templates.find(t => t.id === editing);
      const url = isNew ? "/api/settings/shift-templates" : `/api/settings/shift-templates/${editing}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        body: JSON.stringify(form),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const saved = await res.json();
        if (isNew) setTemplates([...templates, saved]);
        else setTemplates(templates.map(t => t.id === editing ? saved : t));
        cancelEdit();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-primary">Templates</h2>
        <button 
          onClick={() => { setEditing("new"); setForm({ code: "", name: "", startTime: "08:00", endTime: "16:00", color: "#3B82F6", graceLate: 15, graceEarly: 15 }); }}
          className="btn btn-primary px-4 py-2 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Template
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {editing === "new" && (
           <div className="card p-6 border-2 border-accent/30 bg-accent/5 animate-pulse-subtle">
             <div className="space-y-4">
               <div>
                 <label className="text-[10px] font-bold text-gray-500 uppercase">Code & Name</label>
                 <div className="flex gap-2">
                   <input className="input w-20 py-1" placeholder="Code" value={form.code} onChange={e => setForm({...form, code: e.target.value})} />
                   <input className="input flex-1 py-1" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                 </div>
               </div>
               <div className="flex gap-4">
                 <div className="flex-1">
                   <label className="text-[10px] font-bold text-gray-500 uppercase">Times</label>
                   <div className="flex items-center gap-2">
                     <input type="time" className="input py-1" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} />
                     <input type="time" className="input py-1" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} />
                   </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Color</label>
                    <input type="color" className="w-10 h-10 rounded block border-none" value={form.color} onChange={e => setForm({...form, color: e.target.value})} />
                 </div>
               </div>
               <div className="flex justify-end gap-2 pt-2">
                 <button onClick={cancelEdit} className="btn bg-gray-100 px-3 py-1 text-sm">Cancel</button>
                 <button onClick={save} disabled={loading} className="btn btn-primary px-3 py-1 text-sm">Create</button>
               </div>
             </div>
           </div>
        )}

        {templates.map(t => (
          editing === t.id ? (
            <div key={t.id} className="card p-6 border-2 border-primary/30">
              <div className="space-y-4">
                <input className="input py-1 w-full" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                <div className="flex items-center gap-2">
                  <input type="time" className="input py-1" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} />
                  <input type="time" className="input py-1" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={cancelEdit} className="btn bg-gray-100 px-3 py-1 text-sm"><X className="w-4 h-4" /></button>
                  <button onClick={save} disabled={loading} className="btn btn-primary px-3 py-1 text-sm"><Save className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ) : (
            <div key={t.id} className="card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: t.color }}>
                  {t.code}
                </div>
                <button onClick={() => startEdit(t)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-primary transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-semibold text-primary mb-2">{t.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600 font-mono">
                <span>{t.startTime}</span>
                <span>→</span>
                <span>{t.endTime}</span>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
