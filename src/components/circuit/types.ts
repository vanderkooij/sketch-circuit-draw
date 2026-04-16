export const GRID = 20;

export type Tool = 'select' | 'voltage' | 'voltage_var' | 'resistor' | 'led' | 'motor' | 'lamp' | 'wire' | 'text' | 'delete';

export type ComponentType = 'voltage' | 'voltage_var' | 'resistor' | 'led' | 'motor' | 'lamp';

export interface Point {
  x: number;
  y: number;
}

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
}

export interface Wire {
  id: string;
  nodes: Point[];
}

export interface TextLabel {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface CircuitState {
  components: CircuitComponent[];
  wires: Wire[];
  labels: TextLabel[];
}

export function snap(v: number): number {
  return Math.round(v / GRID) * GRID;
}

export function snapPoint(p: Point): Point {
  return { x: snap(p.x), y: snap(p.y) };
}

let _id = 0;
export function uid(): string {
  return `el_${Date.now()}_${_id++}`;
}
