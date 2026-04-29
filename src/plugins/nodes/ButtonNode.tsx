
'use client';

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import styles from './nodes.module.css';
import { MousePointer2 } from 'lucide-react';

export default function ButtonNode({ data }: { data: any }) {
  return (
    <div className={styles.nodeBase} style={{ borderColor: '#db2777' }}>
      <div className={styles.nodeHeader} style={{ background: '#db2777' }}>
        <MousePointer2 size={14} />
        <span>UI Button</span>
      </div>
      <div className={styles.nodeBody}>
        <div className={styles.field}>
          <label>Button Label</label>
          <input 
            type="text" 
            value={data.label || 'Click Me'} 
            onChange={(e) => data.onChange?.({ ...data, label: e.target.value })}
            placeholder="e.g. もっと詳しく聞く"
          />
        </div>
        <div className={styles.field}>
          <label>Position Mode</label>
          <select 
            value={data.posMode || 'slot'} 
            onChange={(e) => data.onChange?.({ ...data, posMode: e.target.value })}
          >
            <option value="slot">Slot-based</option>
            <option value="absolute">Absolute (Pixels)</option>
          </select>
        </div>
        {data.posMode === 'absolute' ? (
          <>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div className={styles.field}>
                <label>X (px)</label>
                <input type="number" value={data.posX || 0} onChange={(e) => data.onChange?.({ ...data, posX: parseInt(e.target.value) })} style={{ width: '60px' }} />
              </div>
              <div className={styles.field}>
                <label>Y (px)</label>
                <input type="number" value={data.posY || 0} onChange={(e) => data.onChange?.({ ...data, posY: parseInt(e.target.value) })} style={{ width: '60px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div className={styles.field}>
                <label>Width (px)</label>
                <input type="number" value={data.width || 150} onChange={(e) => data.onChange?.({ ...data, width: parseInt(e.target.value) })} style={{ width: '60px' }} />
              </div>
              <div className={styles.field}>
                <label>Height (px)</label>
                <input type="number" value={data.height || 40} onChange={(e) => data.onChange?.({ ...data, height: parseInt(e.target.value) })} style={{ width: '60px' }} />
              </div>
            </div>
          </>
        ) : (
          <div className={styles.field}>
            <label>Display Slot</label>
            <select 
              value={data.slot || 'actions'} 
              onChange={(e) => data.onChange?.({ ...data, slot: e.target.value })}
            >
              <option value="actions">Action Bar (Bottom)</option>
              <option value="sidebar">Sidebar</option>
            </select>
          </div>
        )}
        <small style={{ opacity: 0.5 }}>ボタンが押されると次へ進みます</small>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
