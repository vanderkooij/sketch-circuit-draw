import type { CircuitComponent, Wire, TextLabel, Point, WireAttachment, LRouteOrientation } from './types';
import { GRID, orthogonalRoute } from './types';

export function clearCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
}

function drawVoltageSource(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.lineCap = 'round';

  // Plates closer together
  const gap = GRID * 0.18;
  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0);
  ctx.lineTo(-gap, 0);
  ctx.moveTo(gap, 0);
  ctx.lineTo(GRID * 2, 0);
  ctx.stroke();

  // Short plate (negative)
  ctx.beginPath();
  ctx.moveTo(-gap, -GRID * 0.4);
  ctx.lineTo(-gap, GRID * 0.4);
  ctx.stroke();

  // Long plate (positive)
  ctx.beginPath();
  ctx.moveTo(gap, -GRID * 0.7);
  ctx.lineTo(gap, GRID * 0.7);
  ctx.stroke();

  ctx.fillStyle = selected ? '#555' : '#000';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('+', gap + GRID * 0.3, -GRID * 0.85);
  ctx.fillText('−', -gap - GRID * 0.3, -GRID * 0.55);

  if (selected) drawSelectionBox(ctx, GRID * 2.2, GRID * 1.2);
  ctx.restore();
}

function drawACVoltageSource(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.lineCap = 'round';

  const r = GRID * 0.7;

  // Leads
  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0);
  ctx.lineTo(-r, 0);
  ctx.moveTo(r, 0);
  ctx.lineTo(GRID * 2, 0);
  ctx.stroke();

  // Circle
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  // Sine wave inside
  ctx.lineWidth = selected ? 2 : 1.3;
  ctx.beginPath();
  const w = r * 0.75;
  const amp = r * 0.4;
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const x = -w + (2 * w * i) / steps;
    const y = -Math.sin((i / steps) * Math.PI * 2) * amp;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  if (selected) drawSelectionBox(ctx, GRID * 2.2, GRID);
  ctx.restore();
}

function drawResistor(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0);
  ctx.lineTo(-GRID, 0);
  ctx.moveTo(GRID, 0);
  ctx.lineTo(GRID * 2, 0);
  ctx.stroke();

  ctx.strokeRect(-GRID, -GRID * 0.4, GRID * 2, GRID * 0.8);

  if (selected) drawSelectionBox(ctx, GRID * 2.2, GRID * 0.7);
  ctx.restore();
}

function drawLED(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.fillStyle = 'transparent';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0);
  ctx.lineTo(-GRID * 0.6, 0);
  ctx.moveTo(GRID * 0.6, 0);
  ctx.lineTo(GRID * 2, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-GRID * 0.6, -GRID * 0.6);
  ctx.lineTo(-GRID * 0.6, GRID * 0.6);
  ctx.lineTo(GRID * 0.6, 0);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(GRID * 0.6, -GRID * 0.6);
  ctx.lineTo(GRID * 0.6, GRID * 0.6);
  ctx.stroke();

  ctx.lineWidth = 1;
  const arrowStart = GRID * 0.3;
  for (const dy of [-GRID * 0.6, -GRID * 0.9]) {
    ctx.beginPath();
    ctx.moveTo(arrowStart, dy);
    ctx.lineTo(arrowStart + GRID * 0.5, dy - GRID * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(arrowStart + GRID * 0.5, dy - GRID * 0.3);
    ctx.lineTo(arrowStart + GRID * 0.3, dy - GRID * 0.2);
    ctx.moveTo(arrowStart + GRID * 0.5, dy - GRID * 0.3);
    ctx.lineTo(arrowStart + GRID * 0.4, dy - GRID * 0.1);
    ctx.stroke();
  }

  if (selected) drawSelectionBox(ctx, GRID * 2.2, GRID * 1.1);
  ctx.restore();
}

