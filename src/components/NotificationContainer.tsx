
'use client';

import React, { useState, useEffect } from 'react';
import { useBattleRealtime } from '@/hooks/useBattleRealtime';
import Link from 'next/link';

interface BattleToast {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  message: string;
  winner?: string;
  resultId?: string;
}

export function NotificationContainer() {
  const [toasts, setToasts] = useState<BattleToast[]>([]);
  useBattleRealtime(); // Active listener

  useEffect(() => {
    const handleStatusChange = (e: any) => {
      const data = e.detail;
      
      setToasts(prev => {
        const existing = prev.find(t => t.id === data.id);
        if (existing) {
          // Update existing toast
          return prev.map(t => t.id === data.id ? { ...t, ...data } : t);
        } else {
          // Add new toast
          return [...prev, data];
        }
      });

      // Auto-remove completed or failed after some time
      if (data.status === 'completed' || data.status === 'failed') {
        setTimeout(() => {
          setToasts(prev => prev.filter(t => t.id !== data.id));
        }, 10000);
      }
    };

    window.addEventListener('battleStatusChange', handleStatusChange);
    return () => window.removeEventListener('battleStatusChange', handleStatusChange);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      maxWidth: '350px',
      width: '100%'
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.status === 'completed' ? '#059669' : t.status === 'failed' ? '#dc2626' : '#2563eb',
          color: 'white',
          padding: '16px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '0.9rem' }}>
              {t.status === 'processing' && '⚔️ Processing...'}
              {t.status === 'completed' && '🏆 Victory!'}
              {t.status === 'failed' && '⚠️ Failed'}
            </strong>
            <button 
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              style={{ background: 'none', border: 'none', color: 'white', opacity: 0.6, cursor: 'pointer' }}
            >✕</button>
          </div>
          
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>
            {t.winner ? `${t.winner} が勝利しました！` : t.message}
          </p>

          {t.resultId && (
            <Link 
              href={`/?tab=history`} 
              style={{ 
                marginTop: '4px',
                color: 'white', 
                textDecoration: 'none', 
                fontSize: '0.8rem', 
                fontWeight: 'bold',
                background: 'rgba(255,255,255,0.2)',
                padding: '4px 8px',
                borderRadius: '6px',
                textAlign: 'center'
              }}
            >
              結果を見る
            </Link>
          )}
        </div>
      ))}
      <style jsx>{`
        @keyframes popIn {
          from { transform: scale(0.8) translateY(20px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
