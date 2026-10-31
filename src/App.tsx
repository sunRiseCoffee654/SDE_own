import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert, Avatar, Badge, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControl, IconButton, InputAdornment, MenuItem,
  Paper, Select, Snackbar, Stack, Switch, TextField, Tooltip, Typography, ListSubheader,
  useMediaQuery,
} from '@mui/material';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { gsap } from 'gsap';
import {
  Activity, AlarmClock, AlertTriangle, ArrowDown, ArrowDownRight, ArrowRight, ArrowUp, ArrowUpDown, ArrowUpRight, Bell, BellOff, BookOpen,
  Briefcase, CalendarDays, Check, CheckCheck, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, CircleHelp,
  Clock3, Cloud, CloudOff, Code2, Coffee, Copy, Download, ExternalLink, FileText, Flame, FolderGit2, FolderKanban, Focus,
  Github, Globe, GraduationCap, HeartPulse, Home, Layers3, Linkedin, ListTodo, LoaderCircle, LockKeyhole, LogOut, Mail, MoreHorizontal,
  NotebookPen, Paperclip, Pencil, Pin, Plus, Rocket, Search, Settings2, ShieldCheck, Sparkles, Star, Target, Timer,
  RotateCcw, Trash2, Trophy, UploadCloud, User, X, Zap,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { cloudConfigured, supabase, CLOUD_TABLE } from './lib/supabase';
import { phases, curatedSdePhases, getOrderedPhases, type Phase } from './data/syllabus';
import {
  defaultState, makeId, todayLocalISO, isSafeResumeDataUrl,
  type AppState, type Task, type Note, type TaskPriority, type ReminderEvent,
  type ResumeApplication, type ApplicationStatus, type PortfolioProject, type ProjectStatus
} from './lib/types';
import { cancelNativeReminders, enableNotifications, scheduleNativeReminders, scheduleNativeSnooze, showBrowserReminder } from './lib/notifications';
import { consumeWidgetAction, syncWidgets } from './lib/widgets';
import { LocalNotifications } from '@capacitor/local-notifications';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

const DEV_LINKS = {
  github: 'https://github.com/sunRiseCoffee654',
  portfolio: 'https://ram654.dev/',
  linkedin: 'https://www.linkedin.com/in/vishnu654/',
  email: 'chennamvishnu123@gmail.com',
} as const;

const openExternalUrl = (url: string) => {
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    window.location.href = url;
  }
};

const MotionBox = motion.create(Box);
const tabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'syllabus', label: 'Syllabus', icon: Layers3 },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'projects', label: 'Projects', icon: FolderGit2 },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'focus', label: 'Focus', icon: Timer },
] as const;
type TabId = typeof tabs[number]['id'];
type ReminderAction = 'completed' | 'skipped' | 'snoozed' | 'disabled' | 'paused';
const STATUSES = ['Not Started', 'In Progress', 'Needs Revision', 'Mastered'] as const;
const REASONS = ['Taking a short break', 'Working on another task', 'Need more time', 'Not feeling well', 'Completed my planned work', 'Other'];
const localKey = (userId: string) => `sde-orbit-state-v2:${userId}`;
const cloneDefault = (): AppState => JSON.parse(JSON.stringify(defaultState)) as AppState;
const readCachedState = (userId: string): AppState | null => {
  try {
    const cached = localStorage.getItem(localKey(userId));
    if (!cached) return null;
    const parsed = JSON.parse(cached) as Partial<AppState>;
    return { ...cloneDefault(), ...parsed, syllabus: parsed.syllabus || [] };
  } catch {
    return null;
  }
};

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
function topicName(topicId: string, customList?: Phase[]) {
  if (!topicId) return 'Personal';
  if (topicId === 'personal') return 'Personal';
  if (topicId === 'general') return 'Other / General';
  const list = customList || [];
  if (topicId?.startsWith('phase-')) {
    const num = parseInt(topicId.replace('phase-', ''), 10);
    const p = list.find((x) => x.id === num);
    if (p) return p.name;
  }
  for (const p of list) {
    const t = p.topics.find((x) => x.id === topicId);
    if (t) return t.name;
    for (const top of p.topics) {
      const sub = top.subtopics?.find((s) => s.id === topicId);
      if (sub) return `${top.name}: ${sub.name}`;
    }
  }
  return topicId;
}

function calculateStreak(sessions: { startedAt: string; completed?: boolean }[]): number {
  const completed = sessions.filter((s) => s.completed !== false && s.startedAt);
  if (!completed.length) return 0;
  const days = Array.from(new Set(completed.map((s) => todayLocalISO(new Date(s.startedAt))))).sort().reverse();
  if (!days.length) return 0;
  const today = todayLocalISO();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = todayLocalISO(yesterdayDate);
  if (days[0] !== today && days[0] !== yesterday) return 0;
  let streak = 0;
  // Use noon to avoid any DST or timezone transition drift during arithmetic
  const checkDate = new Date(`${days[0]}T12:00:00`);
  for (const day of days) {
    const expected = todayLocalISO(checkDate);
    if (day === expected) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function nextRecurrenceDate(dueDate: string, recurrence?: string) {
  if (!dueDate || !recurrence || recurrence === 'Never') return null;
  const next = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(next.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  do {
    next.setDate(next.getDate() + (recurrence === 'Weekly' ? 7 : 1));
    if (recurrence === 'Weekdays') while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  } while (next <= today);
  return todayLocalISO(next);
}

function AuthScreen({ onGuest }: { onGuest?: () => void }) {
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
      <Typography variant="h1" sx={{ fontSize: 32, mt: 2 }}>Orbit</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.65 }}>Your preparation, notes, tasks, and focus sessions — together, and safely synced.</Typography>
      <Box component="form" onSubmit={(e) => { e.preventDefault(); void submit(); }} className="auth-fields" sx={{ mt: 3 }}>
        <TextField label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
        {error && <Alert severity="error">{error}</Alert>}
        {message && <Alert severity="info">{message}</Alert>}
        <Button type="submit" variant="contained" size="large" disabled={busy || !email.includes('@') || password.length < 6} endIcon={busy ? <CircularProgress size={16} color="inherit" /> : <ArrowRight size={18} />}>
          {mode === 'signup' ? 'Create your account' : 'Sign in to your Orbit'}
        </Button>
        <Button variant="text" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setMessage(''); }}>
          {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </Button>
        {onGuest && <>
          <Divider sx={{ my: 1.5 }}><Typography variant="caption" color="text.secondary">OR</Typography></Divider>
          <Button variant="outlined" color="inherit" onClick={onGuest} startIcon={<Rocket size={16} />} sx={{ borderRadius: 3, fontWeight: 700 }}>
            Continue as Guest (Offline Mode)
          </Button>
        </>}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', gap: 0.7, justifyContent: 'center', alignItems: 'center', mt: 3 }}><ShieldCheck size={14} /> Your private study data belongs to your account.</Typography>
    </MotionBox>
  </Box>;
}

function ConfigurationRequired({ onGuest }: { onGuest?: () => void }) {
  return <Box className="auth-shell"><Paper className="auth-card" elevation={0}>
    <Box className="brand-mark"><OrbitMark /></Box>
    <Typography variant="h1" sx={{ fontSize: 32, mt: 2 }}>Set up Orbit</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.65 }}>This build requires Supabase for cloud sync, or you can explore in offline guest mode.</Typography>
    <Alert severity="info" sx={{ mt: 3 }}>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code> for cloud sync.</Alert>
    {onGuest && <Button variant="contained" sx={{ mt: 2.5 }} onClick={onGuest} startIcon={<Rocket size={17} />}>Continue in Offline Guest Mode</Button>}
  </Paper></Box>;
}

function OrbitMark() {
  return <img src="/logo.png" alt="Orbit" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 'inherit' }} />;
}

