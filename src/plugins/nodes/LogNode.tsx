
"use client";

import { memo } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import styles from "./nodes.module.css";
import { MessageSquare } from "lucide-react";

function LogNode({ id, data, selected }: { id: string; data: any; selected: boolean }) {
  const { updateNodeData } = useReactFlow();

  return (
    <div className={`${styles.node} ${selected ? styles.selected : ""}`}>
      <Handle type="target" position={Position.Left} id="trigger-in" className={`${styles.handle} ${styles.trigger}`} />
      <Handle type="target" position={Position.Left} id="in-message" className={`${styles.handle} ${styles.input_out}`} style={{ top: 'auto', bottom: '15px' }} />
      <div style={{ position: "absolute", left: "-45px", bottom: "10px", fontSize: "10px", color: "#d97706" }}>Message</div>

      <div className={`${styles.header} ${styles.action}`}>
        <MessageSquare size={14} /> UI Display
      </div>
      <div className={styles.body}>
        <div className={styles.field}>
          <label>Display Mode</label>
          <select 
            value={data.mode || 'box'} 
            onChange={(e) => updateNodeData(id, { mode: e.target.value })}
          >
            <option value="box">Box (Styled)</option>
            <option value="plain">Plain Text (Clean)</option>
          </select>
        </div>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label>X (px)</label>
            <input type="number" className="nodrag" value={data.x || 0} onChange={(e) => updateNodeData(id, { x: parseInt(e.target.value) })} />
          </div>
          <div className={styles.field}>
            <label>Y (px)</label>
            <input type="number" className="nodrag" value={data.y || 400} onChange={(e) => updateNodeData(id, { y: parseInt(e.target.value) })} />
          </div>
          <div className={styles.field}>
            <label>Width</label>
            <input type="number" className="nodrag" value={data.width || 600} onChange={(e) => updateNodeData(id, { width: parseInt(e.target.value) })} />
          </div>
          <div className={styles.field}>
            <label>Height</label>
            <input type="number" className="nodrag" value={data.height || 150} onChange={(e) => updateNodeData(id, { height: parseInt(e.target.value) })} />
          </div>
        </div>
        <div className={styles.label}>Static Message (Fallback)</div>
        <input type="text" className={`${styles.input} nodrag`} value={data.message || ""} onChange={(e) => updateNodeData(id, { message: e.target.value })} placeholder="Static text..." />
      </div>

      <Handle type="source" position={Position.Right} id="trigger-out" className={`${styles.handle} ${styles.trigger}`} />
    </div>
  );
}

export default memo(LogNode);
