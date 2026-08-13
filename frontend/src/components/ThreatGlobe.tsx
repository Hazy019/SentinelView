/**
 * ThreatGlobe — 3D WebGL Globe with Light-Mode Refraction, Mouse Tilt, and Attack Arcs.
 * Adheres to Master Prompt: Star of the Show centerpiece direction.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sphere } from "@react-three/drei";
import * as THREE from "three";

// Target SOC destinations for visual attack arcs
const TARGET_DESTINATIONS: [number, number][] = [
  [38.90, -77.03],  // Washington D.C., USA
  [50.11, 8.68],    // Frankfurt, Germany
  [1.35, 103.81],   // Singapore
  [35.67, 139.65],  // Tokyo, Japan
];

const IP_LOCATIONS: Record<string, [number, number]> = {
  "185.220.101.47": [55.75, 37.61],      // Russia
  "45.33.32.156": [37.77, -122.41],      // US West
  "91.108.4.202": [52.36, 4.90],         // Netherlands
  "104.21.45.89": [38.90, -77.03],       // US East
  "198.51.100.7": [1.35, 103.81],        // Singapore
  "203.0.113.42": [-20, 50],             // Indian Ocean
  "192.0.2.18": [20, -40],               // Atlantic
  "5.188.206.14": [59.93, 30.31],        // St. Petersburg
  "194.165.16.20": [50.45, 30.52],       // Kyiv
  "77.88.55.60": [55.75, 37.61],         // Moscow
  "159.65.92.11": [50.11, 8.68],         // Frankfurt
  "165.22.58.130": [1.35, 103.81],       // Singapore
  "167.172.138.143": [40.71, -74.00],    // New York
  "209.141.55.170": [36.16, -115.13],    // Las Vegas
  "218.92.0.186": [39.90, 116.40],       // Beijing
  "220.181.38.251": [31.23, 121.47],     // Shanghai
  "1.180.0.1": [22.54, 114.05],          // Shenzhen
  "61.135.169.125": [30.59, 114.30],     // Wuhan
  "175.45.176.3": [39.03, 125.75],       // Pyongyang
  "196.216.2.1": [-26.20, 28.04],        // Johannesburg
};

function hashIpToCoords(ip: string): [number, number] {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = ip.charCodeAt(i) + ((hash << 5) - hash);
  }
  const lat = (hash % 130) - 65;
  const lng = ((hash >> 8) % 360) - 180;
  return [lat, lng];
}

function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

// ── Components ──

function SourceMarker({ lat, lng, color, reducesMotion }: { lat: number; lng: number; color: string; reducesMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => latLngToVector3(lat, lng, 2.04), [lat, lng]);

  useFrame(({ clock }) => {
    if (meshRef.current && !reducesMotion) {
      const s = 1 + Math.sin(clock.elapsedTime * 4 + pos.x * 2) * 0.3;
      meshRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group position={pos}>
      <Sphere ref={meshRef} args={[0.045, 16, 16]}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.9}
          roughness={0.15}
        />
      </Sphere>
    </group>
  );
}

function AttackArc({
  startLat,
  startLng,
  endLat,
  endLng,
  color,
  reducesMotion,
}: {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  reducesMotion: boolean;
}) {
  const lineObj = useMemo(() => {
    const start = latLngToVector3(startLat, startLng, 2.03);
    const end = latLngToVector3(endLat, endLng, 2.03);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const dist = start.distanceTo(end);
    mid.normalize().multiplyScalar(2.03 + dist * 0.35);

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const points = curve.getPoints(32);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({
      color: color,
      dashSize: 0.15,
      gapSize: 0.1,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.75,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    return line;
  }, [startLat, startLng, endLat, endLng, color]);

  useFrame(({ clock }) => {
    if (lineObj.material && !reducesMotion) {
      lineObj.material.opacity = 0.45 + Math.sin(clock.elapsedTime * 3.5 + startLat) * 0.28;
    }
  });

  return <primitive object={lineObj} />;
}

function GlobeStage({
  activeIps,
  mousePos,
  reducesMotion,
}: {
  activeIps: string[];
  mousePos: { x: number; y: number };
  reducesMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const gridMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  const markers = useMemo(() => {
    const uniqueIps = Array.from(new Set(activeIps));
    return uniqueIps.map((ip, i) => {
      const [lat, lng] = IP_LOCATIONS[ip] || hashIpToCoords(ip);
      const target = TARGET_DESTINATIONS[i % TARGET_DESTINATIONS.length];
      return { ip, lat, lng, targetLat: target[0], targetLng: target[1] };
    });
  }, [activeIps]);

  useFrame(({ clock }) => {
    if (groupRef.current && !reducesMotion) {
      // Gentle auto rotation (~45s revolution) combined with mouse tilt lerp
      groupRef.current.rotation.y += 0.002;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, mousePos.y * 0.12, 0.04);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, -mousePos.x * 0.06, 0.04);
    }
    if (gridMaterialRef.current && !reducesMotion) {
      // Breathing grid surface opacity
      gridMaterialRef.current.opacity = 0.12 + Math.sin(clock.elapsedTime * 1.5) * 0.04;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Translucent Core Earth Refraction Sphere */}
      <Sphere args={[2, 64, 64]}>
        <meshPhysicalMaterial
          color="#F8FAFC"
          roughness={0.08}
          metalness={0.05}
          transmission={0.45}
          ior={1.18}
          reflectivity={0.92}
          transparent
          opacity={0.94}
        />
      </Sphere>

      {/* Wireframe Orbit Grid */}
      <Sphere args={[2.01, 36, 36]}>
        <meshStandardMaterial
          ref={gridMaterialRef}
          color="#2563EB"
          wireframe
          transparent
          opacity={0.14}
        />
      </Sphere>

      {/* Source Attack Markers */}
      {markers.map((m) => (
        <SourceMarker key={m.ip} lat={m.lat} lng={m.lng} color="#EF4444" reducesMotion={reducesMotion} />
      ))}

      {/* Glowing 3D Bezier Attack Arcs */}
      {markers.slice(0, 12).map((m, idx) => (
        <AttackArc
          key={`arc-${m.ip}-${idx}`}
          startLat={m.lat}
          startLng={m.lng}
          endLat={m.targetLat}
          endLng={m.targetLng}
          color={idx % 2 === 0 ? "#EF4444" : "#F59E0B"}
          reducesMotion={reducesMotion}
        />
      ))}
    </group>
  );
}

export default function ThreatGlobe({ activeIps }: { activeIps: string[] }) {
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
      className="w-full h-full relative cursor-grab active:cursor-grabbing"
      onMouseMove={handleMouseMove}
    >
      <Canvas camera={{ position: [0, 0, 5.2], fov: 45 }}>
        <ambientLight intensity={1.3} />
        <directionalLight position={[10, 10, 5]} intensity={1.9} color="#FFFFFF" />
        <directionalLight position={[-10, -10, -5]} intensity={0.6} color="#2563EB" />
        <pointLight position={[0, 5, 0]} intensity={1.1} color="#60A5FA" />

        <GlobeStage activeIps={activeIps} mousePos={mousePos} reducesMotion={reducesMotion} />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={false}
          rotateSpeed={0.7}
        />
      </Canvas>

      {/* Soft Light-Mode Vignette Overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl select-none"
        style={{
          background:
            "radial-gradient(circle at center, transparent 55%, rgba(250, 250, 248, 0.85) 100%)",
        }}
      />
    </div>
  );
}


