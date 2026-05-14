
"use client";

import React, { useState } from 'react';
import { Button } from './Button';
import styles from '../app/page.module.css';

interface LayoutElement {
  id: string;
  type: 'text' | 'input' | 'button' | 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  binding?: string; // Var name from MOD flow
}

export function LayoutDesigner() {
  const [elements, setElements] = useState<LayoutElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const addElement = (type: LayoutElement['type']) => {
    const newEl: LayoutElement = {
      id: `el_${Date.now()}`,
      type,
      x: 50,
      y: 50,
      w: type === 'text' ? 200 : 150,
      h: type === 'text' ? 40 : 40,
      content: type === 'text' ? 'New Text' : type === 'button' ? 'Submit' : '',
    };
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const updateElement = (id: string, updates: Partial<LayoutElement>) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  return (
    <div style={{ display: 'flex', gap: '1rem', height: '600px' }}>
      {/* Element Palette */}
      <div style={{ width: '150px', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h4 style={{ margin: '0 0 1rem 0' }}>Elements</h4>
        <Button variant="secondary" onClick={() => addElement('text')}>+ Text</Button>
        <Button variant="secondary" onClick={() => addElement('input')}>+ Input</Button>
        <Button variant="secondary" onClick={() => addElement('button')}>+ Button</Button>
        <Button variant="secondary" onClick={() => addElement('image')}>+ Image</Button>
      </div>

      {/* Canvas */}
      <div style={{ flexGrow: 1, background: '#111', borderRadius: '12px', position: 'relative', overflow: 'hidden', border: '1px solid #333' }}>
        {elements.map(el => (
          <div
            key={el.id}
            onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
            style={{
              position: 'absolute',
              left: el.x,
              top: el.y,
              width: el.w,
              height: el.h,
              border: selectedId === el.id ? '2px solid var(--primary)' : '1px solid #444',
              background: el.type === 'button' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'move',
              padding: '0.5rem',
              borderRadius: '4px',
              fontSize: '0.8rem',
              color: 'white',
              userSelect: 'none'
            }}
            onMouseDown={(e) => {
                const startX = e.clientX;
                const startY = e.clientY;
                const origX = el.x;
                const origY = el.y;
                
                const onMouseMove = (moveEvent: MouseEvent) => {
                    updateElement(el.id, {
                        x: origX + (moveEvent.clientX - startX),
                        y: origY + (moveEvent.clientY - startY)
                    });
                };
                const onMouseUp = () => {
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                };
                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            }}
          >
            {el.type === 'input' ? <input disabled placeholder="Input Box" style={{ width: '100%', background: 'transparent', border: 'none', color: 'white' }} /> : el.content}
            {selectedId === el.id && (
                <div 
                    style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', background: 'var(--primary)', cursor: 'nwse-resize' }}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const origW = el.w;
                        const origH = el.h;
                        const onMouseMove = (moveEvent: MouseEvent) => {
                            updateElement(el.id, {
                                w: Math.max(20, origW + (moveEvent.clientX - startX)),
                                h: Math.max(20, origH + (moveEvent.clientY - startY))
                            });
                        };
                        const onMouseUp = () => {
                            window.removeEventListener('mousemove', onMouseMove);
                            window.removeEventListener('mouseup', onMouseUp);
                        };
                        window.addEventListener('mousemove', onMouseMove);
                        window.addEventListener('mouseup', onMouseUp);
                    }}
                />
            )}
          </div>
        ))}
      </div>

      {/* Properties Panel */}
      <div style={{ width: '250px', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px' }}>
        <h4 style={{ margin: '0 0 1rem 0' }}>Properties</h4>
        {selectedElement ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Content / Label</label>
                <input 
                    style={{ width: '100%', background: '#000', border: '1px solid #444', color: 'white', padding: '0.4rem' }}
                    value={selectedElement.content} 
                    onChange={e => updateElement(selectedElement.id, { content: e.target.value })} 
                />
            </div>
            <div>
                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem' }}>Variable Binding</label>
                <input 
                    style={{ width: '100%', background: '#000', border: '1px solid #444', color: 'white', padding: '0.4rem' }}
                    placeholder="e.g. energy_value"
                    value={selectedElement.binding || ''} 
                    onChange={e => updateElement(selectedElement.id, { binding: e.target.value })} 
                />
            </div>
            <Button variant="secondary" onClick={() => setElements(elements.filter(el => el.id !== selectedId))}>Delete Element</Button>
          </div>
        ) : (
          <div style={{ opacity: 0.5, fontSize: '0.9rem' }}>Select an element to edit</div>
        )}
      </div>
    </div>
  );
}
