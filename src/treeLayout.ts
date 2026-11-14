import {
  FamilyMember,
  PositionedNode,
  SpouseEdge,
  ParentChildEdge,
  TreeLayoutResult,
} from './types';

export const NODE_WIDTH = 156;
export const NODE_HEIGHT = 96;
export const SPOUSE_GAP = 34;
export const SIBLING_GAP = 42;
export const GENERATION_GAP = 148;
export const CANVAS_PADDING = 100;
export const GRID_SIZE = 20;

export function recomputeEdgesFromPositions(
  members: FamilyMember[],
  positionMap: Record<string, { x: number; y: number }>,
  generationMap: Record<string, number>,
  canvasWidth: number,
  canvasHeight: number
): TreeLayoutResult {
  const byId = new Map<string, FamilyMember>();
  members.forEach((m) => byId.set(m.id, m));

  const nodes: PositionedNode[] = members.map((member) => {
    const pos = positionMap[member.id] || { x: CANVAS_PADDING, y: CANVAS_PADDING };
    return {
      member,
      generation: generationMap[member.id] ?? 0,
      x: pos.x,
      y: pos.y,
    };
  });

  const spouseEdges: SpouseEdge[] = [];
  const seenSpousePairs = new Set<string>();

  for (const m of members) {
    for (const sid of m.spouseIds) {
      if (!byId.has(sid)) continue;
      const pairKey = [m.id, sid].sort().join('--');
      if (seenSpousePairs.has(pairKey)) continue;
      seenSpousePairs.add(pairKey);

      const mPos = positionMap[m.id];
      const sPos = positionMap[sid];
      if (!mPos || !sPos) continue;

      const leftX = Math.min(mPos.x, sPos.x) + NODE_WIDTH;
      const rightX = Math.max(mPos.x, sPos.x);
      const centerY = (mPos.y + sPos.y) / 2 + NODE_HEIGHT / 2;

      spouseEdges.push({
        id: `spouse-${pairKey}`,
        fromId: m.id,
        toId: sid,
        x1: leftX,
        y1: centerY,
        x2: rightX,
        y2: centerY,
      });
    }
  }

  const parentChildEdges: ParentChildEdge[] = [];

  for (const child of members) {
    const validParents = child.parentIds.filter((pid) => byId.has(pid));
    if (validParents.length === 0) continue;

    const cPos = positionMap[child.id];
    if (!cPos) continue;

    const childCenterX = cPos.x + NODE_WIDTH / 2;
    const childTopY = cPos.y;

    if (validParents.length === 2) {
      const p1 = validParents[0];
      const p2 = validParents[1];
      const p1Pos = positionMap[p1];
      const p2Pos = positionMap[p2];

      if (p1Pos && p2Pos) {
        const areSpousesOnSameRow =
          Math.abs(p1Pos.y - p2Pos.y) < 15 &&
          (byId.get(p1)?.spouseIds.includes(p2) || byId.get(p2)?.spouseIds.includes(p1));

        if (areSpousesOnSameRow) {
          const startX = (Math.min(p1Pos.x, p2Pos.x) + NODE_WIDTH + Math.max(p1Pos.x, p2Pos.x)) / 2;
          const startY = p1Pos.y + NODE_HEIGHT / 2;
          const midY = Math.max(p1Pos.y, p2Pos.y) + NODE_HEIGHT + (GENERATION_GAP - NODE_HEIGHT) * 0.45;
          parentChildEdges.push({
            id: `pc-${p1}-${p2}-to-${child.id}`,
            startX,
            startY,
            endX: childCenterX,
            endY: childTopY,
            midY,
          });
          continue;
        }
      }
    }

    for (const pid of validParents) {
      const pPos = positionMap[pid];
      if (!pPos) continue;
      const px = pPos.x + NODE_WIDTH / 2;
      const py = pPos.y + NODE_HEIGHT;
      const midY = py + (childTopY - py) * 0.5;
      parentChildEdges.push({
        id: `pc-${pid}-to-${child.id}`,
        startX: px,
        startY: py,
        endX: childCenterX,
        endY: childTopY,
        midY,
      });
    }
  }

  return {
    nodes,
    spouseEdges,
    parentChildEdges,
    width: canvasWidth,
    height: canvasHeight,
    generationMap,
  };
}

