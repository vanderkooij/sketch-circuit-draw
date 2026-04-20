import { useRef, useState, useCallback, useEffect } from 'react';
import type { CircuitState, Tool, Point, CircuitComponent, Wire, TextLabel, WireAttachment, ComponentType, LRouteOrientation } from './types';
import { GRID, snap, snapPoint, uid, orthogonalRoute, inferOrientation } from './types';
import {
  clearCanvas, drawComponent, drawWire, drawLabel, drawPreviewWire, drawSnapHint,
  drawAlignmentGuides, drawDistanceLabels,
  hitTestComponent, hitTestWire, hitTestWireNode, hitTestLabel,
  getTerminal, findSnapTarget,
} from './renderer';
import { Toolbar } from './Toolbar';
import { t as tr, type Lang } from './i18n';

const EMPTY: CircuitState = { components: [], wires: [], labels: [] };

const SNAP_TOL = 12;
const ALIGN_TOL = 6;
const DISTRIBUTE_TOL = 8;

export interface AlignGuide { x?: number; y?: number }

export interface DistanceLabel {
  a: Point;
  b: Point;
  axis: 'x' | 'y';
  px: number;
}

// Snap a dragged position to align with other components' x/y axes,
// AND to equal-spacing positions when 2+ others share an axis.
function alignToOthers(
  pos: Point,
  others: CircuitComponent[],
): { pos: Point; guides: AlignGuide[]; distances: DistanceLabel[] } {
  let bestDx: { d: number; x: number } | null = null;
  let bestDy: { d: number; y: number } | null = null;
  for (const c of others) {
    const dx = Math.abs(c.x - pos.x);
    if (dx <= ALIGN_TOL && (!bestDx || dx < bestDx.d)) bestDx = { d: dx, x: c.x };
    const dy = Math.abs(c.y - pos.y);
    if (dy <= ALIGN_TOL && (!bestDy || dy < bestDy.d)) bestDy = { d: dy, y: c.y };
  }
  const out = { ...pos };
  const guides: AlignGuide[] = [];
  if (bestDx) { out.x = bestDx.x; guides.push({ x: bestDx.x }); }
  if (bestDy) { out.y = bestDy.y; guides.push({ y: bestDy.y }); }

  // Equal-spacing snap on Y when ≥2 others share X (vertical column)
  const sharedX = others.filter(c => c.x === out.x);
  if (sharedX.length >= 2) {
    const sorted = [...sharedX].sort((a, b) => a.y - b.y);
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].y - sorted[i].y;
      for (const cy of [sorted[i].y - gap, (sorted[i].y + sorted[i + 1].y) / 2, sorted[i + 1].y + gap]) {
        if (Math.abs(out.y - cy) <= DISTRIBUTE_TOL) { out.y = cy; break; }
      }
    }
  }
  const sharedY = others.filter(c => c.y === out.y);
  if (sharedY.length >= 2) {
    const sorted = [...sharedY].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].x - sorted[i].x;
      for (const cx of [sorted[i].x - gap, (sorted[i].x + sorted[i + 1].x) / 2, sorted[i + 1].x + gap]) {
        if (Math.abs(out.x - cx) <= DISTRIBUTE_TOL) { out.x = cx; break; }
      }
    }
  }

  // Distance labels for live preview when ≥1 other shares an axis with the
  // (snapped) position. Show all consecutive gaps in the column / row.
  const distances: DistanceLabel[] = [];
  const colX = others.filter(c => c.x === out.x);
  if (colX.length >= 1) {
    const all = [...colX.map(c => ({ x: c.x, y: c.y })), { x: out.x, y: out.y }]
      .sort((a, b) => a.y - b.y);
    for (let i = 0; i < all.length - 1; i++) {
      distances.push({ a: all[i], b: all[i + 1], axis: 'y', px: all[i + 1].y - all[i].y });
    }
  }
  const rowY = others.filter(c => c.y === out.y);
  if (rowY.length >= 1) {
    const all = [...rowY.map(c => ({ x: c.x, y: c.y })), { x: out.x, y: out.y }]
      .sort((a, b) => a.x - b.x);
    for (let i = 0; i < all.length - 1; i++) {
      distances.push({ a: all[i], b: all[i + 1], axis: 'x', px: all[i + 1].x - all[i].x });
    }
  }

  return { pos: out, guides, distances };
}

