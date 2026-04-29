
'use client';

import React, { useState, useEffect } from 'react';
import styles from './LayoutEditor.module.css';

interface LayoutEditorProps {
  nodes: any[];
  onUpdateNode: (id: string, data: any) => void;
}

export function LayoutEditor({ nodes, onUpdateNode }: LayoutEditorProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Filter nodes that have UI components
  const uiNodes = nodes.filter(n => ['button', 'log'].includes(n.type));

  const handleMouseDown = (e: React.MouseEvent, node: any) => {
    setDraggingId(node.id);
    setOffset({
      x: e.clientX - (node.data.uiX || 0),
      y: e.clientY - (node.data.uiY || 0)
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingId) return;

    const node = uiNodes.find(n => n.id === draggingId);
    if (!node) return;

    const newX = Math.round(e.clientX - offset.x);
    const newY = Math.round(e.clientY - offset.y);

    onUpdateNode(draggingId, { ...node.data, uiX: newX, uiY: newY });
  };

  const handleMouseUp = () => {
    setDraggingId(null);
  };

  useEffect(() => {
    if (draggingId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, offset]);

  return (
    <div className={styles.container}>
      <div className={styles.canvas}>
        <div className={styles.screenInfo}>Battle Arena Preview (1000px wide)</div>
        
        {uiNodes.map(node => (
          <div
            key={node.id}
            className={`${styles.uiElement} ${draggingId === node.id ? styles.dragging : ''}`}
            style={{
              left: `${node.data.uiX || 0}px`,
              top: `${node.data.uiY || 0}px`,
              width: `${node.data.uiW || (node.type === 'button' ? 150 : 400)}px`,
            }}
            onMouseDown={(e) => handleMouseDown(e, node)}
          >
            <div className={styles.nodeTag}>{node.type.toUpperCase()}</div>
            <div className={styles.content}>
              {node.type === 'button' ? (node.data.label || 'Button') : 'Log / Message Area'}
            </div>
          </div>
        ))}

        {/* Mock Battle UI Elements for Reference */}
        <div className={styles.mockArena}>
          <div className={styles.mockTitle}>Battle Result Header</div>
          <div className={styles.mockText}>Sample battle log text will appear here...</div>
        </div>
      </div>
      
      <div className={styles.instructions}>
        <h3>Layout Mode</h3>
        <p>Drag components to position them. Coords are absolute from top-left.</p>
        <p>Tip: Use this to avoid overlapping with battle logs.</p>
      </div>
    </div>
  );
}
