import { initials } from "../lib/utils";
import { AVATAR_COLORS } from "../lib/constants";
import type { DbBlob, Member } from "../types";

interface Props {
  db: DbBlob;
  members: Member[];
  isManager: boolean;
  onAddMember: () => void;
  onRemoveMember: (memberId: string, name: string) => void;
}

// Manager: list members + their lifetime call/task stats. Add via modal.
export function MembersPage({ db, members, isManager, onAddMember, onRemoveMember }: Props) {
  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: -.5 }}>Telesales Members</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{members.length} member{members.length !== 1 ? "s" : ""}</div>
        </div>
        <button className="primary-btn" onClick={onAddMember}>+ Add Member</button>
      </div>

      {members.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", border: "1.5px dashed #e5e5e5", borderRadius: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No members yet</div>
          <div style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>Add your telesales members to get started</div>
          <button className="primary-btn" onClick={onAddMember}>+ Add First Member</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
          {members.map((m, i) => {
            const [c1, c2] = AVATAR_COLORS[m.colorIdx];
            const allDays: any[] = Object.values(db.days || {});
            const totalCalls = allDays.reduce((sum: number, d: any) =>
              sum + ((d.tasks || []) as any[])
                .filter((t: any) => t.type === "telesales" && ((t.assignedMembers || []) as any[]).some((am: any) => am.id === m.id))
                .reduce((s: number, t: any) => s + (t.memberStats?.[m.id]?.total || 0), 0), 0);
            const taskCount = allDays.reduce((sum: number, d: any) =>
              sum + ((d.tasks || []) as any[])
                .filter((t: any) => ((t.assignedMembers || []) as any[]).some((am: any) => am.id === m.id)).length, 0);
            return (
              <div key={m.id} className="card fade-up" style={{ padding: 18, animationDelay: `${i * .05}s` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 14, background: `linear-gradient(135deg,${c1},${c2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#fff" }}>{initials(m.name)}</div>
                  <button className="danger-btn" onClick={() => onRemoveMember(m.id, m.name)} style={{ visibility: isManager ? "visible" : "hidden" }}>×</button>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{m.name}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{totalCalls} calls · {taskCount} tasks assigned</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
