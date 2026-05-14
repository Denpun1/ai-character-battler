
"use client";

import React, { memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';

const nodeStyle: React.CSSProperties = {
  background: '#222',
  color: 'white',
  border: '1px solid #444',
  borderRadius: '12px',
  padding: '12px',
  minWidth: '220px',
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

// --- VARIABLE SUGGESTIONS ---
const VariableDatalist = () => (
  <datalist id="mod-variables">
    <option value="battle_result" />
    <option value="p1_name" />
    <option value="p2_name" />
    <option value="p1_id" />
    <option value="p2_id" />
  </datalist>
);

// --- START NODE ---
export const StartNode = memo(({ data, id }: any) => {
    const { updateNodeData } = useReactFlow();
    return (
        <div style={{ ...nodeStyle, minWidth: '150px' }}>
            <VariableDatalist />
            <div style={headerStyle('#059669')}>Start Trigger</div>
            <select 
                style={inputStyle} 
                value={data.trigger || 'pre-battle'} 
                onChange={(e) => updateNodeData(id, { trigger: e.target.value })}
            >
                <option value="pre-battle">Before Battle</option>
                <option value="post-battle">After Battle</option>
            </select>
            <Handle type="source" position={Position.Right} id="trigger-out" />
        </div>
    );
});

// --- VARIABLE NODE ---
export const VariableNode = memo(({ id, data }: any) => {
  const { updateNodeData } = useReactFlow();
  return (
    <div style={nodeStyle}>
      <div style={headerStyle('#2563eb')}>Variable</div>
      <label style={labelStyle}>Variable Name</label>
      <input 
        style={inputStyle} 
        list="mod-variables"
        value={data.varName || ''} 
        onChange={(e) => updateNodeData(id, { varName: e.target.value })} 
      />
      <label style={labelStyle}>Value</label>
      <input 
        style={inputStyle} 
        list="mod-variables"
        value={data.varValue || ''} 
        onChange={(e) => updateNodeData(id, { varValue: e.target.value })} 
      />
      <p style={{ fontSize: '0.6rem', color: '#666', marginTop: '4px' }}>
        Tip: Use {"{battle_result}"} for result text.
      </p>
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
        list="mod-variables"
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
            list="mod-variables"
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

// --- AI CALL NODE (Separate Session) ---
export const AICallNode = memo(({ id, data }: any) => {
    const { updateNodeData } = useReactFlow();
    return (
      <div style={{ ...nodeStyle, minWidth: '300px', border: '1px solid #2563eb' }}>
        <div style={headerStyle('#2563eb')}>AI Call (New Session)</div>
        <label style={labelStyle}>System Prompt</label>
        <textarea 
          style={{ ...inputStyle, height: '60px', resize: 'vertical' }} 
          list="mod-variables"
          value={data.systemPrompt || ''} 
          onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })} 
        />
        <label style={labelStyle}>User Prompt</label>
        <textarea 
          style={{ ...inputStyle, height: '60px', resize: 'vertical' }} 
          list="mod-variables"
          value={data.userPrompt || ''} 
          onChange={(e) => updateNodeData(id, { userPrompt: e.target.value })} 
        />
        <label style={labelStyle}>Save Response to Var</label>
        <input 
            style={inputStyle} 
            list="mod-variables"
            placeholder="var_name"
            value={data.outputVar || ''} 
            onChange={(e) => updateNodeData(id, { outputVar: e.target.value })} 
        />
        <Handle type="target" position={Position.Left} id="trigger-in" />
        <Handle type="source" position={Position.Right} id="trigger-out" />
      </div>
    );
});

// --- OVERRIDE PROMPT NODE ---
export const OverrideNode = memo(({ id, data }: any) => {
  const { updateNodeData } = useReactFlow();
  return (
    <div style={{ ...nodeStyle, border: '1px solid #9333ea' }}>
      <div style={headerStyle('#9333ea')}>Override Battle Prompt</div>
      <label style={labelStyle}>System Prompt</label>
      <textarea 
        style={{ ...inputStyle, height: '40px', resize: 'vertical' }} 
        list="mod-variables"
        value={data.systemPrompt || ''} 
        onChange={(e) => updateNodeData(id, { systemPrompt: e.target.value })} 
      />
      <label style={labelStyle}>User Prompt</label>
      <textarea 
        style={{ ...inputStyle, height: '40px', resize: 'vertical' }} 
        list="mod-variables"
        value={data.userPrompt || ''} 
        onChange={(e) => updateNodeData(id, { userPrompt: e.target.value })} 
      />
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
