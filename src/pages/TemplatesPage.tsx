import { useState } from "react";
import { uid } from "../lib/utils";
import { safeCopy } from "../lib/security";
import type { DbBlob, ToastAction } from "../types";

interface QaQuestion { id: string; text: string; }
interface QaTemplate  { id: string; name: string; questions: QaQuestion[]; }

interface Props {
  db: DbBlob;
  updateDb: (fn: (db: any) => void) => void;
  showToast: (msg: string, action?: ToastAction) => void;
  isManager: boolean;
  contactCampaigns: string[];
}

// Convert old Record<campaignName, questions[]> format to flat array.
function normalizeQaTpls(raw: any): QaTemplate[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return Object.entries(raw as Record<string, QaQuestion[]>).map(([name, questions]) => ({
    id: name, name, questions: questions || [],
  }));
}

export function TemplatesPage({ db, updateDb, showToast }: Props) {
  const tplTab = (db.settings?.tplTab as string) || "whatsapp";
  const setTplTab = (t: string) => updateDb(d => { if (!d.settings) d.settings = {}; d.settings.tplTab = t; });

  const waTpls: any[] = (db.settings?.waTemplates as any[]) || [];
  const qaTpls = normalizeQaTpls(db.qaTemplates);

  // WA template form
  const [newTplName, setNewTplName] = useState("");
  const [newTplBody, setNewTplBody] = useState("");

  // QA state
  const [selectedTplId, setSelectedTplId] = useState<string>(() => qaTpls[0]?.id || "");
  const effectiveTplId = selectedTplId || qaTpls[0]?.id || "";
  const selectedTpl = qaTpls.find(t => t.id === effectiveTplId);

  const [newTplNameQa, setNewTplNameQa] = useState("");
  const [newQuestionText, setNewQuestionText] = useState("");
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [editingQText, setEditingQText] = useState("");

  const saveQaTpls = (updated: QaTemplate[]) => updateDb(d => { d.qaTemplates = updated; });

  // ── WA template handlers ────────────────────────────────────────────────────
  const addWaTemplate = () => {
    if (!newTplName.trim() || !newTplBody.trim()) { showToast("Name and body required."); return; }
    updateDb(d => {
      if (!d.settings) d.settings = {};
      if (!d.settings.waTemplates) d.settings.waTemplates = [];
      d.settings.waTemplates.push({ id: uid(), name: newTplName.trim(), body: newTplBody.trim() });
    });
    setNewTplName(""); setNewTplBody("");
    showToast("Template saved.");
  };

  const deleteWaTemplate = (id: string) => {
    updateDb(d => { if (d.settings?.waTemplates) d.settings.waTemplates = d.settings.waTemplates.filter((x: any) => x.id !== id); });
  };

  // ── QA template handlers ────────────────────────────────────────────────────
  const addQaTemplate = () => {
    if (!newTplNameQa.trim()) { showToast("Template name required."); return; }
    const newTpl: QaTemplate = { id: uid(), name: newTplNameQa.trim(), questions: [] };
    saveQaTpls([...qaTpls, newTpl]);
    setSelectedTplId(newTpl.id);
    setNewTplNameQa("");
    showToast("Q&A template created.");
  };

  const deleteQaTemplate = (id: string) => {
    const next = qaTpls.filter(t => t.id !== id);
    saveQaTpls(next);
    if (effectiveTplId === id) setSelectedTplId(next[0]?.id || "");
  };

  const addQuestion = () => {
    if (!newQuestionText.trim()) { showToast("Question required."); return; }
    if (!selectedTpl) { showToast("Select or create a template first."); return; }
    const updated = qaTpls.map(t => t.id === effectiveTplId
      ? { ...t, questions: [...t.questions, { id: uid(), text: newQuestionText.trim() }] }
      : t
    );
    saveQaTpls(updated);
    setNewQuestionText("");
    showToast("Question added.");
  };

  const saveEditQuestion = () => {
    if (!editingQText.trim() || !editingQId) return;
    const updated = qaTpls.map(t => t.id === effectiveTplId
      ? { ...t, questions: t.questions.map(q => q.id === editingQId ? { ...q, text: editingQText.trim() } : q) }
      : t
    );
    saveQaTpls(updated);
    setEditingQId(null);
  };

  const deleteQuestion = (qId: string) => {
    const updated = qaTpls.map(t => t.id === effectiveTplId
      ? { ...t, questions: t.questions.filter(q => q.id !== qId) }
      : t
    );
    saveQaTpls(updated);
  };

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -.5 }}>Templates</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Reusable WhatsApp messages and Q&amp;A scripts</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1.5px solid #ebebeb" }}>
        {[["whatsapp", "WhatsApp"], ["qa", "Q&A"]].map(([k, label]) => (
          <button key={k} onClick={() => setTplTab(k)} style={{ padding: "10px 18px", border: "none", background: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: tplTab === k ? "#1a56db" : "#888", borderBottom: `2.5px solid ${tplTab === k ? "#1a56db" : "transparent"}`, marginBottom: -1.5 }}>{label}</button>
        ))}
      </div>

      {/* ── WhatsApp Templates ───────────────────────────────────────────────── */}
      {tplTab === "whatsapp" && (
        <div className="card">
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f0f0", fontWeight: 700, fontSize: 14 }}>
            WhatsApp Templates <span style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>— click to copy. Use {"{name}"}, {"{phone}"}, {"{company}"} as placeholders</span>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {waTpls.length === 0 && <div style={{ textAlign: "center", padding: "30px 14px", color: "#bbb", fontSize: 13 }}>No templates yet — add one below</div>}
            {waTpls.map((t: any) => (
              <div key={t.id} style={{ background: "#fafafa", border: "1.5px solid #ebebeb", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#059669", marginBottom: 3 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5, wordBreak: "break-word" as const, whiteSpace: "pre-wrap" }}>{t.body}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button onClick={() => { safeCopy(t.body); showToast(`"${t.name}" copied`); }} style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #a7f3d0", background: "#ecfdf5", color: "#059669", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Copy</button>
                  <button onClick={() => deleteWaTemplate(t.id)} style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #fecaca", background: "#fff", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                </div>
              </div>
            ))}
            <div style={{ background: "#f0fdf4", border: "1.5px solid #a7f3d0", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={newTplName} onChange={e => setNewTplName(e.target.value)} placeholder="Template name (e.g. First Follow-up)" style={{ border: "1.5px solid #e5e5e5", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              <textarea value={newTplBody} onChange={e => setNewTplBody(e.target.value)} placeholder={`Hi {name}, just following up on our call…`} rows={3} style={{ border: "1.5px solid #e5e5e5", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" as const }} />
              <button onClick={addWaTemplate} className="green-btn" style={{ alignSelf: "flex-end", padding: "7px 18px", fontSize: 13 }}>Add Template</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Q&A Templates ────────────────────────────────────────────────────── */}
      {tplTab === "qa" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Template selector tabs */}
          {qaTpls.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {qaTpls.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTplId(t.id)}
                  style={{ padding: "7px 14px", borderRadius: 9, border: `1.5px solid ${effectiveTplId === t.id ? "#1a56db" : "#e5e5e5"}`, background: effectiveTplId === t.id ? "#eff6ff" : "#fff", color: effectiveTplId === t.id ? "#1a56db" : "#555", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >{t.name}</button>
              ))}
            </div>
          )}

          {/* Selected template questions */}
          <div className="card">
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {selectedTpl ? selectedTpl.name : "No template selected"}
                <span style={{ fontSize: 12, color: "#888", fontWeight: 500, marginLeft: 8 }}>— questions agents fill in per contact</span>
              </div>
              {selectedTpl && (
                <button onClick={() => deleteQaTemplate(effectiveTplId)} style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #fecaca", background: "#fff", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Delete Template</button>
              )}
            </div>
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {!selectedTpl && <div style={{ textAlign: "center", padding: "30px 14px", color: "#bbb", fontSize: 13 }}>Create a Q&amp;A template below to get started</div>}
              {selectedTpl && selectedTpl.questions.length === 0 && <div style={{ textAlign: "center", padding: "20px 14px", color: "#bbb", fontSize: 13 }}>No questions yet — add one below</div>}
              {selectedTpl && selectedTpl.questions.map((q, idx) => (
                <div key={q.id} style={{ background: "#fafafa", border: "1.5px solid #ebebeb", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#1a56db", background: "#eff6ff", padding: "4px 9px", borderRadius: 7, flexShrink: 0, marginTop: 2 }}>Q{idx + 1}</div>
                  {editingQId === q.id ? (
                    <div style={{ flex: 1, display: "flex", gap: 6 }}>
                      <input
                        autoFocus
                        value={editingQText}
                        onChange={e => setEditingQText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveEditQuestion(); if (e.key === "Escape") setEditingQId(null); }}
                        style={{ flex: 1, border: "1.5px solid #1a56db", borderRadius: 7, padding: "5px 9px", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                      />
                      <button onClick={saveEditQuestion} style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #bfdbfe", background: "#eff6ff", color: "#1a56db", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                      <button onClick={() => setEditingQId(null)} style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #e5e5e5", background: "#fff", color: "#888", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1, fontSize: 13, color: "#333", lineHeight: 1.5, wordBreak: "break-word" as const }}>{q.text}</div>
                      <button onClick={() => { setEditingQId(q.id); setEditingQText(q.text); }} style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #bfdbfe", background: "#eff6ff", color: "#1a56db", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Edit</button>
                      <button onClick={() => deleteQuestion(q.id)} style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #fecaca", background: "#fff", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Delete</button>
                    </>
                  )}
                </div>
              ))}
              {selectedTpl && (
                <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 10, padding: 14, display: "flex", gap: 8 }}>
                  <textarea value={newQuestionText} onChange={e => setNewQuestionText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addQuestion(); } }} placeholder="Question text (e.g. What's their current monthly spend?)" rows={2} style={{ flex: 1, border: "1.5px solid #e5e5e5", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" as const }} />
                  <button onClick={addQuestion} className="primary-btn" style={{ alignSelf: "flex-end", padding: "7px 18px", fontSize: 13, flexShrink: 0 }}>Add Question</button>
                </div>
              )}
            </div>
          </div>

          {/* Create new template */}
          <div style={{ background: "#f0fdf4", border: "1.5px solid #a7f3d0", borderRadius: 12, padding: 16, display: "flex", gap: 8, alignItems: "center" }}>
            <input value={newTplNameQa} onChange={e => setNewTplNameQa(e.target.value)} onKeyDown={e => e.key === "Enter" && addQaTemplate()} placeholder="New template name (e.g. Property Enquiry)" style={{ flex: 1, border: "1.5px solid #e5e5e5", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            <button onClick={addQaTemplate} className="green-btn" style={{ padding: "7px 18px", fontSize: 13, flexShrink: 0 }}>Create Template</button>
          </div>
        </div>
      )}
    </div>
  );
}
