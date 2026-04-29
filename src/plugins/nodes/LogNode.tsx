
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
        <div className={styles.label}>Display Mode</div>
        <select className={`${styles.select} nodrag`} value={data.mode || "sidebar"} onChange={(e) => updateNodeData(id, { mode: e.target.value })}>
          <option value="sidebar">Sidebar Log</option>
          <option value="modal">Modal Popup</option>
          <option value="floating">Floating Toast</option>
        </select>
        <div className={styles.label}>Static Message (Fallback)</div>
        <input type="text" className={`${styles.input} nodrag`} value={data.message || ""} onChange={(e) => updateNodeData(id, { message: e.target.value })} placeholder="Static text..." />
      </div>

      <Handle type="source" position={Position.Right} id="trigger-out" className={`${styles.handle} ${styles.trigger}`} />
    </div>
  );
}

export default memo(LogNode);
