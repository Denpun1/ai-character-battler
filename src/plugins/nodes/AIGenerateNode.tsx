
"use client";

import { memo } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import styles from "./nodes.module.css";
import { Bot } from "lucide-react";

function AIGenerateNode({ id, data, selected }: { id: string; data: any; selected: boolean }) {
  const { updateNodeData } = useReactFlow();

  return (
    <div className={`${styles.node} ${selected ? styles.selected : ""}`}>
      <Handle type="target" position={Position.Left} id="trigger-in" className={`${styles.handle} ${styles.trigger}`} />
      
      <div className={`${styles.header} ${styles.action}`}>
        <Bot size={14} /> AI Follow-up
      </div>
      <div className={styles.body}>
        <div className={styles.label}>Prompt (System/Context)</div>
        <textarea 
          className={`${styles.input} nodrag`} 
          value={data.prompt || ""} 
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })} 
          placeholder="エピローグを作成して..."
          style={{ height: '60px', resize: 'none' }}
        />
        
        <div className={styles.label}>Model</div>
        <select className={`${styles.select} nodrag`} value={data.model || "default"} onChange={(e) => updateNodeData(id, { model: e.target.value })}>
          <option value="default">User Setting (Default)</option>
          <option value="gemma-4-31b-it">Gemma 4 (Balance)</option>
          <option value="gemini-3.0-pro">Gemini 3 Pro (Deep)</option>
        </select>
      </div>

      <Handle type="source" position={Position.Right} id="trigger-out" className={`${styles.handle} ${styles.trigger}`} />
      <Handle type="source" position={Position.Right} id="out-text" className={`${styles.handle} ${styles.input_out}`} style={{ top: 'auto', bottom: '15px' }} />
      <div style={{ position: "absolute", right: "-35px", bottom: "10px", fontSize: "10px", color: "#d97706" }}>Result</div>
    </div>
  );
}

export default memo(AIGenerateNode);
