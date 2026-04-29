
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
          <label>Display Slot</label>
          <select 
            value={data.slot || 'actions'} 
            onChange={(e) => data.onChange?.({ ...data, slot: e.target.value })}
          >
            <option value="actions">Action Bar (Bottom)</option>
            <option value="sidebar">Sidebar</option>
            <option value="overlay">Overlay</option>
          </select>
        </div>
        <small style={{ opacity: 0.5 }}>ボタンが押されると次へ進みます</small>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