// Remove redundant nodes from a wire: collapse consecutive collinear nodes
// and drop exact duplicates. Endpoints are preserved.
function cleanupWireNodes(nodes: Point[]): Point[] {
  if (nodes.length <= 2) return nodes;
  const out: Point[] = [nodes[0]];
  for (let i = 1; i < nodes.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = nodes[i];
    const next = nodes[i + 1];
    if (cur.x === prev.x && cur.y === prev.y) continue;
    if (prev.x === cur.x && cur.x === next.x) continue;
    if (prev.y === cur.y && cur.y === next.y) continue;
    out.push(cur);
  }
  const last = nodes[nodes.length - 1];
  const tail = out[out.length - 1];
  if (last.x !== tail.x || last.y !== tail.y) out.push(last);
  return out;
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
  | { kind: 'wire'; id: string; node: number | null; segment?: number | null; segLeft?: number; segRight?: number }
  | { kind: 'label'; id: string }
  | null;

// Hit-test which segment of a wire is under p (returns segment index = index of starting node)
function hitTestWireSegment(w: Wire, p: Point): number | null {
  for (let i = 0; i < w.nodes.length - 1; i++) {
    const a = w.nodes[i], b = w.nodes[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx, py = a.y + t * dy;
    if (Math.hypot(p.x - px, p.y - py) < 8) return i;
  }
  return null;
}

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
  const [alignGuides, setAlignGuides] = useState<AlignGuide[]>([]);
  const [distLabels, setDistLabels] = useState<DistanceLabel[]>([]);
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    const saved = window.localStorage?.getItem('circuit.lang');
    return (saved === 'nl' || saved === 'en') ? saved : 'en';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage?.setItem('circuit.lang', lang);
  }, [lang]);

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
    if (window.confirm(tr(lang, 'btn.resetConfirm'))) {
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
    if (distLabels.length > 0) {
      drawDistanceLabels(ctx, distLabels);
    }

    ctx.restore();
  }, [state, selection, tool, wireStart, mousePos, hoverSnap, pan, editingLabel, dragging, wireOrient, alignGuides, distLabels]);

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
        setTool('select');
      }
      if (e.key === ' ' && tool === 'wire' && wireStart) {
        e.preventDefault();
        setWireOrient(o => (o === 'HV' ? 'VH' : 'HV'));
        setWireOrientLocked(true);
      }
      // W toggles between wire and select (the two most-used tools)
      if (e.key === 'w' || e.key === 'W') {
        if (tool === 'wire') {
          setTool('select');
        } else {
          setTool('wire');
          setWireStart(null);
          setSelection(null);
        }
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
        setSelection({ kind: 'wire', id: w.id, node: nodeIdx, segment: null });
        setDragging(true);
        setDragOffset({ x: 0, y: 0 });
        return;
      }
      const segIdx = hitTestWireSegment(w, p);
      if (segIdx !== null) {
        // Restructure the wire so the segment has 2 interior nodes that we can
        // freely move. Insert helper nodes at the start/end if they're attached
        // (those endpoints must stay anchored). After this, simply moving the
        // two segment nodes perpendicular grows/shrinks the neighbour segments.
        const isStartSeg = segIdx === 0;
        const isEndSeg = segIdx === w.nodes.length - 2;
        const a = w.nodes[segIdx], b = w.nodes[segIdx + 1];
        const newNodes = w.nodes.map(n => ({ ...n }));
        let leftIdx = segIdx;
        let rightIdx = segIdx + 1;
        if (isStartSeg && w.startAttach) {
          // Duplicate the anchor so leftIdx becomes a free copy at the same spot
          newNodes.splice(1, 0, { ...a });
          leftIdx = 1;
          rightIdx = 2;
        }
        if (isEndSeg && w.endAttach) {
          newNodes.splice(rightIdx, 0, { ...b });
          // right anchor stays at the (new) last position; leftIdx unchanged
        }
        commit({
          ...state,
          wires: state.wires.map(x => x.id === w.id ? { ...x, nodes: newNodes } : x),
        });
        setSelection({ kind: 'wire', id: w.id, node: null, segment: segIdx, segLeft: leftIdx, segRight: rightIdx } as Selection);
        setDragging(true);
        setDragOffset({ x: 0, y: 0 });
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
      const rawX = snap(p.x - dragOffset.x);
      const rawY = snap(p.y - dragOffset.y);
      const others = state.components.filter(c => c.id !== selection.id);
      const aligned = alignToOthers({ x: rawX, y: rawY }, others);
      setAlignGuides(aligned.guides);
      setDistLabels(aligned.distances);
      setState(prev => syncWires({
        ...prev,
        components: prev.components.map(c =>
          c.id === selection.id ? { ...c, x: aligned.pos.x, y: aligned.pos.y } : c
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
    } else if (selection.kind === 'wire' && selection.segLeft !== undefined && selection.segRight !== undefined) {
      // Move the two segment endpoints perpendicular to the segment.
      // Helper nodes were already inserted at mousedown if start/end were attached,
      // so segLeft / segRight always point to free, movable nodes.
      const li = selection.segLeft;
      const ri = selection.segRight;
      setState(prev => ({
        ...prev,
        wires: prev.wires.map(w => {
          if (w.id !== selection.id) return w;
          const a = w.nodes[li], b = w.nodes[ri];
          if (!a || !b) return w;
          const horizontal = a.y === b.y;
          const vertical = a.x === b.x;
          if (!horizontal && !vertical) return w;
          const nodes = w.nodes.map(n => ({ ...n }));
          if (horizontal) {
            const newY = snap(p.y);
            nodes[li] = { x: a.x, y: newY };
            nodes[ri] = { x: b.x, y: newY };
          } else {
            const newX = snap(p.x);
            nodes[li] = { x: newX, y: a.y };
            nodes[ri] = { x: newX, y: b.y };
          }
          return { ...w, nodes };
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
      setAlignGuides([]);
      setDistLabels([]);
      // After a wire-segment drag, simplify wires by removing collinear/duplicate nodes
      const cleaned: CircuitState = {
        ...state,
        wires: state.wires.map(w => ({ ...w, nodes: cleanupWireNodes(w.nodes) })),
      };
      commit(cleaned);
      // Clear segment indices on selection so the next click recomputes them
      if (selection?.kind === 'wire' && selection.segment !== undefined) {
        setSelection({ kind: 'wire', id: selection.id, node: null, segment: null });
      }
    }
  }, [dragging, state, commit, panning, selection]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const p = canvasCoords(e.clientX, e.clientY);
    const ctx = canvasRef.current!.getContext('2d')!;

    // Switches: toggle open/closed when double-clicked
    for (const c of state.components) {
      if (c.type === 'switch' && hitTestComponent(c, p)) {
        commit({
          ...state,
          components: state.components.map(x =>
            x.id === c.id ? { ...x, closed: !x.closed } : x
          ),
        });
        return;
      }
    }

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
      return;
    }

    // In select mode, double-clicking empty space creates a new text label
    if (tool === 'select') {
      // Make sure we didn't double-click an existing element
      for (const c of state.components) if (hitTestComponent(c, p)) return;
      for (const w of state.wires) if (hitTestWire(w, p)) return;
      const sp = snapPoint(p);
      const label: TextLabel = { id: uid(), x: sp.x, y: sp.y, text: '' };
      commit({ ...state, labels: [...state.labels, label] });
      setEditingLabel(label.id);
      setEditText('');
      setEditPos(sp);
    }
  }, [canvasCoords, state, selection, commit, tool]);

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
    const aligned = alignToOthers(sp, state.components);
    const comp: CircuitComponent = { id: uid(), type, x: aligned.pos.x, y: aligned.pos.y, rotation: 0 };
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
    if (tool === 'wire' && wireStart) return tr(lang, 'status.wire.placing', { orient: wireOrient });
    if (tool === 'wire') return tr(lang, 'status.wire.start');
    if (tool === 'select' && selection?.kind === 'component') return tr(lang, 'status.select.component');
    if (tool === 'select' && selection?.kind === 'wire') return tr(lang, 'status.select.wire');
    if (tool === 'select') return tr(lang, 'status.select.empty');
    if (tool === 'text') return tr(lang, 'status.text');
    if (tool === 'delete') return tr(lang, 'status.delete');
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
        lang={lang}
        setLang={setLang}
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
              {['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉','ₜₒₜ','ᵥ'].map(s => (
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