export default function App() {
  const reducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [tabHistory, setTabHistory] = useState<TabId[]>(['home']);
  const lastBackPressRef = useRef<number>(0);

  const navigateToTab = useCallback((nextTab: TabId) => {
    setActiveTab(nextTab);
    setSearch('');
    setTabHistory((prev) => {
      if (prev[prev.length - 1] === nextTab) return prev;
      return [...prev, nextTab];
    });
    try {
      window.history.pushState({ tab: nextTab }, '', `#${nextTab}`);
    } catch {
      // ignore
    }
  }, []);
  const [state, setState] = useState<AppState>(cloneDefault);
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'offline' | 'error'>('offline');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [expandedPhase, setExpandedPhase] = useState<number | null>(1);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [taskDialog, setTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [noteDialog, setNoteDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [resumesOpen, setResumesOpen] = useState(false);
  const [resumeDialog, setResumeDialog] = useState(false);
  const [editingResume, setEditingResume] = useState<ResumeApplication | null>(null);
  const [projectDialog, setProjectDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<PortfolioProject | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<ReminderAction | null>(null);
  const [pendingReminder, setPendingReminder] = useState(false);
  const [reason, setReason] = useState('Taking a short break');
  const [otherReason, setOtherReason] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [timerLength, setTimerLength] = useState(25);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; title: string; message: string; action: () => void }>({ open: false, title: '', message: '', action: () => {} });
  const [newPhaseOpen, setNewPhaseOpen] = useState(false);
  const requestDelete = useCallback((title: string, message: string, action: () => void) => {
    setConfirmDelete({ open: true, title, message, action });
  }, []);
  const timerEndTimeRef = useRef<number | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const syncTimerRef = useRef<number | null>(null);
  const snoozeTimerRef = useRef<number | null>(null);
  const isBusyHydrating = useRef(false);
  const [toastAction, setToastAction] = useState<{ label: string; onClick: () => void } | null>(null);
  const lastDeletedTaskRef = useRef<Task | null>(null);
  const lastDeletedNoteRef = useRef<Note | null>(null);
  const lastDeletedProjectRef = useRef<PortfolioProject | null>(null);
  const lastDeletedResumeRef = useRef<ResumeApplication | null>(null);

  const backHandlerStateRef = useRef({
    quickAddOpen,
    taskDialog,
    noteDialog,
    projectDialog,
    resumeDialog,
    resumesOpen,
    settingsOpen,
    historyOpen,
    reorderOpen,
    pendingAction,
    pendingReminder,
    activeTab,
    tabHistory,
  });

  backHandlerStateRef.current = {
    quickAddOpen,
    taskDialog,
    noteDialog,
    projectDialog,
    resumeDialog,
    resumesOpen,
    settingsOpen,
    historyOpen,
    reorderOpen,
    pendingAction,
    pendingReminder,
    activeTab,
    tabHistory,
  };

  useEffect(() => {
    let backListener: { remove: () => void } | null = null;

    const handleBack = () => {
      const s = backHandlerStateRef.current;

      // 1. Close open dialogs or quick action popup
      if (s.quickAddOpen) {
        setQuickAddOpen(false);
        return true;
      }
      if (s.taskDialog) {
        setTaskDialog(false);
        setEditingTask(null);
        return true;
      }
      if (s.noteDialog) {
        setNoteDialog(false);
        setEditingNote(null);
        return true;
      }
      if (s.projectDialog) {
        setProjectDialog(false);
        setEditingProject(null);
        return true;
      }
      if (s.resumeDialog) {
        setResumeDialog(false);
        setEditingResume(null);
        return true;
      }
      if (s.resumesOpen) {
        setResumesOpen(false);
        return true;
      }
      if (s.settingsOpen) {
        setSettingsOpen(false);
        return true;
      }
      if (s.historyOpen) {
        setHistoryOpen(false);
        return true;
      }
      if (s.reorderOpen) {
        setReorderOpen(false);
        return true;
      }
      if (s.pendingAction) {
        setPendingAction(null);
        return true;
      }
      if (s.pendingReminder) {
        setPendingReminder(false);
        return true;
      }

      // 2. Navigate back to previous tab
      if (s.activeTab !== 'home') {
        if (s.tabHistory.length > 1) {
          const nextHistory = [...s.tabHistory];
          nextHistory.pop(); // remove current tab
          const prevTab = nextHistory[nextHistory.length - 1] || 'home';
          setTabHistory(nextHistory);
          setActiveTab(prevTab);
        } else {
          setActiveTab('home');
          setTabHistory(['home']);
        }
        return true;
      }

      // 3. On Home tab: double back press to exit
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        void CapApp.exitApp();
      } else {
        lastBackPressRef.current = now;
        setToast('Press back again to exit.');
      }
      return true;
    };

    void CapApp.addListener('backButton', () => {
      handleBack();
    }).then((handle) => {
      backListener = handle;
    }).catch(() => {
      // not on native platform
    });

    const onPopState = () => {
      handleBack();
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      if (backListener) {
        void backListener.remove();
      }
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#f6f8fc' }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!cloudConfigured || !supabase) { setAuthChecked(true); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setAuthChecked(true);
    }).catch(() => setAuthChecked(true));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthChecked(true);
    });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) { setHydrated(false); return; }
    if (session.user.id === 'guest') {
      isBusyHydrating.current = true;
      setHydrated(false);
      const cached = readCachedState('guest') || cloneDefault();
      setState(cached);
      setSyncStatus('offline');
      setHydrated(true);
      isBusyHydrating.current = false;
      return;
    }
    if (!supabase) { setHydrated(false); return; }
    let cancelled = false;
    isBusyHydrating.current = true;
    setHydrated(false);
    setState(cloneDefault());
    setSyncStatus('syncing');
    (async () => {
      try {
        const { data, error } = await supabase!.from(CLOUD_TABLE).select('data, updated_at').eq('user_id', session.user.id).maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        const local = readCachedState(session.user.id) || (session.user.id !== 'guest' ? readCachedState('guest') : null);
        const localTime = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0;
        const cloudTime = data?.updated_at ? new Date(data.updated_at).getTime() : 0;

        if (local && localTime > cloudTime) {
          // Local changes are newer than cloud row (e.g. prior upsert failed during offline period)
          setState(local);
          setSyncStatus('syncing');
          void Promise.resolve(
            supabase!.from(CLOUD_TABLE).upsert(
              { user_id: session.user.id, data: local, updated_at: new Date().toISOString() },
              { onConflict: 'user_id' }
            )
          ).then(({ error: syncErr }) => {
            if (syncErr) throw syncErr;
            setSyncStatus('synced');
          }).catch((e: unknown) => {
            console.warn('Background recovery sync failed', e);
            setSyncStatus(navigator.onLine ? 'error' : 'offline');
          });
        } else if (data?.data) {
          setState({ ...cloneDefault(), ...(data.data as Partial<AppState>) });
          setSyncStatus('synced');
        } else {
          setState(local || cloneDefault());
          setSyncStatus('synced');
        }
      } catch (e) {
        console.warn('Cloud load failed', e);
        if (!cancelled) {
          setState(readCachedState(session.user.id) || (session.user.id !== 'guest' ? readCachedState('guest') : null) || cloneDefault());
          setSyncStatus(navigator.onLine ? 'error' : 'offline');
        }
      } finally {
        if (!cancelled) { setHydrated(true); isBusyHydrating.current = false; }
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  const syncNow = useCallback(async (customState?: AppState) => {
    const currentState = customState || state;
    const userId = session?.user?.id;
    if (!supabase || !userId || userId === 'guest') return;
    setSyncStatus('syncing');
    try {
      const { error } = await supabase.from(CLOUD_TABLE).upsert(
        { user_id: userId, data: currentState, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
      setSyncStatus('synced');
    } catch (e) {
      console.warn('Manual/auto sync failed', e);
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    }
  }, [state, session?.user?.id]);

  useEffect(() => {
    const handleOnline = () => {
      setToast('Connected to network. Syncing latest workspace...');
      void syncNow();
    };
    const handleOffline = () => {
      setSyncStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncNow]);

  useEffect(() => {
    if (!hydrated || isBusyHydrating.current) return;
    const userId = session?.user?.id;
    if (!userId) return;
    const key = localKey(userId);
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      console.warn('Local storage write failed (quota might be exceeded):', err);
    }
    if (userId === 'guest') {
      setSyncStatus('offline');
      return;
    }
    if (!supabase) return;
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
  }, [state, hydrated, session?.user?.id]);

  useEffect(() => {
    if (reducedMotion || !headerRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo('.hero-animate', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.07, ease: 'power3.out', clearProps: 'all' });
    }, headerRef);
    return () => ctx.revert();
  }, [activeTab, reducedMotion]);

  useEffect(() => {
    if (!timerRunning) {
      timerEndTimeRef.current = null;
      return;
    }
    if (!timerEndTimeRef.current) {
      const validRemaining = remainingSeconds > 0 ? remainingSeconds : timerLength * 60;
      if (remainingSeconds <= 0) setRemainingSeconds(validRemaining);
      timerEndTimeRef.current = Date.now() + validRemaining * 1000;
    }

    const checkTimer = () => {
      if (!timerEndTimeRef.current) return;
      const left = Math.max(0, Math.ceil((timerEndTimeRef.current - Date.now()) / 1000));
      setRemainingSeconds(left);
      if (left <= 0) {
        setTimerRunning(false);
        timerEndTimeRef.current = null;
        const durationMinutes = Math.max(1, timerLength);
        updateState((old) => ({
          ...old,
          sessions: [
            { id: makeId(), topicId: selectedTopic, startedAt: new Date(Date.now() - durationMinutes * 60000).toISOString(), durationMinutes, completed: true },
            ...old.sessions,
          ],
        }));
        setToast('Focus session complete. Nicely done!');
      }
    };

    const timer = window.setInterval(checkTimer, 500);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkTimer();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
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
      const key = `sde-orbit-last-reminder:${session?.user?.id || 'anonymous'}`;
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
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    let handle: { remove: () => Promise<void> } | undefined;
    LocalNotifications.addListener('localNotificationActionPerformed', () => {
      if (!cancelled) setPendingReminder(true);
    })
      .then((listener) => {
        if (cancelled) void listener.remove();
        else handle = listener;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (handle) void handle.remove();
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !state.reminders.enabled) return;
    void scheduleNativeReminders(state.reminders.intervalMinutes, state.reminders.startTime, state.reminders.endTime);
  }, [hydrated, state.reminders.enabled]);

  const updateState = useCallback((update: (old: AppState) => AppState) => setState((old) => {
    const next = update(old);
    return { ...next, updatedAt: new Date().toISOString() };
  }), []);

  const today = todayLocalISO();
  const currentSyllabus = useMemo(() => state.syllabus || [], [state.syllabus]);
  const orderedPhases = useMemo(() => getOrderedPhases(currentSyllabus, state.phaseOrder), [currentSyllabus, state.phaseOrder]);
  const allTopics = useMemo(() => currentSyllabus.flatMap((p) => p.topics), [currentSyllabus]);
  const masteredCount = useMemo(() => allTopics.filter((t) => state.topicStatus[t.id] === 'Mastered').length, [allTopics, state.topicStatus]);
  const inProgressCount = useMemo(() => allTopics.filter((t) => state.topicStatus[t.id] === 'In Progress').length, [allTopics, state.topicStatus]);
  const revisionCount = useMemo(() => allTopics.filter((t) => state.topicStatus[t.id] === 'Needs Revision').length, [allTopics, state.topicStatus]);
  const overallProgress = percent(masteredCount, allTopics.length);
  const todaysTasks = useMemo(() => state.tasks.filter((t) => !t.done && (!t.dueDate || t.dueDate <= today)), [state.tasks, today]);
  const completedToday = useMemo(() => state.tasks.filter((t) => t.done && (t.completedAt ? todayLocalISO(new Date(t.completedAt)) === today : t.dueDate === today)).length, [state.tasks, today]);
  const totalMinutes = useMemo(() => state.sessions.reduce((sum, s) => sum + s.durationMinutes, 0), [state.sessions]);
  const streak = useMemo(() => calculateStreak(state.sessions), [state.sessions]);

  useEffect(() => {
    if (!hydrated || !session?.user?.id) return;
    const nextTask = state.tasks.find((task) => !task.done && (!task.dueDate || task.dueDate <= today));
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    void syncWidgets({
      taskTitle: nextTask?.title || 'No tasks due today',
      taskDetail: nextTask ? `${topicName(nextTask.topicId)} · ${nextTask.priority} priority` : 'Plan one small next step',
      taskCount: todaysTasks.length,
      focusTopic: topicName(selectedTopic),
      focusTime: timerRunning ? `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${String(timerLength).padStart(2, '0')}:00`,
      streak,
    });
  }, [hydrated, session?.user?.id, state.tasks, streak, todaysTasks.length, timerRunning, timerLength, selectedTopic, today]);

  useEffect(() => {
    if (!hydrated || !session?.user?.id) return;
    const checkWidgetAction = () => {
      void consumeWidgetAction().then(({ tab }) => {
        if (tab === 'tasks') navigateToTab('tasks');
        if (tab === 'focus') {
          navigateToTab('focus');
          if (!timerRunning) {
            timerEndTimeRef.current = Date.now() + remainingSeconds * 1000;
            setTimerRunning(true);
          }
        }
      });
    };
    checkWidgetAction();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkWidgetAction();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [hydrated, session?.user?.id, remainingSeconds, timerRunning]);

  const logout = async () => {
    if (snoozeTimerRef.current) window.clearTimeout(snoozeTimerRef.current);
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    const uid = session?.user?.id;
    if (supabase && uid && uid !== 'guest') await supabase.auth.signOut();
    if (uid) {
      try {
        localStorage.removeItem(localKey(uid));
        localStorage.removeItem(`sde-orbit-last-reminder:${uid}`);
      } catch {}
    }
    setSession(null);
    setState(cloneDefault());
    setActiveTab('home');
    setTabHistory(['home']);
    setToast('Signed out.');
  };
  const openReason = (action: ReminderAction) => { setPendingAction(action); setReason('Taking a short break'); setOtherReason(''); };

  const submitReason = async () => {
    if (!pendingAction) return;
    const finalReason = reason === 'Other' ? otherReason.trim() : reason;
    if (!finalReason) return;
    const event: ReminderEvent = { id: makeId(), kind: pendingAction, reason: finalReason, createdAt: new Date().toISOString() };
    updateState((old) => ({ ...old, reminderHistory: [event, ...old.reminderHistory].slice(0, 300), reminders: pendingAction === 'disabled' ? { ...old.reminders, enabled: false } : old.reminders }));
    if (pendingAction === 'disabled') {
      await cancelNativeReminders();
      setPendingReminder(false);
      setToast('Reminders turned off. Your reason was saved.');
    } else if (pendingAction === 'snoozed') {
      setPendingReminder(false);
      setToast('Reminder snoozed for 15 minutes.');
      const nativeSnoozeScheduled = await scheduleNativeSnooze();
      if (!nativeSnoozeScheduled && 'Notification' in window && Notification.permission === 'granted') {
        if (snoozeTimerRef.current) window.clearTimeout(snoozeTimerRef.current);
        snoozeTimerRef.current = window.setTimeout(() => {
          new Notification('Orbit check-in ⏰', { body: 'Your reminder snooze is over.' });
          setPendingReminder(true);
        }, 15 * 60_000);
      }
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
    localStorage.setItem(`sde-orbit-last-reminder:${session?.user?.id || 'anonymous'}`, String(Date.now()));
    await scheduleNativeReminders(state.reminders.intervalMinutes, state.reminders.startTime, state.reminders.endTime);
    setToast('Reminders enabled. You can adjust the interval anytime.');
  };

  const updateInterval = async (minutes: number) => {
    updateState((old) => ({ ...old, reminders: { ...old.reminders, intervalMinutes: minutes } }));
    if (state.reminders.enabled) await scheduleNativeReminders(minutes, state.reminders.startTime, state.reminders.endTime);
  };
  const toggleTask = (id: string) => updateState((old) => {
    const task = old.tasks.find((item) => item.id === id);
    if (!task) return old;
    const nowDone = !task.done;
    const nextDueDate = nowDone ? nextRecurrenceDate(task.dueDate, task.recurrence) : null;
    const alreadyExists = nextDueDate
      ? old.tasks.some((t) => !t.done && t.title === task.title && t.topicId === task.topicId && t.dueDate === nextDueDate)
      : false;
    const nextTask = (nextDueDate && !alreadyExists) ? { ...task, id: makeId(), dueDate: nextDueDate, done: false, createdAt: new Date().toISOString(), completedAt: undefined } : null;
    return {
      ...old,
      tasks: [
        ...(nextTask ? [nextTask] : []),
        ...old.tasks.map((item) => item.id === id ? { ...item, done: nowDone, completedAt: nowDone ? new Date().toISOString() : undefined } : item)
      ]
    };
  });

  const saveTask = (draft: Omit<Task, 'id' | 'createdAt' | 'done'> & Partial<Pick<Task, 'id' | 'createdAt' | 'done'>>) => {
    const task: Task = { id: draft.id || makeId(), title: draft.title, description: draft.description, dueDate: draft.dueDate, priority: draft.priority, topicId: draft.topicId, recurrence: draft.recurrence || 'Never', done: draft.done || false, createdAt: draft.createdAt || new Date().toISOString() };
    updateState((old) => ({ ...old, tasks: draft.id ? old.tasks.map((t) => t.id === draft.id ? task : t) : [task, ...old.tasks] }));
    setTaskDialog(false); setEditingTask(null); setToast(draft.id ? 'Task updated.' : 'Task added.');
  };

  const deleteTask = (id: string) => {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    lastDeletedTaskRef.current = task;
    updateState((old) => ({ ...old, tasks: old.tasks.filter((t) => t.id !== id) }));
    setToastAction({
      label: 'Undo',
      onClick: () => {
        if (lastDeletedTaskRef.current) {
          const item = lastDeletedTaskRef.current;
          updateState((old) => ({ ...old, tasks: [item, ...old.tasks] }));
          lastDeletedTaskRef.current = null;
          setToastAction(null);
          setToast('Task restored.');
        }
      },
    });
    setToast(`Task "${task.title.slice(0, 20)}" deleted.`);
  };

  const deleteNote = (id: string) => {
    const note = state.notes.find((n) => n.id === id);
    if (!note) return;
    lastDeletedNoteRef.current = note;
    updateState((old) => ({ ...old, notes: old.notes.filter((n) => n.id !== id) }));
    setToastAction({
      label: 'Undo',
      onClick: () => {
        if (lastDeletedNoteRef.current) {
          const item = lastDeletedNoteRef.current;
          updateState((old) => ({ ...old, notes: [item, ...old.notes] }));
          lastDeletedNoteRef.current = null;
          setToastAction(null);
          setToast('Note restored.');
        }
      },
    });
    setToast(`Note "${note.title.slice(0, 20)}" deleted.`);
  };

  const deleteProject = (id: string) => {
    const proj = state.projects.find((p) => p.id === id);
    if (!proj) return;
    lastDeletedProjectRef.current = proj;
    updateState((old) => ({ ...old, projects: old.projects.filter((p) => p.id !== id) }));
    setToastAction({
      label: 'Undo',
      onClick: () => {
        if (lastDeletedProjectRef.current) {
          const item = lastDeletedProjectRef.current;
          updateState((old) => ({ ...old, projects: [item, ...old.projects] }));
          lastDeletedProjectRef.current = null;
          setToastAction(null);
          setToast('Project restored.');
        }
      },
    });
    setToast(`Project "${proj.title.slice(0, 20)}" deleted.`);
  };

  const deleteResumeApplication = (id: string) => {
    const res = state.resumes.find((r) => r.id === id);
    if (!res) return;
    lastDeletedResumeRef.current = res;
    updateState((old) => ({ ...old, resumes: old.resumes.filter((r) => r.id !== id) }));
    setToastAction({
      label: 'Undo',
      onClick: () => {
        if (lastDeletedResumeRef.current) {
          const item = lastDeletedResumeRef.current;
          updateState((old) => ({ ...old, resumes: [item, ...old.resumes] }));
          lastDeletedResumeRef.current = null;
          setToastAction(null);
          setToast('Application restored.');
        }
      },
    });
    setToast(`Application for "${res.company}" deleted.`);
  };

  const handleLoadCuratedSyllabus = useCallback(() => {
    updateState((old) => ({
      ...old,
      syllabus: curatedSdePhases,
      phaseOrder: curatedSdePhases.map((p) => p.id),
      updatedAt: new Date().toISOString(),
    }));
    setToast('Curated SDE Roadmap (12 phases) imported.');
  }, [updateState]);

  const handleReorderPhase = useCallback((phaseId: number, direction: 'up' | 'down') => {
    updateState((old) => {
      const base = old.syllabus || [];
      const currentOrder = old.phaseOrder && old.phaseOrder.length > 0
        ? [...old.phaseOrder]
        : base.map((p) => p.id);
      const index = currentOrder.indexOf(phaseId);
      if (index === -1) return old;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= currentOrder.length) return old;
      const temp = currentOrder[index];
      currentOrder[index] = currentOrder[targetIndex];
      currentOrder[targetIndex] = temp;
      return {
        ...old,
        phaseOrder: currentOrder,
        updatedAt: new Date().toISOString(),
      };
    });
    setToast('Syllabus order updated.');
  }, [updateState]);

  const handleResetPhaseOrder = useCallback(() => {
    updateState((old) => {
      const base = old.syllabus || [];
      return {
        ...old,
        phaseOrder: base.map((p) => p.id),
        updatedAt: new Date().toISOString(),
      };
    });
    setToast('Restored default syllabus order.');
  }, [updateState]);

  const handleAddPhase = useCallback((name: string, tags: string[], color: string) => {
    const newId = Date.now();
    const newPhase: Phase = {
      id: newId,
      name: name.trim(),
      tags: tags.length > 0 ? tags : ['Custom'],
      topics: [],
      color: color || '#5774E8',
      icon: 'code',
      isCustom: true,
    };
    updateState((old) => {
      const base = old.syllabus || [];
      const nextSyllabus = [...base, newPhase];
      const nextOrder = old.phaseOrder ? [...old.phaseOrder, newId] : nextSyllabus.map((p) => p.id);
      return { ...old, syllabus: nextSyllabus, phaseOrder: nextOrder };
    });
    setToast(`Topic "${name}" created.`);
  }, [updateState]);

  const handleDeletePhase = useCallback((phaseId: number) => {
    updateState((old) => {
      const base = old.syllabus || [];
      const nextSyllabus = base.filter((p) => p.id !== phaseId);
      const nextOrder = (old.phaseOrder || []).filter((id) => id !== phaseId);
      return { ...old, syllabus: nextSyllabus, phaseOrder: nextOrder };
    });
    setToast('Phase deleted.');
  }, [updateState]);

  const handleAddTopic = useCallback((phaseId: number, name: string) => {
    if (!name.trim()) return;
    const newTopicId = `custom-p${phaseId}-t${Date.now()}`;
    updateState((old) => {
      const base = old.syllabus || [];
      const nextSyllabus = base.map((phase) => {
        if (phase.id !== phaseId) return phase;
        const newTopic = { id: newTopicId, name: name.trim(), subtopics: [] };
        return { ...phase, topics: [...phase.topics, newTopic] };
      });
      return { ...old, syllabus: nextSyllabus };
    });
    setToast(`Sub-heading "${name}" added.`);
  }, [updateState]);

  const handleDeleteTopic = useCallback((phaseId: number, topicId: string) => {
    updateState((old) => {
      const base = old.syllabus || [];
      const nextSyllabus = base.map((phase) => {
        if (phase.id !== phaseId) return phase;
        return { ...phase, topics: phase.topics.filter((t) => t.id !== topicId) };
      });
      const nextStatus = { ...old.topicStatus };
      delete nextStatus[topicId];
      return { ...old, syllabus: nextSyllabus, topicStatus: nextStatus };
    });
    setToast('Sub-heading deleted.');
  }, [updateState]);

  const handleAddSubtopic = useCallback((phaseId: number, topicId: string, subName: string) => {
    if (!subName.trim()) return;
    const newSubId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    updateState((old) => {
      const base = old.syllabus || [];
      const nextSyllabus = base.map((phase) => {
        if (phase.id !== phaseId) return phase;
        const nextTopics = phase.topics.map((t) => {
          if (t.id !== topicId) return t;
          const currentSubs = t.subtopics || [];
          return { ...t, subtopics: [...currentSubs, { id: newSubId, name: subName.trim() }] };
        });
        return { ...phase, topics: nextTopics };
      });
      return { ...old, syllabus: nextSyllabus };
    });
    setToast(`Detailed topic "${subName}" added.`);
  }, [updateState]);

  const handleDeleteSubtopic = useCallback((phaseId: number, topicId: string, subId: string) => {
    updateState((old) => {
      const base = old.syllabus || [];
      const nextSyllabus = base.map((phase) => {
        if (phase.id !== phaseId) return phase;
        const nextTopics = phase.topics.map((t) => {
          if (t.id !== topicId) return t;
          return { ...t, subtopics: (t.subtopics || []).filter((s) => s.id !== subId) };
        });
        return { ...phase, topics: nextTopics };
      });
      const nextSubStatus = { ...(old.subtopicStatus || {}) };
      delete nextSubStatus[subId];
      return { ...old, syllabus: nextSyllabus, subtopicStatus: nextSubStatus };
    });
    setToast('Detailed topic deleted.');
  }, [updateState]);

  const handleToggleSubtopic = useCallback((subId: string) => {
    updateState((old) => ({
      ...old,
      subtopicStatus: {
        ...(old.subtopicStatus || {}),
        [subId]: !old.subtopicStatus?.[subId],
      },
    }));
  }, [updateState]);

  const startFocusSession = (durationMins: number = 25) => {
    setTimerLength(durationMins);
    const totalSecs = durationMins * 60;
    setRemainingSeconds(totalSecs);
    timerEndTimeRef.current = Date.now() + totalSecs * 1000;
    setTimerRunning(true);
    navigateToTab('focus');
  };

  const handleImportState = (imported: Partial<AppState>) => {
    if (!imported || typeof imported !== 'object') {
      setToast('Invalid backup file.');
      return;
    }
    updateState((old) => ({
      ...old,
      tasks: Array.isArray(imported.tasks) ? imported.tasks : old.tasks,
      notes: Array.isArray(imported.notes) ? imported.notes : old.notes,
      projects: Array.isArray(imported.projects) ? imported.projects : old.projects,
      sessions: Array.isArray(imported.sessions) ? imported.sessions : old.sessions,
      resumes: Array.isArray(imported.resumes) ? imported.resumes : old.resumes,
      syllabus: Array.isArray(imported.syllabus) ? imported.syllabus : old.syllabus,
      subtopicStatus: imported.subtopicStatus && typeof imported.subtopicStatus === 'object' ? imported.subtopicStatus : old.subtopicStatus,
      topicStatus: imported.topicStatus && typeof imported.topicStatus === 'object' ? imported.topicStatus : old.topicStatus,
      reminderHistory: Array.isArray(imported.reminderHistory) ? imported.reminderHistory : old.reminderHistory,
    }));
    setToast('Backup data successfully restored.');
  };
  const saveNote = (draft: Omit<Note, 'id' | 'updatedAt'> & Partial<Pick<Note, 'id' | 'updatedAt'>>) => {
    const note: Note = { ...draft, id: draft.id || makeId(), updatedAt: new Date().toISOString() };
    updateState((old) => ({ ...old, notes: draft.id ? old.notes.map((n) => n.id === draft.id ? note : n) : [note, ...old.notes] }));
    setNoteDialog(false); setEditingNote(null); setToast(draft.id ? 'Note updated.' : 'Note saved.');
  };

  const saveResumeApplication = (draft: Omit<ResumeApplication, 'id' | 'createdAt'> & Partial<Pick<ResumeApplication, 'id' | 'createdAt'>>) => {
    const app: ResumeApplication = {
      id: draft.id || makeId(),
      company: draft.company,
      role: draft.role,
      whereApplied: draft.whereApplied,
      appliedDate: draft.appliedDate,
      status: draft.status,
      fileName: draft.fileName,
      fileSize: draft.fileSize,
      fileType: draft.fileType,
      fileData: draft.fileData,
      notes: draft.notes,
      createdAt: draft.createdAt || new Date().toISOString(),
    };
    updateState((old) => ({
      ...old,
      resumes: draft.id ? (old.resumes || []).map((r) => (r.id === draft.id ? app : r)) : [app, ...(old.resumes || [])],
    }));
    setResumeDialog(false);
    setEditingResume(null);
    setToast(draft.id ? 'Application updated.' : 'Resume & application saved.');
  };

  const saveProject = (draft: Omit<PortfolioProject, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<PortfolioProject, 'id' | 'createdAt' | 'updatedAt'>>) => {
    const now = new Date().toISOString();
    const proj: PortfolioProject = {
      id: draft.id || makeId(),
      title: draft.title,
      tagline: draft.tagline,
      summary: draft.summary,
      githubUrl: draft.githubUrl,
      liveUrl: draft.liveUrl,
      techStack: draft.techStack || [],
      status: draft.status || 'Active',
      featured: draft.featured ?? false,
      challenges: draft.challenges,
      starStory: draft.starStory,
      createdAt: draft.createdAt || now,
      updatedAt: now,
    };
    updateState((old) => ({
      ...old,
      projects: draft.id ? (old.projects || []).map((p) => (p.id === draft.id ? proj : p)) : [proj, ...(old.projects || [])],
    }));
    setProjectDialog(false);
    setEditingProject(null);
    setToast(draft.id ? 'Project updated.' : 'Project added to portfolio.');
  };

  const toggleFeaturedProject = (id: string) => {
    updateState((old) => ({
      ...old,
      projects: (old.projects || []).map((p) => (p.id === id ? { ...p, featured: !p.featured, updatedAt: new Date().toISOString() } : p)),
    }));
    setToast('Project pin updated.');
  };
  const setTopicStatus = (topicId: string, value: AppState['topicStatus'][string]) => updateState((old) => ({ ...old, topicStatus: { ...old.topicStatus, [topicId]: value } }));

  const handleGuestLogin = () => {
    const guestSession: Session = {
      access_token: 'guest-token',
      token_type: 'bearer',
      expires_in: 31536000,
      refresh_token: 'guest-refresh',
      user: {
        id: 'guest',
        app_metadata: {},
        user_metadata: { full_name: 'Guest Explorer' },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email: 'guest@sdeorbit.local',
      },
    };
    setSession(guestSession);
    setToast('Welcome to Orbit (Guest Mode)!');
  };

  const isGuest = session?.user?.id === 'guest';

  if (!cloudConfigured && !session) return <ConfigurationRequired onGuest={handleGuestLogin} />;
  if (!authChecked && !session) return <Box className="loading-shell"><CircularProgress /><Typography color="text.secondary">Preparing your workspace…</Typography></Box>;
  if (!session) return <AuthScreen onGuest={handleGuestLogin} />;
  if (!hydrated) return <Box className="loading-shell"><CircularProgress /><Typography color="text.secondary">Syncing your Orbit…</Typography></Box>;

  return <MotionConfig reducedMotion="user" transition={{ duration: reducedMotion ? 0 : 0.22 }}>
    <Box className="app-shell">
      <Box className="app-topbar">
        <Box className="brand-lockup" onClick={() => navigateToTab('home')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateToTab('home'); } }} role="button" tabIndex={0}>
          <Box className="brand-mark small"><OrbitMark /></Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography className="brand-name">orbit<span>.</span></Typography>
            <Typography className="brand-caption">Learning Path</Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={{ xs: 0.8, sm: 1.2 }} alignItems="center" sx={{ flexShrink: 0 }}>
          <Tooltip title={isGuest ? 'Guest Mode (Stored locally). Click for info.' : `Sync Status: ${syncStatusLabel(syncStatus, isGuest)} (Click to sync now)`}>
            <Box
              className={`sync-pill sync-${isGuest ? 'synced' : syncStatus}`}
              onClick={() => {
                if (!isGuest) {
                  void syncNow();
                } else {
                  setToast('Guest mode: changes saved locally. Sign in from Profile to sync to cloud.');
                }
              }}
            >
              <span className="sync-dot" />
              <span>{syncStatusLabel(syncStatus, isGuest)}</span>
            </Box>
          </Tooltip>
          <IconButton
            className="top-icon"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            <Settings2 size={18} />
          </IconButton>
          <Tooltip title="Profile & Settings">
            <IconButton className="profile-button" onClick={() => setSettingsOpen(true)} aria-label="Open profile & settings">
              <Avatar className="profile-avatar">{session.user.email?.slice(0, 1).toUpperCase() || 'V'}</Avatar>
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Box className="app-content" ref={headerRef}>
        <AnimatePresence mode="wait" initial={false}>
          <MotionBox key={activeTab} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: -4 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>
            {activeTab === 'home' && <Dashboard state={state} progress={overallProgress} mastered={masteredCount} totalTopics={allTopics.length} inProgress={inProgressCount} revision={revisionCount} todaysTasks={todaysTasks} completedToday={completedToday} totalMinutes={totalMinutes} streak={streak} onGo={navigateToTab} onSettings={() => setSettingsOpen(true)} onTopicStatus={setTopicStatus} onTaskToggle={toggleTask} onReminder={() => setPendingReminder(true)} onNewTask={() => { setEditingTask(null); setTaskDialog(true); }} onStartFocus={() => startFocusSession(25)} onLoadCurated={handleLoadCuratedSyllabus} />}
            {activeTab === 'syllabus' && (
              <Syllabus
                state={state}
                expandedPhase={expandedPhase}
                setExpandedPhase={setExpandedPhase}
                search={search}
                setSearch={setSearch}
                setTopicStatus={setTopicStatus}
                onReorderPhase={handleReorderPhase}
                onOpenReorder={() => setReorderOpen(true)}
                onOpenNewPhase={() => setNewPhaseOpen(true)}
                onAddTopic={handleAddTopic}
                onDeleteTopic={handleDeleteTopic}
                onAddSubtopic={handleAddSubtopic}
                onDeleteSubtopic={handleDeleteSubtopic}
                onToggleSubtopic={handleToggleSubtopic}
                onDeletePhase={handleDeletePhase}
                onRequestDelete={requestDelete}
                onLoadCurated={handleLoadCuratedSyllabus}
              />
            )}
            {activeTab === 'tasks' && (
              <Tasks
                state={state}
                search={search}
                setSearch={setSearch}
                onAdd={() => { setEditingTask(null); setTaskDialog(true); }}
                onEdit={(task) => { setEditingTask(task); setTaskDialog(true); }}
                onToggle={toggleTask}
                onDelete={(id) => {
                  const task = state.tasks.find((t) => t.id === id);
                  requestDelete(
                    'Delete Task',
                    `Are you sure you want to delete task "${task?.title || 'this task'}"?`,
                    () => deleteTask(id)
                  );
                }}
              />
            )}
            {activeTab === 'projects' && (
              <Projects
                state={state}
                search={search}
                setSearch={setSearch}
                onAdd={() => { setEditingProject(null); setProjectDialog(true); }}
                onEdit={(p) => { setEditingProject(p); setProjectDialog(true); }}
                onToggleFeatured={toggleFeaturedProject}
                onDelete={(id) => {
                  const proj = state.projects.find((p) => p.id === id);
                  requestDelete(
                    'Delete Project',
                    `Are you sure you want to delete project "${proj?.title || 'this project'}"?`,
                    () => deleteProject(id)
                  );
                }}
              />
            )}
            {activeTab === 'notes' && (
              <Notes
                state={state}
                search={search}
                setSearch={setSearch}
                onAdd={() => { setEditingNote(null); setNoteDialog(true); }}
                onEdit={(note) => { setEditingNote(note); setNoteDialog(true); }}
                onTogglePin={(id) => updateState((old) => ({ ...old, notes: old.notes.map((n) => n.id === id ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n) }))}
                onDelete={(id) => {
                  const note = state.notes.find((n) => n.id === id);
                  requestDelete(
                    'Delete Note',
                    `Are you sure you want to delete note "${note?.title || 'Untitled note'}"?`,
                    () => deleteNote(id)
                  );
                }}
              />
            )}
            {activeTab === 'focus' && (
              <FocusPage
                state={state}
                selectedTopic={selectedTopic}
                setSelectedTopic={setSelectedTopic}
                timerLength={timerLength}
                setTimerLength={(m) => { setTimerLength(m); setRemainingSeconds(m * 60); setTimerRunning(false); }}
                remainingSeconds={remainingSeconds}
                timerRunning={timerRunning}
                onToggleTimer={() => setTimerRunning((v) => !v)}
                onResetTimer={() => { setTimerRunning(false); setRemainingSeconds(timerLength * 60); }}
                onSettings={() => setSettingsOpen(true)}
                onHistory={() => setHistoryOpen(true)}
              />
            )}
          </MotionBox>
        </AnimatePresence>
      </Box>

      {quickAddOpen && (
        <Box
          sx={{ position: 'fixed', inset: 0, zIndex: 39 }}
          onClick={() => setQuickAddOpen(false)}
        />
      )}

      <Box className="bottom-dock-bar">
        <Box className="floating-nav" role="navigation" aria-label="Main navigation">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${activeTab === id ? 'active' : ''}`}
              onClick={() => navigateToTab(id)}
              aria-current={activeTab === id ? 'page' : undefined}
            >
              <span className="nav-icon-wrap">
                <Icon size={21} strokeWidth={activeTab === id ? 2.4 : 1.9} />
              </span>
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </Box>

        <Box className="fab-dock-item">
          <AnimatePresence>
            {quickAddOpen && (
              <motion.div
                className="quick-actions"
                initial={{ opacity: 0, y: 10, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
              >
                <button onClick={() => { setEditingTask(null); setTaskDialog(true); setQuickAddOpen(false); }}>
                  <span className="quick-icon task"><ListTodo size={17} /></span>
                  <span>New task</span>
                </button>
                <button onClick={() => { setEditingNote(null); setNoteDialog(true); setQuickAddOpen(false); }}>
                  <span className="quick-icon note"><NotebookPen size={17} /></span>
                  <span>New note</span>
                </button>
                <button onClick={() => { setEditingProject(null); setProjectDialog(true); setQuickAddOpen(false); }}>
                  <span className="quick-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}><FolderGit2 size={17} /></span>
                  <span>New project</span>
                </button>
                <button onClick={() => { setEditingResume(null); setResumeDialog(true); setQuickAddOpen(false); }}>
                  <span className="quick-icon" style={{ background: '#eaf0ff', color: '#2547b8' }}><FileText size={17} /></span>
                  <span>Save resume</span>
                </button>
                <button onClick={() => { navigateToTab('focus'); setQuickAddOpen(false); setTimerRunning(true); }}>
                  <span className="quick-icon focus"><Timer size={17} /></span>
                  <span>Start focus</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button
            whileTap={{ scale: 0.92 }}
            className={`main-fab ${quickAddOpen ? 'is-open' : ''}`}
            onClick={() => setQuickAddOpen((v) => !v)}
            aria-label={quickAddOpen ? 'Close quick actions' : 'Add new item'}
          >
            <motion.span animate={{ rotate: quickAddOpen ? 45 : 0 }} transition={{ duration: 0.18 }}>
              <Plus size={22} />
            </motion.span>
          </motion.button>
        </Box>
      </Box>

      <TaskDialog open={taskDialog} initial={editingTask} onClose={() => { setTaskDialog(false); setEditingTask(null); }} onSave={saveTask} orderedPhases={orderedPhases} />
      <NoteDialog open={noteDialog} initial={editingNote} onClose={() => { setNoteDialog(false); setEditingNote(null); }} onSave={saveNote} />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        state={state}
        syncStatus={syncStatus}
        isGuest={isGuest}
        userEmail={session.user.email || 'Guest Explorer'}
        streak={streak}
        totalMinutes={totalMinutes}
        masteredCount={masteredCount}
        onToggle={toggleReminders}
        onInterval={updateInterval}
        onTimes={async (startTime, endTime) => {
          updateState((old) => ({ ...old, reminders: { ...old.reminders, startTime, endTime } }));
          if (state.reminders.enabled && startTime < endTime) await scheduleNativeReminders(state.reminders.intervalMinutes, startTime, endTime);
        }}
        onHistory={() => { setSettingsOpen(false); setHistoryOpen(true); }}
        onResumes={() => { setSettingsOpen(false); setResumesOpen(true); }}
        onProjects={() => { setSettingsOpen(false); navigateToTab('projects'); }}
        onImport={handleImportState}
        onLogout={logout}
      />
      <ProjectFormDialog open={projectDialog} initial={editingProject} onClose={() => { setProjectDialog(false); setEditingProject(null); }} onSave={saveProject} />
      <ResumesDialog
        open={resumesOpen}
        state={state}
        onClose={() => setResumesOpen(false)}
        onAddNew={() => { setEditingResume(null); setResumeDialog(true); }}
        onEdit={(item) => { setEditingResume(item); setResumeDialog(true); }}
        onDelete={(id) => {
          const app = state.resumes.find((r) => r.id === id);
          requestDelete(
            'Delete Application',
            `Are you sure you want to delete application for ${app?.company || 'this company'} (${app?.role || ''})?`,
            () => deleteResumeApplication(id)
          );
        }}
      />
      <ResumeFormDialog open={resumeDialog} initial={editingResume} onClose={() => { setResumeDialog(false); setEditingResume(null); }} onSave={saveResumeApplication} />
      <ReasonDialog open={Boolean(pendingAction)} action={pendingAction} reason={reason} setReason={setReason} otherReason={otherReason} setOtherReason={setOtherReason} onClose={() => setPendingAction(null)} onSubmit={submitReason} />
      <ReminderDialog open={pendingReminder && !pendingAction} state={state} onAction={openReason} onClose={() => setPendingReminder(false)} />
      <HistoryDialog open={historyOpen} state={state} onClose={() => setHistoryOpen(false)} />
      <ReorderSyllabusDialog
        open={reorderOpen}
        onClose={() => setReorderOpen(false)}
        orderedPhases={orderedPhases}
        onMove={handleReorderPhase}
        onReset={handleResetPhaseOrder}
      />
      <ConfirmDeleteDialog
        open={confirmDelete.open}
        title={confirmDelete.title}
        message={confirmDelete.message}
        onConfirm={confirmDelete.action}
        onClose={() => setConfirmDelete((prev) => ({ ...prev, open: false }))}
      />
      <NewPhaseDialog
        open={newPhaseOpen}
        onClose={() => setNewPhaseOpen(false)}
        onCreate={handleAddPhase}
      />
      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => { setToast(''); setToastAction(null); }} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert
          onClose={() => { setToast(''); setToastAction(null); }}
          severity="success"
          variant="filled"
          sx={{ borderRadius: 3, alignItems: 'center' }}
          action={toastAction ? (
            <Button color="inherit" size="small" onClick={toastAction.onClick} sx={{ fontWeight: 800, textTransform: 'none', border: '1px solid rgba(255,255,255,0.4)', ml: 1 }}>
              {toastAction.label}
            </Button>
          ) : undefined}
        >
          {toast}
        </Alert>
      </Snackbar>
    </Box>
  </MotionConfig>;
}

function syncStatusLabel(status: string, isGuest = false) {
  if (isGuest) return 'Guest (Local)';
  return ({ syncing: 'Syncing…', synced: 'Synced', offline: 'Offline', error: 'Sync issue' } as Record<string, string>)[status] || status;
}

function SectionHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <Box className="section-heading hero-animate"><Box>{eyebrow && <Typography className="eyebrow">{eyebrow}</Typography>}<Typography variant="h1">{title}</Typography>{subtitle && <Typography color="text.secondary" sx={{ mt: 0.65 }}>{subtitle}</Typography>}</Box>{action}</Box>;
}

function Dashboard({
  state,
  progress,
  mastered,
  totalTopics,
  inProgress,
  revision,
  todaysTasks,
  completedToday,
  totalMinutes,
  streak,
  onGo,
  onSettings,
  onTopicStatus,
  onTaskToggle,
  onReminder,
  onNewTask,
  onStartFocus,
  onLoadCurated,
}: {
  state: AppState;
  progress: number;
  mastered: number;
  totalTopics: number;
  inProgress: number;
  revision: number;
  todaysTasks: Task[];
  completedToday: number;
  totalMinutes: number;
  streak: number;
  onGo: (tab: TabId) => void;
  onSettings: () => void;
  onTopicStatus: (id: string, status: AppState['topicStatus'][string]) => void;
  onTaskToggle: (id: string) => void;
  onReminder: () => void;
  onNewTask?: () => void;
  onStartFocus?: () => void;
  onLoadCurated?: () => void;
}) {
  const activeSyllabus = useMemo(() => state.syllabus || [], [state.syllabus]);
  const orderedPhases = useMemo(() => getOrderedPhases(activeSyllabus, state.phaseOrder), [activeSyllabus, state.phaseOrder]);
  const currentPhase = orderedPhases.find((phase) => phase.topics.some((topic) => state.topicStatus[topic.id] === 'In Progress')) || orderedPhases[0] || null;
  const currentPhaseIndex = currentPhase ? orderedPhases.findIndex((p) => p.id === currentPhase.id) : -1;
  const displayCurrentPhaseNo = currentPhaseIndex >= 0 ? currentPhaseIndex + 1 : 1;
  const phaseDone = currentPhase ? currentPhase.topics.filter((topic) => state.topicStatus[topic.id] === 'Mastered').length : 0;
  const phaseProgress = currentPhase ? percent(phaseDone, currentPhase.topics.length) : 0;

  return (
    <Box className="home-clean-layout">
      {/* ── 1. Clean Top Greeting ── */}
      <Box className="home-hero-simple hero-animate">
        <Box className="home-hero-text">
          <Typography className="home-date-pill">
            <CalendarDays size={13} /> {relativeDate()}
          </Typography>
          <Typography variant="h1" className="home-hero-title">
            {timeGreeting()}, <span className="gradient-text">let’s make progress.</span>
          </Typography>
          <Typography className="home-hero-subtitle">
            Your preparation, active tasks, and focus sessions — organized in one clean workspace.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} className="home-hero-actions">
          <Button
            variant="outlined"
            onClick={onNewTask || (() => onGo('tasks'))}
            startIcon={<Plus size={16} />}
            className="home-action-btn"
          >
            New task
          </Button>
          <Button
            variant="contained"
            onClick={onStartFocus || (() => onGo('focus'))}
            startIcon={<Zap size={16} />}
            className="home-action-btn primary"
          >
            Start focus
          </Button>
        </Stack>
      </Box>

      {/* ── Check-in banner (if reminders active) ── */}
      {state.reminders.enabled && (
        <Paper
          className="clean-checkin-banner hero-animate"
          elevation={0}
          onClick={onReminder}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onReminder(); } }}
        >
          <span className="checkin-icon"><Bell size={16} /></span>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={750} sx={{ fontSize: 13 }}>Quick study check-in</Typography>
            <Typography variant="caption" color="text.secondary">
              Reminders active every {state.reminders.intervalMinutes < 60 ? `${state.reminders.intervalMinutes}m` : `${state.reminders.intervalMinutes / 60}h`} · Tap to log a quick response
            </Typography>
          </Box>
          <Button size="small" variant="text" endIcon={<ArrowRight size={14} />} sx={{ fontWeight: 750, fontSize: 11, flexShrink: 0 }}>
            Check in
          </Button>
        </Paper>
      )}

      {/* ── 2. Unified 4 Metric Stat Cards ── */}
      <Box className="home-stats-grid hero-animate">
        <Paper className="home-stat-card" elevation={0} onClick={() => onGo('syllabus')}>
          <Box className="home-stat-head">
            <span>SYLLABUS</span>
            <span className="home-stat-icon blue"><GraduationCap size={16} /></span>
          </Box>
          <Typography className="home-stat-value">{totalTopics > 0 ? `${progress}%` : '0%'}</Typography>
          <Typography className="home-stat-sub">
            {totalTopics > 0 ? `${mastered} of ${totalTopics} topics mastered` : 'No topics yet · Tap to start'}
          </Typography>
          <Box className="home-stat-bar">
            <span style={{ width: `${progress}%` }} className="bar-blue" />
          </Box>
        </Paper>

        <Paper className="home-stat-card" elevation={0}>
          <Box className="home-stat-head">
            <span>STREAK</span>
            <span className="home-stat-icon peach"><Flame size={16} /></span>
          </Box>
          <Typography className="home-stat-value">{streak} <small>days</small></Typography>
          <Typography className="home-stat-sub">
            {streak > 0 ? 'Consistent momentum 🔥' : 'Show up, even for a bit'}
          </Typography>
          <Box className="home-stat-bar">
            <span style={{ width: `${Math.min(100, Math.max(14, streak * 14))}%` }} className="bar-peach" />
          </Box>
        </Paper>

        <Paper className="home-stat-card" elevation={0} onClick={() => onGo('focus')}>
          <Box className="home-stat-head">
            <span>FOCUS TIME</span>
            <span className="home-stat-icon mint"><Clock3 size={16} /></span>
          </Box>
          <Typography className="home-stat-value">
            {Math.floor(totalMinutes / 60)}<small>h</small> {totalMinutes % 60}<small>m</small>
          </Typography>
          <Typography className="home-stat-sub">{state.sessions.length} logged sessions</Typography>
          <Box className="home-stat-bar">
            <span style={{ width: `${Math.min(100, Math.max(12, (totalMinutes % 180) / 1.8))}%` }} className="bar-mint" />
          </Box>
        </Paper>

        <Paper className="home-stat-card" elevation={0} onClick={() => onGo('tasks')}>
          <Box className="home-stat-head">
            <span>TASKS DUE</span>
            <span className="home-stat-icon purple"><ListTodo size={16} /></span>
          </Box>
          <Typography className="home-stat-value">{todaysTasks.length}</Typography>
          <Typography className="home-stat-sub">{completedToday} completed today</Typography>
          <Box className="home-stat-bar">
            <span style={{ width: todaysTasks.length > 0 ? `${Math.min(100, (completedToday / (completedToday + todaysTasks.length || 1)) * 100)}%` : '100%' }} className="bar-purple" />
          </Box>
        </Paper>
      </Box>

      {/* ── 3. Focused Two-Column Workspace ── */}
      <Box className="home-columns-grid">
        {/* Left Column: Tasks & Syllabus Progress */}
        <Box className="home-col-main">
          {/* Today's Tasks Minimal Checklist */}
          <Paper className="clean-section-card hero-animate" elevation={0}>
            <Box className="clean-card-header">
              <Box>
                <Typography variant="h2" className="clean-card-title">Today’s Tasks</Typography>
                <Typography variant="caption" color="text.secondary">
                  Focus on high-leverage steps. Check off as you go.
                </Typography>
              </Box>
              <Button
                size="small"
                onClick={() => onGo('tasks')}
                endIcon={<ArrowRight size={14} />}
                className="clean-card-link"
              >
                All tasks ({state.tasks.length})
              </Button>
            </Box>

            {todaysTasks.length === 0 ? (
              <Box className="clean-empty-box">
                <span className="clean-empty-icon"><CheckCheck size={20} /></span>
                <Typography fontWeight={750} sx={{ fontSize: 13, mt: 0.5 }}>You're all caught up for today!</Typography>
                <Typography variant="caption" color="text.secondary">
                  Add a task or take a well-deserved rest.
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onGo('tasks')}
                  startIcon={<Plus size={14} />}
                  sx={{ mt: 1.5, borderRadius: 2 }}
                >
                  Create a task
                </Button>
              </Box>
            ) : (
              <Box className="clean-task-list">
                {todaysTasks.slice(0, 4).map((task) => (
                  <Box className="clean-task-row" key={task.id}>
                    <button
                      className={`clean-checkbox ${task.done ? 'checked' : ''}`}
                      onClick={() => onTaskToggle(task.id)}
                      aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {task.done && <Check size={13} />}
                    </button>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography className={`clean-task-name ${task.done ? 'done' : ''}`} noWrap>
                        {task.title}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
                        <span className="clean-task-chip">{topicName(task.topicId)}</span>
                        {task.dueDate && (
                          <span className="clean-task-due">
                            <CalendarDays size={11} /> {task.dueDate === todayLocalISO() ? 'Today' : task.dueDate}
                          </span>
                        )}
                      </Box>
                    </Box>
                    <span className={`clean-priority-dot ${task.priority.toLowerCase()}`} title={`${task.priority} priority`} />
                  </Box>
                ))}
                {todaysTasks.length > 4 && (
                  <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 0.5, display: 'block' }}>
                    + {todaysTasks.length - 4} more tasks on your list
                  </Typography>
                )}
              </Box>
            )}
          </Paper>

          {/* Continue Learning Phase Card or First-User Roadmap Card */}
          {!currentPhase || orderedPhases.length === 0 ? (
            <Paper className="clean-section-card hero-animate" elevation={0}>
              <Box className="clean-card-header">
                <Box>
                  <Typography variant="h2" className="clean-card-title">Learning Roadmap</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Build your personalized preparation plan.
                  </Typography>
                </Box>
                <Button
                  size="small"
                  onClick={() => onGo('syllabus')}
                  endIcon={<ArrowRight size={14} />}
                  className="clean-card-link"
                >
                  Open syllabus
                </Button>
              </Box>
              <Box className="clean-empty-box" sx={{ py: 3, px: 2, textAlign: 'center' }}>
                <span className="clean-empty-icon" style={{ background: '#eff4ff', color: '#3563e9' }}>
                  <Layers3 size={22} />
                </span>
                <Typography fontWeight={800} sx={{ fontSize: 13, mt: 0.8 }}>Your roadmap starts here</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 360, mx: 'auto', mt: 0.4, display: 'block', lineHeight: 1.5 }}>
                  Add custom topics to track what you study, or import our curated SDE roadmap.
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1.5, justifyContent: 'center' }}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => onGo('syllabus')}
                    startIcon={<Plus size={14} />}
                    sx={{ borderRadius: 2, fontWeight: 750 }}
                  >
                    Add first topic
                  </Button>
                  {onLoadCurated && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={onLoadCurated}
                      startIcon={<Sparkles size={14} />}
                      sx={{ borderRadius: 2, fontWeight: 750 }}
                    >
                      Import SDE Roadmap
                    </Button>
                  )}
                </Stack>
              </Box>
            </Paper>
          ) : (
            <Paper className="clean-section-card hero-animate" elevation={0}>
              <Box className="clean-card-header">
                <Box>
                  <Typography variant="h2" className="clean-card-title">Continue Learning</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Current syllabus roadmap milestone.
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={`PHASE ${String(displayCurrentPhaseNo).padStart(2, '0')}`}
                  className="clean-phase-tag"
                />
              </Box>

              <Box className="clean-phase-content">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Box>
                    <Typography className="clean-phase-name">{currentPhase.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {currentPhase.topics.length} core topics
                    </Typography>
                  </Box>
                  <Typography className="clean-phase-pct">{phaseProgress}%</Typography>
                </Box>

                <Box className="clean-phase-bar-track">
                  <span style={{ width: `${phaseProgress}%`, background: currentPhase.color || '#3563e9' }} />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 0.5, flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {phaseDone} of {currentPhase.topics.length} topics mastered in this phase
                  </Typography>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => onGo('syllabus')}
                    endIcon={<ArrowRight size={14} />}
                    sx={{ borderRadius: 2, fontWeight: 750, fontSize: 11 }}
                  >
                    Resume syllabus
                  </Button>
                </Box>
              </Box>
            </Paper>
          )}
        </Box>

        {/* Right Column: Focus Timer Launcher & Quick Navigation Hub */}
        <Box className="home-col-side">
          {/* Quick Focus Launcher Card */}
          <Paper className="clean-focus-launcher hero-animate" elevation={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="focus-mini-tag">
                <Zap size={13} /> FOCUS LAUNCHPAD
              </span>
              <IconButton size="small" onClick={() => onGo('focus')} aria-label="Open focus timer">
                <ArrowUpRight size={16} />
              </IconButton>
            </Box>
            <Typography variant="h3" sx={{ fontSize: 18, fontWeight: 850, mt: 1.2 }}>
              One task at a time.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, fontSize: 12, lineHeight: 1.5 }}>
              Enter the flow state with a focused Pomodoro block.
            </Typography>

            <Box className="focus-time-display">
              <Clock3 size={18} color="#3563e9" />
              <strong>25:00</strong>
              <span>Pomodoro block</span>
            </Box>

            <Button
              fullWidth
              variant="contained"
              onClick={() => onGo('focus')}
              endIcon={<ArrowRight size={15} />}
              className="focus-launch-btn"
            >
              Start 25m Focus Session
            </Button>
          </Paper>

          {/* Quick Navigation Hub (2x2 Grid) */}
          <Paper className="clean-section-card hero-animate" elevation={0}>
            <Typography variant="h2" className="clean-card-title" sx={{ mb: 1.5 }}>
              Quick Hub
            </Typography>
            <Box className="clean-hub-grid">
              <Box className="hub-tile" onClick={() => onGo('syllabus')} role="button" tabIndex={0}>
                <span className="hub-icon blue"><Layers3 size={17} /></span>
                <Box sx={{ minWidth: 0 }}>
                  <strong>Syllabus</strong>
                  <span>{phases.length} phases</span>
                </Box>
              </Box>

              <Box className="hub-tile" onClick={() => onGo('projects')} role="button" tabIndex={0}>
                <span className="hub-icon purple"><FolderGit2 size={17} /></span>
                <Box sx={{ minWidth: 0 }}>
                  <strong>Projects</strong>
                  <span>{(state.projects || []).length} projects</span>
                </Box>
              </Box>

              <Box className="hub-tile" onClick={() => onGo('notes')} role="button" tabIndex={0}>
                <span className="hub-icon peach"><NotebookPen size={17} /></span>
                <Box sx={{ minWidth: 0 }}>
                  <strong>Notes</strong>
                  <span>{state.notes.length} notes</span>
                </Box>
              </Box>

              <Box className="hub-tile" onClick={() => onGo('tasks')} role="button" tabIndex={0}>
                <span className="hub-icon mint"><ListTodo size={17} /></span>
                <Box sx={{ minWidth: 0 }}>
                  <strong>Tasks</strong>
                  <span>{state.tasks.length} total</span>
                </Box>
              </Box>
            </Box>
          </Paper>

          {/* Clean Quote Card */}
          <Paper className="clean-quote-card hero-animate" elevation={0}>
            <Sparkles size={16} color="#3563e9" />
            <Typography fontWeight={750} sx={{ fontSize: 13, mt: 0.5, color: '#1e293b' }}>
              Progress, not perfection.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.2, lineHeight: 1.5, display: 'block' }}>
              Consistency beats intensity. Small daily steps build exceptional engineering careers.
            </Typography>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

function PageSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <TextField value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="page-search" InputProps={{ startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment>, endAdornment: value ? <InputAdornment position="end"><IconButton size="small" onClick={() => onChange('')}><X size={15}/></IconButton></InputAdornment> : undefined }} />;
}

function InlineAddTopic({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  if (!adding) {
    return (
      <Button
        variant="outlined"
        size="small"
        startIcon={<Plus size={14} />}
        onClick={() => setAdding(true)}
        className="add-subheading-btn"
        sx={{ mt: 1.5, mb: 0.5, textTransform: 'none', borderRadius: 2, fontSize: 11, fontWeight: 700 }}
      >
        + Add Sub-heading (e.g. React, Node)
      </Button>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, mt: 1.5, mb: 0.5, alignItems: 'center' }}>
      <TextField
        size="small"
        placeholder="Sub-heading name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (name.trim()) {
              onAdd(name.trim());
              setName('');
              setAdding(false);
            }
          } else if (e.key === 'Escape') {
            setAdding(false);
          }
        }}
        sx={{ flex: 1 }}
      />
      <Button
        size="small"
        variant="contained"
        disabled={!name.trim()}
        onClick={() => {
          if (name.trim()) {
            onAdd(name.trim());
            setName('');
            setAdding(false);
          }
        }}
        sx={{ textTransform: 'none', fontWeight: 700 }}
      >
        Add
      </Button>
      <IconButton size="small" onClick={() => setAdding(false)}>
        <X size={16} />
      </IconButton>
    </Box>
  );
}

function InlineAddSubtopic({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  if (!adding) {
    return (
      <button
        type="button"
        className="add-subtopic-trigger"
        onClick={() => setAdding(true)}
      >
        <Plus size={11} /> Add detailed topic
      </button>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center', mt: 0.8 }}>
      <TextField
        size="small"
        placeholder="Detailed topic name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        sx={{
          flex: 1,
          '& .MuiInputBase-input': { fontSize: 11, py: 0.5, px: 1 },
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (name.trim()) {
              onAdd(name.trim());
              setName('');
              setAdding(false);
            }
          } else if (e.key === 'Escape') {
            setAdding(false);
          }
        }}
      />
      <Button
        size="small"
        variant="contained"
        disabled={!name.trim()}
        onClick={() => {
          if (name.trim()) {
            onAdd(name.trim());
            setName('');
            setAdding(false);
          }
        }}
        sx={{ textTransform: 'none', fontSize: 11, py: 0.4, px: 1.2, minWidth: 'auto', fontWeight: 700 }}
      >
        Save
      </Button>
      <IconButton size="small" onClick={() => setAdding(false)}>
        <X size={14} />
      </IconButton>
    </Box>
  );
}

function Syllabus({
  state,
  expandedPhase,
  setExpandedPhase,
  search,
  setSearch,
  setTopicStatus,
  onReorderPhase,
  onOpenReorder,
  onOpenNewPhase,
  onAddTopic,
  onDeleteTopic,
  onAddSubtopic,
  onDeleteSubtopic,
  onToggleSubtopic,
  onDeletePhase,
  onRequestDelete,
  onLoadCurated,
}: {
  state: AppState;
  expandedPhase: number | null;
  setExpandedPhase: (n: number | null) => void;
  search: string;
  setSearch: (s: string) => void;
  setTopicStatus: (id: string, status: AppState['topicStatus'][string]) => void;
  onReorderPhase: (phaseId: number, direction: 'up' | 'down') => void;
  onOpenReorder: () => void;
  onOpenNewPhase: () => void;
  onAddTopic: (phaseId: number, name: string) => void;
  onDeleteTopic: (phaseId: number, topicId: string) => void;
  onAddSubtopic: (phaseId: number, topicId: string, subName: string) => void;
  onDeleteSubtopic: (phaseId: number, topicId: string, subId: string) => void;
  onToggleSubtopic: (subId: string) => void;
  onDeletePhase: (phaseId: number) => void;
  onRequestDelete: (title: string, message: string, action: () => void) => void;
  onLoadCurated?: () => void;
}) {
  const currentSyllabus = useMemo(() => state.syllabus || [], [state.syllabus]);
  const ordered = useMemo(() => getOrderedPhases(currentSyllabus, state.phaseOrder), [currentSyllabus, state.phaseOrder]);
  const total = ordered.reduce((sum, p) => sum + p.topics.length, 0);
  const mastered = ordered.flatMap((p) => p.topics).filter((t) => state.topicStatus[t.id] === 'Mastered').length;
  const filtered = ordered
    .map((phase) => ({
      ...phase,
      topics: phase.topics.filter((topic) =>
        `${topic.name} ${phase.name} ${phase.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((phase) => !search || phase.topics.length > 0);

  return (
    <Box>
      <SectionHeading
        eyebrow="YOUR LEARNING MAP"
        title="Syllabus"
        subtitle={
          ordered.length > 0
            ? `${ordered.length} topics. Customise the order to match your target.`
            : 'Your roadmap is empty. Add your topics or import the curated SDE curriculum.'
        }
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" size="small" startIcon={<Plus size={15} />} onClick={onOpenNewPhase} sx={{ fontWeight: 750 }}>
              New Topic
            </Button>
            {ordered.length > 0 ? (
              <>
                <Button variant="outlined" size="small" startIcon={<ArrowUpDown size={15} />} onClick={onOpenReorder}>
                  Reorder
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Search size={15} />}
                  onClick={() => document.querySelector<HTMLInputElement>('.page-search input')?.focus()}
                >
                  Find
                </Button>
              </>
            ) : (
              onLoadCurated && (
                <Button variant="outlined" size="small" startIcon={<Sparkles size={15} />} onClick={onLoadCurated} sx={{ fontWeight: 650 }}>
                  Import SDE Roadmap
                </Button>
              )
            )}
          </Stack>
        }
      />
      {ordered.length === 0 ? (
        <Paper
          className="empty-state hero-animate"
          elevation={0}
          sx={{
            py: { xs: 5, sm: 6 },
            px: { xs: 3, sm: 4 },
            textAlign: 'center',
            borderRadius: '24px',
            border: '1.5px dashed rgba(24, 62, 131, 0.18)',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFD 100%)',
            boxShadow: '0 12px 36px -12px rgba(15, 23, 42, 0.08)',
            mt: 1.5,
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '20px',
              bgcolor: 'rgba(37, 99, 235, 0.08)',
              color: '#2563EB',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <Layers3 size={32} />
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#0F172A', mb: 1, fontSize: '1.35rem' }}>
            Start your learning roadmap
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, mx: 'auto', mb: 3.5, lineHeight: 1.6 }}>
            You have a clean slate. Organize your learning journey with custom topics, subtopics, and progress tracking, or start with the full curated SDE curriculum.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              startIcon={<Plus size={18} />}
              onClick={onOpenNewPhase}
              sx={{ borderRadius: '14px', fontWeight: 700, px: 3, py: 1.25, boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.35)' }}
            >
              Create first topic
            </Button>
            {onLoadCurated && (
              <Button
                variant="outlined"
                size="large"
                startIcon={<Sparkles size={18} />}
                onClick={onLoadCurated}
                sx={{ borderRadius: '14px', fontWeight: 700, px: 3, py: 1.25 }}
              >
                Import SDE Roadmap (12 Phases)
              </Button>
            )}
          </Stack>
        </Paper>
      ) : (
        <>
          <Paper className="syllabus-overview hero-animate" elevation={0}>
        <Box className="syllabus-progress-ring">
          <Box>
            <strong>{percent(mastered, total)}%</strong>
            <span>mastered</span>
          </Box>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h3">Your progress, at a glance</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 0.55 }}>
            {mastered} of {total} main topics marked as mastered
          </Typography>
          <Box className="segmented-progress">
            {ordered.map((p) => {
              const count = p.topics.filter((t) => state.topicStatus[t.id] === 'Mastered').length;
              return (
                <span
                  key={p.id}
                  title={p.name}
                  style={{
                    flex: Math.max(1, p.topics.length),
                    background: count ? p.color : '#E9EDF5',
                    opacity: count ? 0.55 + (0.45 * count) / (p.topics.length || 1) : 1,
                  }}
                />
              );
            })}
          </Box>
          <Typography variant="caption" color="text.secondary">
            DSA stays available as a parallel learning track.
          </Typography>
        </Box>
      </Paper>
      <Box className="syllabus-tools">
        <PageSearch value={search} onChange={setSearch} placeholder="Search topics…" />
        <Box className="filter-hint">
          <span className="legend-dot mastered" /> Mastered <span className="legend-dot progress" /> In progress <span className="legend-dot revision" /> Revise
        </Box>
      </Box>
      <Box className="phase-list">
        {filtered.length === 0 ? (
          <Paper className="empty-state hero-animate" elevation={0} sx={{ mt: 2, py: 4, textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontSize: '1.1rem' }}>No matching topics found</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5, mb: 2 }}>
              Try searching for something else or clear the search filter.
            </Typography>
            <Button variant="outlined" size="small" onClick={() => setSearch('')}>
              Clear Search
            </Button>
          </Paper>
        ) : (
          filtered.map((phase, idx) => {
          const done = phase.topics.filter((t) => state.topicStatus[t.id] === 'Mastered').length;
          const open = expandedPhase === phase.id || Boolean(search);
          const phaseOrderIndex = ordered.findIndex((p) => p.id === phase.id);
          const displayPhaseNo = phaseOrderIndex >= 0 ? phaseOrderIndex + 1 : idx + 1;

          return (
            <Paper className={`phase-card hero-animate ${open ? 'expanded' : ''}`} elevation={0} key={phase.id}>
              <button className="phase-head" onClick={() => setExpandedPhase(open && !search ? null : phase.id)}>
                <span className="phase-number" style={{ background: `${phase.color}16`, color: phase.color }}>
                  {String(displayPhaseNo).padStart(2, '0')}
                </span>
                <span className="phase-name-block">
                  <strong>{phase.name}</strong>
                  <small>{phase.topics.length} topics</small>
                </span>
                <span className="phase-progress-number">{percent(done, phase.topics.length)}%</span>
                <Box className="phase-reorder-group" onClick={(e) => e.stopPropagation()}>
                  <IconButton
                    size="small"
                    className="phase-reorder-btn"
                    disabled={idx === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderPhase(phase.id, 'up');
                    }}
                    aria-label={`Move phase ${phase.name} up`}
                  >
                    <ArrowUp size={13} />
                  </IconButton>
                  <IconButton
                    size="small"
                    className="phase-reorder-btn"
                    disabled={idx === filtered.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReorderPhase(phase.id, 'down');
                    }}
                    aria-label={`Move phase ${phase.name} down`}
                  >
                    <ArrowDown size={13} />
                  </IconButton>
                  <IconButton
                    size="small"
                    className="phase-reorder-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestDelete(
                        'Delete Topic Phase',
                        `Are you sure you want to delete "${phase.name}" and all its sub-headings?`,
                        () => onDeletePhase(phase.id)
                      );
                    }}
                    aria-label={`Delete phase ${phase.name}`}
                    title="Delete phase"
                    sx={{ color: '#ef4444' }}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </Box>
                <span className="phase-chevron">{open ? <ChevronDown size={19} /> : <ChevronRight size={19} />}</span>
              </button>
              <Box className="phase-progress-bar">
                <span style={{ width: `${percent(done, phase.topics.length)}%`, background: phase.color }} />
              </Box>
              {open && (
                <Box className="phase-topic-list">
                  {phase.topics.map((topic) => {
                    const status = state.topicStatus[topic.id] || 'Not Started';
                    const subs = topic.subtopics || [];
                    const completedSubs = subs.filter((s) => state.subtopicStatus?.[s.id]).length;

                    return (
                      <Box key={topic.id} className="topic-block">
                        <Box className="topic-row">
                          <Box className={`topic-state-dot state-${status.toLowerCase().replaceAll(' ', '-')}`}>
                            {status === 'Mastered' ? <Check size={13} /> : status === 'In Progress' ? <span /> : status === 'Needs Revision' ? <ArrowDownRight size={12} /> : null}
                          </Box>
                          <Box className="topic-row-name">
                            <Typography>{topic.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {status === 'Mastered' ? 'Looking good' : status === 'Needs Revision' ? 'Add to revision queue' : status === 'In Progress' ? 'Keep going' : 'Ready when you are'}
                              {subs.length > 0 && ` · ${completedSubs}/${subs.length} detailed items`}
                            </Typography>
                          </Box>
                          <FormControl size="small" className="topic-status-select">
                            <Select
                              value={status}
                              onChange={(e) => setTopicStatus(topic.id, e.target.value as AppState['topicStatus'][string])}
                              renderValue={(v) => <span className={`status-select-label status-${v.toLowerCase().replaceAll(' ', '-')}`}>{v}</span>}
                            >
                              {STATUSES.map((s) => (
                                <MenuItem key={s} value={s}>
                                  <span className={`status-option-dot status-${s.toLowerCase().replaceAll(' ', '-')}`} />
                                  {s}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <IconButton
                            size="small"
                            className="topic-delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRequestDelete(
                                'Delete Sub-heading',
                                `Are you sure you want to delete "${topic.name}"?`,
                                () => onDeleteTopic(phase.id, topic.id)
                              );
                            }}
                            aria-label={`Delete ${topic.name}`}
                            title="Delete sub-heading"
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Box>

                        {/* Detailed Subtopics */}
                        <Box className="subtopics-container">
                          {subs.length > 0 && (
                            <Box className="subtopics-list">
                              {subs.map((sub) => {
                                const isDone = Boolean(state.subtopicStatus?.[sub.id]);
                                return (
                                  <Box key={sub.id} className={`subtopic-item ${isDone ? 'completed' : ''}`}>
                                    <button
                                      type="button"
                                      className={`subtopic-check ${isDone ? 'done' : ''}`}
                                      onClick={() => onToggleSubtopic(sub.id)}
                                      title={isDone ? 'Mark incomplete' : 'Mark complete'}
                                    >
                                      {isDone && <Check size={10} />}
                                    </button>
                                    <span className="subtopic-title" onClick={() => onToggleSubtopic(sub.id)}>
                                      {sub.name}
                                    </span>
                                    <button
                                      type="button"
                                      className="subtopic-del-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onRequestDelete(
                                          'Delete Subtopic',
                                          `Are you sure you want to delete "${sub.name}"?`,
                                          () => onDeleteSubtopic(phase.id, topic.id, sub.id)
                                        );
                                      }}
                                      title="Delete detailed topic"
                                    >
                                      <X size={12} />
                                    </button>
                                  </Box>
                                );
                              })}
                            </Box>
                          )}
                          <InlineAddSubtopic onAdd={(subName) => onAddSubtopic(phase.id, topic.id, subName)} />
                        </Box>
                      </Box>
                    );
                  })}
                  <InlineAddTopic onAdd={(tName) => onAddTopic(phase.id, tName)} />
                </Box>
              )}
              <Box className="phase-tags">
                {phase.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </Box>
            </Paper>
          );
        }))}
      </Box>
      <Box className="small-note">
        <Sparkles size={16} />
        <Typography variant="body2">
          Mastery is a self-assessment, not just a checkbox. Change a topic's status whenever your understanding changes.
        </Typography>
      </Box>
    </>
  )}
