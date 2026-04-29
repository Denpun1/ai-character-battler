
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
        
        <div className={styles.field}>
          <label>Model</label>
          <select 
            value={data.model || 'gemini-1.5-flash'} 
            onChange={(e) => updateNodeData(id, { model: e.target.value })}
          >
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="gemma-2-27b-it">Gemma 2 27B</option>
            <option value="custom">-- Custom Model --</option>
          </select>
        </div>
        {data.model === 'custom' && (
          <div className={styles.field}>
            <label>Custom Model Name</label>
            <input 
              type="text" 
              value={data.customModel || ''} 
              onChange={(e) => updateNodeData(id, { customModel: e.target.value })}
              placeholder="e.g. gemma-4-7b-it"
            />
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} id="trigger-out" className={`${styles.handle} ${styles.trigger}`} />
      <Handle type="source" position={Position.Right} id="out-text" className={`${styles.handle} ${styles.input_out}`} style={{ top: 'auto', bottom: '15px' }} />
      <div style={{ position: "absolute", right: "-35px", bottom: "10px", fontSize: "10px", color: "#d97706" }}>Result</div>
    </div>
  );
}

export default memo(AIGenerateNode);