function drawMotor(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.lineCap = 'round';

  const r = GRID * 0.7;

  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0);
  ctx.lineTo(-r, 0);
  ctx.moveTo(r, 0);
  ctx.lineTo(GRID * 2, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = selected ? '#555' : '#000';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.rotate((-c.rotation * Math.PI) / 180);
  ctx.fillText('M', 0, 0);

  if (selected) {
    ctx.rotate((c.rotation * Math.PI) / 180);
    drawSelectionBox(ctx, GRID * 2.2, GRID);
  }
  ctx.restore();
}

function drawLamp(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.lineCap = 'round';

  const r = GRID * 0.7;

  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0);
  ctx.lineTo(-r, 0);
  ctx.moveTo(r, 0);
  ctx.lineTo(GRID * 2, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();

  const d = r * 0.55;
  ctx.beginPath();
  ctx.moveTo(-d, -d);
  ctx.lineTo(d, d);
  ctx.moveTo(d, -d);
  ctx.lineTo(-d, d);
  ctx.stroke();

  if (selected) drawSelectionBox(ctx, GRID * 2.2, GRID);
  ctx.restore();
}

function drawSelectionBox(ctx: CanvasRenderingContext2D, hw: number, hh: number) {
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(-hw, -hh, hw * 2, hh * 2);
  ctx.setLineDash([]);
}

export function drawComponent(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean) {
  switch (c.type) {
    case 'voltage': return drawVoltageSource(ctx, c, selected);
    case 'voltage_ac': return drawACVoltageSource(ctx, c, selected);
    case 'resistor': return drawResistor(ctx, c, selected);
    case 'led': return drawLED(ctx, c, selected);
    case 'motor': return drawMotor(ctx, c, selected);
    case 'lamp': return drawLamp(ctx, c, selected);
    case 'ammeter': return drawMeter(ctx, c, selected, 'A');
    case 'voltmeter': return drawMeter(ctx, c, selected, 'V');
    case 'capacitor': return drawCapacitor(ctx, c, selected);
    case 'inductor': return drawInductor(ctx, c, selected);
    case 'switch': return drawSwitch(ctx, c, selected);
    case 'diode': return drawDiode(ctx, c, selected);
    case 'ground': return drawGround(ctx, c, selected);
    case 'potentiometer': return drawPotentiometer(ctx, c, selected);
  }
}

function drawMeter(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean, letter: string) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.lineCap = 'round';
  const r = GRID * 0.7;
  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0); ctx.lineTo(-r, 0);
  ctx.moveTo(r, 0); ctx.lineTo(GRID * 2, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = selected ? '#555' : '#000';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.rotate((-c.rotation * Math.PI) / 180);
  ctx.fillText(letter, 0, 0);
  if (selected) { ctx.rotate((c.rotation * Math.PI) / 180); drawSelectionBox(ctx, GRID * 2.2, GRID); }
  ctx.restore();
}

function drawCapacitor(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.lineCap = 'round';
  const gap = GRID * 0.25;
  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0); ctx.lineTo(-gap, 0);
  ctx.moveTo(gap, 0); ctx.lineTo(GRID * 2, 0);
  ctx.moveTo(-gap, -GRID * 0.6); ctx.lineTo(-gap, GRID * 0.6);
  ctx.moveTo(gap, -GRID * 0.6); ctx.lineTo(gap, GRID * 0.6);
  ctx.stroke();
  if (selected) drawSelectionBox(ctx, GRID * 2.2, GRID * 0.8);
  ctx.restore();
}

function drawInductor(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.lineCap = 'round';
  const bumps = 4;
  const w = GRID * 2; // total bumps span -w/2..w/2 = GRID
  const r = GRID * 0.25;
  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0); ctx.lineTo(-bumps * r, 0);
  for (let i = 0; i < bumps; i++) {
    const cx = -bumps * r + r + i * 2 * r;
    ctx.arc(cx, 0, r, Math.PI, 0, false);
  }
  ctx.moveTo(bumps * r, 0); ctx.lineTo(GRID * 2, 0);
  ctx.stroke();
  void w;
  if (selected) drawSelectionBox(ctx, GRID * 2.2, GRID * 0.6);
  ctx.restore();
}