</Box>
  );
}

function Tasks({ state, search, setSearch, onAdd, onEdit, onToggle, onDelete }: { state: AppState; search: string; setSearch: (s: string) => void; onAdd: () => void; onEdit: (t: Task) => void; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const [filter, setFilter] = useState<'Today' | 'Upcoming' | 'Overdue' | 'Completed' | 'All'>('Today');
  const today = todayLocalISO();
  const filtered = state.tasks.filter((task) => {
    const matchSearch = `${task.title} ${task.description} ${topicName(task.topicId)}`.toLowerCase().includes(search.toLowerCase());
    const group = filter === 'Today' ? !task.done && (!task.dueDate || task.dueDate <= today) : filter === 'Upcoming' ? !task.done && task.dueDate > today : filter === 'Overdue' ? !task.done && task.dueDate && task.dueDate < today : filter === 'Completed' ? task.done : true;
    return matchSearch && group;
  }).sort((a, b) => Number(a.done) - Number(b.done) || ({ High: 0, Medium: 1, Low: 2 }[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority]));
  const doneCount = state.tasks.filter((t) => t.done).length;
  return <Box>
    <SectionHeading eyebrow="MAKE SPACE FOR WHAT MATTERS" title="Tasks" subtitle={`${doneCount} completed · ${state.tasks.length - doneCount} left in your list`} action={<Button variant="contained" startIcon={<Plus size={17}/>} onClick={onAdd}>New task</Button>} />
    <Paper className="tasks-summary hero-animate" elevation={0}><Box className="tasks-summary-icon"><CheckCheck size={22}/></Box><Box sx={{ flex: 1 }}><Typography fontWeight={800}>You’ve got this.</Typography><Typography color="text.secondary" variant="body2">Keep tasks small, clear, and connected to a topic.</Typography></Box><Box className="tasks-summary-count"><strong>{doneCount}/{state.tasks.length}</strong><span>done</span></Box></Paper>
    <Box className="tasks-tools"><PageSearch value={search} onChange={setSearch} placeholder="Search tasks…"/><Box className="task-filters">{(['Today', 'Upcoming', 'Overdue', 'Completed', 'All'] as const).map((name) => <button key={name} className={filter === name ? 'selected' : ''} onClick={() => setFilter(name)}>{name}{name === 'Today' && <span>{state.tasks.filter((t) => !t.done && (!t.dueDate || t.dueDate <= today)).length}</span>}</button>)}</Box></Box>
    <Box className="tasks-list">{filtered.length === 0 ? <Paper className="empty-state" elevation={0}><span className="empty-bubble"><ListTodo size={25}/></span><Typography variant="h3">Nothing on this list</Typography><Typography color="text.secondary" sx={{ mt: 0.6 }}>Add a task or switch to another view.</Typography><Button variant="contained" sx={{ mt: 2 }} startIcon={<Plus size={16}/>} onClick={onAdd}>Create a task</Button></Paper> : filtered.map((task) => <Paper className={`task-card hero-animate ${task.done ? 'task-card-done' : ''}`} elevation={0} key={task.id}>
      <button className={`task-check large ${task.done ? 'checked' : ''}`} onClick={() => onToggle(task.id)} aria-label={task.done ? 'Mark incomplete' : 'Complete task'}>{task.done && <Check size={15}/>}</button>
      <Box className="task-card-content" onClick={() => onEdit(task)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(task); } }} role="button" tabIndex={0}><Typography fontWeight={800} className={task.done ? 'done-text' : ''}>{task.title}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>{task.description || topicName(task.topicId)}</Typography><Box className="task-meta"><Chip size="small" label={topicName(task.topicId)} className="topic-chip"/><span className={`priority-badge ${task.priority.toLowerCase()}`}><i/>{task.priority}</span>{task.dueDate && <span className={`due-label ${!task.done && task.dueDate < today ? 'overdue' : ''}`}><CalendarDays size={13}/>{task.dueDate === today ? 'Today' : task.dueDate}</span>}</Box></Box>
      <Box className="task-actions">
        <IconButton
          size="small"
          className="task-action-btn edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task);
          }}
          aria-label="Edit task"
          title="Edit task"
        >
          <Pencil size={16} />
        </IconButton>
        <IconButton
          size="small"
          className="task-action-btn delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          aria-label="Delete task"
          title="Delete task"
        >
          <Trash2 size={16} />
        </IconButton>
      </Box>
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
      <Box onClick={() => onEdit(note)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(note); } }} role="button" tabIndex={0} className="note-card-click"><Typography variant="h3">{note.title || 'Untitled note'}</Typography><Typography className="note-content-preview">{note.content || 'No content yet.'}</Typography></Box>
      <Box className="note-card-footer"><span>{topicName(note.topicId)}</span><span>{new Date(note.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></Box>
    </MotionBox>)}</Box>}
    <Box className="small-note"><Cloud size={16}/><Typography variant="body2">Notes sync to your account when cloud sync is configured. Keep the content useful and concise for easier revision.</Typography></Box>
  </Box>;
}

