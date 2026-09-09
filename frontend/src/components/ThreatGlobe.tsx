/**
 * ThreatGlobe — R3F Dimensional Wireframe Globe with Firing Particle-Trail Arc & Landing Bloom.
 *
 * Requirements:
 * - Depth of field: globe in sharp focus, background particle field slightly blurred (bokeh).
 * - Ambient rotation: continuous, slow (60s/revolution), never fully stops.
 * - Threat arc animation: fires along globe surface with a particle trail, lands on node
 *   that pulses with bloom/glow, fades over ~3s.
 * - Lighting: one key light from upper-left + one soft rim light from rear, giving actual
 *   dimensional shading to the wireframe.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sphere } from "@react-three/drei";
import * as THREE from "three";

// Coordinates [Latitude, Longitude]
const ORIGIN_NODE: [number, number] = [37.77, -122.41]; // San Francisco Ingress
const TARGET_NODE_1: [number, number] = [50.11, 8.68];   // Frankfurt SOC (Target)
const TARGET_NODE_2: [number, number] = [1.35, 103.81];  // Singapore Edge (Static)

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

/**
 * Bokeh Background Particle Field (45 slow-drifting out-of-focus network nodes).
 * Positioned in deep Z-space (z: -4 to -8) with soft opacity to establish depth-of-field separation.
 */
