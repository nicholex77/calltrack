import { useState } from "react";
import { uid } from "../lib/utils";
import { safeCopy } from "../lib/security";
import type { DbBlob, ToastAction } from "../types";

interface Props {
  db: DbBlob;
  updateDb: (fn: (db: any) => void) => void;
  showToast: (msg: string, action?: ToastAction) => void;
  isManager: boolean;
  contactCampaigns: string[];
}

// Reusable WhatsApp messages and per-campaign Q&A scripts.
// Tab choice + selected QA campaign are persisted in db.settings so they survive reloads.
export function TemplatesPage({ db, updateDb, showToast, isManager, contactCampaigns }: Props) {
  const tplTab = (db.settings?.tplTab as string) || "whatsapp";
  const setTplTab = (t: string) => updateDb(d => { if (!d.settings) d.settings = {}; d.settings.tplTab = t; });

  const waTpls: any[] = (db.settings?.waTemplates as any[]) || [];
  const qaTpls: Record<string, any[]> = (db.qaTemplates as any) || {};
  const allCampaigns = Array.from(new Set([...contactCampaigns, ...Object.keys(qaTpls)])).sort();
  const selectedCampaign = (db.settings?.qaSelectedCampaign as string) || allCampaigns[0] || "";
  const setSelectedCampaign = (cp: string) => updateDb(d => { if (!d.settings) d.settings = {}; d.settings.qaSelectedCampaign = cp; });
  const questions = qaTpls[selectedCampaign] || [];

  const [newTplName, setNewTplName] = useState("");
  const [newTplBody, setNewTplBody] = useState("");
  const [newQuestionText, setNewQuestionText] = useState("");

  const addTemplate = () => {
    if (!newTplName.trim() || !newTplBody.trim()) { showToast("Name and body required."); return; }
    updateDb(d => {
      if (!d.settings) d.settings = {};
      if (!d.settings.waTemplates) d.settings.waTemplates = [];
      d.settings.waTemplates.push({ id: uid(), name: newTplName.trim(), body: newTplBody.trim() });
    });
    setNewTplName(""); setNewTplBody("");
    showToast("Template saved.");
  };

  const deleteTemplate = (id: string) => {
    updateDb(d => { if (d.settings?.waTemplates) d.settings.waTemplates = d.settings.waTemplates.filter((x: any) => x.id !== id); });
  };

  const addQuestion = () => {
    if (!newQuestionText.trim()) { showToast("Question required."); return; }
    updateDb(d => {
      if (!d.qaTemplates) d.qaTemplates = {};
      if (!d.qaTemplates[selectedCampaign]) d.qaTemplates[selectedCampaign] = [];
      d.qaTemplates[selectedCampaign].push({ id: uid(), text: newQuestionText.trim() });
    });
    setNewQuestionText("");
    showToast("Question added.");
  };

  const deleteQuestion = (id: string) => {
    updateDb(d => { if (!d.qaTemplates) return; d.qaTemplates[selectedCampaign] = (d.qaTemplates[selectedCampaign] || []).filter((x: any) => x.id !== id); });
  };

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -.5 }}>Templates</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Reusable WhatsApp messages and campaign Q&amp;A scripts</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1.5px solid #ebebeb" }}>
        {[["whatsapp", "WhatsApp"], ["qa", "Q&A"]].map(([k, label]) => (
          <button key={k} onClick={() => setTplTab(k)} style={{ padding: "10px 18px", border: "none", background: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: tplTab === k ? "#1a56db" : "#888", borderBottom: `2.5px solid ${tplTab === k ? "#1a56db" : "transparent"}`, marginBottom: -1.5 }}>{label}</button>
        ))}
      </div>

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
                  <button
                    onClick={() => { safeCopy(t.body); showToast(`"${t.name}" copied`); }}
                    style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #a7f3d0", background: "#ecfdf5", color: "#059669", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  >Copy</button>
                  {isManager && (
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #fecaca", background: "#fff", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                    >Delete</button>
                  )}
                </div>
              </div>
            ))}
            <div style={{ background: "#f0fdf4", border: "1.5px solid #a7f3d0", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                value={newTplName}
                onChange={e => setNewTplName(e.target.value)}
                placeholder="Template name (e.g. First Follow-up)"
                style={{ border: "1.5px solid #e5e5e5", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none" }}
              />
              <textarea
                value={newTplBody}
                onChange={e => setNewTplBody(e.target.value)}
                placeholder={`Hi {name}, just following up on our call…`}
                rows={3}
                style={{ border: "1.5px solid #e5e5e5", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" as const }}
              />
              <button onClick={addTemplate} className="green-btn" style={{ alignSelf: "flex-end", padding: "7px 18px", fontSize: 13 }}>Add Template</button>
            </div>
          </div>
        </div>
      )}

      {tplTab === "qa" && (
        <div className="card">
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f0f0", fontWeight: 700, fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>Campaign Q&amp;A <span style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>— questions agents fill in per contact</span></div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>Campaign:</span>
              <select
                value={selectedCampaign}
                onChange={e => setSelectedCampaign(e.target.value)}
                style={{ border: "1.5px solid #e5e5e5", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontFamily: "inherit", outline: "none", background: "#fff" }}
              >
                {allCampaigns.length === 0 && <option value="">No campaigns yet</option>}
                {allCampaigns.map(cp => <option key={cp} value={cp}>{cp}</option>)}
              </select>
            </div>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {!selectedCampaign && <div style={{ textAlign: "center", padding: "30px 14px", color: "#bbb", fontSize: 13 }}>Import contacts to create a campaign first</div>}
            {selectedCampaign && questions.length === 0 && <div style={{ textAlign: "center", padding: "20px 14px", color: "#bbb", fontSize: 13 }}>No questions yet for "{selectedCampaign}" — add one below</div>}
            {questions.map((q: any, idx: number) => (
              <div key={q.id} style={{ background: "#fafafa", border: "1.5px solid #ebebeb", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#1a56db", background: "#eff6ff", padding: "4px 9px", borderRadius: 7, flexShrink: 0, marginTop: 2 }}>Q{idx + 1}</div>
                <div style={{ flex: 1, fontSize: 13, color: "#333", lineHeight: 1.5, wordBreak: "break-word" as const }}>{q.text}</div>
                <button
                  onClick={() => deleteQuestion(q.id)}
                  style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #fecaca", background: "#fff", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                >Delete</button>
              </div>
            ))}
            {selectedCampaign && (
              <div style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea
                  value={newQuestionText}
                  onChange={e => setNewQuestionText(e.target.value)}
                  placeholder="Question text (e.g. What's their current monthly spend?)"
                  rows={2}
                  style={{ border: "1.5px solid #e5e5e5", borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" as const }}
                />
                <button onClick={addQuestion} className="primary-btn" style={{ alignSelf: "flex-end", padding: "7px 18px", fontSize: 13 }}>Add Question</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