function Projects({
  state,
  search,
  setSearch,
  onAdd,
  onEdit,
  onToggleFeatured,
  onDelete,
}: {
  state: AppState;
  search: string;
  setSearch: (s: string) => void;
  onAdd: () => void;
  onEdit: (project: PortfolioProject) => void;
  onToggleFeatured: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<'All' | 'Featured' | ProjectStatus>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const projects = state.projects || [];
  const liveCount = projects.filter((p) => Boolean(p.liveUrl?.trim())).length;
  const githubCount = projects.filter((p) => Boolean(p.githubUrl?.trim())).length;
  const featuredCount = projects.filter((p) => p.featured).length;

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      p.title.toLowerCase().includes(q) ||
      p.tagline.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      (p.techStack || []).some((tag) => tag.toLowerCase().includes(q));

    const matchFilter =
      statusFilter === 'All'
        ? true
        : statusFilter === 'Featured'
        ? p.featured
        : p.status === statusFilter;

    return matchSearch && matchFilter;
  }).sort((a, b) => {
    if (a.featured !== b.featured) return Number(b.featured) - Number(a.featured);
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });

  const handleCopy = (url: string, id: string) => {
    try {
      void navigator.clipboard.writeText(url);
      setCopiedLink(id);
      setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <Box>
      <SectionHeading
        eyebrow="PORTFOLIO & CODE SHOWCASE"
        title="Projects"
        subtitle={`${projects.length} project${projects.length === 1 ? '' : 's'} · ${liveCount} live deployment${liveCount === 1 ? '' : 's'}`}
        action={
          <Button variant="contained" startIcon={<Plus size={17} />} onClick={onAdd}>
            New project
          </Button>
        }
      />

      {/* Developer Profiles & Live Portfolio Banner */}
      <Paper className="developer-links-banner hero-animate" elevation={0}>
        <Box className="developer-links-info">
          <Avatar className="developer-links-avatar">V</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography className="developer-name">Vishnu | SDE Aspirant</Typography>
            <Typography variant="caption" color="text.secondary">
              Official developer profiles & live portfolio
            </Typography>
          </Box>
        </Box>
        <Box className="developer-links-buttons">
          <a
            href={DEV_LINKS.github}
            target="_blank"
            rel="noopener noreferrer"
            className="dev-link-btn github"
            onClick={(e) => {
              e.stopPropagation();
              openExternalUrl(DEV_LINKS.github);
            }}
          >
            <Github size={15} />
            <span>GitHub</span>
            <ArrowUpRight size={13} className="dev-link-arrow" />
          </a>
          <a
            href={DEV_LINKS.portfolio}
            target="_blank"
            rel="noopener noreferrer"
            className="dev-link-btn portfolio"
            onClick={(e) => {
              e.stopPropagation();
              openExternalUrl(DEV_LINKS.portfolio);
            }}
          >
            <Globe size={15} />
            <span>Portfolio</span>
            <ArrowUpRight size={13} className="dev-link-arrow" />
          </a>
          <a
            href={DEV_LINKS.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="dev-link-btn linkedin"
            onClick={(e) => {
              e.stopPropagation();
              openExternalUrl(DEV_LINKS.linkedin);
            }}
          >
            <Linkedin size={15} />
            <span>LinkedIn</span>
            <ArrowUpRight size={13} className="dev-link-arrow" />
          </a>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.8, borderRadius: 2, background: 'rgba(255, 255, 255, 0.9)', border: '1px solid #dce6fb', width: { xs: '100%', sm: 'auto' } }}>
          <Mail size={14} style={{ color: '#3563e9', flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', userSelect: 'all' }}>
            {DEV_LINKS.email}
          </Typography>
        </Box>
      </Paper>

      <Box className="projects-summary-grid hero-animate">
        <Paper className="projects-summary-card" elevation={0}>
          <Box className="proj-stat-head">
            <span>TOTAL PROJECTS</span>
            <span className="proj-stat-icon"><FolderGit2 size={16} /></span>
          </Box>
          <strong>{projects.length}</strong>
          <span className="proj-stat-sub">In showcase portfolio</span>
        </Paper>
        <Paper className="projects-summary-card" elevation={0}>
          <Box className="proj-stat-head">
            <span>LIVE DEMOS</span>
            <span className="proj-stat-icon mint"><Globe size={16} /></span>
          </Box>
          <strong style={{ color: '#0f865f' }}>{liveCount}</strong>
          <span className="proj-stat-sub">Deployments active</span>
        </Paper>
        <Paper className="projects-summary-card" elevation={0}>
          <Box className="proj-stat-head">
            <span>GITHUB REPOS</span>
            <span className="proj-stat-icon blue"><Github size={16} /></span>
          </Box>
          <strong style={{ color: '#2547b8' }}>{githubCount}</strong>
          <span className="proj-stat-sub">Codebases linked</span>
        </Paper>
        <Paper className="projects-summary-card" elevation={0}>
          <Box className="proj-stat-head">
            <span>FEATURED</span>
            <span className="proj-stat-icon peach"><Star size={16} /></span>
          </Box>
          <strong style={{ color: '#b7791f' }}>{featuredCount}</strong>
          <span className="proj-stat-sub">Pinned highlights</span>
        </Paper>
      </Box>

      <Box className="projects-tools">
        <PageSearch value={search} onChange={setSearch} placeholder="Search projects…" />
        <Box className="projects-filters">
          {(['All', 'Featured', 'Active', 'In Progress', 'Completed', 'Archived'] as const).map((filter) => (
            <button
              key={filter}
              className={statusFilter === filter ? 'selected' : ''}
              onClick={() => setStatusFilter(filter)}
            >
              {filter === 'Featured' ? '⭐ Featured' : filter}
            </button>
          ))}
        </Box>
      </Box>

      {filtered.length === 0 ? (
        <Paper className="empty-state" elevation={0}>
          <span className="empty-bubble" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <FolderGit2 size={28} />
          </span>
          <Typography variant="h3">No projects found</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6, maxWidth: 420 }}>
            {projects.length === 0
              ? 'Save your GitHub repositories, live demo links, architecture highlights, and interview talking points here.'
              : 'Try adjusting your search query or status filter.'}
          </Typography>
          <Button variant="contained" sx={{ mt: 2 }} startIcon={<Plus size={16} />} onClick={onAdd}>
            Add a project
          </Button>
        </Paper>
      ) : (
        <Box className="projects-grid">
          {filtered.map((proj, i) => {
            const isExpanded = expandedId === proj.id;
            return (
              <MotionBox
                key={proj.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.2) }}
              >
                <Paper className={`project-card hero-animate ${proj.featured ? 'featured-card' : ''}`} elevation={0}>
                  <Box className="project-card-head">
                    <Box className="project-title-area">
                      <Box className="project-title-row">
                        <IconButton
                          size="small"
                          onClick={() => onToggleFeatured(proj.id)}
                          aria-label={proj.featured ? 'Unpin project' : 'Pin as featured'}
                          sx={{ p: 0.5, color: proj.featured ? '#f59e0b' : '#cbd5e1' }}
                        >
                          <Star size={18} fill={proj.featured ? '#f59e0b' : 'none'} />
                        </IconButton>
                        <Typography className="project-name">{proj.title}</Typography>
                        {proj.featured && (
                          <span className="featured-badge">
                            <Star size={11} fill="#b7791f" /> Featured
                          </span>
                        )}
                        <span className={`project-status-badge status-${proj.status.toLowerCase().replace(' ', '-')}`}>
                          {proj.status}
                        </span>
                      </Box>
                      {proj.tagline && <Typography className="project-tagline">{proj.tagline}</Typography>}
                    </Box>
                    <Box className="project-actions">
                      <IconButton size="small" onClick={() => onEdit(proj)} aria-label="Edit project">
                        <MoreHorizontal size={18} />
                      </IconButton>
                      <IconButton size="small" onClick={() => onDelete(proj.id)} aria-label="Delete project">
                        <Trash2 size={16} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Links Row */}
                  <Box className="project-links-row">
                    {proj.githubUrl && (
                      <a
                        href={proj.githubUrl.startsWith('http') ? proj.githubUrl : `https://${proj.githubUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="project-link-btn github"
                      >
                        <Github size={15} /> GitHub Repo
                      </a>
                    )}
                    {proj.liveUrl && (
                      <a
                        href={proj.liveUrl.startsWith('http') ? proj.liveUrl : `https://${proj.liveUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="project-link-btn live"
                      >
                        <ExternalLink size={15} /> Live Demo
                      </a>
                    )}
                    {proj.githubUrl && (
                      <button
                        className="project-link-btn copy"
                        onClick={() => handleCopy(proj.githubUrl, proj.id)}
                        title="Copy GitHub URL"
                      >
                        {copiedLink === proj.id ? <Check size={14} color="#0f865f" /> : <Copy size={14} />}
                        <span>{copiedLink === proj.id ? 'Copied' : 'Copy link'}</span>
                      </button>
                    )}
                  </Box>

                  {/* Tech Stack Pills */}
                  {proj.techStack && proj.techStack.length > 0 && (
                    <Box className="project-tech-row">
                      {proj.techStack.map((tech, idx) => (
                        <span key={idx} className="tech-pill">
                          {tech}
                        </span>
                      ))}
                    </Box>
                  )}

                  {/* Summary */}
                  <Typography className="project-summary-text">{proj.summary}</Typography>

                  {/* Architecture & SDE Talking Points Toggle */}
                  {(proj.challenges || proj.starStory) && (
                    <Box>
                      <button
                        className="project-details-toggle"
                        onClick={() => setExpandedId(isExpanded ? null : proj.id)}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        {isExpanded ? 'Hide interview talking points & architecture' : 'View SDE interview talking points & architecture'}
                      </button>

                      {isExpanded && (
                        <Box className="project-details-box">
                          {proj.challenges && (
                            <Box>
                              <Typography className="details-section-title">
                                ⚙️ Architecture & Technical Challenges
                              </Typography>
                              <Typography className="details-section-content" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
                                {proj.challenges}
                              </Typography>
                            </Box>
                          )}

                          {proj.starStory && (
                            <Box sx={{ mt: proj.challenges ? 1.5 : 0 }}>
                              <Typography className="details-section-title">
                                🎯 STAR Method Interview Story (Behavioral & Technical)
                              </Typography>
                              <Typography className="details-section-content" sx={{ mt: 0.5, whiteSpace: 'pre-line' }}>
                                {proj.starStory}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  )}
                </Paper>
              </MotionBox>
            );
          })}
        </Box>
      )}
    </Box>
  );
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
        <Box className="focus-panel-top"><span className="focus-label"><span className={timerRunning ? 'pulse-dot' : ''}/>{timerRunning ? 'SESSION IN PROGRESS' : 'YOUR FOCUS SPACE'}</span><IconButton onClick={onHistory} aria-label="View focus history"><Activity size={18}/></IconButton></Box>
        <Box className={`timer-wheel ${timerRunning ? 'timer-active' : ''}`} style={{ ['--timer-progress' as string]: `${Math.max(0, elapsed * 360)}deg` }}><Box className="timer-wheel-inner"><span>{timerRunning ? 'IN THE ZONE' : 'TIME TO FOCUS'}</span><strong>{minutes}:{seconds}</strong><small>{timerRunning ? 'You’re doing great' : 'Make this time count'}</small></Box></Box>
        <Box className="timer-presets">{[15, 25, 45, 60].map((m) => <button key={m} className={timerLength === m ? 'active' : ''} onClick={() => setTimerLength(m)} disabled={timerRunning}>{m}<small>min</small></button>)}</Box>
        <Box className="timer-controls"><Button variant="contained" size="large" onClick={onToggleTimer} startIcon={timerRunning ? <Coffee size={18}/> : <Zap size={18}/>} className="timer-main-button">{timerRunning ? 'Pause session' : remainingSeconds === 0 ? 'Start again' : 'Start focusing'}</Button><IconButton onClick={onResetTimer} className="timer-reset" aria-label="Reset timer"><RotateCcw size={18}/></IconButton></Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>Stay with it. Breaks are part of the process.</Typography>
      </Paper>
      <Box className="focus-side">
        <Paper className="focus-topic-card hero-animate" elevation={0}>
          <Box className="card-heading-row">
            <Box>
              <Typography variant="h3">What are you working on?</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 0.4 }}>Type your current focus objective.</Typography>
            </Box>
            <Target size={21} color="#3563E9"/>
          </Box>
          <TextField
            fullWidth
            size="small"
            placeholder="What are you focusing on?"
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            sx={{ mt: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Code2 size={18} color="#3563E9" />
                </InputAdornment>
              ),
            }}
          />
          <Box className="selected-topic-preview">
            <span className="topic-orbit"><Code2 size={20}/></span>
            <Box>
              <Typography fontWeight={800}>{selectedTopic.trim() || 'Custom Focus Task'}</Typography>
              <Typography variant="caption" color="text.secondary">Current focus objective</Typography>
            </Box>
          </Box>
        </Paper>
        <Paper className="focus-summary-card hero-animate" elevation={0}><Box className="summary-icon-row"><span className="summary-soft-icon"><Clock3 size={19}/></span><Box><Typography variant="h3">Your focus history</Typography><Typography variant="body2" color="text.secondary">Every session counts.</Typography></Box></Box><Box className="focus-summary-stats"><Box><strong>{state.sessions.length}</strong><span>Sessions</span></Box><Box><strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong><span>Total time</span></Box><Box><strong>{state.sessions.filter((s) => s.completed).length}</strong><span>Completed</span></Box></Box><Button fullWidth variant="outlined" onClick={onHistory}>View session history</Button></Paper>
        <Paper className="focus-tip hero-animate" elevation={0}><Sparkles size={18}/><Box><Typography fontWeight={800}>A tiny focus ritual</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, lineHeight: 1.55 }}>Write the next action before starting. When the timer ends, jot one thing you learned.</Typography></Box></Paper>
      </Box>
    </Box>
  </Box>;
}

