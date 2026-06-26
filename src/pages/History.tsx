import { useEffect, useMemo, useRef, useState } from 'react';
import { deleteWorkout, getAllWorkouts } from '../lib/db';
import { workoutVolume, toDateKey } from '../lib/calculations';
import Calendar from '../components/Calendar';
import LoadingState from '../components/LoadingState';
import { IconCalendar, IconEmptyWorkout, IconTrash } from '../components/icons';
import type { Workout } from '../types';

type ViewMode = 'list' | 'calendar';

function formatDate(dateKey: string) {
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const UNDO_WINDOW_MS = 5000;

export default function History() {
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Workout | null>(null);
  const [view, setView] = useState<ViewMode>('calendar');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = () => getAllWorkouts().then(setWorkouts);
  useEffect(() => { refresh(); }, []);

  // Calendar is the default view, so it needs a selected date as soon as
  // workouts load — without waiting for the user to tap the Calendar toggle.
  useEffect(() => {
    if (workouts && !selectedDate) {
      setSelectedDate(workouts[0]?.date ?? toDateKey(new Date()));
    }
  }, [workouts, selectedDate]);

  useEffect(() => () => {
    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
  }, []);

  const markedDates = useMemo(() => new Set((workouts ?? []).map((w) => w.date)), [workouts]);

  if (!workouts) return <LoadingState />;

  const handleDelete = (w: Workout) => {
    setWorkouts((cur) => (cur ? cur.filter((x) => x.id !== w.id) : cur));
    setPendingDelete(w);
    pendingTimeoutRef.current = setTimeout(async () => {
      await deleteWorkout(w.id);
      setPendingDelete((cur) => (cur?.id === w.id ? null : cur));
    }, UNDO_WINDOW_MS);
  };

  const handleUndo = () => {
    if (!pendingDelete) return;
    if (pendingTimeoutRef.current) clearTimeout(pendingTimeoutRef.current);
    setWorkouts((cur) => {
      const restored = cur ? [...cur, pendingDelete] : [pendingDelete];
      return restored.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    });
    setPendingDelete(null);
  };

  const selectedWorkout = selectedDate ? workouts.find((w) => w.date === selectedDate) ?? null : null;

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>History</h1>
        <div className="view-toggle">
          <button
            className={`view-toggle-btn${view === 'calendar' ? ' active' : ''}`}
            onClick={() => setView('calendar')}
          ><IconCalendar size={14} />Calendar</button>
          <button
            className={`view-toggle-btn${view === 'list' ? ' active' : ''}`}
            onClick={() => setView('list')}
          >List</button>
        </div>
      </div>

      {workouts.length === 0 && (
        <div className="empty-state">
          <IconEmptyWorkout className="empty-state-icon" />
          <p>No workouts logged yet.</p>
        </div>
      )}

      {workouts.length > 0 && view === 'calendar' && (
        <>
          <div className="card">
            <Calendar selected={selectedDate} markedDates={markedDates} onSelect={setSelectedDate} />
          </div>

          {selectedDate && (
            selectedWorkout ? (
              <WorkoutCard
                workout={selectedWorkout}
                isOpen
                onToggle={() => {}}
                onDelete={handleDelete}
              />
            ) : (
              <div className="empty-state">
                <p>No workout logged on {formatDate(selectedDate)}.</p>
              </div>
            )
          )}
        </>
      )}

      {workouts.length > 0 && view === 'list' && workouts.map((w) => (
        <WorkoutCard
          key={w.id}
          workout={w}
          isOpen={expanded === w.id}
          onToggle={() => setExpanded((cur) => (cur === w.id ? null : w.id))}
          onDelete={handleDelete}
        />
      ))}

      {pendingDelete && (
        <div className="toast-stack">
          <div className="toast">
            <span>Workout deleted</span>
            <button className="toast-undo" onClick={handleUndo}>Undo</button>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkoutCard({
  workout, isOpen, onToggle, onDelete,
}: {
  workout: Workout;
  isOpen: boolean;
  onToggle: () => void;
  onDelete: (w: Workout) => void;
}) {
  const totalVol = workoutVolume(workout);
  const totalSets = workout.exercises.reduce((sum, e) => sum + e.sets.length, 0);

  return (
    <div
      className="card workout-summary-card"
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
    >
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 4 }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>{formatDate(workout.date)}</span>
            <span className="badge">{workout.name ?? 'Freestyle'}</span>
          </div>
          <span className="text-dim" style={{ fontSize: 13 }}>
            {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''} · {totalSets} sets · {Math.round(totalVol).toLocaleString()} kg
          </span>
        </div>
        <button
          className="icon-btn"
          onClick={(e) => { e.stopPropagation(); onDelete(workout); }}
          aria-label="Delete workout"
        ><IconTrash /></button>
      </div>

      {isOpen && (
        <div className="stack" style={{ marginTop: 14 }}>
          {workout.exercises.map((ex) => (
            <div key={ex.id} className="col" style={{ gap: 6, borderTop: '1px solid var(--card-border)', paddingTop: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>{ex.exerciseName}</span>
                <span className="badge">{ex.muscleGroup}</span>
              </div>
              {ex.sets.map((s, i) => (
                <span key={s.id} className="text-dim" style={{ fontSize: 13 }}>
                  Set {i + 1}: {s.reps} reps × {s.weight} kg
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
