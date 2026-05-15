// Shared TypeScript interfaces for the app.
// Replaces `any` at component/hook boundaries.

export type Role = "manager" | "agent";

export interface Profile {
  id: string;
  name: string;
  role: string;
}

export interface Member {
  id: string;
  name: string;
  colorIdx: number;
}

export interface MemberRef {
  id: string;
  name: string;
  colorIdx: number;
}

export interface MemberStats {
  total: number;
  answered: number;
  notAnswered: number;
  interested: number;
}

export interface Campaign {
  id: string;
  name: string;
  template?: string;
  followUpDate?: string;
  memberStats?: Record<string, { sent: number; replied: number; closed: number }>;
}

export interface PotentialLead {
  id: string;
  name: string;
  phone: string;
  notes?: string;
}

export interface TelesalesTask {
  id: string;
  type: "telesales";
  title: string;
  linkedCampaign?: string | null;
  assignedMembers: MemberRef[];
  memberStats: Record<string, MemberStats>;
  remarks: string;
  saved?: boolean;
  potentialLeads?: PotentialLead[];
  callScript?: string;
}

export interface WhatsappTask {
  id: string;
  type: "whatsapp";
  title: string;
  assignedMembers: MemberRef[];
  notes: string;
  campaigns: Campaign[];
  saved?: boolean;
}

export interface GeneralTask {
  id: string;
  type: "general";
  title: string;
  assignedMembers: MemberRef[];
  memberDone: Record<string, boolean>;
  notes: string;
  saved?: boolean;
}

export type Task = TelesalesTask | WhatsappTask | GeneralTask;

export interface Day {
  tasks: Task[];
  saved: boolean;
}

export interface WhatsappTemplate {
  id: string;
  name: string;
  body: string;
}

export interface QaQuestion {
  id: string;
  text: string;
}

export interface Settings {
  managerPin?: string;
  agentPin?: string;
  callTarget?: number | string;
  intTarget?: number | string;
  tplTab?: string;
  waTemplates?: WhatsappTemplate[];
  qaSelectedCampaign?: string;
  agentTargets?: Record<string, { callTarget?: number; intTarget?: number }>;
}

export interface DbBlob {
  days?: Record<string, Day>;
  members?: Member[];
  settings?: Settings;
  qaTemplates?: Record<string, QaQuestion[]>;
  __writerId?: string;
}

export interface ContactNote {
  id: string;
  text: string;
  timestamp: string;
  author: string;
  noteType?: string;
}

export interface ContactHistoryEntry {
  id: string;
  type: "status" | "lead" | "call";
  from?: string;
  to?: string;
  status?: string;
  by: string;
  timestamp: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  phone2?: string;
  email?: string;
  storeType?: string;
  company?: string;
  storeId?: string;
  renId?: string;
  agentName?: string;
  date?: string;
  campaign?: string;
  remarks?: string;
  status: string;
  leadStatus?: string | null;
  salesAgent?: string;
  lastTouched?: string;
  callbackDate?: string;
  notes?: ContactNote[];
  history?: ContactHistoryEntry[];
  reContactDate?: string;
  tags?: string[];
  answers?: Record<string, any>;
  rejectionReason?: string;
  rejectionNote?: string;
  dealValue?: number;
  source?: string;
  nextFollowUp?: string;
  closedAt?: string;
  closedStatus?: "won" | "lost";
}

export interface ConfirmModal {
  type: string;
  id: string;
  title: string;
}

export interface ToastAction {
  label: string;
  fn: () => void;
}

export interface DeletionHistoryEntry {
  hid: string;
  label: string;
  contacts: Contact[];
  timestamp: number;
}
