import type React from 'react';
import { useState } from 'react';
import type { Tool, ComponentType } from './types';
import { t, type Lang } from './i18n';

interface ToolbarProps {
  tool: Tool;
  setTool: (t: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  lang: Lang;
  setLang: (l: Lang) => void;
}

// --- Inline SVG icons (kept tiny & monochrome for clean toolbar) ----------

function VoltageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round">
      <line x1="1" y1="10" x2="9" y2="10" />
      <line x1="11" y1="10" x2="19" y2="10" />
      <line x1="9" y1="7" x2="9" y2="13" />
      <line x1="11" y1="4.5" x2="11" y2="15.5" />
    </svg>
  );
}
function VoltageACIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round">
      <line x1="1" y1="10" x2="4" y2="10" />
      <line x1="16" y1="10" x2="19" y2="10" />
      <circle cx="10" cy="10" r="6" />
      <path d="M 6.5 10 Q 8.25 6.5 10 10 T 13.5 10" strokeWidth="1.2" />
    </svg>
  );
}
function ResistorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round">
      <line x1="1" y1="10" x2="5" y2="10" />
      <line x1="15" y1="10" x2="19" y2="10" />
      <rect x="5" y="7" width="10" height="6" />
    </svg>
  );
}
function LEDIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="10" x2="6" y2="10" />
      <line x1="14" y1="10" x2="19" y2="10" />
      <polygon points="6,5 6,15 14,10" />
      <line x1="14" y1="5" x2="14" y2="15" />
    </svg>
  );
}
function MotorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round">
      <line x1="1" y1="10" x2="4" y2="10" />
      <line x1="16" y1="10" x2="19" y2="10" />
      <circle cx="10" cy="10" r="6" />
      <text x="10" y="13.5" fontSize="9" textAnchor="middle" fill="#000" stroke="none" fontFamily="sans-serif" fontWeight="bold">M</text>
    </svg>
  );
}
function LampIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round">
      <line x1="1" y1="10" x2="4" y2="10" />
      <line x1="16" y1="10" x2="19" y2="10" />
      <circle cx="10" cy="10" r="6" />
      <line x1="6" y1="6" x2="14" y2="14" />
      <line x1="14" y1="6" x2="6" y2="14" />
    </svg>
  );
}
function MeterIcon({ letter }: { letter: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round">
      <line x1="1" y1="10" x2="4" y2="10" />
      <line x1="16" y1="10" x2="19" y2="10" />
      <circle cx="10" cy="10" r="6" />
      <text x="10" y="13.5" fontSize="9" textAnchor="middle" fill="#000" stroke="none" fontFamily="sans-serif" fontWeight="bold">{letter}</text>
    </svg>
  );
}
function CapacitorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round">
      <line x1="1" y1="10" x2="8" y2="10" />
      <line x1="12" y1="10" x2="19" y2="10" />
      <line x1="8" y1="5" x2="8" y2="15" />
      <line x1="12" y1="5" x2="12" y2="15" />
    </svg>
  );
}
function InductorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round" fill="none">
      <line x1="1" y1="12" x2="4" y2="12" />
      <line x1="16" y1="12" x2="19" y2="12" />
      <path d="M 4 12 A 1.5 1.5 0 0 1 7 12 A 1.5 1.5 0 0 1 10 12 A 1.5 1.5 0 0 1 13 12 A 1.5 1.5 0 0 1 16 12" />
    </svg>
  );
}
function SwitchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round">
      <line x1="1" y1="13" x2="6" y2="13" />
      <line x1="14" y1="13" x2="19" y2="13" />
      <circle cx="6" cy="13" r="1.2" fill="#000" />
      <circle cx="14" cy="13" r="1.2" fill="#000" />
      <line x1="6" y1="13" x2="13" y2="6" />
    </svg>
  );
}
function DiodeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="10" x2="6" y2="10" />
      <line x1="14" y1="10" x2="19" y2="10" />
      <polygon points="6,5 6,15 14,10" />
      <line x1="14" y1="5" x2="14" y2="15" />
    </svg>
  );
}
function GroundIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round">
      <line x1="10" y1="2" x2="10" y2="11" />
      <line x1="5" y1="11" x2="15" y2="11" />
      <line x1="7" y1="14" x2="13" y2="14" />
      <line x1="9" y1="17" x2="11" y2="17" />
    </svg>
  );
}
function PotmeterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="12" x2="5" y2="12" />
      <line x1="15" y1="12" x2="19" y2="12" />
      <rect x="5" y="9" width="10" height="6" />
      <line x1="10" y1="2" x2="10" y2="9" />
      <polygon points="10,9 8,5 12,5" fill="#000" />
    </svg>
  );
}
function WireIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round">
      <path d="M 2 6 H 10 V 14 H 18" />
    </svg>
  );
}

