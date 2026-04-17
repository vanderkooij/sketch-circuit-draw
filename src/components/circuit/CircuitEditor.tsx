import { useRef, useState, useCallback, useEffect } from 'react';
import type { CircuitState, Tool, Point, CircuitComponent, Wire, TextLabel } from './types';
import { GRID, snap, snapPoint, uid } from './types';
import {
  clearCanvas, drawComponent, drawWire, drawLabel, drawPreviewWire,
  hitTestComponent, hitTestWire, hitTestWireNode, hitTestLabel,
  getTerminal, findTerminalNear,
} from './renderer';
import { Toolbar } from './Toolbar';

const EMPTY: CircuitState = { components: [], wires: [], labels: [] };

const TERMINAL_SNAP = 12;

// Reconcile wire endpoints with their attached components' current positions
function syncWires(s: CircuitState): CircuitState {
  const byId = new Map(s.components.map(c => [c.id, c]));
  let changed = false;
  const wires = s.wires.map(w => {
    const newNodes = [...w.nodes];
    if (w.startAttach) {
      const c = byId.get(w.startAttach.componentId);
      if (c) {
        const p = getTerminal(c, w.startAttach.terminal);
        if (newNodes[0]?.x !== p.x || newNodes[0]?.y !== p.y) {
          newNodes[0] = p; changed = true;
        }
      }
    }
    if (w.endAttach) {
      const c = byId.get(w.endAttach.componentId);
      if (c) {
        const p = getTerminal(c, w.endAttach.terminal);
        const li = newNodes.length - 1;
        if (newNodes[li]?.x !== p.x || newNodes[li]?.y !== p.y) {
          newNodes[li] = p; changed = true;
        }
      }
    }
    return changed ? { ...w, nodes: newNodes } : w;
  });
  return changed ? { ...s, wires } : s;
}

type Selection =
  | { kind: 'component'; id: string }
  | { kind: 'wire'; id: string; node: number | null }
  | { kind: 'label'; id: string }
  | null;