function drawSwitch(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.fillStyle = selected ? '#555' : '#000';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.lineCap = 'round';
  const a = GRID * 0.6; // hinge points
  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0); ctx.lineTo(-a, 0);
  ctx.moveTo(a, 0); ctx.lineTo(GRID * 2, 0);
  ctx.stroke();
  // Hinge dots
  ctx.beginPath(); ctx.arc(-a, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(a, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  // Lever
  ctx.beginPath();
  if (c.closed) {
    ctx.moveTo(-a, 0); ctx.lineTo(a, 0);
  } else {
    ctx.moveTo(-a, 0); ctx.lineTo(a - GRID * 0.2, -GRID * 0.7);
  }
  ctx.stroke();
  if (selected) drawSelectionBox(ctx, GRID * 2.2, GRID * 0.9);
  ctx.restore();
}

function drawDiode(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.fillStyle = 'transparent';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0); ctx.lineTo(-GRID * 0.6, 0);
  ctx.moveTo(GRID * 0.6, 0); ctx.lineTo(GRID * 2, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-GRID * 0.6, -GRID * 0.6);
  ctx.lineTo(-GRID * 0.6, GRID * 0.6);
  ctx.lineTo(GRID * 0.6, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(GRID * 0.6, -GRID * 0.6);
  ctx.lineTo(GRID * 0.6, GRID * 0.6);
  ctx.stroke();
  if (selected) drawSelectionBox(ctx, GRID * 2.2, GRID * 0.9);
  ctx.restore();
}

function drawGround(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.lineCap = 'round';
  // Connection lead from terminal 0 (left, at -GRID*2) toward symbol
  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0); ctx.lineTo(0, 0);
  // Three horizontal bars (drawn vertically from connection)
  ctx.moveTo(0, -GRID * 0.5); ctx.lineTo(0, GRID * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-GRID * 0.6, GRID * 0.1); ctx.lineTo(GRID * 0.6, GRID * 0.1);
  ctx.moveTo(-GRID * 0.4, GRID * 0.3); ctx.lineTo(GRID * 0.4, GRID * 0.3);
  ctx.moveTo(-GRID * 0.2, GRID * 0.5); ctx.lineTo(GRID * 0.2, GRID * 0.5);
  ctx.stroke();
  if (selected) drawSelectionBox(ctx, GRID * 2.2, GRID * 0.8);
  ctx.restore();
}

function drawPotentiometer(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.fillStyle = selected ? '#555' : '#000';
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.lineCap = 'round';
  // Resistor body
  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0); ctx.lineTo(-GRID, 0);
  ctx.moveTo(GRID, 0); ctx.lineTo(GRID * 2, 0);
  ctx.stroke();
  ctx.strokeRect(-GRID, -GRID * 0.4, GRID * 2, GRID * 0.8);
  // Wiper arrow from above
  ctx.beginPath();
  ctx.moveTo(0, -GRID * 1.1); ctx.lineTo(0, -GRID * 0.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -GRID * 0.4);
  ctx.lineTo(-4, -GRID * 0.7);
  ctx.lineTo(4, -GRID * 0.7);
  ctx.closePath();
  ctx.fill();
  if (selected) drawSelectionBox(ctx, GRID * 2.2, GRID * 1.3);
  ctx.restore();
}