interface ToolDef { id: Tool; key: string; icon: React.ReactNode }

const basic: ToolDef[] = [
  { id: 'select', key: 'tool.select', icon: <span style={{ fontSize: 14 }}>⇱</span> },
  { id: 'wire', key: 'tool.wire', icon: <WireIcon /> },
  { id: 'text', key: 'tool.text', icon: <span style={{ fontFamily: 'serif', fontStyle: 'italic', fontSize: 14 }}>A</span> },
  { id: 'delete', key: 'tool.delete', icon: <span style={{ fontSize: 14 }}>✕</span> },
];
const sources: ToolDef[] = [
  { id: 'voltage', key: 'tool.voltage', icon: <VoltageIcon /> },
  { id: 'voltage_ac', key: 'tool.voltage_ac', icon: <VoltageACIcon /> },
];
const loads: ToolDef[] = [
  { id: 'resistor', key: 'tool.resistor', icon: <ResistorIcon /> },
  { id: 'led', key: 'tool.led', icon: <LEDIcon /> },
  { id: 'motor', key: 'tool.motor', icon: <MotorIcon /> },
  { id: 'lamp', key: 'tool.lamp', icon: <LampIcon /> },
];
const meters: ToolDef[] = [
  { id: 'ammeter', key: 'tool.ammeter', icon: <MeterIcon letter="A" /> },
  { id: 'voltmeter', key: 'tool.voltmeter', icon: <MeterIcon letter="V" /> },
];
const advanced: ToolDef[] = [
  { id: 'capacitor', key: 'tool.capacitor', icon: <CapacitorIcon /> },
  { id: 'inductor', key: 'tool.inductor', icon: <InductorIcon /> },
  { id: 'switch', key: 'tool.switch', icon: <SwitchIcon /> },
  { id: 'diode', key: 'tool.diode', icon: <DiodeIcon /> },
  { id: 'ground', key: 'tool.ground', icon: <GroundIcon /> },
  { id: 'potentiometer', key: 'tool.potentiometer', icon: <PotmeterIcon /> },
];

const componentTools = new Set<Tool>([
  'voltage', 'voltage_ac', 'resistor', 'led', 'motor', 'lamp',
  'ammeter', 'voltmeter', 'capacitor', 'inductor', 'switch', 'diode', 'ground', 'potentiometer',
]);