export default function CircuitEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [state, setState] = useState<CircuitState>(EMPTY);
  const [history, setHistory] = useState<CircuitState[]>([EMPTY]);
  const [histIdx, setHistIdx] = useState(0);
  const [selection, setSelection] = useState<Selection>(null);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [wireNodes, setWireNodes] = useState<Point[]>([]);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editPos, setEditPos] = useState<Point>({ x: 0, y: 0 });
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });

  const commit = useCallback((next: CircuitState) => {
    setState(next);
    setHistory(h => [...h.slice(0, histIdx + 1), next]);
    setHistIdx(i => i + 1);
  }, [histIdx]);

  const undo = useCallback(() => {
    if (histIdx > 0) {
      setHistIdx(i => i - 1);
      setState(history[histIdx - 1]);
      setSelection(null);
    }
  }, [histIdx, history]);

  const redo = useCallback(() => {
    if (histIdx < history.length - 1) {
      setHistIdx(i => i + 1);
      setState(history[histIdx + 1]);
      setSelection(null);
    }
  }, [histIdx, history]);

  const reset = useCallback(() => {
    if (window.confirm('Clear the entire canvas?')) {
      commit(EMPTY);
      setSelection(null);
      setWireNodes([]);
    }
  }, [commit]);

  // Canvas coords from mouse event
  const canvasCoords = useCallback((e: React.MouseEvent): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - pan.x, y: e.clientY - r.top - pan.y };
  }, [pan]);

  // Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    clearCanvas(ctx, w, h);
    ctx.save();
    ctx.translate(pan.x, pan.y);

    state.wires.forEach(wire => {
      const sel = selection?.kind === 'wire' && selection.id === wire.id;
      drawWire(ctx, wire, sel, sel ? selection.node : null);
    });
    state.components.forEach(comp => {
      const sel = selection?.kind === 'component' && selection.id === comp.id;
      drawComponent(ctx, comp, sel);
    });
    state.labels.forEach(label => {
      const sel = selection?.kind === 'label' && selection.id === label.id;
      if (editingLabel !== label.id) drawLabel(ctx, label, sel);
    });

    if (tool === 'wire' && wireNodes.length > 0) {
      drawPreviewWire(ctx, wireNodes, snapPoint(mousePos));
    }

    ctx.restore();
  }, [state, selection, tool, wireNodes, mousePos, pan, editingLabel]);

  // Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      // Trigger re-render
      setMousePos(p => ({ ...p }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (editingLabel) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection) {
          e.preventDefault();
          deleteSelection();
        }
      }
      if (e.key === 'r' && selection?.kind === 'component') {
        rotateSelection();
      }
      if (e.key === 'Escape') {
        setWireNodes([]);
        setSelection(null);
        setTool('select');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selection, editingLabel, undo, redo]);

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    const next = { ...state };
    if (selection.kind === 'component') next.components = state.components.filter(c => c.id !== selection.id);
    if (selection.kind === 'wire') next.wires = state.wires.filter(w => w.id !== selection.id);
    if (selection.kind === 'label') next.labels = state.labels.filter(l => l.id !== selection.id);
    commit(next);
    setSelection(null);
  }, [selection, state, commit]);

  const rotateSelection = useCallback(() => {
    if (selection?.kind !== 'component') return;
    const next = {
      ...state,
      components: state.components.map(c =>
        c.id === selection.id ? { ...c, rotation: ((c.rotation + 90) % 360) as 0 | 90 | 180 | 270 } : c
      ),
    };
    commit(next);
  }, [selection, state, commit]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Pan
      setPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }
    if (e.button !== 0) return;

    const p = canvasCoords(e);
    const sp = snapPoint(p);
    const ctx = canvasRef.current!.getContext('2d')!;

    if (['voltage', 'voltage_var', 'resistor', 'led', 'motor', 'lamp'].includes(tool)) {
      const comp: CircuitComponent = { id: uid(), type: tool as CircuitComponent['type'], x: sp.x, y: sp.y, rotation: 0 };
      commit({ ...state, components: [...state.components, comp] });
      return;
    }

    if (tool === 'wire') {
      // Snap to a component terminal if close
      const term = findTerminalNear(state.components, p, TERMINAL_SNAP);
      const node = term ? term.point : sp;
      setWireNodes(prev => [...prev, node]);
      return;
    }

    if (tool === 'text') {
      const label: TextLabel = { id: uid(), x: sp.x, y: sp.y, text: '' };
      const next = { ...state, labels: [...state.labels, label] };
      commit(next);
      setEditingLabel(label.id);
      setEditText('');
      setEditPos(sp);
      return;
    }

    if (tool === 'delete') {
      // Delete whatever we hit
      for (const c of [...state.components].reverse()) {
        if (hitTestComponent(c, p)) {
          commit({ ...state, components: state.components.filter(x => x.id !== c.id) });
          return;
        }
      }
      for (const w of [...state.wires].reverse()) {
        if (hitTestWire(w, p)) {
          commit({ ...state, wires: state.wires.filter(x => x.id !== w.id) });
          return;
        }
      }
      for (const l of [...state.labels].reverse()) {
        if (hitTestLabel(ctx, l, p)) {
          commit({ ...state, labels: state.labels.filter(x => x.id !== l.id) });
          return;
        }
      }
      return;
    }

    // Select tool
    // Check components
    for (const c of [...state.components].reverse()) {
      if (hitTestComponent(c, p)) {
        setSelection({ kind: 'component', id: c.id });
        setDragging(true);
        setDragOffset({ x: p.x - c.x, y: p.y - c.y });
        return;
      }
    }
    // Check wire nodes first, then wires
    for (const w of [...state.wires].reverse()) {
      const nodeIdx = hitTestWireNode(w, p);
      if (nodeIdx !== null) {
        setSelection({ kind: 'wire', id: w.id, node: nodeIdx });
        setDragging(true);
        setDragOffset({ x: 0, y: 0 });
        return;
      }
      if (hitTestWire(w, p)) {
        setSelection({ kind: 'wire', id: w.id, node: null });
        return;
      }
    }
    // Check labels
    for (const l of [...state.labels].reverse()) {
      if (hitTestLabel(ctx, l, p)) {
        setSelection({ kind: 'label', id: l.id });
        setDragging(true);
        setDragOffset({ x: p.x - l.x, y: p.y - l.y });
        return;
      }
    }
    setSelection(null);
  }, [tool, state, canvasCoords, pan, commit]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const p = canvasCoords(e);
    setMousePos(p);

    if (panning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (!dragging || !selection) return;
    const sp = snapPoint(p);

    if (selection.kind === 'component') {
      setState(prev => ({
        ...prev,
        components: prev.components.map(c =>
          c.id === selection.id ? { ...c, x: snap(p.x - dragOffset.x), y: snap(p.y - dragOffset.y) } : c
        ),
      }));
    } else if (selection.kind === 'wire' && selection.node !== null) {
      setState(prev => ({
        ...prev,
        wires: prev.wires.map(w =>
          w.id === selection.id
            ? { ...w, nodes: w.nodes.map((n, i) => (i === selection.node ? sp : n)) }
            : w
        ),
      }));
    } else if (selection.kind === 'label') {
      setState(prev => ({
        ...prev,
        labels: prev.labels.map(l =>
          l.id === selection.id ? { ...l, x: snap(p.x - dragOffset.x), y: snap(p.y - dragOffset.y) } : l
        ),
      }));
    }
  }, [dragging, selection, canvasCoords, dragOffset, panning, panStart]);

  const handleMouseUp = useCallback(() => {
    if (panning) {
      setPanning(false);
      return;
    }
    if (dragging) {
      setDragging(false);
      // Commit the drag
      commit(state);
    }
  }, [dragging, state, commit, panning]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const p = canvasCoords(e);
    const ctx = canvasRef.current!.getContext('2d')!;

    // Double-click on label to edit
    for (const l of state.labels) {
      if (hitTestLabel(ctx, l, p)) {
        setEditingLabel(l.id);
        setEditText(l.text);
        setEditPos({ x: l.x, y: l.y });
        return;
      }
    }

    // Double-click on wire to add node (split)
    if (selection?.kind === 'wire') {
      const wire = state.wires.find(w => w.id === selection.id);
      if (!wire) return;
      const sp = snapPoint(p);
      // Find nearest segment
      let bestDist = Infinity;
      let bestIdx = 0;
      for (let i = 0; i < wire.nodes.length - 1; i++) {
        const d = distToSegmentFull(p, wire.nodes[i], wire.nodes[i + 1]);
        if (d < bestDist) { bestDist = d; bestIdx = i + 1; }
      }
      if (bestDist < 15) {
        const newNodes = [...wire.nodes];
        newNodes.splice(bestIdx, 0, sp);
        commit({
          ...state,
          wires: state.wires.map(w => w.id === wire.id ? { ...w, nodes: newNodes } : w),
        });
      }
    }

    // Right-click to rotate
    if (selection?.kind === 'component') {
      rotateSelection();
    }
  }, [canvasCoords, state, selection, commit, rotateSelection]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (selection?.kind === 'component') {
      rotateSelection();
    }
  }, [selection, rotateSelection]);

  // Finalize wire on double-click when in wire mode
  const finishWire = useCallback(() => {
    if (wireNodes.length >= 2) {
      const wire: Wire = { id: uid(), nodes: [...wireNodes] };
      commit({ ...state, wires: [...state.wires, wire] });
    }
    setWireNodes([]);
  }, [wireNodes, state, commit]);

  // Handle wire finish (double-click or Escape)
  useEffect(() => {
    const handleDblClick = () => {
      if (tool === 'wire' && wireNodes.length >= 2) finishWire();
    };
    const canvas = canvasRef.current;
    canvas?.addEventListener('dblclick', handleDblClick);
    return () => canvas?.removeEventListener('dblclick', handleDblClick);
  }, [tool, wireNodes, finishWire]);

  const finishLabelEdit = useCallback(() => {
    if (!editingLabel) return;
    commit({
      ...state,
      labels: state.labels.map(l => l.id === editingLabel ? { ...l, text: editText } : l),
    });
    setEditingLabel(null);
  }, [editingLabel, editText, state, commit]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#fff' }}>
      <Toolbar
        tool={tool}
        setTool={(t) => { setTool(t); setWireNodes([]); setSelection(null); }}
        onUndo={undo}
        onRedo={redo}
        onReset={reset}
        canUndo={histIdx > 0}
        canRedo={histIdx < history.length - 1}
      />
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: getCursor(tool, dragging, panning) }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />
      {editingLabel && (
        <div
          style={{
            position: 'absolute',
            left: editPos.x + pan.x,
            top: editPos.y + pan.y + 44 - 10,
            zIndex: 20,
          }}
        >
          <input
            autoFocus
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onBlur={() => setTimeout(finishLabelEdit, 150)}
            onKeyDown={e => { if (e.key === 'Enter') finishLabelEdit(); if (e.key === 'Escape') { setEditingLabel(null); } }}
            style={{
              font: '14px "SF Mono", "Fira Code", monospace',
              border: '1px solid #000',
              outline: 'none',
              background: '#fff',
              padding: '4px 8px',
              minWidth: 120,
              display: 'block',
            }}
            placeholder="R₁, U₂, Ω..."
          />
          <div style={{
            marginTop: 4, background: '#fff', border: '1px solid #e0e0e0',
            borderRadius: 4, padding: '6px 8px', fontSize: 11, color: '#888',
            fontFamily: 'monospace', lineHeight: 1.6, whiteSpace: 'pre-wrap',
          }}>
            <div style={{ marginBottom: 4, color: '#555', fontWeight: 600 }}>Quick insert:</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'].map(s => (
                <button key={s} onMouseDown={e => { e.preventDefault(); setEditText(t => t + s); }}
                  style={{ width: 24, height: 24, border: '1px solid #ddd', borderRadius: 3,
                    background: '#fafafa', cursor: 'pointer', fontSize: 13, fontFamily: 'monospace' }}>
                  {s}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {['Ω','Δ','μ','π','±','·','→','∞','≈','°'].map(s => (
                <button key={s} onMouseDown={e => { e.preventDefault(); setEditText(t => t + s); }}
                  style={{ width: 24, height: 24, border: '1px solid #ddd', borderRadius: 3,
                    background: '#fafafa', cursor: 'pointer', fontSize: 13, fontFamily: 'monospace' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 8, right: 12,
        fontSize: 11, color: '#bbb', fontFamily: 'monospace',
        pointerEvents: 'none',
      }}>
        {tool === 'wire' && wireNodes.length > 0 ? 'Click to add nodes · Double-click to finish' :
         tool === 'select' && selection?.kind === 'component' ? 'R to rotate · Right-click to rotate · Delete to remove' :
         tool === 'select' && selection?.kind === 'wire' ? 'Double-click wire to add node · Drag nodes to reshape' :
         tool === 'select' ? 'Click to select · Alt+drag to pan' :
         tool === 'wire' ? 'Click to start wire' :
         tool === 'text' ? 'Click to place label · Use ₁₂₃ for subscripts' :
         'Alt+drag or middle-click to pan'}
      </div>
    </div>
  );
}

function getCursor(tool: Tool, dragging: boolean, panning: boolean): string {
  if (panning) return 'grabbing';
  if (dragging) return 'grabbing';
  if (tool === 'select') return 'default';
  if (tool === 'delete') return 'crosshair';
  return 'crosshair';
}

function distToSegmentFull(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((p.x - (a.x + t * dx)) ** 2 + (p.y - (a.y + t * dy)) ** 2);
}
