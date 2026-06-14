/**
 * ThreatGlobe — 3D globe plotting source IPs as attack markers.
 *
 * Rules (Phase 8):
 * - Single <Canvas> instance per page.
 * - OrbitControls with auto-rotate and mobile zoom disabled.
 * - Pulse/glow effect for markers.
 * - Visual flourish only, no functional logic.
 */

"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sphere } from "@react-three/drei";
import * as THREE from "three";

// Hardcoded IP to Lat/Lng mapping based on generator pools
const IP_LOCATIONS: Record<string, [number, number]> = {
  "185.220.101.47": [55.75, 37.61],      // Russia
  "45.33.32.156": [37.77, -122.41],      // US West
  "91.108.4.202": [52.36, 4.90],         // Netherlands
  "104.21.45.89": [38.90, -77.03],       // US East
  "198.51.100.7": [0, 0],                // TEST-NET (Equator)
  "203.0.113.42": [-20, 50],             // TEST-NET (Indian Ocean)
  "192.0.2.18": [20, -40],               // TEST-NET (Atlantic)
  "5.188.206.14": [59.93, 30.31],        // RU Botnet (St. Petersburg)
  "194.165.16.20": [50.45, 30.52],       // UA VPS (Kyiv)
  "77.88.55.60": [55.75, 37.61],         // Yandex RU
  "159.65.92.11": [50.11, 8.68],         // Germany (Frankfurt)
  "165.22.58.130": [1.35, 103.81],       // Singapore
  "167.172.138.143": [40.71, -74.00],    // US (New York)
  "209.141.55.170": [36.16, -115.13],    // US VPS (Las Vegas)
  "218.92.0.186": [39.90, 116.40],       // CN Telecom (Beijing)
  "220.181.38.251": [31.23, 121.47],     // CN Baidu (Shanghai)
  "1.180.0.1": [22.54, 114.05],          // CN APNIC (Shenzhen)
  "61.135.169.125": [30.59, 114.30],     // CN (Wuhan)
  "175.45.176.3": [39.03, 125.75],       // KP (Pyongyang)
  "196.216.2.1": [-26.20, 28.04],        // ZA (Johannesburg)
};

// Fallback lat/lng generator for unknown IPs (simple hash)
function hashIpToCoords(ip: string): [number, number] {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = ip.charCodeAt(i) + ((hash << 5) - hash);
  }
  const lat = (hash % 140) - 70; // -70 to 70
  const lng = ((hash >> 8) % 360) - 180; // -180 to 180
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

function Marker({ lat, lng, color }: { lat: number; lng: number; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => latLngToVector3(lat, lng, 2.05), [lat, lng]);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      // Pulsing scale effect
      const s = 1 + Math.sin(clock.elapsedTime * 4 + pos.x) * 0.3;
      meshRef.current.scale.set(s, s, s);
    }
  });

  return (
    <Sphere ref={meshRef} args={[0.03, 16, 16]} position={pos}>
      <meshBasicMaterial color={color} transparent opacity={0.8} />
    </Sphere>
  );
}

function Earth() {
  return (
    <Sphere args={[2, 64, 64]}>
      {/* Dark wireframe/solid hybrid for cyber look */}
      <meshStandardMaterial
        color="#080d14"
        emissive="#00e5ff"
        emissiveIntensity={0.05}
        wireframe={true}
        transparent
        opacity={0.3}
      />
      <meshStandardMaterial
        color="#020508"
        roughness={0.8}
      />
    </Sphere>
  );
}

export default function ThreatGlobe({ activeIps }: { activeIps: string[] }) {
  // Deduplicate and map IPs to coordinates
  const markers = useMemo(() => {
    const uniqueIps = Array.from(new Set(activeIps));
    return uniqueIps.map((ip) => {
      const [lat, lng] = IP_LOCATIONS[ip] || hashIpToCoords(ip);
      return { ip, lat, lng };
    });
  }, [activeIps]);

  return (
    <div className="w-full h-full relative cursor-move">
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <Earth />
        {markers.map((m) => (
          <Marker key={m.ip} lat={m.lat} lng={m.lng} color="#ff3b3b" />
        ))}
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={1.5}
        />
      </Canvas>
      {/* Overlay gradient to blend edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, transparent 40%, var(--color-bg) 100%)",
        }}
      />
    </div>
  );
}
