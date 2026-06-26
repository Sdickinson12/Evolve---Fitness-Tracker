import { useEffect, useState } from 'react';
import {
  endActiveSession, getActiveSession, getAllExercises, getAllTemplates, saveActiveSession, startActiveSession,
} from '../lib/db';
import { formatElapsed, STALE_SESSION_MS, useElapsedTime } from '../lib/useElapsedTime';
import { IconEmptyWorkout, IconStop } from '../components/icons';
import ExerciseBlock from '../components/ExerciseBlock';
import ExercisePickerModal from '../components/ExercisePickerModal';
import TemplatePickerModal from '../components/TemplatePickerModal';
import WorkoutSummaryModal from '../components/WorkoutSummaryModal';
import LoadingState from '../components/LoadingState';
import type { Page } from '../App';
import type { ActiveSession, Exercise, WorkoutExercise, WorkoutTemplate } from '../types';

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function LiveSession({ onEnded, onNavigate }: { onEnded: () => void; onNavigate: (p: Page) => void }) {
  const [session, setSession] = useState<ActiveSession | null | undefined>(undefined);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [dismissedStale, setDismissedStale] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [summary, setSummary] = useState<{ session: ActiveSession; endedAt: number } | null>(null);

  const load = () => {
    setLoadError(false);
    getAllExercises().then(setExercises).catch(() => {});
    getAllTemplates().then(setTemplates).catch(() => {});
    getActiveSession().then((s) => setSession(s ?? null)).catch(() => setLoadError(true));
  };

  useEffect(() => { load(); }, []);

  const elapsedSec = useElapsedTime(session?.startedAt ?? null);
  const isStale = !!session && Date.now() - session.startedAt > STALE_SESSION_MS;

  const start = async () => {
    const fresh = await startActiveSession();
    setSession(fresh);
  };

  const persist = async (next: ActiveSession) => {
    setSession(next);
    await saveActiveSession(next);
  };

  const addExerciseToSession = (ex: Exercise) => {
    if (!session) return;
    const we: WorkoutExercise = { id: newId(), exerciseId: ex.id, exerciseName: ex.name, muscleGroup: ex.muscleGroup, sets: [] };
    persist({ ...session, exercises: [...session.exercises, we] });
    setShowPicker(false);
  };

  const applyTemplate = (t: WorkoutTemplate) => {
    if (!session) return;
    const added: WorkoutExercise[] = t.exercises.map((te) => ({
      id: newId(), exerciseId: te.exerciseId, exerciseName: te.exerciseName, muscleGroup: te.muscleGroup, sets: [],
    }));
    persist({ ...session, name: t.name, exercises: [...session.exercises, ...added] });
    setShowTemplatePicker(false);
  };

  const addSet = (weId: string, reps: number, weight: number) => {
    if (!session) return;
    persist({
      ...session,
      exercises: session.exercises.map((we) =>
        we.id === weId ? { ...we, sets: [...we.sets, { id: newId(), reps, weight }] } : we
      ),
    });
  };

  const deleteSet = (weId: string, setId: string) => {
    if (!session) return;
    persist({
      ...session,
      exercises: session.exercises.map((we) =>
        we.id === weId ? { ...we, sets: we.sets.filter((s) => s.id !== setId) } : we
      ),
    });
  };

  const removeExercise = (weId: string) => {
    if (!session) return;
    persist({ ...session, exercises: session.exercises.filter((we) => we.id !== weId) });
  };

  const endSession = async (endedAt: number) => {
    if (!session) return;
    await endActiveSession(session, endedAt);
    setConfirmEnd(false);
    if (session.exercises.length > 0) {
      // Hold the summary up before handing off — onEnded() (called once the
      // user dismisses it) is what actually navigates away / refreshes data.
      setSummary({ session, endedAt });
    } else {
      setSession(null);
      onEnded();
    }
  };

  if (loadError) {
    return (
      <div className="stack">
        <h1 className="page-title">Live Workout</h1>
        <div className="empty-state">
          <p>Couldn't load your session. Check your connection and try again.</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  const closeSummary = () => {
    setSummary(null);
    setSession(null);
    onEnded();
  };

  if (summary) {
    return <WorkoutSummaryModal session={summary.session} endedAt={summary.endedAt} onClose={closeSummary} />;
  }

  if (session === undefined) return <LoadingState />;

  if (!session) {
    return (
      <div className="stack">
        <h1 className="page-title">Live Workout</h1>
        <div className="empty-state">
          <IconEmptyWorkout className="empty-state-icon" />
          <p>No active session.</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={start}>Start Workout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <h1 className="page-title">Live Workout</h1>

      <div className="card glow-card session-timer-card">
        <span className="stat-label">Elapsed</span>
        <span className="session-timer">{formatElapsed(elapsedSec)}</span>
        <button className="btn btn-danger btn-block" onClick={() => setConfirmEnd(true)}>
          <IconStop size={16} /> End Workout
        </button>
      </div>

      {isStale && !dismissedStale && (
        <div className="card stale-session-banner">
          <div className="col" style={{ gap: 4 }}>
            <span style={{ fontWeight: 700 }}>Still running after {formatElapsed(elapsedSec)}?</span>
            <span className="text-dim" style={{ fontSize: 13 }}>Looks like this session may have been left running. End it now, or keep going if it's a real one.</span>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDismissedStale(true)}>Keep going</button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => setConfirmEnd(true)}>End now</button>
          </div>
        </div>
      )}

      {session.exercises.map((we) => {
        const matched = exercises.find((ex) => ex.id === we.exerciseId);
        return (
          <ExerciseBlock
            key={we.id}
            we={we}
            exercise={matched}
            onAddSet={(reps, weight) => addSet(we.id, reps, weight)}
            onDeleteSet={(setId) => deleteSet(we.id, setId)}
            onRemove={() => removeExercise(we.id)}
          />
        );
      })}

      {session.exercises.length === 0 && (
        <div className="empty-state">
          <IconEmptyWorkout className="empty-state-icon" />
          <p>No exercises added yet.</p>
        </div>
      )}

      <div className="row">
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowPicker(true)}>+ Add Exercise</button>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowTemplatePicker(true)}>Use Template</button>
      </div>

      {showPicker && (
        <ExercisePickerModal
          exercises={exercises}
          onPick={addExerciseToSession}
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

      {confirmEnd && (
        <div className="modal-overlay" onClick={() => setConfirmEnd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 8 }}>End workout?</h2>
            {session.exercises.length === 0 ? (
              <p className="text-dim" style={{ marginBottom: 20 }}>
                No exercises logged — this session won't be saved.
              </p>
            ) : (
              <p className="text-dim" style={{ marginBottom: 20 }}>
                {session.exercises.length} exercise{session.exercises.length !== 1 ? 's' : ''} logged over {formatElapsed(elapsedSec)}. This will be saved to your history.
              </p>
            )}
            <div className="row">
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmEnd(false)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => endSession(Date.now())}>End Workout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
