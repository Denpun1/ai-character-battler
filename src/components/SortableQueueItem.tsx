
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';

interface Props {
  q: any;
  fighterNames: string[];
  deleteQueueItem: (id: string) => void;
}

export function SortableQueueItem({ q, fighterNames, deleteQueueItem }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: q.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'default',
    marginBottom: '1rem',
    touchAction: 'none'
  };

  let statusColor = '#888';
  if (q.status === 'pending') statusColor = '#d97706';
  if (q.status === 'processing') statusColor = '#2563eb';
  if (q.status === 'completed') statusColor = '#16a34a';
  if (q.status === 'failed') statusColor = '#dc2626';

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div {...attributes} {...listeners} style={{ cursor: 'grab', padding: '0.5rem', color: '#888' }}>
              ⠿
            </div>
            <div>
              <h3 style={{ fontSize: '1rem' }}>{fighterNames.filter((n: string) => n !== 'Unknown').join(' vs ') || 'Unknown Battle'}</h3>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ color: statusColor, fontWeight: 'bold' }}> {q.status.toUpperCase()} </span>
                <span style={{ color: '#666' }}>{q.provider} / {q.model}</span>
                <span style={{ color: '#888' }}>{new Date(q.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div>
            <Button variant="secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => deleteQueueItem(q.id)}>Delete</Button>
          </div>
        </div>
        {q.error_msg && <p style={{ color: '#dc2626', marginTop: '0.5rem', fontSize: '0.85rem', background: 'rgba(220, 38, 38, 0.1)', padding: '0.5rem', borderRadius: '4px' }}>{q.error_msg}</p>}
      </Card>
    </div>
  );
}
