import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert, Avatar, Badge, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControl, IconButton, InputAdornment, MenuItem,
  Paper, Select, Snackbar, Stack, Switch, TextField, Tooltip, Typography, ListSubheader,
} from '@mui/material';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { gsap } from 'gsap';
import {
  Activity, AlarmClock, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BellOff, BookOpen,
  CalendarDays, Check, CheckCheck, CheckCircle2, ChevronDown, ChevronRight, CircleHelp,
  Clock3, Cloud, CloudOff, Code2, Coffee, Flame, FolderKanban, Focus, GraduationCap,
  HeartPulse, Home, Layers3, ListTodo, LoaderCircle, LockKeyhole, LogOut, MoreHorizontal,
  NotebookPen, Pin, Plus, Rocket, Search, Settings2, ShieldCheck, Sparkles, Target, Timer,
  Trash2, Trophy, X, Zap,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { cloudConfigured, supabase, CLOUD_TABLE } from './lib/supabase';
import { phases } from './data/syllabus';
import { defaultState, makeId, type AppState, type Task, type Note, type TaskPriority, type ReminderEvent } from './lib/types';
import { enableNotifications, scheduleNativeReminders, showBrowserReminder } from './lib/notifications';
import { LocalNotifications } from '@capacitor/local-notifications';

const MotionBox = motion(Box);
const tabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'syllabus', label: 'Syllabus', icon: Layers3 },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'focus', label: 'Focus', icon: Timer },
] as const;
type TabId = typeof tabs[number]['id'];
type ReminderAction = 'completed' | 'skipped' | 'snoozed' | 'disabled' | 'paused';
const STATUSES = ['Not Started', 'In Progress', 'Needs Revision', 'Mastered'] as const;
const REASONS = ['Taking a short break', 'Working on another task', 'Need more time', 'Not feeling well', 'Completed my planned work', 'Other'];
const localKey = (userId?: string) => `sde-orbit-state-v1:${userId || 'demo'}`;
const cloneDefault = (): AppState => JSON.parse(JSON.stringify(defaultState)) as AppState;

function relativeDate() {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
}
function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function percent(done: number, total: number) { return total ? Math.round((done / total) * 100) : 0; }
function statusColor(status: string) {
  if (status === 'Mastered') return 'success';
  if (status === 'In Progress') return 'primary';
  if (status === 'Needs Revision') return 'warning';
  return 'default';
}
function topicName(topicId: string) {
  for (const p of phases) {
    const t = p.topics.find((x) => x.id === topicId);
    if (t) return t.name;
  }
  return 'General';
}

function AuthScreen({ onDemo }: { onDemo: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const submit = async () => {
    if (!supabase) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (mode === 'signup') {
        const { data, error: e } = await supabase.auth.signUp({ email: email.trim(), password });
        if (e) throw e;
        if (!data.session) setMessage('Check your email to confirm your account, then return here to sign in.');
        else setMessage('Account created. Loading your workspace…');
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (e) throw e;
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Authentication failed.'); }
    finally { setBusy(false); }
  };

  return <Box className="auth-shell">
    <MotionBox initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="auth-card">
      <Box className="brand-mark"><OrbitMark /></Box>
      <Typography variant="h1" sx={{ fontSize: 32, mt: 2 }}>SDE Orbit</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.65 }}>Your preparation, notes, tasks, and focus sessions — together, and safely synced.</Typography>
      <Box className="auth-fields" sx={{ mt: 3 }}>
        <TextField label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
        {error && <Alert severity="error">{error}</Alert>}
        {message && <Alert severity="info">{message}</Alert>}
        <Button onClick={submit} variant="contained" size="large" disabled={busy || !email.includes('@') || password.length < 6} endIcon={busy ? <CircularProgress size={16} color="inherit" /> : <ArrowRight size={18} />}>
          {mode === 'signup' ? 'Create your account' : 'Sign in to your Orbit'}
        </Button>
        <Button variant="text" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setMessage(''); }}>
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </Button>
        <Divider><Typography color="text.secondary" variant="caption">or preview the app</Typography></Divider>
        <Button variant="outlined" onClick={onDemo}>Continue in demo mode</Button>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', gap: 0.7, justifyContent: 'center', alignItems: 'center', mt: 3 }}><ShieldCheck size={14} /> Your private study data belongs to your account.</Typography>
    </MotionBox>
  </Box>;
}

