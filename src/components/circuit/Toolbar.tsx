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

const tools: { id: Tool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: '⇱' },
  { id: 'voltage', label: 'Source', icon: '⊥' },
  { id: 'resistor', label: 'Resistor', icon: '▭' },
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
          }}
        >
          {t.icon}
        </button>
      ))}

      <div style={{ width: 1, height: 24, background: '#e0e0e0', margin: '0 6px' }} />

      <button
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        style={{
          width: 36, height: 32, border: '1px solid transparent', borderRadius: 4,
          background: 'transparent', cursor: canUndo ? 'pointer' : 'default',
          fontSize: 14, color: canUndo ? '#000' : '#ccc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ↩
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        style={{
          width: 36, height: 32, border: '1px solid transparent', borderRadius: 4,
          background: 'transparent', cursor: canRedo ? 'pointer' : 'default',
          fontSize: 14, color: canRedo ? '#000' : '#ccc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ↪
      </button>

      <div style={{ flex: 1 }} />

      <button
        onClick={onReset}
        title="Clear canvas"
        style={{
          height: 28, padding: '0 12px', border: '1px solid #e0e0e0', borderRadius: 4,
          background: '#fff', cursor: 'pointer', fontSize: 12, color: '#666',
        }}
      >
        Reset
      </button>
    </div>
  );
}