export function computeTreeLayout(members: FamilyMember[]): TreeLayoutResult {
  if (members.length === 0) {
    return {
      nodes: [],
      spouseEdges: [],
      parentChildEdges: [],
      width: 800,
      height: 600,
      generationMap: {},
    };
  }

  const byId = new Map<string, FamilyMember>();
  members.forEach((m) => byId.set(m.id, m));

  // 1. Compute relative generation levels
  // Start everyone at 0, then iteratively enforce:
  // - child.gen >= parent.gen + 1
  // - spouse.gen == partner.gen
  const gen: Record<string, number> = {};
  members.forEach((m) => {
    gen[m.id] = 0;
  });

  const maxIterations = members.length * 4;
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    for (const m of members) {
      for (const pid of m.parentIds) {
        if (byId.has(pid)) {
          if (gen[m.id] < gen[pid] + 1) {
            gen[m.id] = gen[pid] + 1;
            changed = true;
          } else if (gen[pid] > gen[m.id] - 1) {
            gen[pid] = gen[m.id] - 1;
            changed = true;
          }
        }
      }
    }

    // Align spouses to the same generation (prefer the one with parents or higher depth)
    for (const m of members) {
      for (const sid of m.spouseIds) {
        if (byId.has(sid) && gen[m.id] !== gen[sid]) {
          const targetGen = Math.max(gen[m.id], gen[sid]);
          gen[m.id] = targetGen;
          gen[sid] = targetGen;
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  // Normalize so minimum generation is 0
  const minGen = Math.min(...Object.values(gen));
  for (const id of Object.keys(gen)) {
    gen[id] -= minGen;
  }

  // 2. Group members by generation
  const levels = new Map<number, FamilyMember[]>();
  for (const m of members) {
    const g = gen[m.id];
    if (!levels.has(g)) levels.set(g, []);
    levels.get(g)!.push(m);
  }

  const sortedGenKeys = Array.from(levels.keys()).sort((a, b) => a - b);

  // Track X positions so children can be sorted by their parents' X positions
  const xPos = new Map<string, number>();
  const yPos = new Map<string, number>();

  // First pass: order each generation into adjacent spouse clusters
  const orderedUnitsByGen = new Map<number, FamilyMember[][]>();

  for (const g of sortedGenKeys) {
    const rowMembers = levels.get(g)!;

    // Sort rowMembers by average parent X (if parents already positioned in g-1), then birthYear
    rowMembers.sort((a, b) => {
      const aParentXs = a.parentIds
        .map((pid) => xPos.get(pid))
        .filter((v): v is number => v !== undefined);
      const bParentXs = b.parentIds
        .map((pid) => xPos.get(pid))
        .filter((v): v is number => v !== undefined);

      const aAvg =
        aParentXs.length > 0
          ? aParentXs.reduce((s, v) => s + v, 0) / aParentXs.length
          : Infinity;
      const bAvg =
        bParentXs.length > 0
          ? bParentXs.reduce((s, v) => s + v, 0) / bParentXs.length
          : Infinity;

      if (aAvg !== bAvg) return aAvg - bAvg;
      const ay = parseInt(a.birthYear || '9999', 10);
      const by = parseInt(b.birthYear || '9999', 10);
      return ay - by;
    });

    const visited = new Set<string>();
    const units: FamilyMember[][] = [];

    for (const m of rowMembers) {
      if (visited.has(m.id)) continue;
      visited.add(m.id);
      const unit: FamilyMember[] = [m];

      // Attach spouses in the same generation right next to `m`
      // UNLESS both spouses have different parent lineages already in the tree
      // (in that case, keeping them in their family branches prevents in-law branch crossing)
      for (const sid of m.spouseIds) {
        const spouse = byId.get(sid);
        if (spouse && gen[sid] === g && !visited.has(sid)) {
          const mHasParents = m.parentIds.some((pid) => byId.has(pid));
          const sHasParents = spouse.parentIds.some((pid) => byId.has(pid));
          if (!(mHasParents && sHasParents)) {
            visited.add(sid);
            unit.push(spouse);
          }
        }
      }
      units.push(unit);
    }

    orderedUnitsByGen.set(g, units);

    // Assign preliminary X coordinates to help sort the next generation
    let cursorX = 0;
    for (const unit of units) {
      for (let i = 0; i < unit.length; i++) {
        xPos.set(unit[i].id, cursorX);
        cursorX += NODE_WIDTH + (i < unit.length - 1 ? SPOUSE_GAP : SIBLING_GAP);
      }
    }
  }

  // Compute total width of each generation row and center all rows relative to widest row
  const rowWidths = new Map<number, number>();
  let maxRowWidth = 0;

  for (const g of sortedGenKeys) {
    const units = orderedUnitsByGen.get(g)!;
    let width = 0;
    units.forEach((unit, uIdx) => {
      width += unit.length * NODE_WIDTH + Math.max(0, unit.length - 1) * SPOUSE_GAP;
      if (uIdx < units.length - 1) width += SIBLING_GAP;
    });
    rowWidths.set(g, width);
    if (width > maxRowWidth) maxRowWidth = width;
  }

  const canvasWidth = Math.max(850, maxRowWidth + CANVAS_PADDING * 2);
  const canvasHeight = Math.max(
    620,
    sortedGenKeys.length * GENERATION_GAP + CANVAS_PADDING * 2
  );

  // Finalize initial centered row positions
  for (let gIdx = 0; gIdx < sortedGenKeys.length; gIdx++) {
    const g = sortedGenKeys[gIdx];
    const units = orderedUnitsByGen.get(g)!;
    const rowWidth = rowWidths.get(g)!;
    let currentX = (canvasWidth - rowWidth) / 2;
    const currentY = CANVAS_PADDING + gIdx * GENERATION_GAP;

    for (let uIdx = 0; uIdx < units.length; uIdx++) {
      const unit = units[uIdx];
      for (let i = 0; i < unit.length; i++) {
        xPos.set(unit[i].id, currentX);
        yPos.set(unit[i].id, currentY);
        currentX += NODE_WIDTH + (i < unit.length - 1 ? SPOUSE_GAP : 0);
      }
      if (uIdx < units.length - 1) {
        currentX += SIBLING_GAP;
      }
    }
  }

  // Bottom-up pass: gently align parent units above the center of their children where possible
  for (let gIdx = sortedGenKeys.length - 2; gIdx >= 0; gIdx--) {
    const g = sortedGenKeys[gIdx];
    const units = orderedUnitsByGen.get(g)!;

    // Calculate desired X shift for each unit based on children center
    const unitBounds: { unit: FamilyMember[]; left: number; width: number }[] = [];

    for (const unit of units) {
      const unitIds = new Set(unit.map((u) => u.id));
      const children = members.filter((m) =>
        m.parentIds.some((pid) => unitIds.has(pid))
      );

      const unitWidth =
        unit.length * NODE_WIDTH + Math.max(0, unit.length - 1) * SPOUSE_GAP;
      let desiredLeft = xPos.get(unit[0].id)!;

      if (children.length > 0) {
        const childCenters = children.map(
          (c) => xPos.get(c.id)! + NODE_WIDTH / 2
        );
        const avgChildCenter =
          childCenters.reduce((a, b) => a + b, 0) / childCenters.length;
        desiredLeft = avgChildCenter - unitWidth / 2;
      }

      unitBounds.push({ unit, left: desiredLeft, width: unitWidth });
    }

    // Resolve overlaps from left to right
    for (let i = 1; i < unitBounds.length; i++) {
      const prev = unitBounds[i - 1];
      const curr = unitBounds[i];
      const minLeft = prev.left + prev.width + SIBLING_GAP;
      if (curr.left < minLeft) {
        curr.left = minLeft;
      }
    }

    // Apply updated positions
    for (const b of unitBounds) {
      let cx = b.left;
      for (let i = 0; i < b.unit.length; i++) {
        xPos.set(b.unit[i].id, cx);
        cx += NODE_WIDTH + SPOUSE_GAP;
      }
    }
  }

  // Top-down pass: align child units directly under their parents' centers where possible
  for (let gIdx = 1; gIdx < sortedGenKeys.length; gIdx++) {
    const g = sortedGenKeys[gIdx];
    const units = orderedUnitsByGen.get(g)!;
    const unitBounds: { unit: FamilyMember[]; left: number; width: number }[] = [];

    for (const unit of units) {
      const unitWidth =
        unit.length * NODE_WIDTH + Math.max(0, unit.length - 1) * SPOUSE_GAP;
      let desiredLeft = xPos.get(unit[0].id)!;

      const parentXs: number[] = [];
      for (const m of unit) {
        for (const pid of m.parentIds) {
          const px = xPos.get(pid);
          if (px !== undefined) parentXs.push(px + NODE_WIDTH / 2);
        }
      }

      if (parentXs.length > 0) {
        const avgParentX = parentXs.reduce((a, b) => a + b, 0) / parentXs.length;
        desiredLeft = avgParentX - unitWidth / 2;
      }

      unitBounds.push({ unit, left: desiredLeft, width: unitWidth });
    }

    // Resolve overlaps from left to right
    for (let i = 1; i < unitBounds.length; i++) {
      const prev = unitBounds[i - 1];
      const curr = unitBounds[i];
      const minLeft = prev.left + prev.width + SIBLING_GAP;
      if (curr.left < minLeft) {
        curr.left = minLeft;
      }
    }

    for (const b of unitBounds) {
      let cx = b.left;
      for (let i = 0; i < b.unit.length; i++) {
        xPos.set(b.unit[i].id, cx);
        cx += NODE_WIDTH + SPOUSE_GAP;
      }
    }
  }

  // Normalize minX so all nodes sit comfortably inside CANVAS_PADDING
  let minX = Infinity;
  let maxX = -Infinity;
  for (const m of members) {
    const x = xPos.get(m.id) ?? CANVAS_PADDING;
    if (x < minX) minX = x;
    if (x + NODE_WIDTH > maxX) maxX = x + NODE_WIDTH;
  }

  const shiftX = isFinite(minX) ? CANVAS_PADDING - minX : 0;
  for (const m of members) {
    const curr = xPos.get(m.id) ?? CANVAS_PADDING;
    xPos.set(m.id, curr + shiftX);
  }

  const finalCanvasWidth = Math.max(
    850,
    isFinite(maxX) ? maxX + shiftX + CANVAS_PADDING : 850
  );

  // Build PositionedNodes
  const nodes: PositionedNode[] = members.map((member) => ({
    member,
    generation: gen[member.id],
    x: xPos.get(member.id) ?? CANVAS_PADDING,
    y: yPos.get(member.id) ?? CANVAS_PADDING,
  }));

  // 3. Build Spouse Edges
  const spouseEdges: SpouseEdge[] = [];
  const seenSpousePairs = new Set<string>();

  for (const m of members) {
    for (const sid of m.spouseIds) {
      if (!byId.has(sid)) continue;
      const pairKey = [m.id, sid].sort().join('--');
      if (seenSpousePairs.has(pairKey)) continue;
      seenSpousePairs.add(pairKey);

      const mx = xPos.get(m.id)!;
      const my = yPos.get(m.id)!;
      const sx = xPos.get(sid)!;
      const sy = yPos.get(sid)!;

      const leftX = Math.min(mx, sx) + NODE_WIDTH;
      const rightX = Math.max(mx, sx);
      const centerY = (my + sy) / 2 + NODE_HEIGHT / 2;

      spouseEdges.push({
        id: `spouse-${pairKey}`,
        fromId: m.id,
        toId: sid,
        x1: leftX,
        y1: centerY,
        x2: rightX,
        y2: centerY,
      });
    }
  }

  // 4. Build Parent-Child Edges
  const parentChildEdges: ParentChildEdge[] = [];

  for (const child of members) {
    const validParents = child.parentIds.filter((pid) => byId.has(pid));
    if (validParents.length === 0) continue;

    const childCenterX = xPos.get(child.id)! + NODE_WIDTH / 2;
    const childTopY = yPos.get(child.id)!;

    if (validParents.length === 2) {
      const p1 = validParents[0];
      const p2 = validParents[1];
      const p1x = xPos.get(p1)!;
      const p1y = yPos.get(p1)!;
      const p2x = xPos.get(p2)!;
      const p2y = yPos.get(p2)!;

      // If parents are spouses on the same row, drop the line from the midpoint between them
      const areSpousesOnSameRow =
        Math.abs(p1y - p2y) < 10 &&
        (byId.get(p1)?.spouseIds.includes(p2) || byId.get(p2)?.spouseIds.includes(p1));

      if (areSpousesOnSameRow) {
        const startX = (Math.min(p1x, p2x) + NODE_WIDTH + Math.max(p1x, p2x)) / 2;
        const startY = p1y + NODE_HEIGHT / 2;
        const midY = Math.max(p1y, p2y) + NODE_HEIGHT + (GENERATION_GAP - NODE_HEIGHT) * 0.45;
        parentChildEdges.push({
          id: `pc-${p1}-${p2}-to-${child.id}`,
          startX,
          startY,
          endX: childCenterX,
          endY: childTopY,
          midY,
        });
        continue;
      }
    }

    // Single parent or non-adjacent parents: draw line from each parent's bottom center
    for (const pid of validParents) {
      const px = xPos.get(pid)! + NODE_WIDTH / 2;
      const py = yPos.get(pid)! + NODE_HEIGHT;
      const midY = py + (childTopY - py) * 0.5;
      parentChildEdges.push({
        id: `pc-${pid}-to-${child.id}`,
        startX: px,
        startY: py,
        endX: childCenterX,
        endY: childTopY,
        midY,
      });
    }
  }

  return {
    nodes,
    spouseEdges,
    parentChildEdges,
    width: finalCanvasWidth,
    height: canvasHeight,
    generationMap: gen,
  };
}