function OrbitMark() {
  return <svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true"><defs><linearGradient id="orbitGrad" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#7190FF"/><stop offset="1" stopColor="#2D58DF"/></linearGradient></defs><circle cx="24" cy="24" r="19" fill="url(#orbitGrad)"/><ellipse cx="24" cy="24" rx="22" ry="8" fill="none" stroke="#C8D3FF" strokeWidth="2" transform="rotate(-35 24 24)"/><circle cx="38" cy="12" r="4" fill="#18B6A6" stroke="white" strokeWidth="2"/><path d="M18 24.5l4.1 4.1 8.4-10" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export default function App() {
  const reducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [state, setState] = useState<AppState>(cloneDefault);
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(!cloudConfigured);
  const [demoMode, setDemoMode] = useState(!cloudConfigured);
  const [hydrated, setHydrated] = useState(!cloudConfigured);
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced' | 'offline' | 'error'>(cloudConfigured ? 'offline' : 'local');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [expandedPhase, setExpandedPhase] = useState<number | null>(1);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [taskDialog, setTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [noteDialog, setNoteDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<ReminderAction | null>(null);
  const [pendingReminder, setPendingReminder] = useState(false);
  const [reason, setReason] = useState('Taking a short break');
  const [otherReason, setOtherReason] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('p1-t1');
  const [timerLength, setTimerLength] = useState(25);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const syncTimerRef = useRef<number | null>(null);
  const isBusyHydrating = useRef(false);

  useEffect(() => {
    if (!cloudConfigured || !supabase) { setAuthChecked(true); setDemoMode(true); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setAuthChecked(true);
    }).catch(() => setAuthChecked(true));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setDemoMode(false);
      setAuthChecked(true);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!cloudConfigured) {
      try {
        const saved = localStorage.getItem(localKey());
        if (saved) setState({ ...cloneDefault(), ...(JSON.parse(saved) as Partial<AppState>) });
      } catch { /* corrupted local cache: keep defaults */ }
      setHydrated(true);
      return;
    }
    if (!session?.user?.id || !supabase) { setHydrated(false); return; }
    let cancelled = false;
    isBusyHydrating.current = true;
    setHydrated(false);
    setSyncStatus('syncing');
    (async () => {
      try {
        const { data, error } = await supabase!.from(CLOUD_TABLE).select('data').eq('user_id', session.user.id).maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        if (data?.data) setState({ ...cloneDefault(), ...(data.data as Partial<AppState>) });
        else {
          const cached = localStorage.getItem(localKey(session.user.id));
          if (cached) setState({ ...cloneDefault(), ...(JSON.parse(cached) as Partial<AppState>) });
          else setState(cloneDefault());
        }
        setSyncStatus('synced');
      } catch (e) {
        console.warn('Cloud load failed', e);
        if (!cancelled) {
          const cached = localStorage.getItem(localKey(session.user.id));
          if (cached) setState({ ...cloneDefault(), ...(JSON.parse(cached) as Partial<AppState>) });
          setSyncStatus(navigator.onLine ? 'error' : 'offline');
        }
      } finally {
        if (!cancelled) { setHydrated(true); isBusyHydrating.current = false; }
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!hydrated || isBusyHydrating.current) return;
    const key = localKey(session?.user?.id);
    try { localStorage.setItem(key, JSON.stringify(state)); } catch { /* storage may be unavailable */ }
    if (!cloudConfigured || demoMode || !session?.user?.id || !supabase) {
      if (!cloudConfigured || demoMode) setSyncStatus('local');
      return;
    }
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    setSyncStatus(navigator.onLine ? 'syncing' : 'offline');
    syncTimerRef.current = window.setTimeout(async () => {
      try {
        const { error } = await supabase!.from(CLOUD_TABLE).upsert({ user_id: session.user.id, data: state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (error) throw error;
        setSyncStatus('synced');
      } catch (e) {
        console.warn('Cloud sync failed', e);
        setSyncStatus(navigator.onLine ? 'error' : 'offline');
      }
    }, 650);
    return () => { if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current); };
  }, [state, hydrated, session?.user?.id, demoMode]);

  useEffect(() => {
    if (reducedMotion || !headerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.hero-animate', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.07, ease: 'power3.out', clearProps: 'all' });
    }, headerRef);
    return () => ctx.revert();
  }, [activeTab, reducedMotion]);

  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          setTimerRunning(false);
          const durationMinutes = timerLength;
          setState((old) => ({ ...old, sessions: [{ id: makeId(), topicId: selectedTopic, startedAt: new Date(Date.now() - durationMinutes * 60000).toISOString(), durationMinutes, completed: true }, ...old.sessions] }));
          setToast('Focus session complete. Nicely done!');
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning, timerLength, selectedTopic]);

  useEffect(() => {
    if (!state.reminders.enabled) return;
    const interval = window.setInterval(() => {
      const now = new Date();
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = state.reminders.startTime.split(':').map(Number);
      const [eh, em] = state.reminders.endTime.split(':').map(Number);
      if (currentMins < sh * 60 + sm || currentMins > eh * 60 + em) return;
      const intervalMs = state.reminders.intervalMinutes * 60_000;
      const key = `sde-orbit-last-reminder:${session?.user?.id || 'demo'}`;
      const last = Number(localStorage.getItem(key) || '0');
      if (Date.now() - last >= intervalMs) {
        localStorage.setItem(key, String(Date.now()));
        setPendingReminder(true);
        showBrowserReminder();
      }
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [state.reminders, session?.user?.id]);

  useEffect(() => {
    if (!cloudConfigured) return;
    let handle: { remove: () => Promise<void> } | undefined;
    LocalNotifications.addListener('localNotificationActionPerformed', () => setPendingReminder(true))
      .then((listener) => { handle = listener; })
      .catch(() => undefined);
    return () => { if (handle) void handle.remove(); };
  }, []);

  const updateState = useCallback((update: (old: AppState) => AppState) => setState((old) => update(old)), []);
  const allTopics = useMemo(() => phases.flatMap((p) => p.topics), []);
  const allStatuses = Object.values(state.topicStatus);
  const masteredCount = allTopics.filter((t) => state.topicStatus[t.id] === 'Mastered').length;
  const inProgressCount = allTopics.filter((t) => state.topicStatus[t.id] === 'In Progress').length;
  const revisionCount = allTopics.filter((t) => state.topicStatus[t.id] === 'Needs Revision').length;
  const overallProgress = percent(masteredCount, allTopics.length);
  const todaysTasks = state.tasks.filter((t) => !t.done && (!t.dueDate || t.dueDate <= new Date().toISOString().slice(0, 10)));
  const completedToday = state.tasks.filter((t) => t.done && t.dueDate === new Date().toISOString().slice(0, 10)).length;
  const totalMinutes = state.sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const streak = state.sessions.length ? Math.max(1, new Set(state.sessions.map((s) => s.startedAt.slice(0, 10))).size) : 0;

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null); setDemoMode(false); setActiveTab('home'); setToast('Signed out.');
  };
  const continueDemo = () => { setDemoMode(true); setSession(null); setHydrated(true); try { const saved = localStorage.getItem(localKey()); if (saved) setState({ ...cloneDefault(), ...(JSON.parse(saved) as Partial<AppState>) }); } catch {} };
  const openReason = (action: ReminderAction) => { setPendingAction(action); setReason('Taking a short break'); setOtherReason(''); };

  const submitReason = async () => {
    if (!pendingAction) return;
    const finalReason = reason === 'Other' ? otherReason.trim() : reason;
    if (!finalReason) return;
    const event: ReminderEvent = { id: makeId(), kind: pendingAction, reason: finalReason, createdAt: new Date().toISOString() };
    updateState((old) => ({ ...old, reminderHistory: [event, ...old.reminderHistory].slice(0, 300), reminders: pendingAction === 'disabled' ? { ...old.reminders, enabled: false } : old.reminders }));
    if (pendingAction === 'disabled') {
      setPendingReminder(false);
      setToast('Reminders turned off. Your reason was saved.');
    } else if (pendingAction === 'snoozed') {
      setPendingReminder(false);
      setToast('Reminder snoozed for 15 minutes.');
      if ('Notification' in window && Notification.permission === 'granted') window.setTimeout(() => new Notification('SDE Orbit check-in ⏰', { body: 'Your reminder snooze is over.' }), 15 * 60_000);
    } else if (pendingAction === 'completed') {
      setPendingReminder(false); setToast('Check-in recorded. Keep going!');
    } else if (pendingAction === 'skipped') {
      setPendingReminder(false); setToast('Skip reason saved to your history.');
    } else {
      setToast('Reminder pause recorded.');
    }
    setPendingAction(null);
  };

  const toggleReminders = async (enabled: boolean) => {
    if (!enabled) { openReason('disabled'); return; }
    const allowed = await enableNotifications();
    if (!allowed) { setToast('Notifications are blocked. Enable permission in device settings to receive reminders.'); return; }
    updateState((old) => ({ ...old, reminders: { ...old.reminders, enabled: true, nextAt: new Date(Date.now() + old.reminders.intervalMinutes * 60_000).toISOString() } }));
    localStorage.setItem(`sde-orbit-last-reminder:${session?.user?.id || 'demo'}`, String(Date.now()));
    await scheduleNativeReminders(state.reminders.intervalMinutes, state.reminders.startTime, state.reminders.endTime);
    setToast('Reminders enabled. You can adjust the interval anytime.');
  };

  const updateInterval = async (minutes: number) => {
    updateState((old) => ({ ...old, reminders: { ...old.reminders, intervalMinutes: minutes } }));
    if (state.reminders.enabled) await scheduleNativeReminders(minutes, state.reminders.startTime, state.reminders.endTime);
  };

  const saveTask = (draft: Omit<Task, 'id' | 'createdAt' | 'done'> & Partial<Pick<Task, 'id' | 'createdAt' | 'done'>>) => {
    const task: Task = { id: draft.id || makeId(), title: draft.title, description: draft.description, dueDate: draft.dueDate, priority: draft.priority, topicId: draft.topicId, recurrence: draft.recurrence, done: draft.done || false, createdAt: draft.createdAt || new Date().toISOString() };
    updateState((old) => ({ ...old, tasks: draft.id ? old.tasks.map((t) => t.id === draft.id ? task : t) : [task, ...old.tasks] }));
    setTaskDialog(false); setEditingTask(null); setToast(draft.id ? 'Task updated.' : 'Task added.');
  };
  const saveNote = (draft: Omit<Note, 'id' | 'updatedAt'> & Partial<Pick<Note, 'id' | 'updatedAt'>>) => {
    const note: Note = { ...draft, id: draft.id || makeId(), updatedAt: new Date().toISOString() };
    updateState((old) => ({ ...old, notes: draft.id ? old.notes.map((n) => n.id === draft.id ? note : n) : [note, ...old.notes] }));
    setNoteDialog(false); setEditingNote(null); setToast(draft.id ? 'Note updated.' : 'Note saved.');
  };
  const setTopicStatus = (topicId: string, value: AppState['topicStatus'][string]) => updateState((old) => ({ ...old, topicStatus: { ...old.topicStatus, [topicId]: value } }));

  if (!authChecked) return <Box className="loading-shell"><CircularProgress /><Typography color="text.secondary">Preparing your workspace…</Typography></Box>;
  if (cloudConfigured && !session && !demoMode) return <AuthScreen onDemo={continueDemo} />;
  if (!hydrated && cloudConfigured && session) return <Box className="loading-shell"><CircularProgress /><Typography color="text.secondary">Syncing your Orbit…</Typography></Box>;

  return <MotionConfig reducedMotion="user" transition={{ duration: reducedMotion ? 0 : 0.22 }}>
    <Box className="app-shell">
      <Box className="app-topbar">
        <Box className="brand-lockup" onClick={() => setActiveTab('home')} role="button" tabIndex={0}>
          <Box className="brand-mark small"><OrbitMark /></Box>
          <Box><Typography className="brand-name">sde orbit<span>.</span></Typography><Typography className="brand-caption">YOUR LEARNING SPACE</Typography></Box>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title={syncStatusLabel(syncStatus)}><Box className={`sync-pill sync-${syncStatus}`}><span className="sync-dot" />{syncStatusLabel(syncStatus)}</Box></Tooltip>
          <IconButton className="top-icon" onClick={() => setSettingsOpen(true)} aria-label="Settings"><Settings2 size={19} /></IconButton>
          {cloudConfigured && session ? <Avatar className="profile-avatar" onClick={logout} title="Sign out">{session.user.email?.slice(0, 1).toUpperCase() || 'V'}</Avatar> : <Avatar className="profile-avatar" title="Demo profile">V</Avatar>}
        </Stack>
      </Box>

      <Box className="app-content" ref={headerRef}>
        <AnimatePresence mode="wait" initial={false}>
          <MotionBox key={activeTab} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: -4 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>
            {activeTab === 'home' && <Dashboard state={state} progress={overallProgress} mastered={masteredCount} totalTopics={allTopics.length} inProgress={inProgressCount} revision={revisionCount} todaysTasks={todaysTasks} completedToday={completedToday} totalMinutes={totalMinutes} streak={streak} onGo={setActiveTab} onSettings={() => setSettingsOpen(true)} onTopicStatus={setTopicStatus} onTaskToggle={(id) => updateState((old) => ({ ...old, tasks: old.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t) }))} onReminder={() => setPendingReminder(true)} />}
            {activeTab === 'syllabus' && <Syllabus state={state} expandedPhase={expandedPhase} setExpandedPhase={setExpandedPhase} search={search} setSearch={setSearch} setTopicStatus={setTopicStatus} />}
            {activeTab === 'tasks' && <Tasks state={state} search={search} setSearch={setSearch} onAdd={() => { setEditingTask(null); setTaskDialog(true); }} onEdit={(task) => { setEditingTask(task); setTaskDialog(true); }} onToggle={(id) => updateState((old) => ({ ...old, tasks: old.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t) }))} onDelete={(id) => updateState((old) => ({ ...old, tasks: old.tasks.filter((t) => t.id !== id) }))} />}
            {activeTab === 'notes' && <Notes state={state} search={search} setSearch={setSearch} onAdd={() => { setEditingNote(null); setNoteDialog(true); }} onEdit={(note) => { setEditingNote(note); setNoteDialog(true); }} onTogglePin={(id) => updateState((old) => ({ ...old, notes: old.notes.map((n) => n.id === id ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n) }))} onDelete={(id) => updateState((old) => ({ ...old, notes: old.notes.filter((n) => n.id !== id) }))} />}
            {activeTab === 'focus' && <FocusPage state={state} selectedTopic={selectedTopic} setSelectedTopic={setSelectedTopic} timerLength={timerLength} setTimerLength={(m) => { setTimerLength(m); setRemainingSeconds(m * 60); setTimerRunning(false); }} remainingSeconds={remainingSeconds} timerRunning={timerRunning} onToggleTimer={() => setTimerRunning((v) => !v)} onResetTimer={() => { setTimerRunning(false); setRemainingSeconds(timerLength * 60); }} onSettings={() => setSettingsOpen(true)} onHistory={() => setHistoryOpen(true)} />}
          </MotionBox>
        </AnimatePresence>
      </Box>

      <Box className="bottom-nav-wrap">
        <Box className="floating-nav" role="navigation" aria-label="Main navigation">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => { setActiveTab(id); setSearch(''); }} aria-current={activeTab === id ? 'page' : undefined}>
            <Icon size={20} strokeWidth={activeTab === id ? 2.4 : 1.9} />
            <AnimatePresence initial={false}>{activeTab === id && <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.18 }}>{label}</motion.span>}</AnimatePresence>
          </button>)}
        </Box>
      </Box>
      <Box className="fab-area">
        <AnimatePresence>{quickAddOpen && <motion.div className="quick-actions" initial={{ opacity: 0, y: 10, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }}>
          <button onClick={() => { setEditingTask(null); setTaskDialog(true); setQuickAddOpen(false); }}><span className="quick-icon task"><ListTodo size={17} /></span><span>New task</span></button>
          <button onClick={() => { setEditingNote(null); setNoteDialog(true); setQuickAddOpen(false); }}><span className="quick-icon note"><NotebookPen size={17} /></span><span>New note</span></button>
          <button onClick={() => { setActiveTab('focus'); setQuickAddOpen(false); setTimerRunning(true); }}><span className="quick-icon focus"><Timer size={17} /></span><span>Start focus</span></button>
        </motion.div>}</AnimatePresence>
        <motion.button whileTap={{ scale: 0.92 }} className={`main-fab ${quickAddOpen ? 'is-open' : ''}`} onClick={() => setQuickAddOpen((v) => !v)} aria-label={quickAddOpen ? 'Close quick actions' : 'Add new item'}>
          <motion.span animate={{ rotate: quickAddOpen ? 45 : 0 }} transition={{ duration: 0.18 }}><Plus size={24} /></motion.span>
        </motion.button>
      </Box>

      <TaskDialog open={taskDialog} initial={editingTask} onClose={() => { setTaskDialog(false); setEditingTask(null); }} onSave={saveTask} />
      <NoteDialog open={noteDialog} initial={editingNote} onClose={() => { setNoteDialog(false); setEditingNote(null); }} onSave={saveNote} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} state={state} onToggle={toggleReminders} onInterval={updateInterval} onTimes={async (startTime, endTime) => { updateState((old) => ({ ...old, reminders: { ...old.reminders, startTime, endTime } })); if (state.reminders.enabled && startTime < endTime) await scheduleNativeReminders(state.reminders.intervalMinutes, startTime, endTime); }} onHistory={() => { setSettingsOpen(false); setHistoryOpen(true); }} onLogout={logout} cloudConfigured={cloudConfigured} demoMode={demoMode} />
      <ReasonDialog open={Boolean(pendingAction)} action={pendingAction} reason={reason} setReason={setReason} otherReason={otherReason} setOtherReason={setOtherReason} onClose={() => setPendingAction(null)} onSubmit={submitReason} />
      <ReminderDialog open={pendingReminder} state={state} onAction={openReason} onClose={() => setPendingReminder(false)} />
      <HistoryDialog open={historyOpen} state={state} onClose={() => setHistoryOpen(false)} />
      <Snackbar open={Boolean(toast)} autoHideDuration={3200} onClose={() => setToast('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}><Alert onClose={() => setToast('')} severity="success" variant="filled" sx={{ borderRadius: 3 }}>{toast}</Alert></Snackbar>
    </Box>
  </MotionConfig>;
}

function syncStatusLabel(status: string) {
  return ({ local: 'Local demo', syncing: 'Syncing…', synced: 'Synced', offline: 'Offline', error: 'Sync issue' } as Record<string, string>)[status] || status;
}

function SectionHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <Box className="section-heading hero-animate"><Box>{eyebrow && <Typography className="eyebrow">{eyebrow}</Typography>}<Typography variant="h1">{title}</Typography>{subtitle && <Typography color="text.secondary" sx={{ mt: 0.65 }}>{subtitle}</Typography>}</Box>{action}</Box>;
}