export function drawWire(ctx: CanvasRenderingContext2D, w: Wire, selected: boolean, selectedNode: number | null) {
  if (w.nodes.length < 2) return;
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.lineWidth = selected ? 2 : 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(w.nodes[0].x, w.nodes[0].y);
  for (let i = 1; i < w.nodes.length; i++) {
    ctx.lineTo(w.nodes[i].x, w.nodes[i].y);
  }
  ctx.stroke();


  if (selected) {
    w.nodes.forEach((n, i) => {
      ctx.fillStyle = selectedNode === i ? '#000' : '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }
}

export function drawLabel(ctx: CanvasRenderingContext2D, l: TextLabel, selected: boolean) {
  ctx.font = '14px "SF Mono", "Fira Code", monospace';
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'middle';
  ctx.fillText(l.text || '(text)', l.x, l.y);

  if (selected) {
    const m = ctx.measureText(l.text || '(text)');
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(l.x - 2, l.y - 10, m.width + 4, 20);
    ctx.setLineDash([]);
  }
}

// Live preview: orthogonal L-shape from start to cursor
export function drawPreviewWire(ctx: CanvasRenderingContext2D, start: Point, cursor: Point, orientation: LRouteOrientation = 'HV') {
  const route = orthogonalRoute(start, cursor, orientation);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(route[0].x, route[0].y);
  for (let i = 1; i < route.length; i++) ctx.lineTo(route[i].x, route[i].y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Start marker
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(start.x, start.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

// Draw alignment guide lines (dashed) across the visible canvas
export function drawAlignmentGuides(
  ctx: CanvasRenderingContext2D,
  guides: { x?: number; y?: number }[],
  viewW: number,
  viewH: number,
  panX: number,
  panY: number,
) {
  ctx.save();
  ctx.strokeStyle = '#ff3b30';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([4, 4]);
  for (const g of guides) {
    ctx.beginPath();
    if (g.x !== undefined) {
      ctx.moveTo(g.x, -panY);
      ctx.lineTo(g.x, viewH - panY);
    }
    if (g.y !== undefined) {
      ctx.moveTo(-panX, g.y);
      ctx.lineTo(viewW - panX, g.y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

// Draw distance labels between aligned components, with bracket marks
export function drawDistanceLabels(
  ctx: CanvasRenderingContext2D,
  labels: { a: Point; b: Point; axis: 'x' | 'y'; px: number }[],
) {
  ctx.save();
  ctx.strokeStyle = '#ff3b30';
  ctx.fillStyle = '#ff3b30';
  ctx.lineWidth = 1;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tick = 4;
  for (const l of labels) {
    if (l.px <= 0) continue;
    if (l.axis === 'y') {
      // Vertical gap on shared X column → draw a small tick at each end and label to the right
      const x = l.a.x + 14;
      ctx.beginPath();
      ctx.moveTo(x - tick, l.a.y); ctx.lineTo(x + tick, l.a.y);
      ctx.moveTo(x - tick, l.b.y); ctx.lineTo(x + tick, l.b.y);
      ctx.moveTo(x, l.a.y); ctx.lineTo(x, l.b.y);
      ctx.stroke();
      // Label background
      const text = `${Math.round(l.px)}`;
      const m = ctx.measureText(text);
      const tx = x + 8 + m.width / 2;
      const ty = (l.a.y + l.b.y) / 2;
      ctx.fillStyle = '#fff';
      ctx.fillRect(tx - m.width / 2 - 2, ty - 7, m.width + 4, 14);
      ctx.fillStyle = '#ff3b30';
      ctx.fillText(text, tx, ty);
    } else {
      const y = l.a.y - 14;
      ctx.beginPath();
      ctx.moveTo(l.a.x, y - tick); ctx.lineTo(l.a.x, y + tick);
      ctx.moveTo(l.b.x, y - tick); ctx.lineTo(l.b.x, y + tick);
      ctx.moveTo(l.a.x, y); ctx.lineTo(l.b.x, y);
      ctx.stroke();
      const text = `${Math.round(l.px)}`;
      const m = ctx.measureText(text);
      const tx = (l.a.x + l.b.x) / 2;
      const ty = y - 10;
      ctx.fillStyle = '#fff';
      ctx.fillRect(tx - m.width / 2 - 2, ty - 7, m.width + 4, 14);
      ctx.fillStyle = '#ff3b30';
      ctx.fillText(text, tx, ty);
    }
  }
  ctx.restore();
}

// Highlight a snap target (terminal or wire-node) under the cursor
export function drawSnapHint(ctx: CanvasRenderingContext2D, p: Point) {
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
  ctx.stroke();
}

export function hitTestComponent(c: CircuitComponent, p: Point): boolean {
  const dx = GRID * 2.2;
  const dy = GRID * 1.2;
  const cos = Math.cos((-c.rotation * Math.PI) / 180);
  const sin = Math.sin((-c.rotation * Math.PI) / 180);
  const lx = (p.x - c.x) * cos - (p.y - c.y) * sin;
  const ly = (p.x - c.x) * sin + (p.y - c.y) * cos;
  return Math.abs(lx) <= dx && Math.abs(ly) <= dy;
}

export function getTerminal(c: CircuitComponent, terminal: 0 | 1): Point {
  const localX = terminal === 0 ? -GRID * 2 : GRID * 2;
  const cos = Math.cos((c.rotation * Math.PI) / 180);
  const sin = Math.sin((c.rotation * Math.PI) / 180);
  return { x: c.x + localX * cos, y: c.y + localX * sin };
}

export function findTerminalNear(
  components: CircuitComponent[],
  p: Point,
  tolerance: number,
): { componentId: string; terminal: 0 | 1; point: Point } | null {
  let best: { componentId: string; terminal: 0 | 1; point: Point; d: number } | null = null;
  for (const c of components) {
    for (const t of [0, 1] as const) {
      const tp = getTerminal(c, t);
      const d = Math.hypot(tp.x - p.x, tp.y - p.y);
      if (d <= tolerance && (!best || d < best.d)) {
        best = { componentId: c.id, terminal: t, point: tp, d };
      }
    }
  }
  return best ? { componentId: best.componentId, terminal: best.terminal, point: best.point } : null;
}

// Find a wire-node (any node) near point p, excluding a specific wire id (so we don't snap to ourselves)
export function findWireNodeNear(
  wires: Wire[],
  p: Point,
  tolerance: number,
  excludeWireId?: string,
): { wireId: string; nodeIndex: number; point: Point } | null {
  let best: { wireId: string; nodeIndex: number; point: Point; d: number } | null = null;
  for (const w of wires) {
    if (w.id === excludeWireId) continue;
    for (let i = 0; i < w.nodes.length; i++) {
      const n = w.nodes[i];
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d <= tolerance && (!best || d < best.d)) {
        best = { wireId: w.id, nodeIndex: i, point: n, d };
      }
    }
  }
  return best ? { wireId: best.wireId, nodeIndex: best.nodeIndex, point: best.point } : null;
}

// Combined snap target lookup
export function findSnapTarget(
  components: CircuitComponent[],
  wires: Wire[],
  p: Point,
  tolerance: number,
  excludeWireId?: string,
): { attach: WireAttachment; point: Point } | null {
  const term = findTerminalNear(components, p, tolerance);
  if (term) {
    return { attach: { kind: 'component', componentId: term.componentId, terminal: term.terminal }, point: term.point };
  }
  const wn = findWireNodeNear(wires, p, tolerance, excludeWireId);
  if (wn) {
    return { attach: { kind: 'wire', wireId: wn.wireId, nodeIndex: wn.nodeIndex }, point: wn.point };
  }
  return null;
}

export function hitTestWire(w: Wire, p: Point): boolean {
  for (let i = 0; i < w.nodes.length - 1; i++) {
    if (distToSegment(p, w.nodes[i], w.nodes[i + 1]) < 8) return true;
  }
  return false;
}

export function hitTestWireNode(w: Wire, p: Point): number | null {
  for (let i = 0; i < w.nodes.length; i++) {
    const dx = w.nodes[i].x - p.x;
    const dy = w.nodes[i].y - p.y;
    if (Math.sqrt(dx * dx + dy * dy) < 10) return i;
  }
  return null;
}

export function hitTestLabel(ctx: CanvasRenderingContext2D, l: TextLabel, p: Point): boolean {
  ctx.font = '14px "SF Mono", "Fira Code", monospace';
  const m = ctx.measureText(l.text || '(text)');
  return p.x >= l.x - 2 && p.x <= l.x + m.width + 2 && p.y >= l.y - 10 && p.y <= l.y + 10;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.sqrt((p.x - px) ** 2 + (p.y - py) ** 2);
}
