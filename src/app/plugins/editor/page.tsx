
'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge,
  Node,
  Edge,
  Connection,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/lib/supabase';
import { useSearchParams, useRouter } from 'next/navigation';
import { Save, ChevronLeft, Play, Plus, Move } from 'lucide-react';
import Link from 'next/link';

// Custom Nodes
import StartNode from '@/plugins/nodes/StartNode';
import AIGenerateNode from '@/plugins/nodes/AIGenerateNode';
import LogNode from '@/plugins/nodes/LogNode';
import ButtonNode from '@/plugins/nodes/ButtonNode';
import LayoutDesigner from '@/components/LayoutDesigner';

const nodeTypes = {
  start: StartNode,
  ai: AIGenerateNode,
  log: LogNode,
  button: ButtonNode,
};

function Editor() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');
  const { setNodes: setFlowNodes, setEdges: setFlowEdges, toObject } = useReactFlow();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [modName, setModName] = useState('Loading...');
  const [isSaving, setIsSaving] = useState(false);
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);

  useEffect(() => {
    const handleClose = () => setIsLayoutOpen(false);
    window.addEventListener('layout-designer:close', handleClose);
    return () => window.removeEventListener('layout-designer:close', handleClose);
  }, []);

  useEffect(() => {
    if (id) fetchMod();
  }, [id]);

  const fetchMod = async () => {
    const { data, error } = await supabase
      .from('battle_mods')
      .select('*')
      .eq('id', id)
      .single();
    
    if (data) {
      setModName(data.name);
      if (data.flow_data) {
        setNodes(data.flow_data.nodes || []);
        setEdges(data.flow_data.edges || []);
      }
    }
  };

  const onNodesChange = useCallback(
    (changes: any) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: any) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#2563eb', strokeWidth: 2 } }, eds)),
    []
  );

  const saveMod = async () => {
    setIsSaving(true);
    const flow = toObject();
    const { error } = await supabase
      .from('battle_mods')
      .update({ flow_data: flow })
      .eq('id', id);
    
    if (error) alert('保存に失敗しました: ' + error.message);
    else console.log('Saved successfully');
    setIsSaving(false);
  };

  const addNode = (type: string) => {
    const newNode: Node = {
      id: `${type}_${Date.now()}`,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { label: type }
    };
    setNodes((nds) => nds.concat(newNode));
  };

  const handleUpdateNodeFromDesigner = (nodeId: string, newData: any) => {
    setNodes(nds => nds.map(node => {
      if (node.id === nodeId) {
        return { ...node, data: { ...node.data, ...newData } };
      }
      return node;
    }));
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#020617', display: 'flex', flexDirection: 'column' }}>
      {isLayoutOpen && (
        <LayoutDesigner 
          nodes={nodes} 
          onUpdateNode={handleUpdateNodeFromDesigner} 
          onAddNode={addNode}
        />
      )}
      {/* Editor Header */}
      <header style={{ 
        height: '60px', 
        background: 'rgba(15, 23, 42, 0.8)', 
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Link href="/plugins" style={{ color: 'white', opacity: 0.6 }}><ChevronLeft /></Link>
          <h2 style={{ fontSize: '1.1rem', color: 'white', margin: 0 }}>{modName}</h2>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => addNode('start')} className="toolbar-btn"><Play size={16} /> Start</button>
          <button onClick={() => addNode('ai')} className="toolbar-btn"><Plus size={16} /> AI</button>
          <button onClick={() => addNode('log')} className="toolbar-btn"><Plus size={16} /> Log</button>
          <button onClick={() => addNode('button')} className="toolbar-btn"><Plus size={16} /> Button</button>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 10px' }} />
          <button 
            onClick={() => setIsLayoutOpen(true)}
            style={{
              background: '#0f172a',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '8px 16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            <Move size={16} /> Layout
          </button>
          <button 
            onClick={saveMod} 
            disabled={isSaving}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              opacity: isSaving ? 0.5 : 1
            }}
          >
            <Save size={18} /> {isSaving ? 'Saving...' : 'Save Mod'}
          </button>
        </div>
      </header>

      {/* React Flow Viewport */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          colorMode="dark"
        >
          <Background color="#1e293b" gap={20} />
          <Controls />
        </ReactFlow>
      </div>

      <style jsx>{`
        .toolbar-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          padding: 6px 12px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .toolbar-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}

export default function EditorPage() {
  return (
    <ReactFlowProvider>
      <Suspense fallback={<div style={{ color: 'white', padding: '20px' }}>Loading Editor...</div>}>
        <Editor />
      </Suspense>
    </ReactFlowProvider>
  );
}