function BokehParticleField({ reducesMotion }: { reducesMotion: boolean }) {
  const count = 45;
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, scales] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sca = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;     // X spread
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10; // Y spread
      pos[i * 3 + 2] = -4 - Math.random() * 4;     // Z depth behind globe
      sca[i] = 0.08 + Math.random() * 0.12;        // Soft blurred disc size
    }
    return [pos, sca];
  }, []);

  useFrame(({ clock }) => {
    if (reducesMotion || !pointsRef.current) return;
    const t = clock.elapsedTime * 0.05;
    // Slow drifting ambient field
    pointsRef.current.rotation.y = t * 0.2;
    pointsRef.current.rotation.x = Math.sin(t * 0.4) * 0.05;
  });

  return (
    <group>
      {/* Pre-generate individual soft blurred circles */}
      {Array.from({ length: count }).map((_, i) => (
        <mesh
          key={i}
          position={[positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]]}
        >
          <circleGeometry args={[scales[i], 16]} />
          <meshBasicMaterial
            color="#3B4A6B"
            transparent
            opacity={0.18}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Origin Ingress Node with continuous beacon pulse
 */
function IngressNode({
  lat,
  lng,
  reducesMotion,
}: {
  lat: number;
  lng: number;
  reducesMotion: boolean;
}) {
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => latLngToVector3(lat, lng, 2.02), [lat, lng]);

  useFrame(({ clock }) => {
    if (reducesMotion) return;
    const t = clock.elapsedTime;
    if (coreRef.current) {
      const s = 1 + Math.sin(t * 4) * 0.2;
      coreRef.current.scale.set(s, s, s);
    }
    if (ringRef.current) {
      const wave = (t * 0.8) % 1;
      const ringScale = 1 + wave * 2.2;
      ringRef.current.scale.set(ringScale, ringScale, ringScale);
      const ringMat = ringRef.current.material as THREE.MeshBasicMaterial;
      if (ringMat) ringMat.opacity = (1 - wave) * 0.7;
    }
  });

  return (
    <group position={pos}>
      <Sphere ref={coreRef} args={[0.045, 16, 16]}>
        <meshStandardMaterial
          color="#2F5BFF"
          emissive="#2F5BFF"
          emissiveIntensity={1.8}
          roughness={0.2}
        />
      </Sphere>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.05, 0.065, 32]} />
        <meshBasicMaterial color="#2F5BFF" transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/**
 * Landing Destination Node with Impact Bloom / Glow pulse fading over ~3s.
 */
function LandingBloomNode({
  lat,
  lng,
  impactIntensity,
  reducesMotion,
}: {
  lat: number;
  lng: number;
  impactIntensity: number; // 0.0 (idle) to 1.0 (peak impact)
  reducesMotion: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const shockwaveRef = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => latLngToVector3(lat, lng, 2.02), [lat, lng]);

  useFrame(() => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        // High bloom emissive response during impact
        mat.emissiveIntensity = 0.5 + impactIntensity * 2.8;
      }
      const s = 1 + impactIntensity * 0.4;
      meshRef.current.scale.set(s, s, s);
    }

    if (shockwaveRef.current && !reducesMotion) {
      const waveScale = 1 + impactIntensity * 2.8;
      shockwaveRef.current.scale.set(waveScale, waveScale, waveScale);
      const sMat = shockwaveRef.current.material as THREE.MeshBasicMaterial;
      if (sMat) {
        sMat.opacity = impactIntensity * 0.85;
      }
    }
  });

  return (
    <group position={pos}>
      {/* Node Core */}
      <Sphere ref={meshRef} args={[0.042, 16, 16]}>
        <meshStandardMaterial
          color="#60A5FA"
          emissive="#2F5BFF"
          emissiveIntensity={0.5}
          roughness={0.15}
        />
      </Sphere>

      {/* Impact Bloom Shockwave Ring */}
      <mesh ref={shockwaveRef}>
        <ringGeometry args={[0.055, 0.075, 32]} />
        <meshBasicMaterial color="#2F5BFF" transparent side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** Static Secondary Edge Node (Monochrome) */
function StaticEdgeNode({ lat, lng }: { lat: number; lng: number }) {
  const pos = useMemo(() => latLngToVector3(lat, lng, 2.015), [lat, lng]);
  return (
    <group position={pos}>
      <Sphere args={[0.03, 12, 12]}>
        <meshStandardMaterial
          color="#64748B"
          emissive="#475569"
          emissiveIntensity={0.2}
          roughness={0.4}
        />
      </Sphere>
    </group>
  );
}

/**
 * Firing Threat Arc with Comet-like Particle Trail.
 * Fires every ~4 seconds along the globe surface.
 */
function FiringParticleTrailArc({
  startLat,
  startLng,
  endLat,
  endLng,
  onImpactUpdate,
  reducesMotion,
}: {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  onImpactUpdate: (intensity: number) => void;
  reducesMotion: boolean;
}) {
  const trailCount = 6;
  const trailRefs = useRef<Array<THREE.Mesh | null>>([]);

  const arcCurve = useMemo(() => {
    const start = latLngToVector3(startLat, startLng, 2.02);
    const end = latLngToVector3(endLat, endLng, 2.02);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const dist = start.distanceTo(end);
    mid.normalize().multiplyScalar(2.02 + dist * 0.42);

    return new THREE.QuadraticBezierCurve3(start, mid, end);
  }, [startLat, startLng, endLat, endLng]);

  const arcWire = useMemo(() => {
    const points = arcCurve.getPoints(48);
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: "#2F5BFF",
      transparent: true,
      opacity: 0.22,
    });
    return new THREE.Line(geom, mat);
  }, [arcCurve]);

  useFrame(({ clock }) => {
    if (reducesMotion) return;
    const loopDuration = 4.0; // 4 second overall loop
    const t = clock.elapsedTime % loopDuration;
    const flightTime = 2.4; // 2.4s travel time, 1.6s post-impact linger

    let headProgress = 0;
    if (t < flightTime) {
      headProgress = t / flightTime; // 0.0 -> 1.0
      // Calculate landing impact intensity: fades over ~3s after hitting
      onImpactUpdate(0);
    } else {
      headProgress = 1.0;
      // Fade impact bloom over remaining cycle time (~1.6s to next loop)
      const afterImpact = t - flightTime;
      const fade = Math.max(0, 1 - afterImpact / 1.6);
      onImpactUpdate(fade);
    }

    // Position lead particle and trailing comet particles
    for (let i = 0; i < trailCount; i++) {
      const mesh = trailRefs.current[i];
      if (!mesh) continue;

      const lag = i * 0.025; // Progressive trailing lag along curve
      const p = Math.max(0, Math.min(1, headProgress - lag));
      mesh.position.copy(arcCurve.getPoint(p));

      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) {
        if (t >= flightTime) {
          // After impact, particles dissolve quickly
          mat.opacity = Math.max(0, (mat.opacity || 1) - 0.1);
        } else {
          // Lead is brightest, trail fades out
          const baseAlpha = 1 - i / trailCount;
          mat.opacity = baseAlpha * (headProgress > 0.05 ? 1 : headProgress / 0.05);
        }
      }
    }
  });

  return (
    <group>
      <primitive object={arcWire} />

      {/* Lead particle + trailing comet sub-particles */}
      {Array.from({ length: trailCount }).map((_, i) => {
        const size = 0.038 * Math.pow(0.82, i);
        return (
          <Sphere
            key={i}
            ref={(el) => {
              trailRefs.current[i] = el;
            }}
            args={[size, 12, 12]}
          >
            <meshStandardMaterial
              color={i === 0 ? "#93C5FD" : "#2F5BFF"}
              emissive="#2F5BFF"
              emissiveIntensity={i === 0 ? 2.5 : 1.2}
              transparent
              opacity={1 - i / trailCount}
            />
          </Sphere>
        );
      })}
    </group>
  );
}

