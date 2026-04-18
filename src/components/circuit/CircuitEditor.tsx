import { useRef, useState, useCallback, useEffect } from 'react';
import type { CircuitState, Tool, Point, CircuitComponent, Wire, TextLabel, WireAttachment, ComponentType, LRouteOrientation } from './types';
import { GRID, snap, snapPoint, uid, orthogonalRoute, inferOrientation } from './types';
import {
  clearCanvas, drawComponent, drawWire, drawLabel, drawPreviewWire, drawSnapHint,
  drawAlignmentGuides,
  hitTestComponent, hitTestWire, hitTestWireNode, hitTestLabel,
  getTerminal, findSnapTarget,
} from './renderer';
import { Toolbar } from './Toolbar';

const EMPTY: CircuitState = { components: [], wires: [], labels: [] };

const SNAP_TOL = 12;
const ALIGN_TOL = 6;

// Snap a dragged position to align with other components' x/y axes.
// Returns adjusted position plus the guide lines that should be displayed.
function alignToOthers(
  pos: Point,
  others: CircuitComponent[],
): { pos: Point; guides: { x?: number; y?: number }[] } {
  let bestDx: { d: number; x: number } | null = null;
  let bestDy: { d: number; y: number } | null = null;
  for (const c of others) {
    const dx = Math.abs(c.x - pos.x);
    if (dx <= ALIGN_TOL && (!bestDx || dx < bestDx.d)) bestDx = { d: dx, x: c.x };
    const dy = Math.abs(c.y - pos.y);
    if (dy <= ALIGN_TOL && (!bestDy || dy < bestDy.d)) bestDy = { d: dy, y: c.y };
  }
  const guides: { x?: number; y?: number }[] = [];
  const out = { ...pos };
  if (bestDx) { out.x = bestDx.x; guides.push({ x: bestDx.x }); }
  if (bestDy) { out.y = bestDy.y; guides.push({ y: bestDy.y }); }
  return { pos: out, guides };
}

// Resolve the world-space point an attachment refers to
function resolveAttach(s: CircuitState, a: WireAttachment): Point | null {
  if (a.kind === 'component') {
    const c = s.components.find(c => c.id === a.componentId);
    if (!c) return null;
    return getTerminal(c, a.terminal);
  } else {
    const w = s.wires.find(w => w.id === a.wireId);
    if (!w || a.nodeIndex >= w.nodes.length) return null;
    return w.nodes[a.nodeIndex];
  }
}

