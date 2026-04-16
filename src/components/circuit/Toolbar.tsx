import type React from 'react';
import type { Tool } from './types';

interface ToolbarProps {
  tool: Tool;
  setTool: (t: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function VoltageIcon({ size = 18 }: { size?: number }) {
  const w = size, h = size;
  return (
    <svg width={w} height={h} viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round">
      {/* connection lines */}
      <line x1="1" y1="10" x2="7" y2="10" />
      <line x1="13" y1="10" x2="19" y2="10" />
      {/* short line (negative) */}
      <line x1="7" y1="6.5" x2="7" y2="13.5" />
      {/* long line (positive) */}
      <line x1="13" y1="4" x2="13" y2="16" />
      {/* +/- labels */}
      <text x="13" y="3" textAnchor="middle" fontSize="5" fill="#000" stroke="none" fontFamily="sans-serif">+</text>
      <text x="7" y="3" textAnchor="middle" fontSize="5.5" fill="#000" stroke="none" fontFamily="sans-serif">−</text>
    </svg>
  );
}

function VoltageVarIcon({ size = 18 }: { size?: number }) {
  const w = size, h = size;
  return (
    <svg width={w} height={h} viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round">
      <line x1="1" y1="10" x2="7" y2="10" />
      <line x1="13" y1="10" x2="19" y2="10" />
      <line x1="7" y1="6.5" x2="7" y2="13.5" />
      <line x1="13" y1="4" x2="13" y2="16" />
      {/* diagonal arrow for variable */}
      <line x1="5" y1="16" x2="16" y2="3" strokeWidth="1" />
      <line x1="14.5" y1="3.5" x2="16" y2="3" strokeWidth="1" />
      <line x1="15.5" y1="4.8" x2="16" y2="3" strokeWidth="1" />
    </svg>
  );
}

const tools: { id: Tool; label: string; icon: string | React.ReactNode }[] = [
  { id: 'select', label: 'Select', icon: '⇱' },
  { id: 'voltage', label: 'Voltage Source', icon: <VoltageIcon /> },
  { id: 'voltage_var', label: 'Variable Source', icon: <VoltageVarIcon /> },
  { id: 'resistor', label: 'Resistor', icon: '▭' },
  { id: 'led', label: 'LED', icon: '▷' },
  { id: 'motor', label: 'Motor', icon: 'M' },
  { id: 'lamp', label: 'Lamp', icon: '☼' },
  { id: 'wire', label: 'Wire', icon: '╲' },
  { id: 'text', label: 'Text', icon: 'A' },
  { id: 'delete', label: 'Delete', icon: '✕' },
];

export function Toolbar({ tool, setTool, onUndo, onRedo, onReset, canUndo, canRedo }: ToolbarProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 44,
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      padding: '0 8px',
      borderBottom: '1px solid #e0e0e0',
      background: '#fff',
      zIndex: 10,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: 12,
    }}>
      {tools.map(t => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          title={t.label}
          style={{
            width: 36, height: 32,
            border: tool === t.id ? '1.5px solid #000' : '1px solid transparent',
            borderRadius: 4,
            background: tool === t.id ? '#f5f5f5' : 'transparent',
            cursor: 'pointer',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#000',
            padding: 0,
          }}
        >
          {t.icon}
        </button>
      ))}

      <div style={{ width: 1, height: 24, background: '#e0e0e0', margin: '0 6px' }} />

      <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)"
        style={{ width: 36, height: 32, border: '1px solid transparent', borderRadius: 4,
          background: 'transparent', cursor: canUndo ? 'pointer' : 'default',
          fontSize: 14, color: canUndo ? '#000' : '#ccc',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↩</button>
      <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"
        style={{ width: 36, height: 32, border: '1px solid transparent', borderRadius: 4,
          background: 'transparent', cursor: canRedo ? 'pointer' : 'default',
          fontSize: 14, color: canRedo ? '#000' : '#ccc',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↪</button>

      <div style={{ flex: 1 }} />

      <button onClick={onReset} title="Clear canvas"
        style={{ height: 28, padding: '0 12px', border: '1px solid #e0e0e0', borderRadius: 4,
          background: '#fff', cursor: 'pointer', fontSize: 12, color: '#666' }}>Reset</button>
    </div>
  );
}