function ToolButton({ t: tdef, current, onPick, label, draggable }: {
  t: ToolDef; current: Tool; onPick: (id: Tool) => void; label: string; draggable: boolean;
}) {
  const active = current === tdef.id;
  return (
    <button
      onClick={() => onPick(tdef.id)}
      title={label}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData('application/x-circuit-component', tdef.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      style={{
        width: 34, height: 30,
        border: active ? '1.5px solid #000' : '1px solid transparent',
        borderRadius: 4,
        background: active ? '#f5f5f5' : 'transparent',
        cursor: draggable ? 'grab' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#000', padding: 0,
      }}
    >
      {tdef.icon}
    </button>
  );
}

function GroupSep() {
  return <div style={{ width: 1, height: 22, background: '#e0e0e0', margin: '0 5px' }} />;
}

export function Toolbar({ tool, setTool, onUndo, onRedo, onReset, canUndo, canRedo, lang, setLang }: ToolbarProps) {
  const [advOpen, setAdvOpen] = useState(false);
  const renderGroup = (defs: ToolDef[]) => defs.map(d => (
    <ToolButton key={d.id} t={d} current={tool} onPick={setTool} label={t(lang, d.key)} draggable={componentTools.has(d.id)} />
  ));

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 44,
      display: 'flex', alignItems: 'center', gap: 1, padding: '0 8px',
      borderBottom: '1px solid #e0e0e0', background: '#fff', zIndex: 10,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: 12,
    }}>
      {renderGroup(basic)}
      <GroupSep />
      {renderGroup(sources)}
      <GroupSep />
      {renderGroup(loads)}
      <GroupSep />
      {renderGroup(meters)}
      <GroupSep />
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setAdvOpen(o => !o)}
          title={t(lang, 'group.advanced')}
          style={{
            height: 30, padding: '0 10px',
            border: advOpen ? '1.5px solid #000' : '1px solid #e0e0e0',
            borderRadius: 4, background: advOpen ? '#f5f5f5' : '#fff',
            cursor: 'pointer', fontSize: 12, color: '#000',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {t(lang, 'group.advanced')} <span style={{ fontSize: 9 }}>▼</span>
        </button>
        {advOpen && (
          <div
            onMouseLeave={() => setAdvOpen(false)}
            style={{
              position: 'absolute', top: 36, left: 0, zIndex: 30,
              background: '#fff', border: '1px solid #ccc', borderRadius: 6,
              padding: 6, display: 'grid', gridTemplateColumns: 'repeat(3, 34px)', gap: 2,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
          >
            {advanced.map(d => (
              <ToolButton key={d.id} t={d} current={tool} onPick={(id) => { setTool(id); setAdvOpen(false); }} label={t(lang, d.key)} draggable />
            ))}
          </div>
        )}
      </div>

      <GroupSep />

      <button onClick={onUndo} disabled={!canUndo} title={t(lang, 'btn.undo')}
        style={{ width: 34, height: 30, border: '1px solid transparent', borderRadius: 4,
          background: 'transparent', cursor: canUndo ? 'pointer' : 'default',
          fontSize: 14, color: canUndo ? '#000' : '#ccc',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↩</button>
      <button onClick={onRedo} disabled={!canRedo} title={t(lang, 'btn.redo')}
        style={{ width: 34, height: 30, border: '1px solid transparent', borderRadius: 4,
          background: 'transparent', cursor: canRedo ? 'pointer' : 'default',
          fontSize: 14, color: canRedo ? '#000' : '#ccc',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↪</button>

      <div style={{ flex: 1 }} />

      <button onClick={onReset} title={t(lang, 'btn.reset')}
        style={{ height: 28, padding: '0 12px', border: '1px solid #e0e0e0', borderRadius: 4,
          background: '#fff', cursor: 'pointer', fontSize: 12, color: '#666' }}>{t(lang, 'btn.reset')}</button>

      <div style={{ width: 8 }} />

      {/* Language toggle: flag pair */}
      <div style={{ display: 'flex', border: '1px solid #e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
        <button onClick={() => setLang('en')} title="English"
          style={{
            width: 30, height: 28, padding: 0, border: 'none',
            background: lang === 'en' ? '#f0f0f0' : '#fff',
            cursor: 'pointer', fontSize: 16, lineHeight: 1,
          }}>🇬🇧</button>
        <button onClick={() => setLang('nl')} title="Nederlands"
          style={{
            width: 30, height: 28, padding: 0, border: 'none', borderLeft: '1px solid #e0e0e0',
            background: lang === 'nl' ? '#f0f0f0' : '#fff',
            cursor: 'pointer', fontSize: 16, lineHeight: 1,
          }}>🇳🇱</button>
      </div>
    </div>
  );
}
