import { useEffect, useState } from 'react';
import { clearAllData, deleteTemplate, getAllExercises, getAllTemplates, saveTemplate } from '../lib/db';
import { IconClose, IconEmptyWorkout, IconTrash } from '../components/icons';
import ExercisePickerModal from '../components/ExercisePickerModal';
import LoadingState from '../components/LoadingState';
import type { Exercise, TemplateExercise, WorkoutTemplate } from '../types';

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function Templates() {
  const [templates, setTemplates] = useState<WorkoutTemplate[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [draft, setDraft] = useState<WorkoutTemplate | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = () => {
    setLoadError(false);
    getAllExercises().then(setExercises).catch(() => {});
    getAllTemplates().then(setTemplates).catch(() => setLoadError(true));
  };

  useEffect(() => { load(); }, []);

  const startNew = () => setDraft({ id: newId(), name: '', exercises: [], createdAt: Date.now() });
  const startEdit = (t: WorkoutTemplate) => setDraft({ ...t, exercises: [...t.exercises] });

  const addExerciseToDraft = (ex: Exercise) => {
    if (!draft) return;
    const te: TemplateExercise = { id: newId(), exerciseId: ex.id, exerciseName: ex.name, muscleGroup: ex.muscleGroup };
    setDraft({ ...draft, exercises: [...draft.exercises, te] });
    setShowPicker(false);
  };

  const removeFromDraft = (teId: string) => {
    if (!draft) return;
    setDraft({ ...draft, exercises: draft.exercises.filter((e) => e.id !== teId) });
  };

  const saveDraft = async () => {
    if (!draft || !draft.name.trim() || draft.exercises.length === 0) return;
    await saveTemplate({ ...draft, name: draft.name.trim() });
    setDraft(null);
    load();
  };

  const remove = async (id: string) => {
    setTemplates((cur) => (cur ? cur.filter((t) => t.id !== id) : cur));
    await deleteTemplate(id);
  };

  const clearData = async () => {
    setClearing(true);
    await clearAllData();
    // A full reload is the simplest way back to a clean first-run state —
    // every page (Dashboard, History, Stats) caches its own fetched data, so
    // a local state update here wouldn't clear what they're already holding.
    window.location.reload();
  };

  if (loadError) {
    return (
      <div className="empty-state">
        <p>Couldn't load your templates. Check your connection and try again.</p>
        <button className="btn" style={{ marginTop: 16 }} onClick={load}>Retry</button>
      </div>
    );
  }

  if (!templates) return <LoadingState />;

  if (draft) {
    const canSave = draft.name.trim().length > 0 && draft.exercises.length > 0;
    return (
      <div className="stack">
        <h1 className="page-title">{templates.some((t) => t.id === draft.id) ? 'Edit Template' : 'New Template'}</h1>

        <div className="card col">
          <label className="text-dim" style={{ fontSize: 13 }}>Name</label>
          <input
            className="input"
            placeholder="e.g. Push Day"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            autoFocus
          />
        </div>

        {draft.exercises.map((te) => (
          <div className="card row" key={te.id} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="col" style={{ gap: 4 }}>
              <span style={{ fontWeight: 600 }}>{te.exerciseName}</span>
              <span className="badge">{te.muscleGroup}</span>
            </div>
            <button className="icon-btn" onClick={() => removeFromDraft(te.id)} aria-label="Remove exercise"><IconClose /></button>
          </div>
        ))}

        {draft.exercises.length === 0 && (
          <div className="empty-state">
            <IconEmptyWorkout className="empty-state-icon" />
            <p>No exercises added yet.</p>
          </div>
        )}

        <button className="btn btn-secondary btn-block" onClick={() => setShowPicker(true)}>+ Add Exercise</button>

        <div className="row">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setDraft(null)}>Cancel</button>
          <button className="btn" style={{ flex: 1 }} onClick={saveDraft} disabled={!canSave}>Save Template</button>
        </div>

        {showPicker && (
          <ExercisePickerModal
            exercises={exercises}
            onPick={addExerciseToDraft}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <h1 className="page-title">Templates</h1>
        <button className="btn" onClick={startNew}>+ New Template</button>
      </div>

      {templates.map((t) => (
        <div
          className="card row workout-summary-card"
          key={t.id}
          style={{ justifyContent: 'space-between', alignItems: 'center' }}
          onClick={() => startEdit(t)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEdit(t); } }}
        >
          <div className="col" style={{ gap: 4 }}>
            <span style={{ fontWeight: 700 }}>{t.name}</span>
            <span className="text-dim" style={{ fontSize: 13 }}>
              {t.exercises.length} exercise{t.exercises.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            className="icon-btn"
            onClick={(e) => { e.stopPropagation(); remove(t.id); }}
            aria-label="Delete template"
          ><IconTrash /></button>
        </div>
      ))}

      {templates.length === 0 && (
        <div className="empty-state">
          <IconEmptyWorkout className="empty-state-icon" />
          <p>No templates yet. Build one once, reuse it every time.</p>
        </div>
      )}

      <div className="section-label" style={{ marginTop: 12 }}>Danger Zone</div>
      <div className="card row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="col" style={{ gap: 2 }}>
          <span style={{ fontWeight: 600 }}>Clear all data</span>
          <span className="text-dim" style={{ fontSize: 13 }}>
            Permanently deletes every logged workout, template, and your body weight. Cannot be undone.
          </span>
        </div>
        <button className="btn btn-danger" onClick={() => setConfirmClear(true)}>Clear Data</button>
      </div>

      {confirmClear && (
        <div className="modal-overlay" onClick={() => setConfirmClear(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: 8 }}>Clear all data?</h2>
            <p className="text-dim" style={{ marginBottom: 20 }}>
              This permanently deletes every workout, template, and your saved body weight. This cannot be undone.
            </p>
            <div className="row">
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmClear(false)} disabled={clearing}>
                Cancel
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={clearData} disabled={clearing}>
                {clearing ? 'Clearing…' : 'Clear Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
