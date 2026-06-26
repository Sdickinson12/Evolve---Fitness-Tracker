import { useEffect, useState } from 'react';
import {
  endActiveSession, getActiveSession, getAllExercises, getAllTemplates, getAllWorkouts,
  saveActiveSession, saveWorkout, startActiveSession,
} from '../lib/db';
import { personalRecords, toDateKey } from '../lib/calculations';
import { formatElapsed, useElapsedTime } from '../lib/useElapsedTime';
import { IconCalendar, IconEmptyWorkout, IconPlay, IconStop } from '../components/icons';
import Calendar from '../components/Calendar';
import ExerciseBlock from '../components/ExerciseBlock';
import ExercisePickerModal from '../components/ExercisePickerModal';
import TemplatePickerModal from '../components/TemplatePickerModal';
import WorkoutSummaryModal from '../components/WorkoutSummaryModal';
import LoadingState from '../components/LoadingState';
import type { Page } from '../App';
import type { ActiveSession, Exercise, Workout, WorkoutExercise, WorkoutTemplate } from '../types';

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function LogWorkout({ onSaved, onNavigate }: { onSaved: () => void; onNavigate: (p: Page) => void }) {
  const [date, setDate] = useState(toDateKey(new Date()));
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [priorPRs, setPriorPRs] = useState<Record<string, { weight: number; reps: number; date: string }>>({});
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [summary, setSummary] = useState<{ session: ActiveSession; endedAt: number } | null>(null);
  const liveElapsedSec = useElapsedTime(activeSession?.startedAt ?? null);

  useEffect(() => {
    getAllExercises().then(setExercises);
    getAllTemplates().then(setTemplates).catch(() => {});
    // Snapshot of PRs from prior history, taken once, so newly added sets can be checked against it.
    getAllWorkouts().then((all) => {
      setPriorPRs(personalRecords(all));
      setLoggedDates(new Set(all.map((w) => w.date)));
    });
    getActiveSession().then((s) => setActiveSession(s ?? null)).catch(() => {});
  }, []);

  // Load (or create) the workout for the selected date
  useEffect(() => {
    let active = true;
    getAllWorkouts().then((all) => {
      if (!active) return;
      const existing = all.find((w) => w.date === date);
      setWorkout(existing ?? { id: newId(), date, exercises: [], createdAt: Date.now() });
    });
    return () => { active = false; };
  }, [date]);

  // Backdated logging (no active session) is a local draft only — nothing
  // hits storage until the user explicitly saves it, so half-built entries
  // don't pile up in history.
  const persist = (next: Workout) => {
    setWorkout(next);
  };

  const saveDraftWorkout = async () => {
    if (!workout || workout.exercises.length === 0) return;
    await saveWorkout(workout);
    onSaved();
    const all = await getAllWorkouts();
    setPriorPRs(personalRecords(all));
    setLoggedDates(new Set(all.map((w) => w.date)));
    setWorkout({ id: newId(), date, exercises: [], createdAt: Date.now() });
  };

  const persistSession = async (next: ActiveSession) => {
    setActiveSession(next);
    await saveActiveSession(next);
  };

  // While a session is running, every add/edit/remove action targets the
  // in-progress session instead of the date-based workout below — the two
  // are mutually exclusive ways to log, never edited at the same time.
  const addExerciseToWorkout = (ex: Exercise) => {
    const we: WorkoutExercise = { id: newId(), exerciseId: ex.id, exerciseName: ex.name, muscleGroup: ex.muscleGroup, sets: [] };
    if (activeSession) {
      persistSession({ ...activeSession, exercises: [...activeSession.exercises, we] });
    } else if (workout) {
      persist({ ...workout, exercises: [...workout.exercises, we] });
    }
    setShowPicker(false);
  };

  const applyTemplate = (t: WorkoutTemplate) => {
    const added: WorkoutExercise[] = t.exercises.map((te) => ({
      id: newId(), exerciseId: te.exerciseId, exerciseName: te.exerciseName, muscleGroup: te.muscleGroup, sets: [],
    }));
    if (activeSession) {
      persistSession({ ...activeSession, name: t.name, exercises: [...activeSession.exercises, ...added] });
    } else if (workout) {
      persist({ ...workout, name: t.name, exercises: [...workout.exercises, ...added] });
    }
    setShowTemplatePicker(false);
  };

  const addSet = (weId: string, reps: number, weight: number) => {
    if (activeSession) {
      persistSession({
        ...activeSession,
        exercises: activeSession.exercises.map((we) =>
          we.id === weId ? { ...we, sets: [...we.sets, { id: newId(), reps, weight }] } : we
        ),
      });
    } else if (workout) {
      persist({
        ...workout,
        exercises: workout.exercises.map((we) =>
          we.id === weId ? { ...we, sets: [...we.sets, { id: newId(), reps, weight }] } : we
        ),
      });
    }
  };

  const deleteSet = (weId: string, setId: string) => {
    if (activeSession) {
      persistSession({
        ...activeSession,
        exercises: activeSession.exercises.map((we) =>
          we.id === weId ? { ...we, sets: we.sets.filter((s) => s.id !== setId) } : we
        ),
      });
    } else if (workout) {
      persist({
        ...workout,
        exercises: workout.exercises.map((we) =>
          we.id === weId ? { ...we, sets: we.sets.filter((s) => s.id !== setId) } : we
        ),
      });
    }
  };

  const removeExercise = (weId: string) => {
    if (activeSession) {
      persistSession({ ...activeSession, exercises: activeSession.exercises.filter((we) => we.id !== weId) });
    } else if (workout) {
      persist({ ...workout, exercises: workout.exercises.filter((we) => we.id !== weId) });
    }
  };

  const startSession = async () => {
    const fresh = await startActiveSession();
    setActiveSession(fresh);
  };

  const endSessionNow = async () => {
    if (!activeSession) return;
    const endedAt = Date.now();
    await endActiveSession(activeSession, endedAt);
    setConfirmEnd(false);
    if (activeSession.exercises.length > 0) {
      // Hold the summary up before clearing — closeSummary() does the
      // refetch-and-clear once the user dismisses it.
      setSummary({ session: activeSession, endedAt });
    } else {
      setActiveSession(null);
    }
  };

  const closeSummary = async () => {
    setSummary(null);
    setActiveSession(null);
    // The session's exercises were merged into today's date-logged workout in
    // storage — refetch so the date view reflects them immediately instead of
    // showing the stale pre-merge state until the next date change.
    const all = await getAllWorkouts();
    setWorkout(all.find((w) => w.date === date) ?? { id: newId(), date, exercises: [], createdAt: Date.now() });
    setPriorPRs(personalRecords(all));
    setLoggedDates(new Set(all.map((w) => w.date)));
    onSaved();
  };

  if (summary) {
    return <WorkoutSummaryModal session={summary.session} endedAt={summary.endedAt} onClose={closeSummary} />;
  }

  if (!workout) return <LoadingState />;

  const activeExercises = activeSession ? activeSession.exercises : workout.exercises;

  return (
    <div className="stack">
      <h1 className="page-title">Log Workout</h1>
      {!activeSession && (
        <button className="btn btn-block btn-xl" onClick={startSession}><IconPlay size={16} /> Start Workout</button>
      )}

      {activeSession ? (
        <div className="card glow-card row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="col" style={{ gap: 2 }}>
            <span className="stat-label">Session in progress</span>
            <span className="session-timer" style={{ fontSize: 22 }}>{formatElapsed(liveElapsedSec)}</span>
          </div>
          <button className="btn btn-danger" onClick={() => setConfirmEnd(true)}>
            <IconStop size={14} /> End Workout
          </button>
        </div>
      ) : (
        <div className="card col">
          <label className="text-dim" style={{ fontSize: 13 }}>Date</label>
          <div className="row">
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className={`icon-btn calendar-toggle-btn${showCalendar ? ' active' : ''}`}
              onClick={() => setShowCalendar((v) => !v)}
              aria-label="Pick date from calendar"
            ><IconCalendar size={18} /></button>
          </div>

          {showCalendar && (
            <div style={{ marginTop: 12 }}>
              <Calendar
                selected={date}
                markedDates={loggedDates}
                onSelect={(d) => { setDate(d); setShowCalendar(false); }}
              />
            </div>
          )}
        </div>
      )}

      {confirmEnd && activeSession && (
        <div className="modal-overlay" onClick={() => setConfirmEnd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 8 }}>End workout?</h2>
            {activeSession.exercises.length === 0 ? (
              <p className="text-dim" style={{ marginBottom: 20 }}>
                No exercises logged — this session won't be saved.
              </p>
            ) : (
              <p className="text-dim" style={{ marginBottom: 20 }}>
                {activeSession.exercises.length} exercise{activeSession.exercises.length !== 1 ? 's' : ''} logged over {formatElapsed(liveElapsedSec)}. This will be saved to your history.
              </p>
            )}
            <div className="row">
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmEnd(false)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={endSessionNow}>End Workout</button>
            </div>
          </div>
        </div>
      )}

      {activeExercises.map((we) => {
        const matched = exercises.find((ex) => ex.id === we.exerciseId);
        return (
          <ExerciseBlock
            key={we.id}
            we={we}
            priorPR={priorPRs[we.exerciseId]}
            exercise={matched}
            onAddSet={(reps, weight) => addSet(we.id, reps, weight)}
            onDeleteSet={(setId) => deleteSet(we.id, setId)}
            onRemove={() => removeExercise(we.id)}
          />
        );
      })}

      {activeExercises.length === 0 && (
        <div className="empty-state">
          <IconEmptyWorkout className="empty-state-icon" />
          <p>No exercises added yet.</p>
        </div>
      )}

      <div className="row">
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowPicker(true)}>+ Add Exercise</button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowTemplatePicker(true)}>Use Template</button>
      </div>

      {!activeSession && workout.exercises.length > 0 && (
        <button className="btn btn-block" onClick={saveDraftWorkout}>Save Workout</button>
      )}

      {showPicker && (
        <ExercisePickerModal
          exercises={exercises}
          onPick={addExerciseToWorkout}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showTemplatePicker && (
        <TemplatePickerModal
          templates={templates}
          onPick={applyTemplate}
          onClose={() => setShowTemplatePicker(false)}
          onManage={() => { setShowTemplatePicker(false); onNavigate('templates'); }}
        />
      )}
    </div>
  );
}
