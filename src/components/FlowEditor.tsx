
"use client";

import React, { useCallback, useMemo } from 'react';
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
  // Initialize state from props
  const [nodes, setNodes, onNodesChange] = useNodesState(flowData.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowData.edges || []);

  // Update parent when anything changes
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Sync back to parent
  React.useEffect(() => {
    setFlowData({ nodes, edges });
  }, [nodes, edges, setFlowData]);

  // If props change from outside (e.g. switching MODs), update internal state
  React.useEffect(() => {
    if (flowData.nodes !== nodes) setNodes(flowData.nodes || []);
    if (flowData.edges !== edges) setEdges(flowData.edges || []);
  }, [flowData, setNodes, setEdges]);

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `node_${Date.now()}`,
      type: 'default',
      data: { label: `${type}` },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      style: { 
        background: type === 'Start' ? '#059669' : type === 'AI Call' ? '#2563eb' : '#333',
        color: 'white',
        borderRadius: '8px',
        padding: '10px',
        width: 150
      }
    };
    setNodes((nds) => nds.concat(newNode));
  };

  return (
    <div style={{ height: '600px', background: '#111', borderRadius: '12px', border: '1px solid #333', position: 'relative' }}>
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
        <Panel position="top-left" style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.5)', padding: '0.5rem', borderRadius: '8px' }}>
            <Button variant="secondary" onClick={() => addNode('Start')}>+ Start</Button>
            <Button variant="secondary" onClick={() => addNode('AI Call')}>+ AI Call</Button>
            <Button variant="secondary" onClick={() => addNode('Variable')}>+ Variable</Button>
            <Button variant="secondary" onClick={() => addNode('Math')}>+ Math</Button>
            <Button variant="secondary" onClick={() => addNode('Show UI')}>+ Show UI</Button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