function Dashboard({ state, progress, mastered, totalTopics, inProgress, revision, todaysTasks, completedToday, totalMinutes, streak, onGo, onSettings, onTopicStatus, onTaskToggle, onReminder }: { state: AppState; progress: number; mastered: number; totalTopics: number; inProgress: number; revision: number; todaysTasks: Task[]; completedToday: number; totalMinutes: number; streak: number; onGo: (tab: TabId) => void; onSettings: () => void; onTopicStatus: (id: string, status: AppState['topicStatus'][string]) => void; onTaskToggle: (id: string) => void; onReminder: () => void }) {
  const nextTask = todaysTasks[0];
  const currentPhase = phases.find((phase) => phase.topics.some((topic) => state.topicStatus[topic.id] === 'In Progress')) || phases[0];
  const phaseDone = currentPhase.topics.filter((topic) => state.topicStatus[topic.id] === 'Mastered').length;
  return <Box>
    <Box className="hero-copy hero-animate" sx={{ mb: 2.3 }}>
      <Box><Typography color="text.secondary" className="date-line"><CalendarDays size={14} /> {relativeDate()}</Typography><Typography variant="h1" sx={{ mt: 1 }}>{timeGreeting()},<br /><span className="gradient-text">let’s make progress.</span></Typography><Typography color="text.secondary" sx={{ mt: 1, maxWidth: 460, lineHeight: 1.6 }}>A little momentum every day adds up. Your next step is right here.</Typography></Box>
      <Box className="hero-orbit-art"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core"><OrbitMark /></div><span className="orbit-spark spark-one">✦</span><span className="orbit-spark spark-two">✧</span></Box>
    </Box>

    {state.reminders.enabled && <Paper className="reminder-banner hero-animate" elevation={0} onClick={onReminder} role="button" tabIndex={0}>
      <Box className="reminder-icon"><Bell size={19} /></Box><Box sx={{ flex: 1, minWidth: 0 }}><Typography fontWeight={800}>Quick check-in</Typography><Typography variant="body2" color="text.secondary">How's your focus? Tap to log a response.</Typography></Box><ArrowRight size={19} />
    </Paper>}

    <Box className="stats-grid hero-animate">
      <Paper className="stat-card progress-stat" elevation={0}>
        <Box className="stat-top"><span>SYLLABUS MASTERY</span><span className="stat-icon"><GraduationCap size={17} /></span></Box>
        <Box className="progress-stat-main"><Box className="progress-ring" style={{ ['--progress' as string]: `${progress * 3.6}deg` }}><Box className="progress-ring-inner"><strong>{progress}%</strong><span>done</span></Box></Box><Box className="progress-stat-copy"><Typography variant="h3">You're moving.</Typography><Typography variant="body2" color="text.secondary">{mastered} of {totalTopics} topics mastered</Typography><Button size="small" endIcon={<ArrowUpRight size={15} />} onClick={() => onGo('syllabus')}>View syllabus</Button></Box></Box>
      </Paper>
      <Paper className="stat-card" elevation={0}><Box className="stat-top"><span>STUDY TIME</span><span className="stat-icon mint"><Clock3 size={17} /></span></Box><Typography className="big-stat">{Math.floor(totalMinutes / 60)}<small>h</small> {totalMinutes % 60}<small>m</small></Typography><Typography color="text.secondary" variant="body2">Total logged focus time</Typography><Box className="micro-bars">{[28, 45, 36, 72, 49, 86, Math.min(100, Math.max(18, totalMinutes % 100))].map((height, i) => <span key={i} style={{ height: `${height}%` }} />)}</Box></Paper>
      <Paper className="stat-card" elevation={0}><Box className="stat-top"><span>STREAK</span><span className="stat-icon peach"><Flame size={17} /></span></Box><Typography className="big-stat">{streak}<small> days</small></Typography><Typography color="text.secondary" variant="body2">Show up, even for a little.</Typography><Box className="streak-dots">{['M','T','W','T','F','S','S'].map((d, i) => <span key={`${d}-${i}`} className={i < Math.min(streak, 7) ? 'lit' : ''}>{d}</span>)}</Box></Paper>
      <Paper className="stat-card" elevation={0}><Box className="stat-top"><span>TOPIC STATUS</span><span className="stat-icon violet"><Activity size={17} /></span></Box><Box className="status-stats"><Box><strong>{inProgress}</strong><span>In progress</span></Box><Box><strong>{revision}</strong><span>Revise</span></Box><Box><strong>{totalTopics - inProgress - revision - mastered}</strong><span>To learn</span></Box></Box><Button size="small" onClick={() => onGo('syllabus')} endIcon={<ArrowRight size={15} />}>Manage topics</Button></Paper>
    </Box>

    <Box className="dashboard-columns">
      <Box className="dashboard-main-col">
        <Box className="inline-section-header hero-animate"><Box><Typography variant="h2">Today’s focus</Typography><Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>Small wins count. Pick one and begin.</Typography></Box><Button size="small" onClick={() => onGo('tasks')}>All tasks <ArrowRight size={15} /></Button></Box>
        <Paper className="task-preview-card hero-animate" elevation={0}>
          {todaysTasks.length === 0 ? <Box className="empty-inline"><span className="empty-bubble"><CheckCheck size={22} /></span><Typography fontWeight={750}>You're clear for now.</Typography><Typography color="text.secondary" variant="body2">Add a task or enjoy a guilt-free break.</Typography></Box> : todaysTasks.slice(0, 3).map((task, i) => <Box className="task-preview-row" key={task.id}>
            <button className={`task-check ${task.done ? 'checked' : ''}`} aria-label={task.done ? 'Mark incomplete' : 'Complete task'} onClick={() => onTaskToggle(task.id)}>{task.done && <Check size={14} />}</button>
            <Box sx={{ flex: 1, minWidth: 0 }}><Typography fontWeight={750} className={task.done ? 'task-title done-text' : 'task-title'}>{task.title}</Typography><Typography variant="caption" color="text.secondary">{topicName(task.topicId)}{task.dueDate ? ` · ${task.dueDate === new Date().toISOString().slice(0, 10) ? 'Due today' : task.dueDate}` : ''}</Typography></Box>
            <span className={`priority-mark priority-${task.priority.toLowerCase()}`} />
          </Box>)}
          <Button fullWidth className="add-task-inline" onClick={() => onGo('tasks')} startIcon={<Plus size={16} />}>Open task manager</Button>
        </Paper>
        <Box className="inline-section-header hero-animate"><Box><Typography variant="h2">Pick up where you left off</Typography><Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>Keep the learning momentum.</Typography></Box></Box>
        <Paper className="continue-card hero-animate" elevation={0}>
          <Box className="continue-card-art"><div className="continue-circle circle-a"/><div className="continue-circle circle-b"/><Code2 size={36} /></Box>
          <Box className="continue-copy"><Chip size="small" label={`PHASE ${String(currentPhase.id).padStart(2, '0')}`} className="phase-chip"/><Typography variant="h3" sx={{ mt: 1 }}>{currentPhase.name}</Typography><Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>{currentPhase.weeks}</Typography><Box className="mini-progress"><span style={{ width: `${percent(phaseDone, currentPhase.topics.length)}%` }}/></Box><Typography variant="caption" color="text.secondary">{phaseDone} of {currentPhase.topics.length} topics mastered</Typography><Button variant="contained" size="small" sx={{ mt: 1.3, alignSelf: 'flex-start' }} endIcon={<ArrowRight size={15} />} onClick={() => onGo('syllabus')}>Continue learning</Button></Box>
        </Paper>
      </Box>
      <Box className="dashboard-side-col">
        <Paper className="focus-promo hero-animate" elevation={0}>
          <Box className="focus-promo-top"><span className="promo-icon"><Focus size={19} /></span><span className="promo-tag">FOCUS MODE</span></Box><Typography variant="h2" sx={{ mt: 2, fontSize: 24 }}>One thing at a time.</Typography><Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,.76)', lineHeight: 1.65 }}>Quiet the noise. Give your next task your full attention.</Typography><Box className="promo-timer"><Clock3 size={16} /> 25:00 <span>· Pomodoro</span></Box><Button onClick={() => onGo('focus')} variant="contained" className="promo-button" endIcon={<ArrowUpRight size={16} />}>Start a session</Button><div className="promo-blob blob-one"/><div className="promo-blob blob-two"/>
        </Paper>
        <Paper className="reminder-card hero-animate" elevation={0}><Box className="card-heading-row"><Box><Typography variant="h3">Your reminders</Typography><Typography color="text.secondary" variant="body2" sx={{ mt: 0.4 }}>Gentle nudges, on your terms.</Typography></Box><Box className={`reminder-status ${state.reminders.enabled ? 'is-enabled' : ''}`}><span />{state.reminders.enabled ? 'On' : 'Off'}</Box></Box><Box className="reminder-interval"><Box className="reminder-big-icon"><Bell size={18}/></Box><Box sx={{ flex: 1 }}><Typography fontWeight={800}>Study check-in</Typography><Typography color="text.secondary" variant="body2">Every {state.reminders.intervalMinutes < 60 ? `${state.reminders.intervalMinutes} min` : `${state.reminders.intervalMinutes / 60} ${state.reminders.intervalMinutes / 60 === 1 ? 'hour' : 'hours'}`}</Typography></Box><IconButton size="small" onClick={onSettings}><Settings2 size={18}/></IconButton></Box><Button fullWidth onClick={onSettings} variant={state.reminders.enabled ? 'outlined' : 'contained'}>{state.reminders.enabled ? 'Manage reminders' : 'Set up reminders'}</Button><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.2, lineHeight: 1.5 }}>You'll add a reason when you skip or turn a reminder off.</Typography></Paper>
        <Paper className="quote-card hero-animate" elevation={0}><Sparkles size={19} /><Typography fontWeight={800} sx={{ mt: 1 }}>Progress, not perfection.</Typography><Typography color="text.secondary" variant="body2" sx={{ mt: 0.5, lineHeight: 1.6 }}>You don't need a perfect day. You need a next step.</Typography></Paper>
      </Box>
    </Box>
  </Box>;
}

function PageSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <TextField value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="page-search" InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment>, endAdornment: value ? <InputAdornment position="end"><IconButton size="small" onClick={() => onChange('')}><X size={15}/></IconButton></InputAdornment> : undefined }} />;
}

function Syllabus({ state, expandedPhase, setExpandedPhase, search, setSearch, setTopicStatus }: { state: AppState; expandedPhase: number | null; setExpandedPhase: (n: number | null) => void; search: string; setSearch: (s: string) => void; setTopicStatus: (id: string, status: AppState['topicStatus'][string]) => void }) {
  const total = phases.reduce((sum, p) => sum + p.topics.length, 0);
  const mastered = phases.flatMap((p) => p.topics).filter((t) => state.topicStatus[t.id] === 'Mastered').length;
  const filtered = phases.map((phase) => ({ ...phase, topics: phase.topics.filter((topic) => `${topic.name} ${phase.name} ${phase.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())) })).filter((phase) => !search || phase.topics.length > 0);
  return <Box>
    <SectionHeading eyebrow="YOUR LEARNING MAP" title="Syllabus" subtitle="12 phases. One clear view of where you are." action={<Button variant="outlined" startIcon={<Search size={16} />} onClick={() => document.querySelector<HTMLInputElement>('.page-search input')?.focus()}>Find a topic</Button>} />
    <Paper className="syllabus-overview hero-animate" elevation={0}><Box className="syllabus-progress-ring"><Box><strong>{percent(mastered, total)}%</strong><span>mastered</span></Box></Box><Box sx={{ flex: 1 }}><Typography variant="h3">Your progress, at a glance</Typography><Typography color="text.secondary" variant="body2" sx={{ mt: 0.55 }}>{mastered} of {total} main topics marked as mastered</Typography><Box className="segmented-progress">{phases.map((p) => { const count = p.topics.filter((t) => state.topicStatus[t.id] === 'Mastered').length; return <span key={p.id} title={p.name} style={{ flex: p.topics.length, background: count ? p.color : '#E9EDF5', opacity: count ? 0.55 + 0.45 * count / p.topics.length : 1 }} />; })}</Box><Typography variant="caption" color="text.secondary">DSA stays available as a parallel learning track.</Typography></Box></Paper>
    <Box className="syllabus-tools"><PageSearch value={search} onChange={setSearch} placeholder="Search topics, phases, or skill tags…" /><Box className="filter-hint"><span className="legend-dot mastered"/> Mastered <span className="legend-dot progress"/> In progress <span className="legend-dot revision"/> Revise</Box></Box>
    <Box className="phase-list">
      {filtered.map((phase) => {
        const done = phase.topics.filter((t) => state.topicStatus[t.id] === 'Mastered').length;
        const open = expandedPhase === phase.id || Boolean(search);
        return <Paper className={`phase-card hero-animate ${open ? 'expanded' : ''}`} elevation={0} key={phase.id}>
          <button className="phase-head" onClick={() => setExpandedPhase(open && !search ? null : phase.id)}>
            <span className="phase-number" style={{ background: `${phase.color}16`, color: phase.color }}>{String(phase.id).padStart(2, '0')}</span><span className="phase-name-block"><strong>{phase.name}</strong><small>{phase.weeks} · {phase.topics.length} topics</small></span><span className="phase-progress-number">{percent(done, phase.topics.length)}%</span><span className="phase-chevron">{open ? <ChevronDown size={19}/> : <ChevronRight size={19}/>}</span>
          </button>
          <Box className="phase-progress-bar"><span style={{ width: `${percent(done, phase.topics.length)}%`, background: phase.color }}/></Box>
          {open && <Box className="phase-topic-list">{phase.topics.map((topic) => {
            const status = state.topicStatus[topic.id] || 'Not Started';
            return <Box key={topic.id} className="topic-row"><Box className={`topic-state-dot state-${status.toLowerCase().replaceAll(' ', '-')}`}>{status === 'Mastered' ? <Check size={13}/> : status === 'In Progress' ? <span/> : status === 'Needs Revision' ? <ArrowDownRight size={12}/> : null}</Box><Box className="topic-row-name"><Typography>{topic.name}</Typography><Typography variant="caption" color="text.secondary">{status === 'Mastered' ? 'Looking good' : status === 'Needs Revision' ? 'Add to revision queue' : status === 'In Progress' ? 'Keep going' : 'Ready when you are'}</Typography></Box><FormControl size="small" className="topic-status-select"><Select value={status} onChange={(e) => setTopicStatus(topic.id, e.target.value as AppState['topicStatus'][string])} renderValue={(v) => <span className={`status-select-label status-${v.toLowerCase().replaceAll(' ', '-')}`}>{v}</span>}>
              {STATUSES.map((s) => <MenuItem key={s} value={s}><span className={`status-option-dot status-${s.toLowerCase().replaceAll(' ', '-')}`}/>{s}</MenuItem>)}
            </Select></FormControl></Box>;
          })}</Box>}
          <Box className="phase-tags">{phase.tags.map((tag) => <span key={tag}>{tag}</span>)}</Box>
        </Paper>;
      })}
    </Box>
    <Box className="small-note"><Sparkles size={16}/><Typography variant="body2">Mastery is a self-assessment, not just a checkbox. Change a topic's status whenever your understanding changes.</Typography></Box>
  </Box>;
}

function Tasks({ state, search, setSearch, onAdd, onEdit, onToggle, onDelete }: { state: AppState; search: string; setSearch: (s: string) => void; onAdd: () => void; onEdit: (t: Task) => void; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState<'Today' | 'Upcoming' | 'Overdue' | 'Completed' | 'All'>('Today');
  const today = new Date().toISOString().slice(0, 10);
  const filtered = state.tasks.filter((task) => {
    const matchSearch = `${task.title} ${task.description} ${topicName(task.topicId)}`.toLowerCase().includes(search.toLowerCase());
    const group = filter === 'Today' ? !task.done && (!task.dueDate || task.dueDate <= today) : filter === 'Upcoming' ? !task.done && task.dueDate > today : filter === 'Overdue' ? !task.done && task.dueDate && task.dueDate < today : filter === 'Completed' ? task.done : true;
    return matchSearch && group;
  }).sort((a, b) => Number(a.done) - Number(b.done) || ({ High: 0, Medium: 1, Low: 2 }[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority]));
  const doneCount = state.tasks.filter((t) => t.done).length;
  return <Box>
    <SectionHeading eyebrow="MAKE SPACE FOR WHAT MATTERS" title="Tasks" subtitle={`${doneCount} completed · ${state.tasks.length - doneCount} left in your list`} action={<Button variant="contained" startIcon={<Plus size={17}/>} onClick={onAdd}>New task</Button>} />
    <Paper className="tasks-summary hero-animate" elevation={0}><Box className="tasks-summary-icon"><CheckCheck size={22}/></Box><Box sx={{ flex: 1 }}><Typography fontWeight={800}>You’ve got this.</Typography><Typography color="text.secondary" variant="body2">Keep tasks small, clear, and connected to a topic.</Typography></Box><Box className="tasks-summary-count"><strong>{doneCount}/{state.tasks.length}</strong><span>done</span></Box></Paper>
    <Box className="tasks-tools"><PageSearch value={search} onChange={setSearch} placeholder="Search your tasks…"/><Box className="task-filters">{(['Today', 'Upcoming', 'Overdue', 'Completed', 'All'] as const).map((name) => <button key={name} className={filter === name ? 'selected' : ''} onClick={() => setFilter(name)}>{name}{name === 'Today' && <span>{state.tasks.filter((t) => !t.done && (!t.dueDate || t.dueDate <= today)).length}</span>}</button>)}</Box></Box>
    <Box className="tasks-list">{filtered.length === 0 ? <Paper className="empty-state" elevation={0}><span className="empty-bubble"><ListTodo size={25}/></span><Typography variant="h3">Nothing on this list</Typography><Typography color="text.secondary" sx={{ mt: 0.6 }}>Add a task or switch to another view.</Typography><Button variant="contained" sx={{ mt: 2 }} startIcon={<Plus size={16}/>} onClick={onAdd}>Create a task</Button></Paper> : filtered.map((task) => <Paper className={`task-card hero-animate ${task.done ? 'task-card-done' : ''}`} elevation={0} key={task.id}>
      <button className={`task-check large ${task.done ? 'checked' : ''}`} onClick={() => onToggle(task.id)} aria-label={task.done ? 'Mark incomplete' : 'Complete task'}>{task.done && <Check size={15}/>}</button>
      <Box className="task-card-content" onClick={() => onEdit(task)} role="button" tabIndex={0}><Typography fontWeight={800} className={task.done ? 'done-text' : ''}>{task.title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>{task.description || topicName(task.topicId)}</Typography><Box className="task-meta"><Chip size="small" label={topicName(task.topicId)} className="topic-chip"/><span className={`priority-badge ${task.priority.toLowerCase()}`}><i/>{task.priority}</span>{task.dueDate && <span className={`due-label ${!task.done && task.dueDate < today ? 'overdue' : ''}`}><CalendarDays size={13}/>{task.dueDate === today ? 'Today' : task.dueDate}</span>}</Box></Box>
      <Box className="task-actions"><IconButton size="small" onClick={() => onEdit(task)} aria-label="Edit task"><MoreHorizontal size={18}/></IconButton><IconButton size="small" onClick={() => onDelete(task.id)} aria-label="Delete task"><Trash2 size={16}/></IconButton></Box>
    </Paper>)}</Box>
  </Box>;
}

function Notes({ state, search, setSearch, onAdd, onEdit, onTogglePin, onDelete }: { state: AppState; search: string; setSearch: (s: string) => void; onAdd: () => void; onEdit: (n: Note) => void; onTogglePin: (id: string) => void; onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState<'All notes' | 'Pinned'>('All notes');
  const filtered = state.notes.filter((note) => `${note.title} ${note.content} ${topicName(note.topicId)}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'All notes' || note.pinned)).sort((a, b) => Number(b.pinned) - Number(a.pinned));
  return <Box>
    <SectionHeading eyebrow="YOUR SECOND BRAIN" title="Notes" subtitle="Catch a thought before it disappears." action={<Button variant="contained" startIcon={<Plus size={17}/>} onClick={onAdd}>New note</Button>} />
    <Box className="notes-tools"><PageSearch value={search} onChange={setSearch} placeholder="Search notes…"/><Box className="task-filters note-filter">{(['All notes', 'Pinned'] as const).map((f) => <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>{f}{f === 'Pinned' && <Pin size={13}/>}</button>)}</Box></Box>
    {filtered.length === 0 ? <Paper className="empty-state" elevation={0}><span className="empty-bubble"><NotebookPen size={25}/></span><Typography variant="h3">A fresh page</Typography><Typography color="text.secondary" sx={{ mt: 0.6 }}>Keep insights, code snippets, and things to revisit here.</Typography><Button variant="contained" sx={{ mt: 2 }} onClick={onAdd}>Write your first note</Button></Paper> : <Box className="notes-grid">{filtered.map((note, i) => <MotionBox key={note.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.035, 0.2) }} className={`note-card note-tint-${i % 4}`}>
      <Box className="note-card-top"><span className="note-icon"><NotebookPen size={17}/></span><Box className="note-top-actions"><IconButton size="small" onClick={() => onTogglePin(note.id)} aria-label={note.pinned ? 'Unpin note' : 'Pin note'} className={note.pinned ? 'pin-active' : ''}><Pin size={15}/></IconButton><IconButton size="small" onClick={() => onDelete(note.id)} aria-label="Delete note"><Trash2 size={15}/></IconButton></Box></Box>
      <Box onClick={() => onEdit(note)} role="button" tabIndex={0} className="note-card-click"><Typography variant="h3">{note.title || 'Untitled note'}</Typography><Typography className="note-content-preview">{note.content || 'No content yet.'}</Typography></Box>
      <Box className="note-card-footer"><span>{topicName(note.topicId)}</span><span>{new Date(note.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></Box>
    </MotionBox>)}</Box>}
    <Box className="small-note"><Cloud size={16}/><Typography variant="body2">Notes sync to your account when cloud sync is configured. Keep the content useful and concise for easier revision.</Typography></Box>
  </Box>;
}

function FocusPage({ state, selectedTopic, setSelectedTopic, timerLength, setTimerLength, remainingSeconds, timerRunning, onToggleTimer, onResetTimer, onSettings, onHistory }: { state: AppState; selectedTopic: string; setSelectedTopic: (id: string) => void; timerLength: number; setTimerLength: (m: number) => void; remainingSeconds: number; timerRunning: boolean; onToggleTimer: () => void; onResetTimer: () => void; onSettings: () => void; onHistory: () => void }) {
  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
  const seconds = (remainingSeconds % 60).toString().padStart(2, '0');
  const elapsed = 1 - remainingSeconds / (timerLength * 60 || 1);
  const totalMinutes = state.sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  return <Box>
    <SectionHeading eyebrow="BE HERE, RIGHT NOW" title="Focus" subtitle="One task. One session. Less noise." action={<Button variant="outlined" startIcon={<AlarmClock size={16}/>} onClick={onSettings}>Reminders</Button>} />
    <Box className="focus-layout">
      <Paper className="timer-panel hero-animate" elevation={0}>
        <Box className="focus-panel-top"><span className="focus-label"><span className={timerRunning ? 'pulse-dot' : ''}/>{timerRunning ? 'SESSION IN PROGRESS' : 'YOUR FOCUS SPACE'}</span><IconButton onClick={onHistory}><Activity size={18}/></IconButton></Box>
        <Box className={`timer-wheel ${timerRunning ? 'timer-active' : ''}`} style={{ ['--timer-progress' as string]: `${Math.max(0, elapsed * 360)}deg` }}><Box className="timer-wheel-inner"><span>{timerRunning ? 'IN THE ZONE' : 'TIME TO FOCUS'}</span><strong>{minutes}:{seconds}</strong><small>{timerRunning ? 'You’re doing great' : 'Make this time count'}</small></Box></Box>
        <Box className="timer-presets">{[15, 25, 45, 60].map((m) => <button key={m} className={timerLength === m ? 'active' : ''} onClick={() => setTimerLength(m)} disabled={timerRunning}>{m}<small>min</small></button>)}</Box>
        <Box className="timer-controls"><Button variant="contained" size="large" onClick={onToggleTimer} startIcon={timerRunning ? <Coffee size={18}/> : <Zap size={18}/>} className="timer-main-button">{timerRunning ? 'Pause session' : remainingSeconds === 0 ? 'Start again' : 'Start focusing'}</Button><IconButton onClick={onResetTimer} className="timer-reset" aria-label="Reset timer"><Activity size={18}/></IconButton></Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>Stay with it. Breaks are part of the process.</Typography>
      </Paper>
      <Box className="focus-side">
        <Paper className="focus-topic-card hero-animate" elevation={0}><Box className="card-heading-row"><Box><Typography variant="h3">What are you working on?</Typography><Typography color="text.secondary" variant="body2" sx={{ mt: 0.4 }}>Log time against a topic.</Typography></Box><Target size={21} color="#3563E9"/></Box><FormControl fullWidth size="small" sx={{ mt: 2 }}><Select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)}>{phases.map((phase) => [<ListSubheader key={`phase-${phase.id}`} disableSticky>{phase.name}</ListSubheader>, ...phase.topics.map((topic) => <MenuItem key={topic.id} value={topic.id}>{topic.name}</MenuItem>)] )}</Select></FormControl><Box className="selected-topic-preview"><span className="topic-orbit"><Code2 size={20}/></span><Box><Typography fontWeight={800}>{topicName(selectedTopic)}</Typography><Typography variant="caption" color="text.secondary">Selected focus topic</Typography></Box></Box></Paper>
        <Paper className="focus-summary-card hero-animate" elevation={0}><Box className="summary-icon-row"><span className="summary-soft-icon"><Clock3 size={19}/></span><Box><Typography variant="h3">Your focus history</Typography><Typography variant="body2" color="text.secondary">Every session counts.</Typography></Box></Box><Box className="focus-summary-stats"><Box><strong>{state.sessions.length}</strong><span>Sessions</span></Box><Box><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong><span>Total time</span></Box><Box><strong>{state.sessions.filter((s) => s.completed).length}</strong><span>Completed</span></Box></Box><Button fullWidth variant="outlined" onClick={onHistory}>View session history</Button></Paper>
        <Paper className="focus-tip hero-animate" elevation={0}><Sparkles size={18}/><Box><Typography fontWeight={800}>A tiny focus ritual</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, lineHeight: 1.55 }}>Write the next action before starting. When the timer ends, jot one thing you learned.</Typography></Box></Paper>
      </Box>
    </Box>
  </Box>;
}

