
"use client";

import { memo } from "react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import styles from "./nodes.module.css";
import { Play } from "lucide-react";

function StartNode({ id, data, selected }: { id: string; data: any; selected: boolean }) {
  const { updateNodeData } = useReactFlow();

  return (
    <div className={`${styles.node} ${selected ? styles.selected : ""}`}>
      <div className={`${styles.header} ${styles.event}`}>
        <Play size={14} /> Battle Event
      </div>
      <div className={styles.body}>
        <div className={styles.label}>Trigger Type</div>
        <select className={`${styles.select} nodrag`} value={data.triggerType || "start"} onChange={(e) => updateNodeData(id, { triggerType: e.target.value })}>
          <option value="start">対戦開始時 (Before AI)</option>
          <option value="end">対戦終了時 (After AI)</option>
          <option value="custom">カスタムボタン押下</option>
        </select>
        {data.triggerType === "custom" && (
          <>
            <div className={styles.label} style={{ marginTop: '4px' }}>Button Label</div>
            <input type="text" className={`${styles.input} nodrag`} value={data.buttonLabel || "Action"} onChange={(e) => updateNodeData(id, { buttonLabel: e.target.value })} />
          </>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="trigger-out" className={`${styles.handle} ${styles.trigger}`} />
    </div>
  );
}

export default memo(StartNode);
