import { useState } from "react";
import { hashPin } from "../lib/security";
import { uid, initials } from "../lib/utils";
import { AVATAR_COLORS } from "../lib/constants";
import type { DbBlob, Member, ToastAction } from "../types";

interface Props {
  db: DbBlob;
  updateDb: (fn: (db: any) => void) => void;
  showToast: (msg: string, action?: ToastAction) => void;
  members: Member[];
}

// Manager-only settings: PIN management, daily call/interested targets, WhatsApp templates.
export function SettingsPage({ db, updateDb, showToast, members }: Props) {
  const settings = db.settings || {};
  const callTarget = parseInt(String(settings.callTarget || 0)) || 0;
  const intTarget  = parseInt(String(settings.intTarget  || 0)) || 0;

  const [managerPin, setManagerPin]       = useState("");
  const [memberPin, setMemberPin]         = useState("");
  const [showManagerPin, setShowManagerPin] = useState(false);
  const [showMemberPin, setShowMemberPin]   = useState(false);
  const [callTargetInput, setCallTargetInput] = useState("");
  const [intTargetInput, setIntTargetInput]   = useState("");
  const [newTplName, setNewTplName] = useState("");
  const [newTplBody, setNewTplBody] = useState("");

  const saveSettings = async () => {
    const mgr = managerPin.length === 4 ? await hashPin(managerPin) : null;
    const mbr = memberPin.length === 4  ? await hashPin(memberPin)  : null;
    updateDb((d: any) => {
      if (!d.settings) d.settings = {};
      if (mgr) d.settings.managerPin = mgr;
      if (mbr) d.settings.agentPin = mbr;
      if (callTargetInput !== "") d.settings.callTarget = parseInt(callTargetInput) || 0;
      if (intTargetInput  !== "") d.settings.intTarget  = parseInt(intTargetInput)  || 0;
    });
    showToast("Settings saved");
    setManagerPin(""); setMemberPin(""); setCallTargetInput(""); setIntTargetInput("");
  };

  const resetPin = async (kind: "manager" | "agent", defaultPin: string, label: string) => {
    const h = await hashPin(defaultPin);
    updateDb((d: any) => {
      if (!d.settings) d.settings = {};
      if (kind === "manager") d.settings.managerPin = h;
      else d.settings.agentPin = h;
    });
    showToast(`${label} PIN reset to ${defaultPin}`);
  };

  const addTemplate = () => {
    if (!newTplName.trim() || !newTplBody.trim()) { showToast("Name and body required."); return; }
    updateDb((d: any) => {
      if (!d.settings) d.settings = {};
      if (!d.settings.waTemplates) d.settings.waTemplates = [];
      d.settings.waTemplates.push({ id: uid(), name: newTplName.trim(), body: newTplBody.trim() });
    });
    setNewTplName(""); setNewTplBody("");
    showToast("Template saved.");
  };

  const deleteTemplate = (id: string) => {
    updateDb((d: any) => {
      if (d.settings?.waTemplates) d.settings.waTemplates = d.settings.waTemplates.filter((x: any) => x.id !== id);
    });
  };

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -.5, marginBottom: 4 }}>Settings</div>
        <div style={{ fontSize: 13, color: "#888" }}>Configure PINs and daily targets</div>
      </div>

      {/* PINs */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", fontWeight: 700, fontSize: 14 }}>Change PINs</div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>
              Manager PIN <span style={{ color: "#bbb", fontWeight: 400 }}>(currently: {settings.managerPin || "1234"})</span>
            </div>
            <div style={{ position: "relative" }}>
              <input
                className="text-input"
                type={showManagerPin ? "text" : "password"}
                inputMode="numeric"
                maxLength={4}
                placeholder="New 4-digit PIN"
                value={managerPin}
                onChange={e => { if (/^\d*$/.test(e.target.value) && e.target.value.length <= 4) setManagerPin(e.target.value); }}
                style={{ paddingRight: 40 }}
              />
              <button
                onClick={() => setShowManagerPin(v => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}
              >{showManagerPin ? "Hide" : "Show"}</button>
            </div>
            <button
              onClick={() => resetPin("manager", "1234", "Manager")}
              style={{ marginTop: 8, background: "none", border: "none", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
            >Reset to default (1234)</button>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>
              Telesales Member PIN <span style={{ color: "#bbb", fontWeight: 400 }}>(currently: {settings.agentPin || "0000"})</span>
            </div>
            <div style={{ position: "relative" }}>
              <input
                className="text-input"
                type={showMemberPin ? "text" : "password"}
                inputMode="numeric"
                maxLength={4}
                placeholder="New 4-digit PIN"
                value={memberPin}
                onChange={e => { if (/^\d*$/.test(e.target.value) && e.target.value.length <= 4) setMemberPin(e.target.value); }}
                style={{ paddingRight: 40 }}
              />
              <button
                onClick={() => setShowMemberPin(v => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}
              >{showMemberPin ? "Hide" : "Show"}</button>
            </div>
            <button
              onClick={() => resetPin("agent", "0000", "Member")}
              style={{ marginTop: 8, background: "none", border: "none", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
            >Reset to default (0000)</button>
          </div>
        </div>
      </div>

      {/* Daily targets */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", fontWeight: 700, fontSize: 14 }}>Daily Targets (per telesales member)</div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>
              Call Target <span style={{ color: "#bbb", fontWeight: 400 }}>(currently: {callTarget || "not set"})</span>
            </div>
            <input className="text-input" type="number" min={0} placeholder="e.g. 80" value={callTargetInput} onChange={e => setCallTargetInput(e.target.value)} />
            <div style={{ fontSize: 11, color: "#999", marginTop: 5 }}>Calls each member should make per day</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 8 }}>
              Interested Target <span style={{ color: "#bbb", fontWeight: 400 }}>(currently: {intTarget || "not set"})</span>
            </div>
            <input className="text-input" type="number" min={0} placeholder="e.g. 10" value={intTargetInput} onChange={e => setIntTargetInput(e.target.value)} />
            <div style={{ fontSize: 11, color: "#999", marginTop: 5 }}>Interested leads each member should get</div>
          </div>
        </div>
      </div>

      <button className="primary-btn" style={{ width: "100%", padding: 14, fontSize: 14 }} onClick={saveSettings}>Save Global Settings</button>

      <div style={{ marginTop: 16, padding: "14px 18px", background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 12, fontSize: 13, color: "#92400e" }}>
        Changing PINs takes effect on next login. Remember the new PINs before locking the app.
      </div>

      {/* Per-agent target overrides */}
      {members.length > 0 && (
        <div className="card" style={{ marginTop: 20, marginBottom: 20 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Per-Agent Targets</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Override the global targets for specific members. Leave blank to use global.</div>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {members.map(m => {
              const existing = db.settings?.agentTargets?.[m.id] || {};
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#fafafa", borderRadius: 10, border: "1.5px solid #ebebeb" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: AVATAR_COLORS[m.colorIdx % AVATAR_COLORS.length][0], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{initials(m.name)}</div>
                  <div style={{ fontWeight: 600, fontSize: 13, flex: 1, minWidth: 80 }}>{m.name}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 3 }}>CALLS/DAY</div>
                      <input
                        type="number" min={0} placeholder={String(db.settings?.callTarget || "—")}
                        defaultValue={existing.callTarget ?? ""}
                        style={{ width: 70, border: "1.5px solid #e5e5e5", borderRadius: 7, padding: "5px 8px", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                        onBlur={e => {
                          const v = parseInt(e.target.value) || undefined;
                          updateDb((d: any) => {
                            if (!d.settings) d.settings = {};
                            if (!d.settings.agentTargets) d.settings.agentTargets = {};
                            if (!d.settings.agentTargets[m.id]) d.settings.agentTargets[m.id] = {};
                            if (v) d.settings.agentTargets[m.id].callTarget = v;
                            else delete d.settings.agentTargets[m.id].callTarget;
                          });
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 3 }}>INT/DAY</div>
                      <input
                        type="number" min={0} placeholder={String(db.settings?.intTarget || "—")}
                        defaultValue={existing.intTarget ?? ""}
                        style={{ width: 70, border: "1.5px solid #e5e5e5", borderRadius: 7, padding: "5px 8px", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                        onBlur={e => {
                          const v = parseInt(e.target.value) || undefined;
                          updateDb((d: any) => {
                            if (!d.settings) d.settings = {};
                            if (!d.settings.agentTargets) d.settings.agentTargets = {};
                            if (!d.settings.agentTargets[m.id]) d.settings.agentTargets[m.id] = {};
                            if (v) d.settings.agentTargets[m.id].intTarget = v;
                            else delete d.settings.agentTargets[m.id].intTarget;
                          });
                        }}
                      />
                    </div>
                    {(existing.callTarget || existing.intTarget) && (
                      <button onClick={() => updateDb((d: any) => { if (d.settings?.agentTargets) delete d.settings.agentTargets[m.id]; })}
                        style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "4px 8px" }}>Reset</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WhatsApp templates */}
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0", fontWeight: 700, fontSize: 14 }}>
          WhatsApp Templates <span style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>— use {"{name}"}, {"{phone}"}, {"{company}"} as placeholders</span>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {(db.settings?.waTemplates || []).map((t: any) => (
            <div key={t.id} style={{ background: "#fafafa", border: "1.5px solid #ebebeb", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#059669", marginBottom: 3 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5, wordBreak: "break-word" as const }}>{t.body}</div>
              </div>
              <button
                onClick={() => deleteTemplate(t.id)}
                style={{ padding: "4px 10px", borderRadius: 7, border: "1.5px solid #fecaca", background: "#fff", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
              >Delete</button>
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
    </div>
  );
}