function ReorderSyllabusDialog({
  open,
  onClose,
  orderedPhases,
  onMove,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  orderedPhases: Phase[];
  onMove: (phaseId: number, direction: 'up' | 'down') => void;
  onReset: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" className="reorder-dialog">
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ArrowUpDown size={20} color="#2563eb" />
          <Typography variant="h3" sx={{ fontSize: 18, fontWeight: 800 }}>
            Reorder Roadmap
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Close dialog">
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 1.5, maxHeight: '60vh', overflowY: 'auto' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, px: 0.5 }}>
          Move phases up or down to align with your personal interview timeline.
        </Typography>
        <Stack spacing={1}>
          {orderedPhases.map((phase, idx) => (
            <Paper
              key={phase.id}
              elevation={0}
              sx={{
                p: 1.2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                background: '#ffffff',
                transition: 'all 0.15s ease',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 800,
                    background: `${phase.color}18`,
                    color: phase.color,
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </span>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    noWrap
                    sx={{ color: '#1e293b', fontSize: 13 }}
                  >
                    {phase.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 11, display: 'block' }}>
                    {phase.topics.length} topics
                  </Typography>
                </Box>
              </Box>

              <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, ml: 1 }}>
                <IconButton
                  size="small"
                  className="reorder-action-btn"
                  disabled={idx === 0}
                  onClick={() => onMove(phase.id, 'up')}
                  aria-label={`Move ${phase.name} up`}
                >
                  <ArrowUp size={15} />
                </IconButton>
                <IconButton
                  size="small"
                  className="reorder-action-btn"
                  disabled={idx === orderedPhases.length - 1}
                  onClick={() => onMove(phase.id, 'down')}
                  aria-label={`Move ${phase.name} down`}
                >
                  <ArrowDown size={15} />
                </IconButton>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button size="small" color="inherit" onClick={onReset} sx={{ textTransform: 'none', color: '#64748b' }}>
          Reset Default
        </Button>
        <Button variant="contained" size="small" onClick={onClose} sx={{ borderRadius: '10px', textTransform: 'none', px: 2.5 }}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ConfirmDeleteDialog({
  open,
  title,
  message,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1, color: '#dc2626' }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AlertTriangle size={20} color="#dc2626" />
        </Box>
        <Typography variant="h3" sx={{ fontSize: 17, fontWeight: 800, color: '#1e293b' }}>
          {title || 'Confirm Deletion'}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, lineHeight: 1.6 }}>
          {message}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: '#dc2626', fontWeight: 700 }}>
          ⚠️ This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2, textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          variant="contained"
          sx={{ borderRadius: 2, fontWeight: 750, bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' }, textTransform: 'none' }}
          autoFocus
        >
          Confirm Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function NewPhaseDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, tags: string[], color: string) => void;
}) {
  const isMobile = useMediaQuery('(max-width:600px)');
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [color, setColor] = useState('#5774E8');
  const PRESET_COLORS = ['#5774E8', '#9065E8', '#34866F', '#D77B45', '#438DCA', '#C45E8A', '#D16D4D', '#4A8AB2'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const tagArray = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onCreate(name.trim(), tagArray, color);
    setName('');
    setTags('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth fullScreen={isMobile} className="phase-dialog form-fullscreen-dialog">
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#eff4ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers3 size={20} color="#3563e9" />
          </Box>
          <Typography variant="h3" sx={{ fontSize: 17, fontWeight: 800 }}>Create New Topic / Phase</Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1.5 }}>
          <TextField
            label="Topic / Phase Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            fullWidth
            size="small"
          />
          <TextField
            label="Tags / Skills (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            fullWidth
            size="small"
          />
          <Box>
            <Typography variant="caption" sx={{ fontWeight: 750, color: 'text.secondary', display: 'block', mb: 1 }}>
              Theme Color
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {PRESET_COLORS.map((c) => (
                <Box
                  key={c}
                  onClick={() => setColor(c)}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: c,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: color === c ? '2.5px solid #1e293b' : '2px solid transparent',
                    boxShadow: color === c ? '0 0 0 2px white' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {color === c && <Check size={14} color="#fff" />}
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!name.trim()} sx={{ textTransform: 'none', fontWeight: 750 }}>
            Create Topic
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function TaskDialog({ open, initial, onClose, onSave, orderedPhases }: { open: boolean; initial: Task | null; onClose: () => void; onSave: (task: Omit<Task, 'id' | 'createdAt' | 'done'> & Partial<Pick<Task, 'id' | 'createdAt' | 'done'>>) => void; orderedPhases?: Phase[] }) {
  const isMobile = useMediaQuery('(max-width:600px)');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [topicId, setTopicId] = useState('personal');
  const [recurrence, setRecurrence] = useState<'Never' | 'Daily' | 'Weekdays' | 'Weekly'>('Never');

  useEffect(() => {
    setTitle(initial?.title || '');
    setDescription(initial?.description || '');
    setDueDate(initial?.dueDate || '');
    setPriority(initial?.priority || 'Medium');
    setTopicId(initial?.topicId || 'personal');
    setRecurrence((initial?.recurrence as 'Never' | 'Daily' | 'Weekdays' | 'Weekly') || 'Never');
  }, [initial, open]);

  const submit = () => {
    if (!title.trim()) return;
    onSave({
      id: initial?.id,
      createdAt: initial?.createdAt,
      done: initial?.done,
      title: title.trim(),
      description: description.trim(),
      dueDate,
      priority,
      topicId,
      recurrence: recurrence === 'Never' ? undefined : recurrence,
    });
  };

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile} className="task-dialog form-fullscreen-dialog">
    <DialogTitle className="dialog-title">
      <span className="dialog-icon task"><ListTodo size={19}/></span>
      <Box>
        <Typography variant="h3">{initial ? 'Edit task' : 'Create a task'}</Typography>
        <Typography color="text.secondary" variant="body2">A small next step is a good next step.</Typography>
      </Box>
      <IconButton onClick={onClose} aria-label="Close task editor" sx={{ ml: 'auto' }}><X size={19}/></IconButton>
    </DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        <TextField
          label="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <FormControl fullWidth>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontWeight: 700 }}>
            Category / Topic
          </Typography>
          <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <ListSubheader disableSticky sx={{ fontWeight: 800 }}>General</ListSubheader>
            <MenuItem value="personal">📌 Personal / Daily Goal</MenuItem>
            <MenuItem value="general">📌 Other / General</MenuItem>
            {(orderedPhases || phases).map((phase, pIdx) => [
              <ListSubheader key={`task-phase-${phase.id}`} disableSticky sx={{ fontWeight: 800, color: 'text.primary' }}>
                Topic {String(pIdx + 1).padStart(2, '0')}: {phase.name}
              </ListSubheader>,
              <MenuItem key={`phase-${phase.id}`} value={`phase-${phase.id}`} sx={{ fontWeight: 650 }}>
                Entire Topic {String(pIdx + 1).padStart(2, '0')}
              </MenuItem>,
              ...phase.topics.map((t) => (
                <MenuItem key={t.id} value={t.id} sx={{ pl: 4 }}>
                  {t.name}
                </MenuItem>
              )),
            ])}
          </Select>
        </FormControl>
        <Box className="form-two-col">
          <TextField
            label="Due date (optional)"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontWeight: 700 }}>Priority</Typography>
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <MenuItem value="Low">Low</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="High">High</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <FormControl fullWidth>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontWeight: 700 }}>
            Repeat (Recurrence)
          </Typography>
          <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value as any)}>
            <MenuItem value="Never">Never (One-time task)</MenuItem>
            <MenuItem value="Daily">Daily</MenuItem>
            <MenuItem value="Weekdays">Weekdays (Mon - Fri)</MenuItem>
            <MenuItem value="Weekly">Weekly</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Notes (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          multiline
          minRows={2}
        />
      </Stack>
    </DialogContent>
    <DialogActions className="dialog-actions">
      <Button onClick={onClose} color="inherit">Cancel</Button>
      <Button onClick={submit} variant="contained" disabled={!title.trim()}>
        {initial ? 'Save changes' : 'Add task'}
      </Button>
    </DialogActions>
  </Dialog>;
}

