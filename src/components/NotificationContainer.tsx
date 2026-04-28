
'use client';

import React, { useState, useEffect } from 'react';
import { useQueueNotification } from '@/hooks/useQueueNotification';
import Link from 'next/link';

export function NotificationContainer() {
  const [notifications, setNotifications] = useState<any[]>([]);
  useQueueNotification(); // Initialize listener

  useEffect(() => {
    const handleBattleCompleted = (e: any) => {
      const { id, resultId, winner } = e.detail;
      const newNotif = {
        id,
        message: `${winner || '対戦'} の生成が完了しました！`,
        link: `/history#${resultId}`,
        type: 'success'
      };
      setNotifications(prev => [...prev, newNotif]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 10000);
    };

    const handleBattleFailed = (e: any) => {
      const id = Math.random().toString(36);
      const newNotif = {
        id,
        message: `対戦の生成に失敗しました: ${e.detail.message}`,
        type: 'error'
      };
      setNotifications(prev => [...prev, newNotif]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 10000);
    };

    window.addEventListener('battleCompleted', handleBattleCompleted);
    window.addEventListener('battleFailed', handleBattleFailed);
    return () => {
      window.removeEventListener('battleCompleted', handleBattleCompleted);
      window.removeEventListener('battleFailed', handleBattleFailed);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      {notifications.map(n => (
        <div key={n.id} style={{
          background: n.type === 'success' ? '#16a34a' : '#dc2626',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          <span>{n.message}</span>
          {n.link && (
            <Link href={n.link} style={{ 
              color: 'white', 
              textDecoration: 'underline', 
              fontWeight: 'bold' 
            }}>
              View
            </Link>
          )}
          <button onClick={() => setNotifications(prev => prev.filter(x => x.id !== n.id))} style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            opacity: 0.7
          }}>✕</button>
        </div>
      ))}
      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