function WireframeGlobeStage({
  mousePos,
  reducesMotion,
}: {
  mousePos: { x: number; y: number };
  reducesMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [impactIntensity, setImpactIntensity] = useState(0);

  useFrame(() => {
    if (groupRef.current && !reducesMotion) {
      // Ambient rotation: continuous, slow (60s/revolution: 2*PI / 3600 frames at 60fps = 0.001745)
      groupRef.current.rotation.y += 0.001745;

      // Gentle interactive mouse parallax
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        mousePos.y * 0.08,
        0.04
      );
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        -mousePos.x * 0.05,
        0.04
      );
    }
  });

  return (
    <group ref={groupRef}>
      {/* Inner Obsidian Glass Core Sphere */}
      <Sphere args={[1.985, 48, 48]}>
        <meshStandardMaterial
          color="#0B1220"
          roughness={0.2}
          metalness={0.6}
        />
      </Sphere>

      {/* Outer Wireframe Sphere — Dimensional Shading via meshStandardMaterial catching key/rim lights */}
      <Sphere args={[2.0, 36, 36]}>
        <meshStandardMaterial
          color="#3B82F6"
          emissive="#1E3A8A"
          emissiveIntensity={0.25}
          wireframe
          transparent
          opacity={0.38}
          roughness={0.25}
          metalness={0.7}
        />
      </Sphere>

      {/* Thin Latitudinal Accent Orbit */}
      <mesh rotation={[Math.PI / 2.1, 0, 0]}>
        <ringGeometry args={[2.008, 2.014, 64]} />
        <meshStandardMaterial
          color="#2F5BFF"
          emissive="#2F5BFF"
          emissiveIntensity={0.8}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Ingress Origin Node */}
      <IngressNode
        lat={ORIGIN_NODE[0]}
        lng={ORIGIN_NODE[1]}
        reducesMotion={reducesMotion}
      />

      {/* Landing Destination Node with Bloom Glow */}
      <LandingBloomNode
        lat={TARGET_NODE_1[0]}
        lng={TARGET_NODE_1[1]}
        impactIntensity={impactIntensity}
        reducesMotion={reducesMotion}
      />

      {/* Static Monochrome Edge Node */}
      <StaticEdgeNode lat={TARGET_NODE_2[0]} lng={TARGET_NODE_2[1]} />

      {/* Firing Particle-Trail Threat Arc */}
      <FiringParticleTrailArc
        startLat={ORIGIN_NODE[0]}
        startLng={ORIGIN_NODE[1]}
        endLat={TARGET_NODE_1[0]}
        endLng={TARGET_NODE_1[1]}
        onImpactUpdate={setImpactIntensity}
        reducesMotion={reducesMotion}
      />
    </group>
  );
}

/** Dynamic Camera Controller — prevents sphere clipping on tall/narrow mobile viewports */
function ResponsiveCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      const aspect = size.width / Math.max(size.height, 1);
      if (aspect < 1.0) {
        camera.position.z = 5.8;
      } else if (aspect < 1.3) {
        camera.position.z = 5.4;
      } else {
        camera.position.z = 5.0;
      }
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height]);

  return null;
}

export default function ThreatGlobe(_props: { activeIps?: string[] } = {}) {
  void _props;
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [reducesMotion, setReducesMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducesMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducesMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducesMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    setMousePos({ x, y });
  };

  return (
    <div
      className="w-full h-full relative cursor-grab active:cursor-grabbing select-none"
      onMouseMove={handleMouseMove}
    >
      <Canvas camera={{ position: [0, 0, 5.1], fov: 42 }}>
        <ResponsiveCamera />

        {/* Key light from upper-left providing dimensional shading */}
        <directionalLight position={[-6, 8, 5]} intensity={2.6} color="#FFFFFF" />

        {/* Soft rim light from rear-right casting specular edge highlights */}
        <directionalLight position={[7, -4, -6]} intensity={2.0} color="#2F5BFF" />

        {/* Subtle ambient fill */}
        <ambientLight intensity={0.4} />

        {/* Depth-of-Field Bokeh Particle Field (Background) */}
        <BokehParticleField reducesMotion={reducesMotion} />

        {/* The Star of the Show: In-Focus Wireframe Globe */}
        <WireframeGlobeStage mousePos={mousePos} reducesMotion={reducesMotion} />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          rotateSpeed={0.6}
        />
      </Canvas>
    </div>
  );
}