function NoteDialog({ open, initial, onClose, onSave }: { open: boolean; initial: Note | null; onClose: () => void; onSave: (note: Omit<Note, 'id' | 'updatedAt'> & Partial<Pick<Note, 'id' | 'updatedAt'>>) => void }) {
  const isMobile = useMediaQuery('(max-width:600px)');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [topicId, setTopicId] = useState('personal');
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setTitle(initial?.title || '');
    setContent(initial?.content || '');
    setTopicId(initial?.topicId || 'personal');
    setPinned(initial?.pinned || false);
  }, [initial, open]);

  const submit = () => onSave({ id: initial?.id, title: title.trim() || 'Untitled note', content, topicId, pinned });

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile} className="note-dialog form-fullscreen-dialog">
    <DialogTitle className="dialog-title">
      <span className="dialog-icon note"><NotebookPen size={19}/></span>
      <Box>
        <Typography variant="h3">{initial ? 'Edit note' : 'A fresh page'}</Typography>
        <Typography color="text.secondary" variant="body2">Capture an idea while it’s still fresh.</Typography>
      </Box>
      <IconButton onClick={onClose} aria-label="Close note editor" sx={{ ml: 'auto' }}><X size={19}/></IconButton>
    </DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        <TextField
          label="Note title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <TextField
          label="Your note"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          multiline
          minRows={7}
        />
        <FormControl fullWidth>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontWeight: 700 }}>
            Category / Topic
          </Typography>
          <Select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <ListSubheader disableSticky sx={{ fontWeight: 800 }}>General</ListSubheader>
            <MenuItem value="personal">📌 Personal / Daily Goal</MenuItem>
            <MenuItem value="general">📌 Other / General</MenuItem>
            {phases.map((phase) => [
              <ListSubheader key={`note-phase-${phase.id}`} disableSticky sx={{ fontWeight: 800, color: 'text.primary' }}>
                Phase {phase.id}: {phase.name}
              </ListSubheader>,
              <MenuItem key={`phase-${phase.id}`} value={`phase-${phase.id}`} sx={{ fontWeight: 650 }}>
                Entire Phase {phase.id}
              </MenuItem>,
              ...phase.topics.map((t) => (
                <MenuItem key={t.id} value={t.id} sx={{ pl: 4 }}>
                  {t.name}
                </MenuItem>
              )),
            ])}
          </Select>
        </FormControl>
        <Button variant={pinned ? 'contained' : 'outlined'} startIcon={<Pin size={16}/>} onClick={() => setPinned((v) => !v)} sx={{ alignSelf: 'flex-start' }}>
          {pinned ? 'Pinned note' : 'Pin this note'}
        </Button>
      </Stack>
    </DialogContent>
    <DialogActions className="dialog-actions">
      <Button onClick={onClose} color="inherit">Cancel</Button>
      <Button onClick={submit} variant="contained">Save note</Button>
    </DialogActions>
  </Dialog>;
}