function TaskDialog({ open, initial, onClose, onSave }: { open: boolean; initial: Task | null; onClose: () => void; onSave: (task: Omit<Task, 'id' | 'createdAt' | 'done'> & Partial<Pick<Task, 'id' | 'createdAt' | 'done'>>) => void }) {
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [dueDate, setDueDate] = useState(''); const [priority, setPriority] = useState<TaskPriority>('Medium'); const [topicId, setTopicId] = useState('p1-t1'); const [recurrence, setRecurrence] = useState('Never');
  useEffect(() => { setTitle(initial?.title || ''); setDescription(initial?.description || ''); setDueDate(initial?.dueDate || ''); setPriority(initial?.priority || 'Medium'); setTopicId(initial?.topicId || 'p1-t1'); setRecurrence(initial?.recurrence || 'Never'); }, [initial, open]);
  const submit = () => { if (!title.trim()) return; onSave({ id: initial?.id, createdAt: initial?.createdAt, done: initial?.done, title: title.trim(), description: description.trim(), dueDate, priority, topicId, recurrence: recurrence === 'Never' ? undefined : recurrence }); };
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle className="dialog-title"><span className="dialog-icon task"><ListTodo size={19}/></span><Box><Typography variant="h3">{initial ? 'Edit task' : 'Create a task'}</Typography><Typography color="text.secondary" variant="body2">A small next step is a good next step.</Typography></Box><IconButton onClick={onClose} sx={{ ml: 'auto' }}><X size={19}/></IconButton></DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField label="Task title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. Practise binary search"/><TextField label="Notes (optional)" value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={2} placeholder="What does done look like?"/><Box className="form-two-col"><TextField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }}/><FormControl><Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>Priority</Typography><Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}><MenuItem value="Low">Low</MenuItem><MenuItem value="Medium">Medium</MenuItem><MenuItem value="High">High</MenuItem></Select></FormControl></Box><FormControl><Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>Link to topic</Typography><Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>{phases.map((phase) => [<ListSubheader key={`phase-${phase.id}`} disableSticky>{phase.name}</ListSubheader>, ...phase.topics.map((topic) => <MenuItem key={topic.id} value={topic.id}>{topic.name}</MenuItem>)] )}</Select></FormControl><FormControl><Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>Repeat</Typography><Select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>{['Never', 'Daily', 'Weekdays', 'Weekly'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}</Select></FormControl></Stack></DialogContent><DialogActions className="dialog-actions"><Button onClick={onClose} color="inherit">Cancel</Button><Button onClick={submit} variant="contained" disabled={!title.trim()}>{initial ? 'Save changes' : 'Add task'}</Button></DialogActions></Dialog>;
}

