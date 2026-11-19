import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Image,
  LayoutChangeEvent,
  PixelRatio,
  Animated,
} from 'react-native';
import Svg, { Circle, Pattern, Rect, Defs } from 'react-native-svg';
import {
  FamilyMember,
  TreeLayoutResult,
  ParentChildEdge,
  SpouseEdge,
} from '../types';
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  GRID_SIZE,
  recomputeEdgesFromPositions,
} from '../treeLayout';

export const CANVAS_SIZE = 3000;
export const CANVAS_CENTER = CANVAS_SIZE / 2;

// Static accent theme mappings (zero allocation during render)
const ACCENTS = {
  light: {
    male: { border: '#3B82F6', bg: '#EFF6FF', badge: '#DBEAFE', text: '#1D4ED8' },
    female: { border: '#EC4899', bg: '#FDF2F8', badge: '#FCE7F3', text: '#BE185D' },
  },
  dark: {
    male: { border: '#60A5FA', bg: '#1E293B', badge: '#1E3A8A', text: '#93C5FD' },
    female: { border: '#F472B6', bg: '#2A1824', badge: '#831843', text: '#FBCFE8' },
  },
};

const isUrl = (str: string) =>
  Boolean(
    str &&
      (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:'))
  );

// Memoized Parent-Child Connector Layer (prevents thousands of subview re-renders during canvas pan/zoom)
interface ParentChildEdgesLayerProps {
  edges: ParentChildEdge[];
  edgeStrokeColor: string;
  isDarkMode: boolean;
}

const ParentChildEdgesLayer = React.memo<ParentChildEdgesLayerProps>(
  ({ edges, edgeStrokeColor, isDarkMode }) => {
    const dotBg = isDarkMode ? '#94A3B8' : '#64748B';
    return (
      <>
        {edges.map((edge) => {
          const v1Top = Math.min(edge.startY, edge.midY);
          const v1Height = Math.abs(edge.midY - edge.startY);
          const hLeft = Math.min(edge.startX, edge.endX);
          const hWidth = Math.abs(edge.endX - edge.startX);
          const v2Top = Math.min(edge.midY, edge.endY);
          const v2Height = Math.abs(edge.endY - edge.midY);

          return (
            <View key={edge.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
              {/* Vertical segment from parent to midY */}
              <View
                style={{
                  position: 'absolute',
                  left: edge.startX - 1.25,
                  top: v1Top,
                  width: 2.5,
                  height: v1Height + 1.25,
                  backgroundColor: edgeStrokeColor,
                  borderRadius: 1.25,
                }}
              />
              {/* Horizontal bar at midY */}
              <View
                style={{
                  position: 'absolute',
                  left: hLeft - 1.25,
                  top: edge.midY - 1.25,
                  width: hWidth + 2.5,
                  height: 2.5,
                  backgroundColor: edgeStrokeColor,
                  borderRadius: 1.25,
                }}
              />
              {/* Vertical segment from midY to child top */}
              <View
                style={{
                  position: 'absolute',
                  left: edge.endX - 1.25,
                  top: v2Top,
                  width: 2.5,
                  height: v2Height + 1.25,
                  backgroundColor: edgeStrokeColor,
                  borderRadius: 1.25,
                }}
              />
              {/* Child connector dot */}
              <View
                style={{
                  position: 'absolute',
                  left: edge.endX - 3.5,
                  top: edge.endY - 3.5,
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: dotBg,
                }}
              />
            </View>
          );
        })}
      </>
    );
  }
);

// Memoized Spouse Connector Layer with heart badge
interface SpouseEdgesLayerProps {
  edges: SpouseEdge[];
  isDarkMode: boolean;
}

const SpouseEdgesLayer = React.memo<SpouseEdgesLayerProps>(
  ({ edges, isDarkMode }) => {
    const heartBg = isDarkMode ? '#4C0519' : '#FFF1F2';
    return (
      <>
        {edges.map((edge) => {
          const midX = (edge.x1 + edge.x2) / 2;
          const midY = (edge.y1 + edge.y2) / 2;
          const sLeft = Math.min(edge.x1, edge.x2);
          const sWidth = Math.max(2, Math.abs(edge.x2 - edge.x1));

          return (
            <View key={edge.id} pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View
                style={{
                  position: 'absolute',
                  left: sLeft,
                  top: midY - 1.25,
                  width: sWidth,
                  height: 2.5,
                  backgroundColor: '#F43F5E',
                  borderRadius: 1.25,
                }}
              />
              <View
                style={[
                  styles.heartBadge,
                  {
                    left: midX - 9,
                    top: midY - 9,
                    backgroundColor: heartBg,
                  },
                ]}
              >
                <Text style={styles.heartText}>❤️</Text>
              </View>
            </View>
          );
        })}
      </>
    );
  }
);

// Memoized Member Card Component (0 card re-renders during canvas panning/zooming)
interface MemberCardProps {
  member: FamilyMember;
  generation: number;
  x: number;
  y: number;
  accent: { border: string; bg: string; badge: string; text: string };
  isSelected: boolean;
  isHighlighted: boolean;
  isDragging: boolean;
  isDarkMode: boolean;
  onSelectMember: (member: FamilyMember) => void;
  panHandlers: any;
}

const MemberCard = React.memo<MemberCardProps>(
  ({
    member,
    generation,
    x,
    y,
    accent,
    isSelected,
    isHighlighted,
    isDragging,
    isDarkMode,
    onSelectMember,
    panHandlers,
  }) => {
    const lifespan = member.birthYear
      ? `${member.birthYear}${member.deathYear ? ` – ${member.deathYear}` : ''}`
      : 'Years unknown';

    return (
      <View
        style={[
          styles.nodeCard,
          isDarkMode && styles.nodeCardDark,
          {
            left: x,
            top: y,
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
            borderColor: isSelected
              ? '#6366F1'
              : isHighlighted
              ? '#F59E0B'
              : accent.border,
            backgroundColor: isSelected
              ? isDarkMode
                ? '#312E81'
                : '#EEF2FF'
              : isDarkMode
              ? '#1E293B'
              : '#FFFFFF',
            borderWidth: isSelected || isHighlighted ? 2.5 : 1.5,
            zIndex: isDragging ? 100 : 1,
            transform: [{ scale: isDragging ? 1.04 : 1 }],
            shadowOpacity: isDragging ? 0.3 : 0.08,
            elevation: isDragging ? 9 : 3,
          },
        ]}
      >
        {/* Card Tap Area for Selection */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onSelectMember(member)}
          style={styles.cardTapArea}
        >
          <View style={styles.nodeHeader}>
            <View style={[styles.avatarCircle, { backgroundColor: accent.bg }]}>
              {isUrl(member.avatar) ? (
                <Image source={{ uri: member.avatar }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarEmoji}>{member.avatar || '🧑'}</Text>
              )}
            </View>
            <View style={[styles.genPill, { backgroundColor: accent.badge }]}>
              <Text style={[styles.genPillText, { color: accent.text }]}>
                Gen {generation + 1}
              </Text>
            </View>
          </View>

          <Text
            style={[styles.memberName, isDarkMode && styles.textLight]}
            numberOfLines={1}
          >
            {member.name}
          </Text>

          <View style={styles.bottomMetaRow}>
            <Text
              style={[styles.memberYears, isDarkMode && styles.textMutedDark]}
              numberOfLines={1}
            >
              {lifespan}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Dedicated 6-dot Drag Handle */}
        <View
          {...panHandlers}
          style={[
            styles.dragHandleBtn,
            isDarkMode && styles.dragHandleBtnDark,
            isDragging && styles.dragHandleBtnActive,
          ]}
        >
          <Text
            style={[
              styles.dragHandleIcon,
              isDarkMode && styles.textMutedDark,
              isDragging && { color: '#6366F1' },
            ]}
          >
            ⠿
          </Text>
        </View>
      </View>
    );
  }
);

interface TreeCanvasProps {
  layout: TreeLayoutResult;
  selectedId: string | null;
  highlightedIds: Set<string>;
  onSelectMember: (member: FamilyMember) => void;
  members: FamilyMember[];
  isDarkMode?: boolean;
  onUpdateMemberPosition?: (memberId: string, position: { x: number; y: number }) => void;
  onResetAllPositions?: () => void;
  onAutoArrange?: () => void;
}

interface GridBackdropProps {
  width: number;
  height: number;
  step: number;
  dotRadius: number;
  dotColor: string;
}

// Viewport-sized SVG dot grid (never exceeds screen size, preventing Android >100MB Bitmap OOM crash)
const GridBackdrop: React.FC<GridBackdropProps> = React.memo(
  ({ width, height, step, dotRadius, dotColor }) => {
    const safeW = Math.min(1000, Math.max(300, Math.ceil(width)));
    const safeH = Math.min(1200, Math.max(400, Math.ceil(height)));
    return (
      <Svg width={safeW} height={safeH}>
        <Defs>
          <Pattern
            id="grid-pattern"
            width={step}
            height={step}
            patternUnits="userSpaceOnUse"
          >
            <Circle cx={step / 2} cy={step / 2} r={dotRadius} fill={dotColor} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={safeW} height={safeH} fill="url(#grid-pattern)" />
      </Svg>
    );
  }
);

export const TreeCanvas: React.FC<TreeCanvasProps> = ({
  layout,
  selectedId,
  highlightedIds,
  onSelectMember,
  members,
  isDarkMode = false,
  onUpdateMemberPosition,
  onResetAllPositions,
  onAutoArrange,
}) => {
  const [scale, setScale] = useState(0.85);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  // Tap the zoom percentage to expand or collapse the floating controls.
  const [controlsExpanded, setControlsExpanded] = useState(false);

  // Subtle pulsing glow animation for clickable controls (collapsed zoom badge)
  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [glowAnim]);

  // User-dragged custom overrides per member ID
  const [customPositions, setCustomPositions] = useState<
    Record<string, { x: number; y: number }>
  >(() => {
    const initial: Record<string, { x: number; y: number }> = {};
    members.forEach((m) => {
      if (m.position) {
        initial[m.id] = m.position;
      }
    });
    return initial;
  });

  // Sync customPositions whenever members prop updates (e.g., initial storage load, import, reset)
  useEffect(() => {
    setCustomPositions((prev) => {
      let changed = false;
      const next = { ...prev };
      members.forEach((m) => {
        if (m.position && (!next[m.id] || next[m.id].x !== m.position.x || next[m.id].y !== m.position.y)) {
          next[m.id] = m.position;
          changed = true;
        } else if (!m.position && next[m.id]) {
          delete next[m.id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [members]);

  const customPositionsRef = useRef(customPositions);
  customPositionsRef.current = customPositions;

  const onUpdateMemberPositionRef = useRef(onUpdateMemberPosition);
  onUpdateMemberPositionRef.current = onUpdateMemberPosition;

  // Grid snap toggle state
  const [snapToGrid, setSnapToGrid] = useState(true);
  const snapToGridRef = useRef(snapToGrid);
  snapToGridRef.current = snapToGrid;

  // Track currently dragged card ID to lock canvas panning
  const [activeDraggingId, setActiveDraggingId] = useState<string | null>(null);
  const isDraggingCardRef = useRef(false);

  // Calculate base offset so initial tree layout is centered at (CANVAS_CENTER, CANVAS_CENTER)
  const layoutBaseOffset = useMemo(() => {
    if (layout.nodes.length === 0) return { x: CANVAS_CENTER, y: CANVAS_CENTER };
    const minX = Math.min(...layout.nodes.map((n) => n.x));
    const maxX = Math.max(...layout.nodes.map((n) => n.x + NODE_WIDTH));
    const minY = Math.min(...layout.nodes.map((n) => n.y));
    const maxY = Math.max(...layout.nodes.map((n) => n.y + NODE_HEIGHT));

    const treeW = maxX - minX;
    const treeH = maxY - minY;

    return {
      x: CANVAS_CENTER - treeW / 2 - minX,
      y: CANVAS_CENTER - treeH / 2 - minY,
    };
  }, [layout]);

  // Effective positions synchronously combine centered layout with any manual card drags
  const effectivePositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    layout.nodes.forEach((node) => {
      const override = customPositions[node.member.id];
      if (override) {
        map[node.member.id] = override;
      } else {
        map[node.member.id] = {
          x: Math.round((node.x + layoutBaseOffset.x) / GRID_SIZE) * GRID_SIZE,
          y: Math.round((node.y + layoutBaseOffset.y) / GRID_SIZE) * GRID_SIZE,
        };
      }
    });
    return map;
  }, [layout.nodes, layoutBaseOffset, customPositions]);

  const effectivePositionsRef = useRef(effectivePositions);
  effectivePositionsRef.current = effectivePositions;

  // Compute live layout with current effective positions
  const currentLayout = useMemo(() => {
    return recomputeEdgesFromPositions(
      members,
      effectivePositions,
      layout.generationMap,
      CANVAS_SIZE,
      CANVAS_SIZE
    );
  }, [members, effectivePositions, layout.generationMap]);

  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const containerRef = useRef<any>(null);
  const containerPagePosRef = useRef({ x: 0, y: 140 });

  const hasCenteredInitial = useRef(false);

  const centerTree = useCallback((target: number | 'fit') => {
    if (currentLayout.nodes.length === 0) return;
    const minX = Math.min(...currentLayout.nodes.map((n) => n.x));
    const maxX = Math.max(...currentLayout.nodes.map((n) => n.x + NODE_WIDTH));
    const minY = Math.min(...currentLayout.nodes.map((n) => n.y));
    const maxY = Math.max(...currentLayout.nodes.map((n) => n.y + NODE_HEIGHT));

    const targetScale = target === 'fit'
      ? Math.max(0.35, Math.min(
          0.85,
          (viewport.width - 32) / (maxX - minX),
          (viewport.height - 32) / (maxY - minY),
        ))
      : target;
    const treeCenterX = (minX + maxX) / 2;
    const treeCenterY = (minY + maxY) / 2;

    const newX = viewport.width / 2 - treeCenterX * targetScale;
    const newY = viewport.height / 2 - treeCenterY * targetScale;
    setScale(targetScale);
    setOffset({ x: newX, y: newY });
  }, [currentLayout.nodes, viewport.width, viewport.height]);

  useEffect(() => {
    if (!hasCenteredInitial.current && viewport.width > 0 && viewport.height > 0 && currentLayout.nodes.length > 0) {
      hasCenteredInitial.current = true;
      centerTree('fit');
    }
  }, [centerTree, viewport.width, viewport.height, currentLayout.nodes.length]);

  const handleAutoArrange = () => {
    // 1. Clear any custom manually-dragged positions so cards align with symmetrical auto-computed layout
    setCustomPositions({});
    // 2. Persist position clearing in parent storage
    if (onResetAllPositions) {
      onResetAllPositions();
    }
    if (onAutoArrange) {
      onAutoArrange();
    }
    // 3. Smoothly center the entire tree at default 85% scale with symmetrical balanced framing
    setTimeout(() => {
      centerTree(0.85);
    }, 50);
  };

  const resetCardPositions = () => {
    setCustomPositions({});
    if (onResetAllPositions) {
      onResetAllPositions();
    }
    setTimeout(() => centerTree(0.85), 0);
  };

  const focusNode = (memberId: string) => {
    const node = currentLayout.nodes.find((n) => n.member.id === memberId);
    if (!node) return;
    const nodeCenterX = node.x + NODE_WIDTH / 2;
    const nodeCenterY = node.y + NODE_HEIGHT / 2;
    const newX = viewport.width / 2 - nodeCenterX * scale;
    const newY = viewport.height / 2 - nodeCenterY * scale;
    setOffset({ x: newX, y: newY });
  };

  // Helper to calculate Euclidean distance between two touches
  const getTouchesDistance = (touches: readonly any[]) => {
    if (!touches || touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Helper to calculate midpoint of two touches in container-local coordinates
  const getTouchesCenter = (touches: readonly any[]) => {
    if (!touches || touches.length < 2) return { x: 0, y: 0 };
    const midPageX = (touches[0].pageX + touches[1].pageX) / 2;
    const midPageY = (touches[0].pageY + touches[1].pageY) / 2;
    return {
      x: midPageX - containerPagePosRef.current.x,
      y: midPageY - containerPagePosRef.current.y,
    };
  };

  // Canvas Pan & Focal-Centered Pinch-to-Zoom responder
  const panStartRef = useRef({ x: 0, y: 0 });
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const pinchStartOffsetRef = useRef({ x: 0, y: 0 });
  const pinchStartFocalRef = useRef({ x: 0, y: 0 });

  const canvasPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isDraggingCardRef.current) return false;
        return (
          Math.abs(gestureState.dx) > 3 ||
          Math.abs(gestureState.dy) > 3 ||
          gestureState.numberActiveTouches >= 2
        );
      },
      onPanResponderTerminationRequest: () => !isDraggingCardRef.current,
      onPanResponderGrant: (evt) => {
        if (isDraggingCardRef.current) return;
        containerRef.current?.measureInWindow((x: number, y: number) => {
          if (typeof x === 'number' && typeof y === 'number') {
            containerPagePosRef.current = { x, y };
          }
        });
        panStartRef.current = {
          x: offsetRef.current.x,
          y: offsetRef.current.y,
        };
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          pinchStartDistanceRef.current = getTouchesDistance(touches);
          pinchStartScaleRef.current = scaleRef.current;
          pinchStartOffsetRef.current = {
            x: offsetRef.current.x,
            y: offsetRef.current.y,
          };
          pinchStartFocalRef.current = getTouchesCenter(touches);
        } else {
          pinchStartDistanceRef.current = null;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (isDraggingCardRef.current) return;
        const touches = evt.nativeEvent.touches;
        // Two-finger focal-centered pinch to zoom + two-finger pan
        if (touches && touches.length >= 2) {
          const currentDist = getTouchesDistance(touches);
          const currentFocal = getTouchesCenter(touches);

          if (!pinchStartDistanceRef.current || pinchStartDistanceRef.current <= 0) {
            pinchStartDistanceRef.current = currentDist;
            pinchStartScaleRef.current = scaleRef.current;
            pinchStartOffsetRef.current = {
              x: offsetRef.current.x,
              y: offsetRef.current.y,
            };
            pinchStartFocalRef.current = currentFocal;
            return;
          }

          const factor = currentDist / pinchStartDistanceRef.current;
          const newScale = Math.min(
            2.0,
            Math.max(0.35, Number((pinchStartScaleRef.current * factor).toFixed(3)))
          );

          // Anchor the canvas point that was beneath pinchStartFocal so it stays under currentFocal
          const s0 = pinchStartScaleRef.current;
          const ox0 = pinchStartOffsetRef.current.x;
          const oy0 = pinchStartOffsetRef.current.y;
          const fx0 = pinchStartFocalRef.current.x;
          const fy0 = pinchStartFocalRef.current.y;

          const canvasPointX = (fx0 - ox0) / s0;
          const canvasPointY = (fy0 - oy0) / s0;

          const newOffsetX = currentFocal.x - canvasPointX * newScale;
          const newOffsetY = currentFocal.y - canvasPointY * newScale;

          setScale(newScale);
          setOffset({ x: newOffsetX, y: newOffsetY });
          return;
        }

        // Seamless transition from 2-finger pinch back to 1-finger pan without jumping
        if (pinchStartDistanceRef.current !== null) {
          pinchStartDistanceRef.current = null;
          panStartRef.current = {
            x: offsetRef.current.x - gestureState.dx,
            y: offsetRef.current.y - gestureState.dy,
          };
        }

        // Single-finger canvas pan
        if (gestureState.numberActiveTouches <= 1) {
          setOffset({
            x: panStartRef.current.x + gestureState.dx,
            y: panStartRef.current.y + gestureState.dy,
          });
        }
      },
      onPanResponderRelease: () => {
        pinchStartDistanceRef.current = null;
      },
      onPanResponderTerminate: () => {
        pinchStartDistanceRef.current = null;
      },
    })
  ).current;

  // Persistent dictionary of PanResponders attached strictly to the 6-dot drag icon (item 1)
  const handlePanRespondersRef = useRef<Record<string, any>>({});
  const handleDragStateRef = useRef<Record<string, { startPos: { x: number; y: number } }>>({});

  const getHandlePanResponder = (memberId: string) => {
    if (!handlePanRespondersRef.current[memberId]) {
      handleDragStateRef.current[memberId] = { startPos: { x: 0, y: 0 } };

      handlePanRespondersRef.current[memberId] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          isDraggingCardRef.current = true;
          const current = effectivePositionsRef.current[memberId] || {
            x: CANVAS_CENTER,
            y: CANVAS_CENTER,
          };
          handleDragStateRef.current[memberId] = {
            startPos: { x: current.x, y: current.y },
          };
          setActiveDraggingId(memberId);
        },
        onPanResponderMove: (_, gestureState) => {
          const currentScale = scaleRef.current;
          const start = handleDragStateRef.current[memberId].startPos;

          const rawX = start.x + gestureState.dx / currentScale;
          const rawY = start.y + gestureState.dy / currentScale;

          const finalX = snapToGridRef.current
            ? Math.round(rawX / GRID_SIZE) * GRID_SIZE
            : rawX;
          const finalY = snapToGridRef.current
            ? Math.round(rawY / GRID_SIZE) * GRID_SIZE
            : rawY;

          setCustomPositions((prev) => ({
            ...prev,
            [memberId]: {
              x: Math.max(0, Math.min(CANVAS_SIZE - NODE_WIDTH, finalX)),
              y: Math.max(0, Math.min(CANVAS_SIZE - NODE_HEIGHT, finalY)),
            },
          }));
        },
        onPanResponderRelease: () => {
          isDraggingCardRef.current = false;
          setActiveDraggingId(null);
          const pos = customPositionsRef.current[memberId];
          if (pos && onUpdateMemberPositionRef.current) {
            onUpdateMemberPositionRef.current(memberId, pos);
          }
        },
        onPanResponderTerminate: () => {
          isDraggingCardRef.current = false;
          setActiveDraggingId(null);
          const pos = customPositionsRef.current[memberId];
          if (pos && onUpdateMemberPositionRef.current) {
            onUpdateMemberPositionRef.current(memberId, pos);
          }
        },
      });
    }

    return handlePanRespondersRef.current[memberId];
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setViewport({ width, height });
    }
    containerRef.current?.measureInWindow((x: number, y: number) => {
      if (typeof x === 'number' && typeof y === 'number') {
        containerPagePosRef.current = { x, y };
      }
    });
  };

  const zoomAroundViewportCenter = (delta: number) => {
    const oldScale = scaleRef.current;
    const newScale = Math.min(2.0, Math.max(0.35, Number((oldScale + delta).toFixed(2))));
    if (newScale === oldScale) return;
    const vx = viewportRef.current.width / 2;
    const vy = viewportRef.current.height / 2;
    const cx = (vx - offsetRef.current.x) / oldScale;
    const cy = (vy - offsetRef.current.y) / oldScale;
    setScale(newScale);
    setOffset({
      x: vx - cx * newScale,
      y: vy - cy * newScale,
    });
  };

  const zoomIn = () => zoomAroundViewportCenter(0.15);
  const zoomOut = () => zoomAroundViewportCenter(-0.15);

  const gridDotColor = isDarkMode ? '#334155' : '#CBD5E1';
  const edgeStrokeColor = isDarkMode ? '#64748B' : '#94A3B8';

  // Compute pixel-aligned grid step for the viewport-sized dot pattern
  const density = PixelRatio.get() || 2;
  const rawStep = Math.max(7, GRID_SIZE * scale);
  const alignedStep = Math.max(4, Math.round(rawStep * density) / density);
  const dotRadius = Math.max(0.8, Math.min(2.2, Number((1.25 * scale).toFixed(2))));
  const gridModX = ((offset.x % alignedStep) - alignedStep) % alignedStep;
  const gridModY = ((offset.y % alignedStep) - alignedStep) % alignedStep;
  const gridWidth = viewport.width + alignedStep * 2;
  const gridHeight = viewport.height + alignedStep * 2;

  return (
    <View
      ref={containerRef}
      style={[styles.container, isDarkMode && styles.containerDark]}
      onLayout={handleLayout}
      {...canvasPanResponder.panHandlers}
    >
      {/* Viewport-sized repeating dot grid background (zero large bitmap allocation) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: gridWidth,
          height: gridHeight,
          transform: [{ translateX: gridModX }, { translateY: gridModY }],
        }}
      >
        <GridBackdrop
          width={gridWidth}
          height={gridHeight}
          step={alignedStep}
          dotRadius={dotRadius}
          dotColor={gridDotColor}
        />
      </View>

      {/* Transformed Canvas containing connectors and member cards */}
      <View
        style={[
          styles.canvas,
          {
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            transform: [
              { translateX: offset.x },
              { translateY: offset.y },
              { scale },
            ],
            transformOrigin: '0 0',
          },
        ]}
      >
        {/* Parent-Child Orthogonal Connector Lines (memoized native Views, 0 bitmap overhead) */}
        <ParentChildEdgesLayer
          edges={currentLayout.parentChildEdges}
          edgeStrokeColor={edgeStrokeColor}
          isDarkMode={isDarkMode}
        />

        {/* Spouse Connector Lines & Heart Badges (memoized) */}
        <SpouseEdgesLayer
          edges={currentLayout.spouseEdges}
          isDarkMode={isDarkMode}
        />

        {/* Member Cards (memoized, 0 card re-renders during canvas pan/zoom) */}
        {currentLayout.nodes.map((node) => {
          const accent = isDarkMode
            ? ACCENTS.dark[node.member.gender]
            : ACCENTS.light[node.member.gender];
          const isSelected = selectedId === node.member.id;
          const isHighlighted = highlightedIds.has(node.member.id);
          const isDragging = activeDraggingId === node.member.id;
          const handlePanResponder = getHandlePanResponder(node.member.id);

          return (
            <MemberCard
              key={node.member.id}
              member={node.member}
              generation={node.generation}
              x={node.x}
              y={node.y}
              accent={accent}
              isSelected={isSelected}
              isHighlighted={isHighlighted}
              isDragging={isDragging}
              isDarkMode={isDarkMode}
              onSelectMember={onSelectMember}
              panHandlers={handlePanResponder.panHandlers}
            />
          );
        })}
      </View>

      {!controlsExpanded ? (
        <Animated.View
          style={[
            styles.floatingControlsFrame,
            styles.collapsedZoomBadge,
            isDarkMode && styles.floatingControlsDark,
            {
              shadowOpacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.15, 0.55],
              }),
              shadowRadius: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [4, 10],
              }),
              borderColor: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: isDarkMode
                  ? ['#334155', '#818CF8']
                  : ['#CBD5E1', '#6366F1'],
              }),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.collapsedZoomButton}
            onPress={() => setControlsExpanded(true)}
            activeOpacity={0.85}
            accessibilityLabel="Expand zoom controls"
          >
            <Text style={[styles.zoomLabelCollapsed, isDarkMode && styles.textLight]}>
              {Math.round(scale * 100)}%
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <View style={[styles.floatingControlsFrame, styles.floatingControls, isDarkMode && styles.floatingControlsDark]}>
          <TouchableOpacity style={styles.controlBtn} onPress={zoomIn}>
            <Text style={[styles.controlBtnText, isDarkMode && styles.textLight]}>＋</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.zoomBadgeBtn, isDarkMode && styles.zoomBadgeBtnDark]}
            onPress={() => setControlsExpanded(false)}
            activeOpacity={0.8}
            accessibilityLabel="Collapse zoom controls"
          >
            <Text style={[styles.zoomLabel, isDarkMode && styles.textLight]}>
              {Math.round(scale * 100)}%
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={zoomOut}>
            <Text style={[styles.controlBtnText, isDarkMode && styles.textLight]}>－</Text>
          </TouchableOpacity>

          <View style={[styles.controlDivider, isDarkMode && styles.controlDividerDark]} />

          {/* Auto Arrange Button: organizes family tree symmetrically, removes overlaps and balances spacing */}
          <TouchableOpacity
            style={[styles.controlBtn, styles.autoArrangeBtn]}
            onPress={handleAutoArrange}
            activeOpacity={0.75}
            accessibilityLabel="Auto arrange family tree"
          >
            <Text style={styles.autoArrangeBtnIcon}>✨</Text>
            <Text style={[styles.controlBtnSubText, styles.autoArrangeBtnText]}>
              Arrange
            </Text>
          </TouchableOpacity>

          <View style={[styles.controlDivider, isDarkMode && styles.controlDividerDark]} />

          {/* Snap to Grid Toggle */}
          <TouchableOpacity
            style={[
              styles.controlBtn,
              snapToGrid && (isDarkMode ? styles.activeToggleBtnDark : styles.activeToggleBtn),
            ]}
            onPress={() => setSnapToGrid(!snapToGrid)}
          >
            <Text
              style={[
                styles.controlBtnSubText,
                isDarkMode && styles.textMutedDark,
                snapToGrid && { color: '#6366F1', fontWeight: '700' },
              ]}
            >
              {snapToGrid ? '🧲 Snap' : 'Free'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={() => centerTree('fit')}>
            <Text style={[styles.controlBtnSubText, isDarkMode && styles.textMutedDark]}>
              Center
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={resetCardPositions}>
            <Text style={[styles.controlBtnSubText, isDarkMode && styles.textMutedDark]}>
              Reset
            </Text>
          </TouchableOpacity>

          {selectedId && (
            <TouchableOpacity
              style={[
                styles.controlBtn,
                styles.focusBtn,
                isDarkMode && styles.activeToggleBtnDark,
              ]}
              onPress={() => focusNode(selectedId)}
            >
              <Text style={[styles.controlBtnSubText, { color: '#6366F1' }]}>Focus</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Hint pill */}
      <View
        style={[styles.hintBanner, isDarkMode && styles.hintBannerDark]}
        pointerEvents="none"
      >
        <Text style={[styles.hintText, isDarkMode && styles.textMutedDark]}>
          {activeDraggingId
            ? 'Dragging card (Canvas locked)'
            : `Pinch to zoom • Drag ⠿ icon • ${snapToGrid ? 'Grid snap ON' : 'Free'}`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  canvas: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  nodeCard: {
    position: 'absolute',
    borderRadius: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  nodeCardDark: {
    shadowColor: '#000000',
    shadowOpacity: 0.3,
  },
  cardTapArea: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  nodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarEmoji: {
    fontSize: 20,
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  genPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  genPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  memberName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  textLight: {
    color: '#F8FAFC',
  },
  textMutedDark: {
    color: '#94A3B8',
  },
  bottomMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 28,
  },
  memberYears: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    flex: 1,
  },
  dragHandleBtn: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 28,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandleBtnDark: {
    backgroundColor: '#334155',
  },
  dragHandleBtnActive: {
    backgroundColor: '#E0E7FF',
  },
  dragHandleIcon: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
  },
  heartBadge: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#F43F5E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartText: {
    fontSize: 9,
  },
  floatingControlsFrame: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 74,
    borderRadius: 12,
    alignItems: 'center',
  },
  collapsedZoomBadge: {
    height: 46,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  collapsedZoomButton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoArrangeBtn: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginVertical: 2,
  },
  autoArrangeBtnIcon: {
    fontSize: 12,
    marginBottom: 1,
  },
  autoArrangeBtnText: {
    color: '#15803D',
    fontWeight: '700',
  },
  zoomLabelCollapsed: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  floatingControls: {
    backgroundColor: '#FFFFFF',
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingControlsDark: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    shadowColor: '#000000',
  },
  zoomBadgeBtn: {
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  zoomBadgeBtnDark: {
    backgroundColor: '#334155',
  },
  controlBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  activeToggleBtn: {
    backgroundColor: '#EEF2FF',
  },
  activeToggleBtnDark: {
    backgroundColor: '#312E81',
  },
  focusBtn: {
    backgroundColor: '#EEF2FF',
    marginTop: 2,
  },
  controlBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  controlBtnSubText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  zoomLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  controlDivider: {
    width: 24,
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  controlDividerDark: {
    backgroundColor: '#334155',
  },
  hintBanner: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  hintBannerDark: {
    backgroundColor: 'rgba(30, 41, 59, 0.94)',
    borderColor: '#334155',
  },
  hintText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
});
