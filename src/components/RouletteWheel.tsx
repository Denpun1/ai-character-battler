'use client';

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import confetti from 'canvas-confetti';

export interface WheelItem {
  id: string;
  label: string;
  color: string;
  weight: number;
}

interface RouletteWheelProps {
  items: WheelItem[];
  onSpinStart?: () => void;
  onSpinEnd?: (winner: WheelItem) => void;
}

export interface RouletteWheelRef {
  spin: () => void;
}

const playTickSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {}
};

export const RouletteWheel = forwardRef<RouletteWheelRef, RouletteWheelProps>(({ items, onSpinStart, onSpinEnd }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  
  // Physics states mapped ref to survive renders
  const state = useRef({
    angle: 0,
    velocity: 0,
    lastTickAngle: 0,
    isSpinning: false,
    winnerAnnounced: false
  });

  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    ctx.clearRect(0, 0, width, height);

    if (items.length === 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#222';
      ctx.fill();
      ctx.fillStyle = '#666';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No Items', centerX, centerY);
      return;
    }

    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let startAngle = state.current.angle;

    // Draw slices
    items.forEach(item => {
      const sliceAngle = (item.weight / totalWeight) * 2 * Math.PI;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      
      ctx.fillStyle = item.color;
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw text
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      
      // Calculate font size based on slice angle if needed, or fixed
      ctx.font = 'bold 16px Inter, sans-serif';
      
      // Shadow for readability
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      
      ctx.fillText(item.label, radius - 20, 5);
      ctx.restore();

      startAngle += sliceAngle;
    });

    // Draw center dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 15, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.stroke();

    // Draw pointer
    ctx.beginPath();
    ctx.moveTo(width - 15, centerY);
    ctx.lineTo(width, centerY - 15);
    ctx.lineTo(width, centerY + 15);
    ctx.closePath();
    ctx.fillStyle = '#ff3366';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
  };

  useEffect(() => {
    drawWheel();
  }, [items]);

  const spin = () => {
    if (state.current.isSpinning || items.length === 0) return;
    
    setIsSpinning(true);
    state.current.isSpinning = true;
    state.current.winnerAnnounced = false;
    
    // Give a huge random velocity
    state.current.velocity = Math.random() * 0.2 + 0.4;
    state.current.lastTickAngle = state.current.angle;
    
    if (onSpinStart) onSpinStart();
    animate();
  };

  useImperativeHandle(ref, () => ({
    spin
  }));

  const animate = () => {
    if (!state.current.isSpinning) return;

    // Apply friction
    state.current.velocity *= 0.99;
    state.current.angle += state.current.velocity;

    // Tick sound trigger (pointer is at right edge, which corresponds to angle 0 locally)
    // We check how many slices we passed
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    
    // Normalized current angle (pointer is stationary at right side)
    const normalizedAngle = ((state.current.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const lastNormalizedAngle = ((state.current.lastTickAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    
    // Check if we crossed a boundary
    let accA = 0;
    for (const item of items) {
       const sliceA = (item.weight / totalWeight) * 2 * Math.PI;
       // We pass a boundary when reverse angle crosses accA
       // Actually simpler: just play sound randomly based on velocity, or calculate exact boundary.
       // For a smooth premium feel, let's just trigger sound when angle moves by roughly slice size.
       accA += sliceA;
    }
    
    // Simplification for ticks: tick every Math.PI / (items.length/2) 
    const tickDistance = (Math.PI * 2) / Math.max(1, items.length);
    if (Math.abs(state.current.angle - state.current.lastTickAngle) > tickDistance) {
       playTickSound();
       state.current.lastTickAngle = state.current.angle;
    }

    drawWheel();

    if (state.current.velocity < 0.001) {
      state.current.isSpinning = false;
      setIsSpinning(false);
      
      // Calculate winner
      // Pointer is at angle 0. 
      // The wheel is rotated by state.current.angle
      // So the absolute angle pointing to 0 is (2*PI - normalizedAngle)
      let winAngle = (Math.PI * 2 - normalizedAngle) % (Math.PI * 2);
      
      let accWinner = 0;
      let winner = items[0];
      for (const item of items) {
         const sliceAngle = (item.weight / totalWeight) * 2 * Math.PI;
         if (winAngle >= accWinner && winAngle < accWinner + sliceAngle) {
            winner = item;
            break;
         }
         accWinner += sliceAngle;
      }

      if (!state.current.winnerAnnounced) {
        state.current.winnerAnnounced = true;
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
        if (onSpinEnd) onSpinEnd(winner);
      }
      return;
    }

    requestAnimationFrame(animate);
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '500px', aspectRatio: '1', margin: '0 auto' }}>
      <canvas 
        ref={canvasRef} 
        width={500} 
        height={500} 
        style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))' }}
      />
    </div>
  );
});

RouletteWheel.displayName = 'RouletteWheel';
