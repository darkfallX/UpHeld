"use client";

/**
 * The UpHeld Monolith: WebGL scene (React Three Fiber).
 *
 * A letter U made of two square-topped stems on a semicircular base, extruded with a
 * chamfered bevel and a brushed silver finish. Lit by a procedural studio environment
 * (three's RoomEnvironment, no network fetch), a key light across the bevels and a cool
 * rim light that separates the silhouette from the background.
 *
 * Motion (critically damped, no spring overshoot):
 *  • entrance: rises 0.25u, scales 0.92 to 1, fades in and ramps the light over ~2.2s
 *  • idle: slow yaw/pitch drift and a 0.05u float (≈ 40s / 16s periods)
 *  • pointer: perspective tilt toward the cursor (±14° max), exponential smoothing
 *  • scroll: as the hero scrolls away it pitches back, lifts and recedes (parallax)
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const R = 1; // outer radius / half-width
const T = 0.5; // stem thickness
const TOP = 1.55; // stem height above arc centre
const DEPTH = 0.8;

function buildU(curveSegments: number) {
  const r = R - T;
  const s = new THREE.Shape();
  s.moveTo(-R, TOP);
  s.lineTo(-R, 0);
  s.absarc(0, 0, R, Math.PI, Math.PI * 2, false);
  s.lineTo(R, TOP);
  s.lineTo(r, TOP);
  s.lineTo(r, 0);
  s.absarc(0, 0, r, 0, Math.PI, true);
  s.lineTo(-r, TOP);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: DEPTH,
    curveSegments,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 6,
  });
  g.center();
  g.computeVertexNormals();
  return g;
}

/** soft radial pool of light beneath the object (reads as a plinth reflection on black) */
function usePoolTexture(light: boolean) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    // on black: a soft pool of light; on white: a soft contact shadow
    const c0 = light ? "0,0,0" : "255,255,255";
    g.addColorStop(0, `rgba(${c0},${light ? 0.32 : 0.55})`);
    g.addColorStop(0.35, `rgba(${c0},${light ? 0.12 : 0.16})`);
    g.addColorStop(1, `rgba(${c0},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [light]);
}

function Studio() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

const smoothstep = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10); // smootherstep: zero velocity & accel at both ends
};
const damp = (cur: number, target: number, lambda: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

export interface MonolithSceneProps {
  /** static pose, no idle / pointer / scroll motion */
  still: boolean;
  /** viewport-relative scroll progress of the hero: 0 at top, 1 when scrolled past */
  scrollRef: React.RefObject<number>;
  pointerRef: React.RefObject<{ x: number; y: number }>;
  onReady: () => void;
  quality: "high" | "low";
  /** light page theme: graphite-silver finish + contact shadow instead of a light pool */
  light: boolean;
}

function Monolith({ still, scrollRef, pointerRef, onReady, light }: Omit<MonolithSceneProps, "quality">) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshPhysicalMaterial>(null);
  const pool = useRef<THREE.MeshBasicMaterial>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const geometry = useMemo(() => buildU(96), []);
  const poolTex = usePoolTexture(light);
  const start = useRef<number | null>(null);
  const frames = useRef(0);
  const s = useRef({ tiltX: 0, tiltY: 0, scroll: 0 });
  const { invalidate } = useThree();

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g || !mat.current) return;
    if (frames.current < 3 && ++frames.current === 2) onReady();
    const dt = Math.min(delta, 1 / 20);
    const now = state.clock.elapsedTime;
    if (start.current === null) start.current = now;
    const t = now - start.current;

    const e = still ? 1 : smoothstep((t - 0.1) / 2.2); // entrance 0→1
    const idleYaw = still ? 0 : Math.sin(t * 0.157) * 0.2; // ~40s period
    const idlePitch = still ? 0 : Math.sin(t * 0.11) * 0.035;
    const float = still ? 0 : Math.sin(t * 0.39) * 0.05; // ~16s period

    const p = pointerRef.current ?? { x: 0, y: 0 };
    s.current.tiltX = damp(s.current.tiltX, still ? 0 : -p.y * 0.16, 2.4, dt);
    s.current.tiltY = damp(s.current.tiltY, still ? 0 : p.x * 0.26, 2.4, dt);
    s.current.scroll = damp(s.current.scroll, still ? 0 : scrollRef.current ?? 0, 4, dt);
    const sc = s.current.scroll;

    g.rotation.y = -0.38 + idleYaw + s.current.tiltY + (1 - e) * -0.35;
    g.rotation.x = 0.1 + idlePitch + s.current.tiltX + sc * 0.42;
    g.position.y = float + (1 - e) * -0.28 + sc * 0.7;
    g.scale.setScalar((0.92 + 0.08 * e) * (1 - sc * 0.08));

    mat.current.opacity = e;
    mat.current.envMapIntensity = 0.3 + 0.9 * e;
    if (key.current) key.current.intensity = 3.2 * e;
    if (pool.current) pool.current.opacity = 0.5 * e * (1 - sc * 0.8) * (1 - float * 2);

    if (still && frames.current < 3) invalidate();
  });

  return (
    <>
      <Studio />
      <ambientLight intensity={0.12} />
      {/* key light rakes the bevels from upper-left */}
      <directionalLight ref={key} position={[-3.2, 4.2, 4]} intensity={0} color="#ffffff" />
      {/* cool rim light separates the silhouette from black */}
      <directionalLight position={[3.5, 1.5, -4]} intensity={1.6} color="#dfe8ff" />
      <directionalLight position={[0, -3, 2]} intensity={0.25} color="#ffffff" />
      <group ref={group}>
        <mesh geometry={geometry}>
          <meshPhysicalMaterial
            ref={mat}
            color={light ? "#b9b9b9" : "#ececec"}
            metalness={1}
            roughness={light ? 0.24 : 0.19}
            clearcoat={0.6}
            clearcoatRoughness={0.12}
            envMapIntensity={0.35}
            transparent
            opacity={0}
          />
        </mesh>
      </group>
      <mesh position={[0, -1.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.4, 2.2]} />
        <meshBasicMaterial key={light ? "l" : "d"} ref={pool} map={poolTex} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

export default function MonolithScene({ still, scrollRef, pointerRef, onReady, quality, active, light }: MonolithSceneProps & { active: boolean }) {
  return (
    <Canvas
      dpr={quality === "high" ? [1, 1.75] : [1, 1.25]}
      camera={{ position: [0, 0.1, 7.3], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.setClearColor(0x000000, 0);
      }}
      frameloop={!active ? "never" : still ? "demand" : "always"}
      style={{ background: "transparent" }}
      aria-hidden
    >
      <Monolith still={still} scrollRef={scrollRef} pointerRef={pointerRef} onReady={onReady} light={light} />
    </Canvas>
  );
}