function NoteDialog({ open, initial, onClose, onSave }: { open: boolean; initial: Note | null; onClose: () => void; onSave: (note: Omit<Note, 'id' | 'updatedAt'> & Partial<Pick<Note, 'id' | 'updatedAt'>>) => void }) {
  const [title, setTitle] = useState(''); const [content, setContent] = useState(''); const [topicId, setTopicId] = useState('p1-t1'); const [pinned, setPinned] = useState(false);
  useEffect(() => { setTitle(initial?.title || ''); setContent(initial?.content || ''); setTopicId(initial?.topicId || 'p1-t1'); setPinned(initial?.pinned || false); }, [initial, open]);
  const submit = () => onSave({ id: initial?.id, title: title.trim() || 'Untitled note', content, topicId, pinned });
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle className="dialog-title"><span className="dialog-icon note"><NotebookPen size={19}/></span><Box><Typography variant="h3">{initial ? 'Edit note' : 'A fresh page'}</Typography><Typography color="text.secondary" variant="body2">Capture an idea while it’s still fresh.</Typography></Box><IconButton onClick={onClose} sx={{ ml: 'auto' }}><X size={19}/></IconButton></DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField label="Note title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. DSA patterns I keep mixing up"/><TextField label="Your note" value={content} onChange={(e) => setContent(e.target.value)} multiline minRows={7} placeholder="Write a concept, snippet, mistake, or reminder to yourself…"/><FormControl><Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>Link to topic</Typography><Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>{phases.map((phase) => [<ListSubheader key={`phase-${phase.id}`} disableSticky>{phase.name}</ListSubheader>, ...phase.topics.map((topic) => <MenuItem key={topic.id} value={topic.id}>{topic.name}</MenuItem>)] )}</Select></FormControl><Button variant={pinned ? 'contained' : 'outlined'} startIcon={<Pin size={16}/>} onClick={() => setPinned((v) => !v)} sx={{ alignSelf: 'flex-start' }}>{pinned ? 'Pinned note' : 'Pin this note'}</Button></Stack></DialogContent><DialogActions className="dialog-actions"><Button onClick={onClose} color="inherit">Cancel</Button><Button onClick={submit} variant="contained">Save note</Button></DialogActions></Dialog>;
}

