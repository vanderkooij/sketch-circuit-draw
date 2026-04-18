import type React from 'react';
import type { Tool, ComponentType } from './types';

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
      <line x1="1" y1="10" x2="9" y2="10" />
      <line x1="11" y1="10" x2="19" y2="10" />
      <line x1="9" y1="7" x2="9" y2="13" />
      <line x1="11" y1="4.5" x2="11" y2="15.5" />
      <text x="12.5" y="4" textAnchor="middle" fontSize="5" fill="#000" stroke="none" fontFamily="sans-serif">+</text>
      <text x="7.5" y="4" textAnchor="middle" fontSize="5.5" fill="#000" stroke="none" fontFamily="sans-serif">−</text>
    </svg>
  );
}

function VoltageACIcon({ size = 18 }: { size?: number }) {
  const w = size, h = size;
  return (
    <svg width={w} height={h} viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round">
      <line x1="1" y1="10" x2="4" y2="10" />
      <line x1="16" y1="10" x2="19" y2="10" />
      <circle cx="10" cy="10" r="6" />
      <path d="M 6.5 10 Q 8.25 6.5 10 10 T 13.5 10" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

const componentTypes: ComponentType[] = ['voltage', 'voltage_ac', 'resistor', 'led', 'motor', 'lamp'];

const tools: { id: Tool; label: string; icon: string | React.ReactNode }[] = [
  { id: 'select', label: 'Select', icon: '⇱' },
  { id: 'voltage', label: 'DC Voltage Source (drag to canvas)', icon: <VoltageIcon /> },
  { id: 'voltage_ac', label: 'AC Voltage Source (drag to canvas)', icon: <VoltageACIcon /> },
  { id: 'resistor', label: 'Resistor (drag to canvas)', icon: '▭' },
  { id: 'led', label: 'LED (drag to canvas)', icon: '▷' },
  { id: 'motor', label: 'Motor (drag to canvas)', icon: 'M' },
  { id: 'lamp', label: 'Lamp (drag to canvas)', icon: '☼' },
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
      {tools.map(t => {
        const isComponent = (componentTypes as string[]).includes(t.id);
        return (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={t.label}
            draggable={isComponent}
            onDragStart={(e) => {
              if (!isComponent) return;
              e.dataTransfer.setData('application/x-circuit-component', t.id);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            style={{
              width: 36, height: 32,
              border: tool === t.id ? '1.5px solid #000' : '1px solid transparent',
              borderRadius: 4,
              background: tool === t.id ? '#f5f5f5' : 'transparent',
              cursor: isComponent ? 'grab' : 'pointer',
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
        );
      })}

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
