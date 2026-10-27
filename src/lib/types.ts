export type TaskPriority = 'Low' | 'Medium' | 'High';
export type Task = { id: string; title: string; description: string; dueDate: string; priority: TaskPriority; topicId: string; done: boolean; createdAt: string; recurrence?: string };
export type Note = { id: string; title: string; content: string; topicId: string; pinned: boolean; updatedAt: string };
export type ReminderEvent = { id: string; kind: 'completed' | 'skipped' | 'snoozed' | 'disabled' | 'paused'; reason: string; createdAt: string };
export type StudySession = { id: string; topicId: string; startedAt: string; durationMinutes: number; completed: boolean };
export type AppState = {
  topicStatus: Record<string, 'Not Started' | 'In Progress' | 'Needs Revision' | 'Mastered'>;
  tasks: Task[];
  notes: Note[];
  reminders: { enabled: boolean; intervalMinutes: number; startTime: string; endTime: string; quietHours: boolean; nextAt?: string };
  reminderHistory: ReminderEvent[];
  sessions: StudySession[];
  journal: { id: string; date: string; content: string }[];
};

export const defaultState: AppState = {
  topicStatus: { 'p1-t1': 'In Progress', 'p1-t2': 'Mastered', 'p2-t1': 'In Progress', 'p3-t1': 'Needs Revision', 'p4-t1': 'Not Started' },
  tasks: [
    { id: 'seed-task-1', title: 'Review Git branching & merge conflicts', description: 'Practise on a throwaway repository', dueDate: new Date().toISOString().slice(0, 10), priority: 'High', topicId: 'p1-t1', done: false, createdAt: new Date().toISOString() },
    { id: 'seed-task-2', title: 'Solve 2 array problems', description: 'Focus on the two-pointer pattern', dueDate: new Date().toISOString().slice(0, 10), priority: 'Medium', topicId: 'p2-t1', done: false, createdAt: new Date().toISOString() },
    { id: 'seed-task-3', title: 'Make concise HTTP notes', description: 'Methods, status codes, headers', dueDate: '', priority: 'Low', topicId: 'p3-t5', done: true, createdAt: new Date().toISOString() },
  ],
  notes: [
    { id: 'seed-note-1', title: 'Things to remember', content: 'Keep commits focused. Explain the reason behind a change, not just what changed.\n\nNext: practise resolving a merge conflict.', topicId: 'p1-t1', pinned: true, updatedAt: new Date().toISOString() },
    { id: 'seed-note-2', title: 'DSA mistakes log', content: 'Check constraints before picking an approach. Test empty input, one item, duplicates and maximum constraints.', topicId: 'p2-t4', pinned: false, updatedAt: new Date().toISOString() },
  ],
  reminders: { enabled: false, intervalMinutes: 60, startTime: '09:00', endTime: '21:00', quietHours: true },
  reminderHistory: [],
  sessions: [],
  journal: [],
};

export const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