function SettingsDialog({ open, onClose, state, onToggle, onInterval, onTimes, onHistory, onLogout, cloudConfigured, demoMode }: { open: boolean; onClose: () => void; state: AppState; onToggle: (enabled: boolean) => void; onInterval: (m: number) => void; onTimes: (start: string, end: string) => void; onHistory: () => void; onLogout: () => void; cloudConfigured: boolean; demoMode: boolean }) {
  const [start, setStart] = useState(state.reminders.startTime); const [end, setEnd] = useState(state.reminders.endTime);
  useEffect(() => { setStart(state.reminders.startTime); setEnd(state.reminders.endTime); }, [state.reminders.startTime, state.reminders.endTime, open]);
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle className="dialog-title"><span className="dialog-icon focus"><Settings2 size={19}/></span><Box><Typography variant="h3">Your Orbit settings</Typography><Typography variant="body2" color="text.secondary">Make your workspace work for you.</Typography></Box><IconButton onClick={onClose} sx={{ ml: 'auto' }}><X size={19}/></IconButton></DialogTitle><DialogContent><Stack spacing={2.3} sx={{ pt: 1 }}>
    <Paper className="settings-section" elevation={0}><Box className="settings-row"><Box><Typography fontWeight={800}>Study check-in reminders</Typography><Typography variant="body2" color="text.secondary">Choose a rhythm that works for you.</Typography></Box><Switch checked={state.reminders.enabled} onChange={(e) => onToggle(e.target.checked)} /></Box><Divider sx={{ my: 1.5 }}/><Typography variant="caption" color="text.secondary" fontWeight={800}>REMIND ME EVERY</Typography><Box className="interval-options">{[{ label: '30 min', value: 30 }, { label: '1 hour', value: 60 }, { label: '2 hours', value: 120 }, { label: '3 hours', value: 180 }].map((item) => <button key={item.value} className={state.reminders.intervalMinutes === item.value ? 'selected' : ''} onClick={() => onInterval(item.value)}>{item.label}</button>)}</Box><Box className="form-two-col"><TextField label="Active from" type="time" value={start} onChange={(e) => setStart(e.target.value)} InputLabelProps={{ shrink: true }}/><TextField label="Active until" type="time" value={end} onChange={(e) => setEnd(e.target.value)} InputLabelProps={{ shrink: true }}/></Box><Button variant="outlined" onClick={() => onTimes(start, end)} disabled={start >= end}>Save active hours</Button><Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>Turning reminders off or dismissing a check-in asks for a reason. Device settings may still allow system notifications to be swiped away.</Typography></Paper>
    <Paper className="settings-section" elevation={0}><Box className="settings-row"><Box><Typography fontWeight={800}>Reminder history</Typography><Typography variant="body2" color="text.secondary">Review your check-ins and the reasons recorded.</Typography></Box><Button onClick={onHistory} size="small">View</Button></Box></Paper>
    <Paper className="settings-section" elevation={0}><Box className="settings-row"><Box><Typography fontWeight={800}>Cloud & data</Typography><Typography variant="body2" color="text.secondary">{cloudConfigured && !demoMode ? 'Connected to your cloud workspace.' : 'Demo mode saves on this device only.'}</Typography></Box><Chip size="small" color={cloudConfigured && !demoMode ? 'success' : 'default'} label={cloudConfigured && !demoMode ? 'Cloud' : 'Local demo'}/></Box>{(!cloudConfigured || demoMode) && <Alert severity="info" sx={{ mt: 1.2 }}>Cloud sync needs the app's Supabase database table and configuration. Local demo data may be lost if app storage is cleared or the app is uninstalled.</Alert>}<Button fullWidth variant="outlined" sx={{ mt: 1.5 }} onClick={() => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `sde-orbit-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url); }}>Export my data</Button></Paper>
    {cloudConfigured && !demoMode && <Button color="error" startIcon={<LogOut size={16}/>} onClick={onLogout} sx={{ alignSelf: 'flex-start' }}>Sign out</Button>}
  </Stack></DialogContent><DialogActions className="dialog-actions"><Button onClick={onClose} variant="contained">Done</Button></DialogActions></Dialog>;
}

function ReasonDialog({ open, action, reason, setReason, otherReason, setOtherReason, onClose, onSubmit }: { open: boolean; action: ReminderAction | null; reason: string; setReason: (s: string) => void; otherReason: string; setOtherReason: (s: string) => void; onClose: () => void; onSubmit: () => void }) {
  const label = action === 'disabled' ? 'turn reminders off' : action === 'snoozed' ? 'snooze this reminder' : action === 'skipped' ? 'skip this check-in' : action === 'paused' ? 'pause this check-in' : 'complete this check-in';
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs"><DialogTitle className="reason-title"><span className="dialog-icon focus"><MessageCircleIcon /></span><Typography variant="h3">Before you {label}</Typography><IconButton onClick={onClose} sx={{ ml: 'auto' }}><X size={18}/></IconButton></DialogTitle><DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>A quick reason helps you understand your habits later. Choose the closest match.</Typography><Stack spacing={1}>{REASONS.map((r) => <button key={r} className={`reason-option ${reason === r ? 'selected' : ''}`} onClick={() => setReason(r)}><span className="reason-radio">{reason === r && <span/>}</span>{r}</button>)}</Stack>{reason === 'Other' && <TextField sx={{ mt: 2 }} label="Tell us why" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} multiline minRows={2} required/>}</DialogContent><DialogActions className="dialog-actions"><Button color="inherit" onClick={onClose}>Go back</Button><Button variant="contained" onClick={onSubmit} disabled={!reason || (reason === 'Other' && !otherReason.trim())}>Save reason</Button></DialogActions></Dialog>;
}
function MessageCircleIcon() { return <Bell size={18}/>; }

function ReminderDialog({ open, state, onAction, onClose }: { open: boolean; state: AppState; onAction: (action: ReminderAction) => void; onClose: () => void }) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs"><DialogTitle className="reminder-dialog-head"><span className="reminder-dialog-icon"><Bell size={21}/></span><Typography variant="h2" sx={{ mt: 1.4 }}>A little check-in</Typography><Typography color="text.secondary" variant="body2" sx={{ mt: 0.6 }}>What’s happening right now?</Typography></DialogTitle><DialogContent><Box className="reminder-context"><span className="mini-wave">✦</span><Typography fontWeight={800}>No judgement. Just awareness.</Typography><Typography color="text.secondary" variant="body2">Record a reason to close this reminder. It becomes part of your history.</Typography></Box><Stack spacing={1.1} sx={{ mt: 2 }}><Button variant="contained" fullWidth onClick={() => onAction('completed')} startIcon={<CheckCircle2 size={17}/>}>I’m on track</Button><Button variant="outlined" fullWidth onClick={() => onAction('snoozed')} startIcon={<Clock3 size={17}/>}>Snooze for 15 minutes</Button><Button variant="text" fullWidth color="inherit" onClick={() => onAction('skipped')}>Skip this check-in</Button></Stack></DialogContent><DialogActions className="dialog-actions"><Button color="inherit" onClick={onClose}>Keep it open</Button><Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>Every response needs a reason.</Typography></DialogActions></Dialog>;
}

