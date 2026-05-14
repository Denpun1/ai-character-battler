
"use client";

import React, { useCallback } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  Connection,
  Edge,
  Node,
  useNodesState,
  useEdgesState,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from './Button';

interface FlowEditorProps {
  flowData: { nodes: Node[]; edges: Edge[] };
  setFlowData: (data: { nodes: Node[]; edges: Edge[] }) => void;
}

export function FlowEditor({ flowData, setFlowData }: FlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(flowData.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowData.edges || []);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  React.useEffect(() => {
    setFlowData({ nodes, edges });
  }, [nodes, edges, setFlowData]);

  React.useEffect(() => {
    if (JSON.stringify(flowData.nodes) !== JSON.stringify(nodes)) setNodes(flowData.nodes || []);
    if (JSON.stringify(flowData.edges) !== JSON.stringify(edges)) setEdges(flowData.edges || []);
  }, [flowData]);

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `node_${Date.now()}`,
      type: 'default',
      data: { 
        label: type,
        ...(type === 'Variable' ? { varName: 'myVar', varValue: '100' } : {}),
        ...(type === 'Math' ? { targetVar: 'myVar', op: '+', value: '1' } : {}),
        ...(type === 'Set Prompt' ? { systemPrompt: '', userPrompt: '' } : {}),
      },
      position: { x: 100, y: 100 },
      style: { 
        background: type === 'Start' ? '#059669' : type === 'Set Prompt' ? '#9333ea' : '#333',
        color: 'white',
        borderRadius: '8px',
        padding: '10px',
        width: 150
      }
    };
    setNodes((nds) => nds.concat(newNode));
  };

  return (
    <div style={{ height: '600px', background: '#111', borderRadius: '12px', border: '1px solid #333' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        colorMode="dark"
      >
        <Background />
        <Controls />
        <Panel position="top-left" style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.5)', padding: '0.5rem', borderRadius: '8px', flexWrap: 'wrap', maxWidth: '400px' }}>
            <Button variant="secondary" onClick={() => addNode('Start')}>+ Start</Button>
            <Button variant="secondary" onClick={() => addNode('Variable')}>+ Variable</Button>
            <Button variant="secondary" onClick={() => addNode('Math')}>+ Math</Button>
            <Button variant="secondary" onClick={() => addNode('Show UI')}>+ Show UI</Button>
            <Button variant="secondary" onClick={() => addNode('Set Prompt')}>+ Set Prompt</Button>
            <Button variant="secondary" onClick={() => addNode('End')}>+ End</Button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
