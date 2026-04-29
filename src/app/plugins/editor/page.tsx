
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
import { Save, ChevronLeft, Play, Plus } from 'lucide-react';
import Link from 'next/link';

// Custom Nodes
import StartNode from '@/plugins/nodes/StartNode';
import AIGenerateNode from '@/plugins/nodes/AIGenerateNode';
import LogNode from '@/plugins/nodes/LogNode';
import ButtonNode from '@/plugins/nodes/ButtonNode';

import { LayoutEditor } from '@/components/LayoutEditor';

const nodeTypes = {
  start: StartNode,
  ai: AIGenerateNode,
  log: LogNode,
  button: ButtonNode,
};

function Editor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { user } = useUser();
  const { toObject } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [modName, setModName] = useState('Loading...');
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'flow' | 'layout'>('flow');

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

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#020617', display: 'flex', flexDirection: 'column' }}>
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
          <button onClick={() => addNode('log')} className="toolbar-btn"><Plus size={16} /> UI</button>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 10px' }} />
          <button 
            onClick={saveMod} 
      <header style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="secondary" onClick={() => router.push('/plugins')}>Back</Button>
          <input 
            type="text" 
            value={modName} 
            onChange={(e) => setModName(e.target.value)}
            style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', color: 'white', fontWeight: 'bold' }}
          />
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
          <Button 
            variant={viewMode === 'flow' ? 'primary' : 'secondary'} 
            onClick={() => setViewMode('flow')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Flow (Logic)
          </Button>
          <Button 
            variant={viewMode === 'layout' ? 'primary' : 'secondary'} 
            onClick={() => setViewMode('layout')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Layout (UI)
          </Button>
        </div>

        <Button onClick={saveMod} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Plugin'}
        </Button>
      </header>

      <div style={{ flexGrow: 1, position: 'relative' }}>
        {viewMode === 'flow' ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        ) : (
          <LayoutEditor 
            nodes={nodes} 
            onUpdateNode={(id, data) => {
              setNodes(nds => nds.map(n => n.id === id ? { ...n, data } : n));
            }} 
          />
        )}
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
