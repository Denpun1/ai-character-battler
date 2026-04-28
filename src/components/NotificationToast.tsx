
import React from 'react';
import Link from 'next/link';

interface Props {
  notifications: any[];
  onRemove: (id: string) => void;
}

export default function NotificationToast({ notifications, onRemove }: Props) {
  if (notifications.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '300px'
    }}>
      {notifications.map(n => (
        <div key={n.id} style={{
          background: n.type === 'error' ? '#dc2626' : 'var(--primary)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.3s ease-out',
          fontSize: '0.9rem',
          position: 'relative'
        }}>
          <button 
            onClick={() => onRemove(n.id)}
            style={{
              position: 'absolute',
              top: '5px',
              right: '8px',
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >✕</button>
          <div style={{ marginRight: '15px' }}>{n.message}</div>
          {n.battleId && (
            <Link 
              href={`/history`}
              onClick={() => onRemove(n.id)}
              style={{
                color: 'white',
                textDecoration: 'underline',
                marginTop: '5px',
                fontSize: '0.8rem',
                fontWeight: 'bold'
              }}
            >
              結果を見る
            </Link>
          )}
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