// Reconcile wire endpoints with their attached components/wires.
// Iterate to a fixed point so wire→wire chains propagate.
function syncWires(s: CircuitState): CircuitState {
  let cur = s;
  for (let iter = 0; iter < 4; iter++) {
    let changed = false;
    const wires = cur.wires.map(w => {
      const newNodes = [...w.nodes];
      if (w.startAttach) {
        const p = resolveAttach(cur, w.startAttach);
        if (p && (newNodes[0]?.x !== p.x || newNodes[0]?.y !== p.y)) {
          const end = newNodes[newNodes.length - 1];
          const orient = inferOrientation(newNodes);
          const route = orthogonalRoute(p, end, orient);
          newNodes.splice(0, newNodes.length, ...route);
          changed = true;
        }
      }
      if (w.endAttach) {
        const p = resolveAttach(cur, w.endAttach);
        const li = newNodes.length - 1;
        if (p && (newNodes[li]?.x !== p.x || newNodes[li]?.y !== p.y)) {
          const start = newNodes[0];
          const orient = inferOrientation(newNodes);
          const route = orthogonalRoute(start, p, orient);
          newNodes.splice(0, newNodes.length, ...route);
          changed = true;
        }
      }
      return changed ? { ...w, nodes: newNodes } : w;
    });
    if (!changed) break;
    cur = { ...cur, wires };
  }
  return cur;
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
  // Wire drawing: single start point, then click to finalize end point
  const [wireStart, setWireStart] = useState<{ point: Point; attach?: WireAttachment } | null>(null);
  // L-shape orientation while previewing. Auto-detected from first mouse move,
  // user can flip with spacebar.
  const [wireOrient, setWireOrient] = useState<LRouteOrientation>('HV');
  const [wireOrientLocked, setWireOrientLocked] = useState(false);
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [hoverSnap, setHoverSnap] = useState<Point | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editPos, setEditPos] = useState<Point>({ x: 0, y: 0 });
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [alignGuides, setAlignGuides] = useState<{ x?: number; y?: number }[]>([]);

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
      setWireStart(null);
    }
  }, [histIdx, history]);

  const redo = useCallback(() => {
    if (histIdx < history.length - 1) {
      setHistIdx(i => i + 1);
      setState(history[histIdx + 1]);
      setSelection(null);
      setWireStart(null);
    }
  }, [histIdx, history]);

  const reset = useCallback(() => {
    if (window.confirm('Clear the entire canvas?')) {
      commit(EMPTY);
      setSelection(null);
      setWireStart(null);
    }
  }, [commit]);

  const canvasCoords = useCallback((clientX: number, clientY: number): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: clientX - r.left - pan.x, y: clientY - r.top - pan.y };
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

    if (tool === 'wire' && wireStart) {
      const endPoint = hoverSnap ?? snapPoint(mousePos);
      drawPreviewWire(ctx, wireStart.point, endPoint, wireOrient);
    }
    if (hoverSnap && (tool === 'wire' || (dragging && selection?.kind === 'wire'))) {
      drawSnapHint(ctx, hoverSnap);
    }
    if (alignGuides.length > 0) {
      const cw = canvasRef.current!.clientWidth;
      const ch = canvasRef.current!.clientHeight;
      drawAlignmentGuides(ctx, alignGuides, cw, ch, pan.x, pan.y);
    }

    ctx.restore();
  }, [state, selection, tool, wireStart, mousePos, hoverSnap, pan, editingLabel, dragging, wireOrient, alignGuides]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      setMousePos(p => ({ ...p }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        setWireStart(null);
        setWireOrientLocked(false);
        setSelection(null);
      }
      if (e.key === ' ' && tool === 'wire' && wireStart) {
        e.preventDefault();
        setWireOrient(o => (o === 'HV' ? 'VH' : 'HV'));
        setWireOrientLocked(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selection, editingLabel, undo, redo, tool, wireStart]);

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    const next = { ...state };
    if (selection.kind === 'component') {
      next.components = state.components.filter(c => c.id !== selection.id);
      // Detach wires that pointed at this component
      next.wires = state.wires.map(w => ({
        ...w,
        startAttach: w.startAttach?.kind === 'component' && w.startAttach.componentId === selection.id ? undefined : w.startAttach,
        endAttach: w.endAttach?.kind === 'component' && w.endAttach.componentId === selection.id ? undefined : w.endAttach,
      }));
    }
    if (selection.kind === 'wire') {
      next.wires = state.wires.filter(w => w.id !== selection.id);
      // Detach wires that pointed at this wire
      next.wires = next.wires.map(w => ({
        ...w,
        startAttach: w.startAttach?.kind === 'wire' && w.startAttach.wireId === selection.id ? undefined : w.startAttach,
        endAttach: w.endAttach?.kind === 'wire' && w.endAttach.wireId === selection.id ? undefined : w.endAttach,
      }));
    }
    if (selection.kind === 'label') next.labels = state.labels.filter(l => l.id !== selection.id);
    commit(next);
    setSelection(null);
  }, [selection, state, commit]);

  const rotateSelection = useCallback(() => {
    if (selection?.kind !== 'component') return;
    const next = syncWires({
      ...state,
      components: state.components.map(c =>
        c.id === selection.id ? { ...c, rotation: ((c.rotation + 90) % 360) as 0 | 90 | 180 | 270 } : c
      ),
    });
    commit(next);
  }, [selection, state, commit]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }
    if (e.button !== 0) return;

    const p = canvasCoords(e.clientX, e.clientY);
    const sp = snapPoint(p);
    const ctx = canvasRef.current!.getContext('2d')!;

    if (tool === 'wire') {
      // Snap to terminal or wire-node, otherwise free point on grid
      const target = findSnapTarget(state.components, state.wires, p, SNAP_TOL);
      const point = target ? target.point : sp;
      const attach = target?.attach;

      if (!wireStart) {
        setWireStart({ point, attach });
        setWireOrient('HV');
        setWireOrientLocked(false);
      } else {
        // Second click — finalize wire as L-shape using current orientation
        const route = orthogonalRoute(wireStart.point, point, wireOrient);
        const wire: Wire = {
          id: uid(),
          nodes: route,
          startAttach: wireStart.attach,
          endAttach: attach,
        };
        commit({ ...state, wires: [...state.wires, wire] });
        setWireStart(null);
        setWireOrientLocked(false);
      }
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
      for (const c of [...state.components].reverse()) {
        if (hitTestComponent(c, p)) {
          const next = {
            ...state,
            components: state.components.filter(x => x.id !== c.id),
            wires: state.wires.map(w => ({
              ...w,
              startAttach: w.startAttach?.kind === 'component' && w.startAttach.componentId === c.id ? undefined : w.startAttach,
              endAttach: w.endAttach?.kind === 'component' && w.endAttach.componentId === c.id ? undefined : w.endAttach,
            })),
          };
          commit(next);
          return;
        }
      }
      for (const w of [...state.wires].reverse()) {
        if (hitTestWire(w, p)) {
          const remaining = state.wires.filter(x => x.id !== w.id).map(x => ({
            ...x,
            startAttach: x.startAttach?.kind === 'wire' && x.startAttach.wireId === w.id ? undefined : x.startAttach,
            endAttach: x.endAttach?.kind === 'wire' && x.endAttach.wireId === w.id ? undefined : x.endAttach,
          }));
          commit({ ...state, wires: remaining });
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

    // Select tool (default) — also handles clicks while a component-tool is active
    // (component placement is now drag&drop only)
    for (const c of [...state.components].reverse()) {
      if (hitTestComponent(c, p)) {
        setSelection({ kind: 'component', id: c.id });
        setDragging(true);
        setDragOffset({ x: p.x - c.x, y: p.y - c.y });
        return;
      }
    }
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
    for (const l of [...state.labels].reverse()) {
      if (hitTestLabel(ctx, l, p)) {
        setSelection({ kind: 'label', id: l.id });
        setDragging(true);
        setDragOffset({ x: p.x - l.x, y: p.y - l.y });
        return;
      }
    }
    setSelection(null);
  }, [tool, state, canvasCoords, pan, commit, wireStart, wireOrient]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const p = canvasCoords(e.clientX, e.clientY);
    setMousePos(p);

    if (panning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    // Snap-hint highlighting in wire mode and when dragging a wire endpoint
    if (tool === 'wire') {
      const t = findSnapTarget(state.components, state.wires, p, SNAP_TOL);
      setHoverSnap(t ? t.point : null);
      // Auto-detect L orientation from cursor direction (until user locks via spacebar)
      if (wireStart && !wireOrientLocked) {
        const dx = Math.abs(p.x - wireStart.point.x);
        const dy = Math.abs(p.y - wireStart.point.y);
        if (dx > 4 || dy > 4) {
          // If cursor moves more horizontally first, do H then V; otherwise V then H
          setWireOrient(dx >= dy ? 'HV' : 'VH');
        }
      }
    } else if (dragging && selection?.kind === 'wire' && selection.node !== null) {
      const t = findSnapTarget(state.components, state.wires, p, SNAP_TOL, selection.id);
      setHoverSnap(t ? t.point : null);
    } else if (hoverSnap) {
      setHoverSnap(null);
    }

    if (!dragging || !selection) return;
    const sp = snapPoint(p);

    if (selection.kind === 'component') {
      setState(prev => syncWires({
        ...prev,
        components: prev.components.map(c =>
          c.id === selection.id ? { ...c, x: snap(p.x - dragOffset.x), y: snap(p.y - dragOffset.y) } : c
        ),
      }));
    } else if (selection.kind === 'wire' && selection.node !== null) {
      const target = findSnapTarget(state.components, state.wires, p, SNAP_TOL, selection.id);
      const newPos = target ? target.point : sp;
      setState(prev => ({
        ...prev,
        wires: prev.wires.map(w => {
          if (w.id !== selection.id) return w;
          const isStart = selection.node === 0;
          const isEnd = selection.node === w.nodes.length - 1;
          // For endpoints, re-route as L-shape against the opposite end, preserving orientation
          let nextNodes = w.nodes.map((n, i) => (i === selection.node ? newPos : n));
          const orient = inferOrientation(w.nodes);
          if (isStart && w.nodes.length >= 2) {
            nextNodes = orthogonalRoute(newPos, w.nodes[w.nodes.length - 1], orient);
          } else if (isEnd && w.nodes.length >= 2) {
            nextNodes = orthogonalRoute(w.nodes[0], newPos, orient);
          }
          let next: Wire = { ...w, nodes: nextNodes };
          if (isStart) next = { ...next, startAttach: target?.attach };
          if (isEnd) next = { ...next, endAttach: target?.attach };
          return next;
        }),
      }));
    } else if (selection.kind === 'label') {
      setState(prev => ({
        ...prev,
        labels: prev.labels.map(l =>
          l.id === selection.id ? { ...l, x: snap(p.x - dragOffset.x), y: snap(p.y - dragOffset.y) } : l
        ),
      }));
    }
  }, [dragging, selection, canvasCoords, dragOffset, panning, panStart, tool, state.components, state.wires, hoverSnap, wireStart, wireOrientLocked]);

  const handleMouseUp = useCallback(() => {
    if (panning) {
      setPanning(false);
      return;
    }
    if (dragging) {
      setDragging(false);
      commit(state);
    }
  }, [dragging, state, commit, panning]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const p = canvasCoords(e.clientX, e.clientY);
    const ctx = canvasRef.current!.getContext('2d')!;

    for (const l of state.labels) {
      if (hitTestLabel(ctx, l, p)) {
        setEditingLabel(l.id);
        setEditText(l.text);
        setEditPos({ x: l.x, y: l.y });
        return;
      }
    }

    if (selection?.kind === 'wire') {
      const wire = state.wires.find(w => w.id === selection.id);
      if (!wire) return;
      const sp = snapPoint(p);
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
  }, [canvasCoords, state, selection, commit]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (selection?.kind === 'component') {
      rotateSelection();
    }
  }, [selection, rotateSelection]);

  // ---- Drag & drop component placement ----
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-circuit-component')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    const type = e.dataTransfer.getData('application/x-circuit-component') as ComponentType;
    if (!type) return;
    e.preventDefault();
    const p = canvasCoords(e.clientX, e.clientY);
    const sp = snapPoint(p);
    const comp: CircuitComponent = { id: uid(), type, x: sp.x, y: sp.y, rotation: 0 };
    commit({ ...state, components: [...state.components, comp] });
    setTool('select');
    setSelection({ kind: 'component', id: comp.id });
  }, [canvasCoords, commit, state]);

  const finishLabelEdit = useCallback(() => {
    if (!editingLabel) return;
    commit({
      ...state,
      labels: state.labels.map(l => l.id === editingLabel ? { ...l, text: editText } : l),
    });
    setEditingLabel(null);
  }, [editingLabel, editText, state, commit]);

  const statusText = (() => {
    if (tool === 'wire' && wireStart) return `Klik eindpunt · Spatie = wissel L-richting (${wireOrient}) · Esc om af te breken`;
    if (tool === 'wire') return 'Klik startpunt → beweeg in gewenste richting → klik eindpunt (spatie wisselt L-vorm)';
    if (tool === 'select' && selection?.kind === 'component') return 'R / rechtermuisknop = roteren · Delete = verwijderen';
    if (tool === 'select' && selection?.kind === 'wire') return 'Sleep nodes om te verplaatsen · Dubbelklik wire om node toe te voegen';
    if (tool === 'select') return 'Sleep componenten uit de toolbar · Klik om te selecteren · Alt+drag = pan';
    if (tool === 'text') return 'Klik om label te plaatsen · Gebruik ₁₂₃ ₜ ᵥ Ω voor notatie';
    if (tool === 'delete') return 'Klik op een element om het te verwijderen';
    return '';
  })();

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: '#fff' }}>
      <Toolbar
        tool={tool}
        setTool={(t) => { setTool(t); setWireStart(null); setSelection(null); }}
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
        onDragOver={handleDragOver}
        onDrop={handleDrop}
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
              {['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉','ₜ','ᵥ'].map(s => (
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
        position: 'absolute', bottom: 8, left: 12, right: 12,
        fontSize: 11, color: '#888', fontFamily: 'monospace',
        pointerEvents: 'none', textAlign: 'center',
      }}>
        {statusText}
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
