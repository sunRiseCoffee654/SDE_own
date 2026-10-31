import type { Phase } from '../data/syllabus';

export type TaskPriority = 'Low' | 'Medium' | 'High';
export type Task = { id: string; title: string; description: string; dueDate: string; priority: TaskPriority; topicId: string; done: boolean; createdAt: string; recurrence?: string; completedAt?: string };
export type Note = { id: string; title: string; content: string; topicId: string; pinned: boolean; updatedAt: string };
export type ReminderEvent = { id: string; kind: 'completed' | 'skipped' | 'snoozed' | 'disabled' | 'paused'; reason: string; createdAt: string };
export type StudySession = { id: string; topicId: string; startedAt: string; durationMinutes: number; completed: boolean };
export type ApplicationStatus = 'Applied' | 'Screening' | 'Interviewing' | 'Offer' | 'Rejected';
export type ProjectStatus = 'Active' | 'Completed' | 'In Progress' | 'Archived';

export type PortfolioProject = {
  id: string;
  title: string;
  tagline: string;
  summary: string;
  githubUrl: string;
  liveUrl?: string;
  techStack: string[];
  status: ProjectStatus;
  featured?: boolean;
  challenges?: string;
  starStory?: string;
  createdAt: string;
  updatedAt: string;
};

export type ResumeApplication = {
  id: string;
  company: string;
  role: string;
  whereApplied: string;
  appliedDate: string;
  status: ApplicationStatus;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileData?: string; // base64 data URL
  notes?: string;
  createdAt: string;
};

export type AppState = {
  topicStatus: Record<string, 'Not Started' | 'In Progress' | 'Needs Revision' | 'Mastered'>;
  subtopicStatus?: Record<string, boolean>;
  tasks: Task[];
  notes: Note[];
  reminders: { enabled: boolean; intervalMinutes: number; startTime: string; endTime: string; quietHours: boolean; nextAt?: string };
  reminderHistory: ReminderEvent[];
  sessions: StudySession[];
  journal: { id: string; date: string; content: string }[];
  resumes: ResumeApplication[];
  projects: PortfolioProject[];
  phaseOrder?: number[];
  syllabus?: Phase[];
  updatedAt?: string;
};

export const defaultState: AppState = {
  topicStatus: {},
  subtopicStatus: {},
  tasks: [],
  notes: [],
  reminders: { enabled: false, intervalMinutes: 60, startTime: '09:00', endTime: '21:00', quietHours: true },
  reminderHistory: [],
  sessions: [],
  journal: [],
  resumes: [],
  projects: [],
  phaseOrder: [],
  syllabus: [],
  updatedAt: new Date().toISOString(),
};

export const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export function todayLocalISO(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isSafeResumeDataUrl(url?: string): boolean {
  if (!url) return false;
  return /^data:(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document);base64,/.test(url);
}
