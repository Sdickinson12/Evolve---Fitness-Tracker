import { IconEmptyWorkout } from './icons';
import type { WorkoutTemplate } from '../types';

export default function TemplatePickerModal({
  templates, onPick, onClose, onManage,
}: { templates: WorkoutTemplate[]; onPick: (t: WorkoutTemplate) => void; onClose: () => void; onManage: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: 12 }}>Use Template</h2>
        <div>
          {templates.map((t) => (
            <div
              className="exercise-list-item"
              key={t.id}
              onClick={() => onPick(t)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(t); } }}
            >
              <div className="col" style={{ gap: 4 }}>
                <span style={{ fontWeight: 600 }}>{t.name}</span>
                <span className="text-dim" style={{ fontSize: 13 }}>
                  {t.exercises.length} exercise{t.exercises.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="empty-state">
              <IconEmptyWorkout className="empty-state-icon" />
              <p>No templates saved yet.</p>
            </div>
          )}
        </div>
        <button className="link-btn" style={{ marginTop: 4 }} onClick={onManage}>Manage templates</button>
      </div>
    </div>
  );
}
