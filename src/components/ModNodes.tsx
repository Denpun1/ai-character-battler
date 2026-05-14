
"use client";

import React, { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import styles from '../app/page.module.css';

const nodeStyle: React.CSSProperties = {
  background: '#222',
  color: 'white',
  border: '1px solid #444',
  borderRadius: '12px',
  padding: '12px',
  minWidth: '200px',
  fontSize: '0.85rem',
  boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
};

const headerStyle = (bg: string): React.CSSProperties => ({
  background: bg,
  margin: '-12px -12px 10px -12px',
  padding: '6px 12px',
  borderRadius: '11px 11px 0 0',
  fontWeight: 'bold',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  display: 'flex',
  justifyContent: 'space-between'
});

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#000',
  border: '1px solid #444',
  color: 'white',
  padding: '4px 8px',
  borderRadius: '4px',
  fontSize: '0.8rem',
  marginTop: '4px'
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#aaa',
  marginTop: '8px',
  display: 'block'
};

// --- START NODE ---
export const StartNode = memo(() => (
  <div style={{ ...nodeStyle, minWidth: '100px', textAlign: 'center' }}>
    <div style={headerStyle('#059669')}>Start</div>
    <div style={{ padding: '10px 0' }}>Flow Entry</div>
    <Handle type="source" position={Position.Right} id="trigger-out" />
  </div>
));

// --- VARIABLE NODE ---
export const VariableNode = memo(({ id, data }: any) => {
  const { updateNodeData } = useReactFlow();
  return (
    <div style={nodeStyle}>
      <div style={headerStyle('#2563eb')}>Variable</div>
      <label style={labelStyle}>Variable Name</label>
      <input 
        style={inputStyle} 
        value={data.varName || ''} 
        onChange={(e) => updateNodeData(id, { varName: e.target.value })} 
      />
      <label style={labelStyle}>Initial Value</label>
      <input 
        style={inputStyle} 
        value={data.varValue || ''} 
        onChange={(e) => updateNodeData(id, { varValue: e.target.value })} 
      />
      <Handle type="target" position={Position.Left} id="trigger-in" />
      <Handle type="source" position={Position.Right} id="trigger-out" />
    </div>
  );
});

// --- MATH NODE ---
export const MathNode = memo(({ id, data }: any) => {
  const { updateNodeData } = useReactFlow();
  return (
    <div style={nodeStyle}>
      <div style={headerStyle('#7c3aed')}>Math</div>
      <label style={labelStyle}>Target Variable</label>
      <input 
        style={inputStyle} 
        value={data.targetVar || ''} 
        onChange={(e) => updateNodeData(id, { targetVar: e.target.value })} 
      />
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Op</label>
          <select 
            style={inputStyle} 
            value={data.op || '+'} 
            onChange={(e) => updateNodeData(id, { op: e.target.value })}
          >
            <option value="+">+</option>
            <option value="-">-</option>
            <option value="*">×</option>
            <option value="/">÷</option>
          </select>
        </div>
        <div style={{ flex: 2 }}>
          <label style={labelStyle}>Value</label>
          <input 
            style={inputStyle} 
            value={data.value || ''} 
            onChange={(e) => updateNodeData(id, { value: e.target.value })} 
          />
        </div>
      </div>
      <Handle type="target" position={Position.Left} id="trigger-in" />
      <Handle type="source" position={Position.Right} id="trigger-out" />
    </div>
  );
});

// --- PROMPT NODE ---
export const PromptNode = memo(({ id, data }: any) => {
  const { updateNodeData } = useReactFlow();
  return (
    <div style={{ ...nodeStyle, minWidth: '300px' }}>
      <div style={headerStyle('#9333ea')}>Set Prompt</div>
      <label style={labelStyle}>System Prompt Override</label>
      <textarea 
        style={{ ...inputStyle, height: '80px', resize: 'vertical' }} 
        value={data.systemPrompt || ''} 
        onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })} 
      />
      <label style={labelStyle}>User Prompt Override</label>
      <textarea 
        style={{ ...inputStyle, height: '60px', resize: 'vertical' }} 
        value={data.userPrompt || ''} 
        onChange={(e) => updateNodeData(id, { userPrompt: e.target.value })} 
      />
      <p style={{ fontSize: '0.65rem', color: '#666', marginTop: '8px' }}>
        Use {"{var_name}"} to inject variables.
      </p>
      <Handle type="target" position={Position.Left} id="trigger-in" />
      <Handle type="source" position={Position.Right} id="trigger-out" />
    </div>
  );
});

// --- SHOW UI NODE ---
export const ShowUINode = memo(() => (
  <div style={{ ...nodeStyle, background: '#333' }}>
    <div style={headerStyle('#db2777')}>Show UI</div>
    <div style={{ padding: '10px 0', fontSize: '0.8rem', opacity: 0.8 }}>
      Displays the Layout Designer design to the user.
    </div>
    <Handle type="target" position={Position.Left} id="trigger-in" />
    <Handle type="source" position={Position.Right} id="trigger-out" />
  </div>
));