function SettingsDialog({
  open,
  onClose,
  state,
  syncStatus,
  isGuest = false,
  userEmail = 'Guest Explorer',
  streak = 0,
  totalMinutes = 0,
  masteredCount = 0,
  onToggle,
  onInterval,
  onTimes,
  onHistory,
  onResumes,
  onProjects,
  onImport,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  state: AppState;
  syncStatus: 'syncing' | 'synced' | 'offline' | 'error';
  isGuest?: boolean;
  userEmail?: string;
  streak?: number;
  totalMinutes?: number;
  masteredCount?: number;
  onToggle: (enabled: boolean) => void;
  onInterval: (m: number) => void;
  onTimes: (start: string, end: string) => void;
  onHistory: () => void;
  onResumes: () => void;
  onProjects: () => void;
  onImport: (imported: Partial<AppState>) => void;
  onLogout: () => void;
}) {
  const isMobile = useMediaQuery('(max-width:600px)');
  const [start, setStart] = useState(state.reminders.startTime);
  const [end, setEnd] = useState(state.reminders.endTime);
  useEffect(() => { setStart(state.reminders.startTime); setEnd(state.reminders.endTime); }, [state.reminders.startTime, state.reminders.endTime, open]);
  const syncCopy = isGuest ? { label: 'Guest (Local)', detail: 'Your workspace is stored locally on this device in guest mode.', color: 'default' as const } : syncStatus === 'synced' ? { label: 'Synced', detail: 'Your workspace is securely synced to your account.', color: 'success' as const } : syncStatus === 'syncing' ? { label: 'Syncing', detail: 'Saving your latest changes securely.', color: 'primary' as const } : { label: syncStatus === 'offline' ? 'Offline' : 'Sync issue', detail: 'Your latest changes remain on this device and will retry when the connection is available.', color: 'warning' as const };
  const handleDone = () => {
    if (start < end && (start !== state.reminders.startTime || end !== state.reminders.endTime)) {
      onTimes(start, end);
    }
    onClose();
  };
  return (
    <Dialog className="settings-dialog form-fullscreen-dialog" open={open} onClose={handleDone} fullWidth maxWidth="sm" fullScreen={isMobile} scroll="paper">
      <DialogTitle className="dialog-title">
        <span className="dialog-icon focus"><User size={20}/></span>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h3">Profile & Settings</Typography>
          <Typography variant="body2" color="text.secondary">Your Orbit workspace & account preferences.</Typography>
        </Box>
        <IconButton onClick={handleDone} aria-label="Close profile & settings" sx={{ ml: 'auto' }}><X size={19}/></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {/* User Profile Banner Card */}
          <Paper className="profile-hero-card" elevation={0}>
            <Box className="profile-hero-top">
              <Avatar className="profile-hero-avatar">
                {userEmail?.slice(0, 1).toUpperCase() || 'V'}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography className="profile-hero-name" noWrap>
                  {isGuest ? 'Guest Explorer' : userEmail}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 0.5, flexWrap: 'wrap' }}>
                  <span className={`profile-status-pill ${isGuest ? 'guest' : 'cloud'}`}>
                    {isGuest ? <ShieldCheck size={12} /> : <Cloud size={12} />}
                    {isGuest ? 'Offline Guest Mode' : 'Cloud Synchronized'}
                  </span>
                  <span className="profile-role-pill">SDE Aspirant</span>
                </Box>
              </Box>
            </Box>
            <Box className="profile-hero-stats">
              <Box className="profile-stat-item">
                <strong>{streak}</strong>
                <span>Day Streak 🔥</span>
              </Box>
              <Box className="profile-stat-item">
                <strong>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</strong>
                <span>Focus Logged ⏱️</span>
              </Box>
              <Box className="profile-stat-item">
                <strong>{masteredCount}</strong>
                <span>Mastered Topics 🎯</span>
              </Box>
            </Box>

            <Divider sx={{ my: 0.5, borderColor: 'rgba(220,230,250,.8)' }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Developer Profiles & Portfolio
              </Typography>
              <Box className="profile-social-links">
                <a
                  href={DEV_LINKS.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link-btn github"
                  onClick={(e) => {
                    e.stopPropagation();
                    openExternalUrl(DEV_LINKS.github);
                  }}
                >
                  <Github size={14} />
                  <span>GitHub</span>
                  <ArrowUpRight size={12} style={{ opacity: 0.7 }} />
                </a>
                <a
                  href={DEV_LINKS.portfolio}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link-btn portfolio"
                  onClick={(e) => {
                    e.stopPropagation();
                    openExternalUrl(DEV_LINKS.portfolio);
                  }}
                >
                  <Globe size={14} />
                  <span>Portfolio</span>
                  <ArrowUpRight size={12} style={{ opacity: 0.7 }} />
                </a>
                <a
                  href={DEV_LINKS.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link-btn linkedin"
                  onClick={(e) => {
                    e.stopPropagation();
                    openExternalUrl(DEV_LINKS.linkedin);
                  }}
                >
                  <Linkedin size={14} />
                  <span>LinkedIn</span>
                  <ArrowUpRight size={12} style={{ opacity: 0.7 }} />
                </a>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.8, borderRadius: 2, background: 'rgba(241, 245, 249, 0.8)', border: '1px solid #e2e8f0', mt: 1, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                <Mail size={14} style={{ color: '#64748b', flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', userSelect: 'all', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {DEV_LINKS.email}
                </Typography>
              </Box>
            </Box>
          </Paper>

          <Paper className="settings-section" elevation={0} sx={{ overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
            <Box className="settings-row" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, width: '100%', minWidth: 0, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <span className="dialog-icon note" style={{ width: 40, height: 40, borderRadius: 12, background: '#eff4ff', color: '#3563e9', flexShrink: 0 }}>
                  <FileText size={20}/>
                </span>
                <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <Typography fontWeight={800} sx={{ fontSize: { xs: 13.5, sm: 14 }, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Resumes & Applications
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 11, sm: 12 }, mt: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(state.resumes || []).length} application{(state.resumes || []).length === 1 ? '' : 's'} saved with attached resumes
                  </Typography>
                </Box>
              </Box>
              <Button variant="contained" size="small" onClick={onResumes} sx={{ flexShrink: 0, borderRadius: 2.5, px: 2, minWidth: { xs: '100%', sm: 'fit-content' }, fontWeight: 750 }}>
                Manage
              </Button>
            </Box>
          </Paper>

          <Paper className="settings-section" elevation={0} sx={{ overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
            <Box className="settings-row" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, width: '100%', minWidth: 0, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <span className="dialog-icon note" style={{ width: 40, height: 40, borderRadius: 12, background: '#f5f3ff', color: '#7c3aed', flexShrink: 0 }}>
                  <FolderGit2 size={20}/>
                </span>
                <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <Typography fontWeight={800} sx={{ fontSize: { xs: 13.5, sm: 14 }, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Projects & Portfolio
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 11, sm: 12 }, mt: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(state.projects || []).length} project{(state.projects || []).length === 1 ? '' : 's'} with GitHub & live links
                  </Typography>
                </Box>
              </Box>
              <Button variant="contained" size="small" onClick={onProjects} sx={{ flexShrink: 0, borderRadius: 2.5, px: 2, minWidth: { xs: '100%', sm: 'fit-content' }, fontWeight: 750 }}>
                Showcase
              </Button>
            </Box>
          </Paper>

          <Paper className="settings-section" elevation={0}>
            <Box className="settings-row">
              <Box>
                <Typography fontWeight={800}>Study check-in reminders</Typography>
                <Typography variant="body2" color="text.secondary">Choose a rhythm that works for you.</Typography>
              </Box>
              <Switch checked={state.reminders.enabled} onChange={(e) => onToggle(e.target.checked)} />
            </Box>
            <Divider sx={{ my: 1.5 }}/>
            <Typography variant="caption" color="text.secondary" fontWeight={800}>REMIND ME EVERY</Typography>
            <Box className="interval-options">
              {[{ label: '30 min', value: 30 }, { label: '1 hour', value: 60 }, { label: '2 hours', value: 120 }, { label: '3 hours', value: 180 }].map((item) => (
                <button key={item.value} className={state.reminders.intervalMinutes === item.value ? 'selected' : ''} onClick={() => onInterval(item.value)}>
                  {item.label}
                </button>
              ))}
            </Box>
            <Box className="form-two-col">
              <TextField label="Active from" type="time" value={start} onChange={(e) => setStart(e.target.value)} InputLabelProps={{ shrink: true }}/>
              <TextField label="Active until" type="time" value={end} onChange={(e) => setEnd(e.target.value)} InputLabelProps={{ shrink: true }}/>
            </Box>
            <Button variant="outlined" onClick={() => onTimes(start, end)} disabled={start >= end} sx={{ mt: 1.2 }}>
              Save active hours
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, lineHeight: 1.5 }}>
              Turning reminders off or dismissing a check-in asks for a reason. Device settings may still allow system notifications to be swiped away.
            </Typography>
          </Paper>

          <Paper className="settings-section" elevation={0}>
            <Box className="settings-row">
              <Box>
                <Typography fontWeight={800}>Reminder history</Typography>
                <Typography variant="body2" color="text.secondary">Review your check-ins and the reasons recorded.</Typography>
              </Box>
              <Button onClick={onHistory} size="small" variant="outlined">View</Button>
            </Box>
          </Paper>

          <Paper className="settings-section" elevation={0}>
            <Box className="settings-row">
              <Box>
                <Typography fontWeight={800}>Cloud & data</Typography>
                <Typography variant="body2" color="text.secondary">{syncCopy.detail}</Typography>
              </Box>
              <Chip size="small" color={syncCopy.color} label={syncCopy.label}/>
            </Box>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `orbit-backup-${todayLocalISO()}.json`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
              >
                Export JSON
              </Button>
              <Button
                fullWidth
                variant="outlined"
                component="label"
              >
                Import JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      try {
                        const parsed = JSON.parse(evt.target?.result as string);
                        onImport(parsed);
                      } catch {
                        alert('Could not parse JSON backup file.');
                      }
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                />
              </Button>
            </Stack>
          </Paper>

          <Box sx={{ pt: 1, pb: 0.5 }}>
            <Button color="error" variant="outlined" startIcon={<LogOut size={16}/>} onClick={onLogout} sx={{ borderRadius: 3, fontWeight: 750 }}>
              {isGuest ? 'Exit Guest Mode' : 'Sign out of Orbit'}
            </Button>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions className="dialog-actions">
        <Button onClick={handleDone} variant="contained">Done</Button>
      </DialogActions>
    </Dialog>
  );
}
function ResumesDialog({ open, state, onClose, onAddNew, onEdit, onDelete }: { open: boolean; state: AppState; onClose: () => void; onAddNew: () => void; onEdit: (app: ResumeApplication) => void; onDelete: (id: string) => void }) {
  const isMobile = useMediaQuery('(max-width:600px)');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ApplicationStatus>('All');
  const resumes = state.resumes || [];

  const filtered = resumes.filter((item) => {
    const matchSearch = `${item.company} ${item.role} ${item.whereApplied} ${item.notes || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' ? true : item.status === statusFilter;
    return matchSearch && matchStatus;
  }).sort((a, b) => (b.appliedDate || '').localeCompare(a.appliedDate || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));

  const totalCount = resumes.length;
  const activeCount = resumes.filter((r) => r.status === 'Applied' || r.status === 'Screening' || r.status === 'Interviewing').length;
  const offerCount = resumes.filter((r) => r.status === 'Offer').length;

  return (
    <Dialog className="resumes-dialog form-fullscreen-dialog" open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={isMobile} scroll="paper">
      <DialogTitle className="dialog-title" sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, p: { xs: '16px 16px 12px !important', sm: '20px 24px 16px !important' }, boxSizing: 'border-box', width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flex: 1, minWidth: 0, width: '100%' }}>
          <span className="dialog-icon task" style={{ flexShrink: 0 }}><Briefcase size={20} /></span>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h3" sx={{ fontSize: { xs: 16, sm: 18 }, fontWeight: 850 }}>Resumes & Applications</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 11, sm: 12 }, lineHeight: 1.35, mt: 0.2 }}>
              Track applications and saved resume files (PDF/Word).
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Close dialog" sx={{ display: { xs: 'inline-flex', sm: 'none' }, ml: 'auto', flexShrink: 0 }}>
            <X size={19} />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'flex-start', sm: 'flex-end' }, flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}>
          <Button variant="contained" size="small" startIcon={<Plus size={16} />} onClick={onAddNew} sx={{ borderRadius: 2.5, px: 2, fontWeight: 750, width: { xs: '100%', sm: 'auto' }, minHeight: 38 }}>
            New application
          </Button>
          <IconButton onClick={onClose} aria-label="Close dialog" sx={{ display: { xs: 'none', sm: 'inline-flex' }, ml: 0.5 }}>
            <X size={19} />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box className="resumes-summary-grid">
          <Paper className="resumes-summary-card" elevation={0}>
            <Box className="proj-stat-head">
              <span>TOTAL</span>
              <span className="proj-stat-icon"><Briefcase size={14} /></span>
            </Box>
            <strong>{totalCount}</strong>
            <span className="proj-stat-sub">Tracked</span>
          </Paper>
          <Paper className="resumes-summary-card" elevation={0}>
            <Box className="proj-stat-head">
              <span>ACTIVE</span>
              <span className="proj-stat-icon blue"><Activity size={14} /></span>
            </Box>
            <strong style={{ color: '#2563eb' }}>{activeCount}</strong>
            <span className="proj-stat-sub">Pipeline</span>
          </Paper>
          <Paper className="resumes-summary-card" elevation={0}>
            <Box className="proj-stat-head">
              <span>OFFERS</span>
              <span className="proj-stat-icon mint"><Trophy size={14} /></span>
            </Box>
            <strong style={{ color: '#16a34a' }}>{offerCount}</strong>
            <span className="proj-stat-sub">Received</span>
          </Paper>
        </Box>

        <Box className="resumes-toolbar">
          <TextField
            size="small"
            placeholder="Search applications…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="resumes-search-field"
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>,
              endAdornment: search ? <InputAdornment position="end"><IconButton size="small" onClick={() => setSearch('')}><X size={14} /></IconButton></InputAdornment> : undefined,
            }}
          />
          <Box className="resume-filters">
            {(['All', 'Applied', 'Screening', 'Interviewing', 'Offer', 'Rejected'] as const).map((s) => (
              <button
                key={s}
                className={statusFilter === s ? 'selected' : ''}
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </button>
            ))}
          </Box>
        </Box>

        {filtered.length === 0 ? (
          <Paper className="empty-state" elevation={0}>
            <span className="empty-bubble"><Briefcase size={26} /></span>
            <Typography variant="h3">{resumes.length === 0 ? 'No resumes saved yet' : 'No matching applications'}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.6, maxWidth: 360 }}>
              {resumes.length === 0
                ? 'Save your tailored resumes (PDF or Word), track company names, where you applied, and status.'
                : 'Try adjusting your search query or status filter.'}
            </Typography>
            {resumes.length === 0 && (
              <Button variant="contained" sx={{ mt: 2.5 }} startIcon={<Plus size={16} />} onClick={onAddNew}>
                Save your first resume
              </Button>
            )}
          </Paper>
        ) : (
          <Box className="resumes-list">
            {filtered.map((app) => {
              const isWord = app.fileName?.endsWith('.doc') || app.fileName?.endsWith('.docx');
              return (
                <Paper className="resume-card" elevation={0} key={app.id}>
                  <Box className="resume-card-head">
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography className="resume-company">{app.company}</Typography>
                        <span className={`app-status-badge app-status-${app.status.toLowerCase()}`}>
                          {app.status}
                        </span>
                      </Box>
                      <Typography className="resume-role">{app.role}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <IconButton size="small" onClick={() => onEdit(app)} aria-label="Edit application"><MoreHorizontal size={18} /></IconButton>
                      <IconButton size="small" onClick={() => onDelete(app.id)} aria-label="Delete application"><Trash2 size={16} /></IconButton>
                    </Box>
                  </Box>

                  <Box className="resume-meta-row">
                    <span className="resume-portal-pill">
                      <ExternalLink size={12} /> {app.whereApplied || 'Direct / Other'}
                    </span>
                    <span className="resume-date-pill">
                      <CalendarDays size={12} /> Applied {app.appliedDate || 'Recently'}
                    </span>
                  </Box>

                  {app.notes && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, lineHeight: 1.5, background: '#f8fafc', p: 1.2, borderRadius: 2 }}>
                      {app.notes}
                    </Typography>
                  )}

                  {app.fileData && isSafeResumeDataUrl(app.fileData) ? (
                    <Box sx={{ mt: 0.5, width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
                      <a
                        href={app.fileData}
                        download={app.fileName || `${app.company}_Resume.pdf`}
                        className={`resume-file-action ${isWord ? 'word' : ''}`}
                        title={`Download ${app.fileName || 'Resume'}`}
                      >
                        <Paperclip size={14} style={{ flexShrink: 0 }} />
                        <span className="resume-filename-text">{app.fileName || 'Resume'}</span>
                        {app.fileSize > 0 && (
                          <span className="resume-filesize-text">({Math.round(app.fileSize / 1024)} KB)</span>
                        )}
                        <Download size={14} style={{ flexShrink: 0, marginLeft: 'auto' }} />
                      </a>
                    </Box>
                  ) : app.fileData ? (
                    <Typography variant="caption" color="error.main" sx={{ fontStyle: 'italic' }}>
                      Attached file is not a supported document format.
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No resume file attached
                    </Typography>
                  )}
                </Paper>
              );
            })}
          </Box>
        )}
      </DialogContent>
      <DialogActions className="dialog-actions">
        <Button onClick={onClose} variant="contained">Done</Button>
      </DialogActions>
    </Dialog>
  );
}

const WHERE_OPTIONS = [
  'LinkedIn',
  'NxtWave',
  'Company Careers Portal',
  'Employee Referral',
  'Wellfound / AngelList',
  'Indeed',
  'Naukri',
  'Campus Placement',
  'Cold Email / Outreach',
  'Other',
];

function ResumeFormDialog({ open, initial, onClose, onSave }: { open: boolean; initial: ResumeApplication | null; onClose: () => void; onSave: (draft: Omit<ResumeApplication, 'id' | 'createdAt'> & Partial<Pick<ResumeApplication, 'id' | 'createdAt'>>) => void }) {
  const isMobile = useMediaQuery('(max-width:600px)');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [whereApplied, setWhereApplied] = useState('LinkedIn');
  const [customWhere, setCustomWhere] = useState('');
  const [appliedDate, setAppliedDate] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('Applied');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [fileType, setFileType] = useState('');
  const [fileData, setFileData] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompany(initial?.company || '');
    setRole(initial?.role || '');
    const preset = WHERE_OPTIONS.includes(initial?.whereApplied || '') ? initial?.whereApplied : initial?.whereApplied ? 'Other' : 'LinkedIn';
    setWhereApplied(preset || 'LinkedIn');
    setCustomWhere(preset === 'Other' ? initial?.whereApplied || '' : '');
    setAppliedDate(initial?.appliedDate || todayLocalISO());
    setStatus(initial?.status || 'Applied');
    setFileName(initial?.fileName || '');
    setFileSize(initial?.fileSize || 0);
    setFileType(initial?.fileType || '');
    setFileData(initial?.fileData);
    setNotes(initial?.notes || '');
    setFileError(null);
  }, [initial, open]);

  const processFile = (file: File) => {
    setFileError(null);
    const validExtensions = ['.pdf', '.doc', '.docx'];
    const nameLower = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => nameLower.endsWith(ext));
    if (!hasValidExt) {
      setFileError('Invalid file type. Please upload a PDF (.pdf) or Word document (.doc, .docx).');
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      setFileError('File size exceeds 2.5MB limit. Please upload a smaller document.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!isSafeResumeDataUrl(dataUrl)) {
        setFileError('The file content is not a supported document format.');
        return;
      }
      setFileData(dataUrl);
      setFileName(file.name);
      setFileSize(file.size);
      setFileType(file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'application/msword'));
    };
    reader.onerror = () => {
      setFileError('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const removeFile = () => {
    setFileData(undefined);
    setFileName('');
    setFileSize(0);
    setFileType('');
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submit = () => {
    if (!company.trim() || !role.trim()) return;
    const finalWhere = whereApplied === 'Other' && customWhere.trim() ? customWhere.trim() : whereApplied;
    onSave({
      id: initial?.id,
      createdAt: initial?.createdAt,
      company: company.trim(),
      role: role.trim(),
      whereApplied: finalWhere,
      appliedDate: appliedDate || todayLocalISO(),
      status,
      fileName,
      fileSize,
      fileType,
      fileData,
      notes: notes.trim(),
    });
  };

  const isWord = fileName?.endsWith('.doc') || fileName?.endsWith('.docx');

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile} className="resume-form-dialog form-fullscreen-dialog">
      <DialogTitle className="dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: { xs: '16px 16px 12px !important', sm: '20px 24px 16px !important' }, boxSizing: 'border-box', width: '100%' }}>
        <span className="dialog-icon note" style={{ background: '#eaf0ff', color: '#3563e9', flexShrink: 0 }}>
          <Briefcase size={20} />
        </span>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h3" sx={{ fontSize: { xs: 16, sm: 18 }, fontWeight: 850 }}>{initial ? 'Edit Application' : 'Save Resume & Application'}</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ fontSize: { xs: 11, sm: 12 }, mt: 0.2 }}>Attach tailored resume & track application.</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close dialog" sx={{ ml: 'auto', flexShrink: 0 }}><X size={19} /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {fileError && <Alert severity="error" sx={{ borderRadius: 2 }}>{fileError}</Alert>}
          <TextField
            label="Company name"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="Role / Position"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          />
          <Box className="form-two-col">
            <FormControl fullWidth>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontWeight: 750 }}>Where did you apply?</Typography>
              <Select value={whereApplied} onChange={(e) => setWhereApplied(e.target.value)}>
                {WHERE_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontWeight: 750 }}>Application status</Typography>
              <Select value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus)}>
                <MenuItem value="Applied">Applied</MenuItem>
                <MenuItem value="Screening">Screening / OA</MenuItem>
                <MenuItem value="Interviewing">Interviewing</MenuItem>
                <MenuItem value="Offer">Offer Received</MenuItem>
                <MenuItem value="Rejected">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {whereApplied === 'Other' && (
            <TextField
              label="Specify portal or platform"
              value={customWhere}
              onChange={(e) => setCustomWhere(e.target.value)}
            />
          )}

          <TextField
            label="Applied date"
            type="date"
            value={appliedDate}
            onChange={(e) => setAppliedDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.8, display: 'block', fontWeight: 750 }}>
              Attach Resume File (PDF, DOC, DOCX — Max 2.5MB)
            </Typography>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: 'none' }}
            />
            {fileData ? (
              <Box sx={{ p: 1.5, border: '1px solid #dce5ff', borderRadius: 3, background: '#f4f7ff', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 1.2, maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  <FileText size={22} color={isWord ? '#1d4ed8' : '#dc2626'} style={{ flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                    <Typography
                      fontWeight={750}
                      sx={{
                        fontSize: 13,
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        display: 'block',
                        maxWidth: '100%',
                      }}
                      title={fileName}
                    >
                      {fileName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {Math.round(fileSize / 1024)} KB · Attached
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.8, justifyContent: { xs: 'flex-end', sm: 'flex-start' }, flexShrink: 0 }}>
                  <Button size="small" variant="outlined" onClick={() => fileInputRef.current?.click()} sx={{ borderRadius: 2 }}>Change</Button>
                  <Button size="small" color="error" variant="outlined" onClick={removeFile} sx={{ borderRadius: 2 }}>Remove</Button>
                </Box>
              </Box>
            ) : (
              <Box
                className="file-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) processFile(file);
                }}
                role="button"
                tabIndex={0}
                aria-label="Upload resume file"
              >
                <UploadCloud size={28} color="#3563e9" style={{ margin: '0 auto 6px' }} />
                <Typography fontWeight={750} sx={{ fontSize: 13 }}>Click or drag & drop Resume file here</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.4 }}>
                  Supports PDF (.pdf) and Word documents (.doc, .docx) up to 2.5MB
                </Typography>
              </Box>
            )}
          </Box>

          <TextField
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions className="dialog-actions">
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={submit} variant="contained" disabled={!company.trim() || !role.trim()}>
          {initial ? 'Save changes' : 'Save application'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ProjectFormDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: PortfolioProject | null;
  onClose: () => void;
  onSave: (project: Omit<PortfolioProject, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<PortfolioProject, 'id' | 'createdAt' | 'updatedAt'>>) => void;
}) {
  const isMobile = useMediaQuery('(max-width:600px)');
  const [title, setTitle] = useState('');
  const [tagline, setTagline] = useState('');
  const [summary, setSummary] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [techInput, setTechInput] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('Active');
  const [featured, setFeatured] = useState(false);
  const [challenges, setChallenges] = useState('');
  const [starStory, setStarStory] = useState('');

  useEffect(() => {
    setTitle(initial?.title || '');
    setTagline(initial?.tagline || '');
    setSummary(initial?.summary || '');
    setGithubUrl(initial?.githubUrl || '');
    setLiveUrl(initial?.liveUrl || '');
    setTechInput(initial?.techStack ? initial.techStack.join(', ') : '');
    setStatus(initial?.status || 'Active');
    setFeatured(Boolean(initial?.featured));
    setChallenges(initial?.challenges || '');
    setStarStory(initial?.starStory || '');
  }, [initial, open]);

  const submit = () => {
    if (!title.trim() || !tagline.trim() || !githubUrl.trim()) return;
    const techStack = techInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onSave({
      id: initial?.id,
      createdAt: initial?.createdAt,
      title: title.trim(),
      tagline: tagline.trim(),
      summary: summary.trim(),
      githubUrl: githubUrl.trim(),
      liveUrl: liveUrl.trim() || undefined,
      techStack,
      status,
      featured,
      challenges: challenges.trim() || undefined,
      starStory: starStory.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile} className="project-form-dialog form-fullscreen-dialog">
      <DialogTitle className="dialog-title">
        <span className="dialog-icon note" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
          <FolderGit2 size={20} />
        </span>
        <Box>
          <Typography variant="h3">{initial ? 'Edit Project' : 'Add Project to Portfolio'}</Typography>
          <Typography color="text.secondary" variant="body2">
            Store live links, GitHub repository, tech stack, and interview talking points.
          </Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Close dialog" sx={{ ml: 'auto' }}>
          <X size={19} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Project title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="One-line tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            required
          />

          <Box className="form-two-col">
            <FormControl fullWidth>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontWeight: 750 }}>
                Status
              </Typography>
              <Select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="In Progress">In Progress</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Archived">Archived</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', alignItems: 'center', pt: 2.5 }}>
              <Button
                variant={featured ? 'contained' : 'outlined'}
                onClick={() => setFeatured((v) => !v)}
                startIcon={<Star size={16} fill={featured ? '#fff' : 'none'} />}
                fullWidth
                sx={{
                  height: 40,
                  bgcolor: featured ? '#f59e0b' : undefined,
                  borderColor: featured ? '#f59e0b' : undefined,
                  color: featured ? '#fff' : undefined,
                  '&:hover': { bgcolor: featured ? '#d97706' : undefined },
                }}
              >
                {featured ? 'Featured ⭐' : 'Pin to top'}
              </Button>
            </Box>
          </Box>

          <TextField
            label="GitHub repository URL"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            required
            placeholder="https://github.com/..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Github size={17} />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Live demo URL (optional)"
            value={liveUrl}
            onChange={(e) => setLiveUrl(e.target.value)}
            placeholder="https://..."
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Globe size={17} />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Tech stack (comma-separated)"
            value={techInput}
            onChange={(e) => setTechInput(e.target.value)}
          />

          <TextField
            label="Summary / Overview"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            multiline
            minRows={3}
          />

          <TextField
            label="Key Architecture & Technical Challenges (optional)"
            value={challenges}
            onChange={(e) => setChallenges(e.target.value)}
            multiline
            minRows={2}
          />

          <TextField
            label="SDE Interview Talking Points (STAR Method) (optional)"
            value={starStory}
            onChange={(e) => setStarStory(e.target.value)}
            multiline
            minRows={3}
            placeholder="Situation, Task, Action, Result..."
          />
        </Stack>
      </DialogContent>
      <DialogActions className="dialog-actions">
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={submit}
          variant="contained"
          disabled={!title.trim() || !tagline.trim() || !githubUrl.trim()}
        >
          {initial ? 'Save changes' : 'Add project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ReasonDialog({ open, action, reason, setReason, otherReason, setOtherReason, onClose, onSubmit }: { open: boolean; action: ReminderAction | null; reason: string; setReason: (s: string) => void; otherReason: string; setOtherReason: (s: string) => void; onClose: () => void; onSubmit: () => void }) {
  const label = action === 'disabled' ? 'turn reminders off' : action === 'snoozed' ? 'snooze this reminder' : action === 'skipped' ? 'skip this check-in' : action === 'paused' ? 'pause this check-in' : 'complete this check-in';
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs"><DialogTitle className="reason-title"><span className="dialog-icon focus"><MessageCircleIcon /></span><Typography variant="h3">Before you {label}</Typography><IconButton onClick={onClose} sx={{ ml: 'auto' }}><X size={18}/></IconButton></DialogTitle><DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.6 }}>A quick reason helps you understand your habits later. Choose the closest match.</Typography><Stack spacing={1}>{REASONS.map((r) => <button key={r} className={`reason-option ${reason === r ? 'selected' : ''}`} onClick={() => setReason(r)}><span className="reason-radio">{reason === r && <span/>}</span>{r}</button>)}</Stack>{reason === 'Other' && <TextField sx={{ mt: 2 }} label="Tell us why" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} multiline minRows={2} required/>}</DialogContent><DialogActions className="dialog-actions"><Button color="inherit" onClick={onClose}>Go back</Button><Button variant="contained" onClick={onSubmit} disabled={!reason || (reason === 'Other' && !otherReason.trim())}>Save reason</Button></DialogActions></Dialog>;
}
function MessageCircleIcon() { return <Bell size={18}/>; }

function ReminderDialog({ open, state, onAction, onClose }: { open: boolean; state: AppState; onAction: (action: ReminderAction) => void; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason !== 'backdropClick' && reason !== 'escapeKeyDown') onClose();
      }}
      disableEscapeKeyDown
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle className="reminder-dialog-head">
        <span className="reminder-dialog-icon"><Bell size={21}/></span>
        <Typography variant="h2" sx={{ mt: 1.4 }}>A little check-in</Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.6 }}>What’s happening right now?</Typography>
      </DialogTitle>
      <DialogContent>
        <Box className="reminder-context">
          <span className="mini-wave">✦</span>
          <Typography fontWeight={800}>No judgement. Just awareness.</Typography>
          <Typography color="text.secondary" variant="body2">Record a reason to close this reminder. It becomes part of your history.</Typography>
        </Box>
        <Stack spacing={1.1} sx={{ mt: 2 }}>
          <Button variant="contained" fullWidth onClick={() => onAction('completed')} startIcon={<CheckCircle2 size={17}/>}>
            I’m on track
          </Button>
          <Button variant="outlined" fullWidth onClick={() => onAction('snoozed')} startIcon={<Clock3 size={17}/>}>
            Snooze for 15 minutes
          </Button>
          <Button variant="text" fullWidth color="inherit" onClick={() => onAction('skipped')}>
            Skip this check-in
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions className="dialog-actions" sx={{ justifyContent: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', width: '100%' }}>
          Every response needs a reason.
        </Typography>
      </DialogActions>
    </Dialog>
  );
}

function HistoryDialog({ open, state, onClose }: { open: boolean; state: AppState; onClose: () => void }) {
  const isMobile = useMediaQuery('(max-width:600px)');
  const items = [...state.reminderHistory, ...state.sessions.map((s) => ({ id: s.id, kind: 'completed' as const, reason: `Focus session · ${s.durationMinutes} minutes on ${topicName(s.topicId)}`, createdAt: s.startedAt }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={isMobile} className="history-dialog form-fullscreen-dialog"><DialogTitle className="dialog-title"><span className="dialog-icon focus"><Activity size={19}/></span><Box><Typography variant="h3">Your activity history</Typography><Typography color="text.secondary" variant="body2">A record of showing up, your way.</Typography></Box><IconButton onClick={onClose} sx={{ ml: 'auto' }}><X size={18}/></IconButton></DialogTitle><DialogContent>{items.length === 0 ? <Box className="empty-state compact"><span className="empty-bubble"><Clock3 size={22}/></span><Typography fontWeight={800}>Your history starts here.</Typography><Typography color="text.secondary" variant="body2">Check-ins and focus sessions will appear here.</Typography></Box> : <Box className="history-list">{items.map((item) => <Box className="history-row" key={item.id}><span className={`history-marker kind-${item.kind}`}>{item.kind === 'completed' ? <Check size={14}/> : item.kind === 'skipped' ? <X size={13}/> : <Clock3 size={13}/>}</span><Box sx={{ flex: 1 }}><Typography fontWeight={750}>{item.kind === 'completed' ? 'Completed / checked in' : item.kind === 'skipped' ? 'Skipped check-in' : item.kind === 'snoozed' ? 'Reminder snoozed' : item.kind === 'disabled' ? 'Reminders turned off' : 'Reminder paused'}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{item.reason}</Typography></Box><Typography variant="caption" color="text.secondary">{new Date(item.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Typography></Box>)}</Box>}</DialogContent><DialogActions className="dialog-actions"><Button onClick={onClose} variant="contained">Done</Button></DialogActions></Dialog>;
}