function HistoryDialog({ open, state, onClose }: { open: boolean; state: AppState; onClose: () => void }) {
  const items = [...state.reminderHistory, ...state.sessions.map((s) => ({ id: s.id, kind: 'completed' as const, reason: `Focus session · ${s.durationMinutes} minutes on ${topicName(s.topicId)}`, createdAt: s.startedAt }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle className="dialog-title"><span className="dialog-icon focus"><Activity size={19}/></span><Box><Typography variant="h3">Your activity history</Typography><Typography color="text.secondary" variant="body2">A record of showing up, your way.</Typography></Box><IconButton onClick={onClose} sx={{ ml: 'auto' }}><X size={18}/></IconButton></DialogTitle><DialogContent>{items.length === 0 ? <Box className="empty-state compact"><span className="empty-bubble"><Clock3 size={22}/></span><Typography fontWeight={800}>Your history starts here.</Typography><Typography color="text.secondary" variant="body2">Check-ins and focus sessions will appear here.</Typography></Box> : <Box className="history-list">{items.map((item) => <Box className="history-row" key={item.id}><span className={`history-marker kind-${item.kind}`}>{item.kind === 'completed' ? <Check size={14}/> : item.kind === 'skipped' ? <X size={13}/> : <Clock3 size={13}/>}</span><Box sx={{ flex: 1 }}><Typography fontWeight={750}>{item.kind === 'completed' ? 'Completed / checked in' : item.kind === 'skipped' ? 'Skipped check-in' : item.kind === 'snoozed' ? 'Reminder snoozed' : item.kind === 'disabled' ? 'Reminders turned off' : 'Reminder paused'}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{item.reason}</Typography></Box><Typography variant="caption" color="text.secondary">{new Date(item.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Typography></Box>)}</Box>}</DialogContent><DialogActions className="dialog-actions"><Button onClick={onClose} variant="contained">Done</Button></DialogActions></Dialog>;
}
