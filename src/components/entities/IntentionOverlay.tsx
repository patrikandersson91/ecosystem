import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import { Color, Vector3 } from 'three';
import type { Group } from 'three';
import { useDebug } from '../../state/debug-context.tsx';
import { groundHeightAt } from '../../utils/terrain-height.ts';

interface IntentionOverlayProps {
  /** Ref to current world position of the entity */
  positionRef: React.RefObject<Vector3>;
  /** Ref to current target world position (null when wandering) */
  targetRef: React.RefObject<Vector3 | null>;
  /** Ref to current intention label string */
  intentionRef: React.RefObject<string>;
  /** Y offset above the entity for the label */
  labelY?: number;
  /** Line color */
  color?: string;
}

const LINE_HEIGHT_ABOVE_GROUND = 0.25;

function getIntentionColor(label: string, fallbackColor: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('mate') || normalized.includes('mating'))
    return '#ff69b4'; // pink
  if (normalized.includes('food') || normalized.includes('eating'))
    return '#90ee90'; // light green
  if (normalized.includes('water') || normalized.includes('drinking'))
    return '#87ceeb'; // blue
  if (normalized.includes('chasing')) return '#ff4d4d'; // red
  return fallbackColor;
}

export default function IntentionOverlay({
  positionRef,
  targetRef,
  intentionRef,
  labelY = 1.4,
  color = '#00ffff',
}: IntentionOverlayProps) {
  const { showIntentions } = useDebug();
  const lineRef = useRef<{
    geometry: { setPositions: (arr: number[]) => void };
  }>(null!);
  const htmlRef = useRef<HTMLDivElement>(null!);
  const groupRef = useRef<Group>(null!);
  const lineGroupRef = useRef<Group>(null!);
  const colorBuffer = useMemo(() => new Color(color), [color]);

  useFrame(() => {
    if (!showIntentions) return;

    const pos = positionRef.current;
    const target = targetRef.current;
    const label = intentionRef.current;
    const currentGroundY = groundHeightAt(pos.x, pos.z);

    // Update label position to follow entity
    if (groupRef.current) {
      groupRef.current.position.set(pos.x, currentGroundY + labelY, pos.z);
    }

    // Update html text
    if (htmlRef.current) {
      htmlRef.current.textContent = label;
      htmlRef.current.style.color = getIntentionColor(label, color);
    }

    const activeColor = getIntentionColor(label, color);
    colorBuffer.set(activeColor);
    const lineMaterial = (
      lineRef.current as unknown as {
        material?: { color?: { copy: (c: Color) => void } };
      }
    )?.material;
    lineMaterial?.color?.copy(colorBuffer);

    // Update line
    if (lineRef.current && target) {
      const targetGroundY = groundHeightAt(target.x, target.z);
      const lineY =
        Math.max(currentGroundY, targetGroundY) + LINE_HEIGHT_ABOVE_GROUND;
      lineRef.current.geometry.setPositions([
        pos.x,
        lineY,
        pos.z,
        target.x,
        lineY,
        target.z,
      ]);
      lineGroupRef.current.visible = true;
    } else if (lineGroupRef.current) {
      lineGroupRef.current.visible = false;
    }
  });

  if (!showIntentions) return null;

  return (
    <>
      {/* Label above head */}
      <group ref={groupRef}>
        <Html center distanceFactor={20} style={{ pointerEvents: 'none' }}>
          <div
            ref={htmlRef}
            style={{
              color,
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          />
        </Html>
      </group>

      {/* Line to target */}
      <group ref={lineGroupRef}>
        <Line
          ref={lineRef as never}
          points={[
            [0, 0, 0],
            [0, 0, 0],
          ]}
          color={color}
          lineWidth={1.5}
          transparent
          opacity={0.6}
          dashed
          dashSize={0.5}
          gapSize={0.3}
        />
      </group>
    </>
  );
}
