export type Gender = 'male' | 'female';

export interface FamilyMember {
  id: string;
  name: string;
  gender: Gender;
  birthYear?: string;
  deathYear?: string;
  avatar: string; // Emoji or image URL
  notes?: string;
  parentIds: string[]; // Up to 2 parent IDs
  spouseIds: string[]; // Spouse IDs
  position?: { x: number; y: number }; // User-dragged custom canvas position
}

export interface PositionedNode {
  member: FamilyMember;
  generation: number;
  x: number;
  y: number;
}

export interface SpouseEdge {
  id: string;
  fromId: string;
  toId: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ParentChildEdge {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  midY: number;
}

export interface TreeLayoutResult {
  nodes: PositionedNode[];
  spouseEdges: SpouseEdge[];
  parentChildEdges: ParentChildEdge[];
  width: number;
  height: number;
  generationMap: Record<string, number>;
}
