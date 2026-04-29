
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { X, Move } from 'lucide-react';

interface LayoutItem {
  id: string;
  type: string;
  label?: string;
  message?: string;
  posX: number;
  posY: number;
}

export default function LayoutDesigner({ 
  nodes, 
  onUpdateNode 
}: { 
  nodes: any[], 
  onUpdateNode: (id: string, data: any) => void 
}) {
  const [items, setItems] = useState<LayoutItem[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // Correctly find UI nodes by checking n.type
    const uiNodes = nodes.filter(n => n.type === 'button' || n.type === 'log');
    setItems(uiNodes.map(n => ({
      id: n.id,
      type: n.type,
      label: n.data.label || n.data.buttonLabel,
      message: n.data.message,
      posX: n.data.posX || 100,
      posY: n.data.posY || 100,
      width: n.data.width || (n.type === 'button' ? 150 : 300),
      height: n.data.height || (n.type === 'button' ? 40 : 100),
    })));
  }, [nodes]);

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setDraggingId(id);
    setOffset({
      x: e.clientX - item.posX,
      y: e.clientY - item.posY
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId) return;
    const newX = e.clientX - offset.x;
    const newY = e.clientY - offset.y;

    setItems(prev => prev.map(item => 
      item.id === draggingId ? { ...item, posX: newX, posY: newY } : item
    ));
  };

  const handleMouseUp = () => {
    if (draggingId) {
      const item = items.find(i => i.id === draggingId);
      if (item) {
        onUpdateNode(draggingId, { posX: item.posX, posY: item.posY, posMode: 'absolute' });
      }
    }
    setDraggingId(null);
  };

  const handleSizeChange = (id: string, w: number, h: number) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, width: w, height: h } : item
    ));
    onUpdateNode(id, { width: w, height: h });
  };

  return (
    <div 
      style={{ 
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000,
        display: 'flex', flexDirection: 'column'
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div style={{ padding: '1rem', background: '#111', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333' }}>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Pixel Layout Designer</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>Drag components to position them.</p>
          </div>
          {draggingId && (
            <div style={{ display: 'flex', gap: '1rem', background: '#222', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>W:</span>
                <input 
                  type="number" 
                  value={items.find(i => i.id === draggingId)?.width} 
                  onChange={(e) => handleSizeChange(draggingId, parseInt(e.target.value), items.find(i => i.id === draggingId)?.height || 40)}
                  style={{ width: '60px', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>H:</span>
                <input 
                  type="number" 
                  value={items.find(i => i.id === draggingId)?.height} 
                  onChange={(e) => handleSizeChange(draggingId, items.find(i => i.id === draggingId)?.width || 150, parseInt(e.target.value))}
                  style={{ width: '60px', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: '4px' }}
                />
              </div>
            </div>
          )}
        </div>
        <Button variant="secondary" onClick={() => window.dispatchEvent(new CustomEvent('layout-designer:close'))}>
          <X size={20} /> Close
        </Button>
      </div>

      <div style={{ 
        flexGrow: 1, position: 'relative', 
        backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', 
        backgroundSize: '20px 20px'
      }}>
        {items.map(item => (
          <div 
            key={item.id}
            onMouseDown={(e) => handleMouseDown(e, item.id)}
            style={{ 
              position: 'absolute', left: item.posX, top: item.posY,
              width: item.width, height: item.height,
              cursor: draggingId === item.id ? 'grabbing' : 'grab',
              userSelect: 'none',
              zIndex: draggingId === item.id ? 1000 : 1
            }}
          >
            <div style={{ 
              position: 'absolute', top: '-25px', left: 0, 
              fontSize: '10px', background: draggingId === item.id ? '#db2777' : '#2563eb', color: 'white', padding: '2px 6px', borderRadius: '4px',
              display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
            }}>
              <Move size={10} /> {item.type.toUpperCase()} ({item.posX}, {item.posY}) {item.width}x{item.height}
            </div>
            
            {item.type === 'button' ? (
              <Button style={{ pointerEvents: 'none', width: '100%', height: '100%' }}>{item.label || 'Button'}</Button>
            ) : (
              <div style={{ 
                padding: '1rem', background: 'rgba(37, 99, 235, 0.2)', border: '1px solid #2563eb', 
                borderRadius: '8px', width: '100%', height: '100%', pointerEvents: 'none',
                overflow: 'hidden'
              }}>
                {item.message || 'Log message...'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
