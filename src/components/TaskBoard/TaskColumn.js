import React from 'react';
import TaskCard from './TaskCard';

export default function TaskColumn({ title, tasks, onTaskClick }) {
  return (
    <div style={{ flex: 1, minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', height: 'calc(100vh - 220px)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '2px solid var(--border-color)' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
          {title}
        </h3>
        <span style={{ background: 'var(--bg-main)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
          {tasks.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {tasks.length > 0 ? (
          tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-main)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
            Bu sütunda görev bulunmuyor.
          </div>
        )}
      </div>
    </div>
  );
}
