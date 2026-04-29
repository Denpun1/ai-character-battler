
'use client';

import React, { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import styles from './nodes.module.css';
import { MousePointer2 } from 'lucide-react';

function ButtonNode({ id, data, selected }: { id: string; data: any; selected: boolean }) {
  const { updateNodeData } = useReactFlow();

  return (
    <div className={`${styles.node} ${selected ? styles.selected : ""}`}>
      <div className={`${styles.header}`} style={{ borderBottom: '2px solid #db2777' }}>
        <MousePointer2 size={14} /> UI Button
      </div>
      <div className={styles.body}>
        <div className={styles.field}>
          <label>Button Label</label>
          <input 
            type="text" 
            className={`${styles.input} nodrag`}
            value={data.label || 'Click Me'} 
            onChange={(e) => updateNodeData(id, { label: e.target.value })}
            placeholder="e.g. 詳しく聞く"
          />
        </div>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>X (px)</label>
            <input type="number" className="nodrag" value={data.x || 0} onChange={(e) => updateNodeData(id, { x: parseInt(e.target.value) })} />
          </div>
          <div className={styles.field}>
            <label>Y (px)</label>
            <input type="number" className="nodrag" value={data.y || 0} onChange={(e) => updateNodeData(id, { y: parseInt(e.target.value) })} />
          </div>
          <div className={styles.field}>
            <label>Width</label>
            <input type="number" className="nodrag" value={data.width || 120} onChange={(e) => updateNodeData(id, { width: parseInt(e.target.value) })} />
          </div>
          <div className={styles.field}>
            <label>Height</label>
            <input type="number" className="nodrag" value={data.height || 40} onChange={(e) => updateNodeData(id, { height: parseInt(e.target.value) })} />
          </div>
        </div>
        <small style={{ opacity: 0.5, fontSize: '9px' }}>ボタンが押されると次へ進みます</small>
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(ButtonNode);
