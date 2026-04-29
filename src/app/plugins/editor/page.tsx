
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
  const { toObject } = useReactFlow();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [modName, setModName] = useState('Loading...');
  const [isSaving, setIsSaving] = useState(false);

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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f172a', color: 'white' }}>
      <header style={{ padding: '1rem', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/plugins" style={{ color: 'white' }}><ChevronLeft /></Link>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{modName}</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => addNode('start')} className="toolbar-btn"><Play size={16} /> Start</button>
            <button onClick={() => addNode('ai')} className="toolbar-btn"><Plus size={16} /> AI</button>
            <button onClick={() => addNode('log')} className="toolbar-btn"><Plus size={16} /> UI</button>
            <button onClick={() => addNode('button')} className="toolbar-btn"><Plus size={16} /> Button</button>
          </div>
        </div>
        <button onClick={saveMod} className="toolbar-btn" style={{ background: '#2563eb' }}>
          {isSaving ? 'Saving...' : 'Save Plugin'}
        </button>
      </header>

      <div style={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Flow Editor */}
        <div style={{ flexGrow: 1, position: 'relative', borderRight: '1px solid #1e293b' }}>
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
            <Background color="#334155" />
            <Controls />
          </ReactFlow>
        </div>

        {/* UI Layout Preview */}
        <div style={{ width: '400px', background: '#020617', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          <h2 style={{ fontSize: '1rem', color: '#3b82f6', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>UI Layout Preview</h2>
          <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>ピクセル単位の配置確認（アリーナ基準）</p>
          
          <div style={{ 
            width: '100%', 
            height: '500px', 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px dashed #334155', 
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '8px'
          }}>
            <div style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '0.7rem', opacity: 0.3 }}>
              Arena Mockup (1000px Scale)
            </div>

            {nodes.map(node => {
              if (node.type === 'button') {
                return (
                  <div key={node.id} style={{
                    position: 'absolute',
                    left: `${(Number(node.data.x) || 0) / 2.5}px`,
                    top: `${(Number(node.data.y) || 0) / 2.5 + 40}px`,
                    width: `${(Number(node.data.width) || 120) / 2.5}px`,
                    height: `${(Number(node.data.height) || 40) / 2.5}px`,
                    background: '#2563eb',
                    borderRadius: '4px',
                    fontSize: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid white',
                    color: 'white',
                    fontWeight: 'bold'
                  }}>
                    {String(node.data.label || 'Btn')}
                  </div>
                );
              }
              if (node.type === 'log') {
                return (
                  <div key={node.id} style={{
                    position: 'absolute',
                    left: `${(Number(node.data.x) || 0) / 2.5}px`,
                    top: `${(Number(node.data.y) || 0) / 2.5 + 40}px`,
                    width: `${(Number(node.data.width) || 600) / 2.5}px`,
                    height: `${(Number(node.data.height) || 150) / 2.5}px`,
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid #3b82f6',
                    padding: '4px',
                    fontSize: '8px',
                    overflow: 'hidden',
                    color: '#94a3b8'
                  }}>
                    {String(node.data.mode === 'box' ? 'Log Box' : 'Plain Text Log')}
                  </div>
                );
              }
              return null;
            })}
          </div>
          <small style={{ opacity: 0.4, textAlign: 'center' }}>※ 実際のアリーナ幅 1000px を基準に縮小表示しています</small>
        </div>
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
