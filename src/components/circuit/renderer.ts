import type { CircuitComponent, Wire, TextLabel, Point } from './types';
import { GRID } from './types';

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

  // Connection lines
  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0);
  ctx.lineTo(-GRID * 0.5, 0);
  ctx.moveTo(GRID * 0.5, 0);
  ctx.lineTo(GRID * 2, 0);
  ctx.stroke();

  // Short line (negative)
  ctx.beginPath();
  ctx.moveTo(-GRID * 0.5, -GRID * 0.4);
  ctx.lineTo(-GRID * 0.5, GRID * 0.4);
  ctx.stroke();

  // Long line (positive)
  ctx.beginPath();
  ctx.moveTo(GRID * 0.5, -GRID * 0.7);
  ctx.lineTo(GRID * 0.5, GRID * 0.7);
  ctx.stroke();

  // + and - labels
  ctx.fillStyle = selected ? '#555' : '#000';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('+', GRID * 0.5, -GRID * 0.8);
  ctx.fillText('−', -GRID * 0.5, -GRID * 0.5);

  if (selected) {
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(-GRID * 2.2, -GRID * 1.2, GRID * 4.4, GRID * 2.4);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawVariableVoltageSource(ctx: CanvasRenderingContext2D, c: CircuitComponent, selected: boolean) {
  // Draw base voltage source first
  drawVoltageSource(ctx, c, selected);

  // Add diagonal arrow for "variable"
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate((c.rotation * Math.PI) / 180);
  ctx.strokeStyle = selected ? '#555' : '#000';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(-GRID * 1.2, GRID * 0.8);
  ctx.lineTo(GRID * 1.2, -GRID * 0.8);
  ctx.stroke();

  // Arrowhead
  const ax = GRID * 1.2, ay = -GRID * 0.8;
  const angle = Math.atan2(-GRID * 0.8 - GRID * 0.8, GRID * 1.2 - (-GRID * 1.2));
  const hl = 5;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - hl * Math.cos(angle - 0.4), ay - hl * Math.sin(angle - 0.4));
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - hl * Math.cos(angle + 0.4), ay - hl * Math.sin(angle + 0.4));
  ctx.stroke();

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

  // Connection lines
  ctx.beginPath();
  ctx.moveTo(-GRID * 2, 0);
  ctx.lineTo(-GRID * 0.6, 0);
  ctx.moveTo(GRID * 0.6, 0);
  ctx.lineTo(GRID * 2, 0);
  ctx.stroke();

  // Triangle (diode)
  ctx.beginPath();
  ctx.moveTo(-GRID * 0.6, -GRID * 0.6);
  ctx.lineTo(-GRID * 0.6, GRID * 0.6);
  ctx.lineTo(GRID * 0.6, 0);
  ctx.closePath();
  ctx.stroke();

  // Cathode line
  ctx.beginPath();
  ctx.moveTo(GRID * 0.6, -GRID * 0.6);
  ctx.lineTo(GRID * 0.6, GRID * 0.6);
  ctx.stroke();

  // Light arrows
  ctx.lineWidth = 1;
  const arrowStart = GRID * 0.3;
  for (const dy of [-GRID * 0.6, -GRID * 0.9]) {
    ctx.beginPath();
    ctx.moveTo(arrowStart, dy);
    ctx.lineTo(arrowStart + GRID * 0.5, dy - GRID * 0.3);
    ctx.stroke();
    // Small arrowhead
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

  // Connection lines
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

  // M label
  ctx.fillStyle = selected ? '#555' : '#000';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Counter-rotate text so it stays readable
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

  // Connection lines
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

  // X inside (cross)
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
    case 'voltage_var': return drawVariableVoltageSource(ctx, c, selected);
    case 'resistor': return drawResistor(ctx, c, selected);
    case 'led': return drawLED(ctx, c, selected);
    case 'motor': return drawMotor(ctx, c, selected);
    case 'lamp': return drawLamp(ctx, c, selected);
  }
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

export function drawPreviewWire(ctx: CanvasRenderingContext2D, nodes: Point[], cursor: Point) {
  if (nodes.length === 0) return;
  const last = nodes[nodes.length - 1];
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(cursor.x, last.y);
  ctx.lineTo(cursor.x, cursor.y);
  ctx.stroke();
  ctx.setLineDash([]);

  if (nodes.length >= 2) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 1; i < nodes.length; i++) {
      ctx.lineTo(nodes[i].x, nodes[i].y);
    }
    ctx.stroke();
  }
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

// Returns world-space coordinates of the two terminals (left=0, right=1) of a component
export function getTerminal(c: CircuitComponent, terminal: 0 | 1): Point {
  const localX = terminal === 0 ? -GRID * 2 : GRID * 2;
  const cos = Math.cos((c.rotation * Math.PI) / 180);
  const sin = Math.sin((c.rotation * Math.PI) / 180);
  return { x: c.x + localX * cos, y: c.y + localX * sin };
}

// Find the nearest component terminal within tolerance of point p
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
