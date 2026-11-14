/**
 * ThreeHeroNode.tsx
 * Ultra-Stable 3D Knowledge Orb for Baton.
 * 
 * Bulletproof Architecture:
 * - Direct Native Three.js implementation (eliminates @react-three/fiber reconciler version conflicts & 'reading S' crashes).
 * - Safe Texture Loading: Uses THREE.TextureLoader with explicit onLoad and onError handlers, falling back to a synthesized Baton logo texture.
 * - Hardware / WebGL Detection: Instantly renders FallbackHero if WebGL is unavailable or fails context creation.
 * - Smooth Mouse Parallax: Dampened tilt and rotation tracking pointer movements.
 * - Complete Lifecycle Cleanup: Cancels animation frames, removes event listeners, and disposes GPU buffers on unmount.
 */

import React, { useRef, useEffect, useState, Component, type ReactNode } from "react";
import * as THREE from "three";
import { useTheme } from "../../context/ThemeContext";

interface ThreeHeroNodeProps {
  className?: string;
}

const LOGO_ASSET_PATH = "/assets/baton-logo.png";

// ---------------------------------------------------------------------------
// 0. WebGL Detection & Safety Guards
// ---------------------------------------------------------------------------

function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return !!(gl && typeof (gl as WebGLRenderingContext).getParameter === "function");
  } catch {
    return false;
  }
}

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ThreeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("ThreeHeroNode fallback triggered:", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// 1. Procedural Document & Logo Texture Generators
// ---------------------------------------------------------------------------

function createDocTexture(color: string, verified: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 200;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(12, 12, 136, 176, 18);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.beginPath();
    ctx.roundRect(30, 42, 100, 12, 5);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(30, 66, 80, 10, 4);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(30, 88, 90, 10, 4);
    ctx.fill();

    if (verified) {
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.arc(114, 140, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(106, 140);
      ctx.lineTo(112, 146);
      ctx.lineTo(122, 134);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.roundRect(30, 110, 60, 10, 4);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createFallbackLogoTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    const grad = ctx.createLinearGradient(32, 32, 224, 224);
    grad.addColorStop(0, "#4f46e5");
    grad.addColorStop(0.5, "#7c3aed");
    grad.addColorStop(1, "#c084fc");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(128, 128, 96, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 96px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("B", 128, 132);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// 2. High-Fidelity 2.5D Fallback Component
// ---------------------------------------------------------------------------

export const FallbackHero: React.FC<{ className?: string; isDark?: boolean }> = ({
  className = "",
  isDark = false,
}) => (
  <div
    className={`relative w-full h-[280px] sm:h-[320px] lg:h-[360px] flex items-center justify-center overflow-hidden select-none ${className}`}
  >
    {/* Ambient Radial Aura */}
    <div className="absolute inset-0 pointer-events-none opacity-80">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-200/40 dark:bg-purple-600/25 rounded-full blur-3xl transition-colors duration-500" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-200/40 dark:bg-indigo-600/25 rounded-full blur-2xl transition-colors duration-500" />
    </div>

    {/* Concentric Decorative Rings */}
    <div className="absolute w-72 h-72 rounded-full border border-indigo-400/40 rotate-[55deg] scale-y-[0.38] pointer-events-none animate-spin-slow" />
    <div className="absolute w-88 h-88 rounded-full border border-purple-400/35 rotate-[-35deg] scale-y-[0.38] pointer-events-none" />

    {/* Central 2.5D Glass Orb */}
    <div className="relative w-48 h-48 sm:w-52 sm:h-52 rounded-full bg-gradient-to-tr from-white/70 via-purple-100/40 to-indigo-100/60 dark:from-slate-900/80 dark:via-purple-950/40 dark:to-indigo-950/60 backdrop-blur-2xl border border-white/80 dark:border-white/20 shadow-[0_20px_50px_rgba(79,70,229,0.25)] flex items-center justify-center p-4">
      {/* Specular Glare Arc */}
      <div className="absolute top-2 left-6 w-14 h-7 rounded-full bg-white/60 dark:bg-white/30 blur-[2px] rotate-[-25deg] pointer-events-none" />

      {/* Baton Logo */}
      <img
        src={LOGO_ASSET_PATH}
        alt="Baton"
        className={`w-32 h-32 sm:w-36 sm:h-36 object-contain drop-shadow-md transition-all duration-300 ${
          isDark ? "drop-shadow-[0_0_16px_rgba(168,85,247,0.6)]" : ""
        }`}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = "/logo.png";
        }}
      />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// 3. Direct Three.js Native Canvas View (Crash-Proof)
// ---------------------------------------------------------------------------

const ThreeCanvasView: React.FC<{ isDark: boolean; className?: string }> = ({
  isDark,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let animationFrameId: number;
    let renderer: THREE.WebGLRenderer | null = null;

    try {
      // 1. Scene, Camera, Renderer
      const scene = new THREE.Scene();
      const width = container.clientWidth || 400;
      const height = container.clientHeight || 340;

      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      camera.position.set(0, 0, 7.6);

      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "default",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      // 2. Lighting System
      const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 1.4 : 2.0);
      scene.add(ambientLight);

      const dirLight1 = new THREE.DirectionalLight(0xffffff, isDark ? 2.8 : 3.5);
      dirLight1.position.set(5.5, 7.0, 5.0);
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0xc7d2fe, isDark ? 2.2 : 1.8);
      dirLight2.position.set(-5, 4, 3);
      scene.add(dirLight2);

      const ptLight1 = new THREE.PointLight(0xffffff, 2.4, 8);
      ptLight1.position.set(1.8, 2.2, 2.8);
      scene.add(ptLight1);

      const ptLight2 = new THREE.PointLight(0xa855f7, isDark ? 4.0 : 2.8, 12);
      ptLight2.position.set(-4, -2.5, 3);
      scene.add(ptLight2);

      const ptLight3 = new THREE.PointLight(0x38bdf8, isDark ? 3.6 : 2.6, 12);
      ptLight3.position.set(4, -2.5, 3.5);
      scene.add(ptLight3);

      const ptLight4 = new THREE.PointLight(0x818cf8, isDark ? 2.4 : 1.6, 10);
      ptLight4.position.set(0, 0, -3.2);
      scene.add(ptLight4);

      // Root scene group for mouse parallax
      const sceneGroup = new THREE.Group();
      scene.add(sceneGroup);

      // 3. Central Glass Orb
      const orbGroup = new THREE.Group();
      sceneGroup.add(orbGroup);

      if (isDark) {
        const interiorLight = new THREE.PointLight(0xc084fc, 3.5, 3.8);
        interiorLight.position.set(0, 0, -0.35);
        orbGroup.add(interiorLight);
      }

      // Outer 3D Glass Bubble
      const sphereGeo = new THREE.SphereGeometry(1.5, 64, 64);
      const sphereMat = new THREE.MeshPhysicalMaterial({
        color: isDark ? 0xede9fe : 0xffffff,
        roughness: 0.06,
        transmission: 0.92,
        thickness: 0.9,
        ior: 1.48,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      });
      const glassMesh = new THREE.Mesh(sphereGeo, sphereMat);
      glassMesh.renderOrder = 10;
      orbGroup.add(glassMesh);

      // 4. Logo Mesh inside Glass Orb
      const planeWidth = 1.95;
      const planeHeight = planeWidth / (554 / 388); // ~1.365
      const logoGeo = new THREE.PlaneGeometry(planeWidth, planeHeight);

      const fallbackTex = createFallbackLogoTexture();
      const logoMat = new THREE.MeshStandardMaterial({
        map: fallbackTex,
        transparent: true,
        alphaTest: 0.01,
        roughness: 0.15,
        metalness: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
        emissive: isDark ? 0xa855f7 : 0x000000,
        emissiveIntensity: isDark ? 0.45 : 0,
      });
      const logoMesh = new THREE.Mesh(logoGeo, logoMat);
      logoMesh.position.set(0, 0, 0.05);
      logoMesh.renderOrder = 1;
      orbGroup.add(logoMesh);

      // Load texture safely without throwing
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        LOGO_ASSET_PATH,
        (loadedTex) => {
          logoMat.map = loadedTex;
          logoMat.needsUpdate = true;
        },
        undefined,
        () => {
          // Fallback to secondary logo or synthesized texture
          textureLoader.load(
            "/logo.png",
            (subTex) => {
              logoMat.map = subTex;
              logoMat.needsUpdate = true;
            },
            undefined,
            () => {
              // Keeps the synthesized fallback texture
            }
          );
        }
      );

      // 5. Orbital Concentric Rings
      const ringsGroup = new THREE.Group();
      sceneGroup.add(ringsGroup);

      // Inner Ring (Indigo)
      const ring1Geo = new THREE.TorusGeometry(2.3, 0.02, 16, 100);
      const ring1Mat = new THREE.MeshBasicMaterial({ color: 0x6366f1, transparent: true, opacity: 0.8 });
      const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
      ring1.rotation.set(Math.PI / 2.7, 0.12, 0);
      ringsGroup.add(ring1);

      // Middle Ring (Purple)
      const ring2Geo = new THREE.TorusGeometry(2.95, 0.016, 16, 100);
      const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.68 });
      const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
      ring2.rotation.set(Math.PI / 2.5, -0.16, 0.08);
      ringsGroup.add(ring2);

      // Outer Ring (Sky Blue)
      const ring3Geo = new THREE.TorusGeometry(3.7, 0.012, 16, 100);
      const ring3Mat = new THREE.MeshBasicMaterial({ color: 0x0ea5e9, transparent: true, opacity: 0.52 });
      const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
      ring3.rotation.set(Math.PI / 2.38, 0.18, -0.06);
      ringsGroup.add(ring3);

      // 6. Satellites & Documents
      const satellitesGroup = new THREE.Group();
      sceneGroup.add(satellitesGroup);

      const docTex1 = createDocTexture("#4f46e5", true);
      const docTex2 = createDocTexture("#7c3aed", false);

      const doc1Geo = new THREE.PlaneGeometry(0.55, 0.7);
      const doc1Mat = new THREE.MeshBasicMaterial({ map: docTex1, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
      const doc1Mesh = new THREE.Mesh(doc1Geo, doc1Mat);
      const doc1Holder = new THREE.Group();
      doc1Holder.add(doc1Mesh);
      satellitesGroup.add(doc1Holder);

      const doc2Geo = new THREE.PlaneGeometry(0.5, 0.65);
      const doc2Mat = new THREE.MeshBasicMaterial({ map: docTex2, transparent: true, opacity: 0.95, side: THREE.DoubleSide });
      const doc2Mesh = new THREE.Mesh(doc2Geo, doc2Mat);
      const doc2Holder = new THREE.Group();
      doc2Holder.add(doc2Mesh);
      satellitesGroup.add(doc2Holder);

      // Metallic Pearl 1 (Royal Blue)
      const pearl1Geo = new THREE.SphereGeometry(0.2, 24, 24);
      const pearl1Mat = new THREE.MeshStandardMaterial({ color: 0x4f46e5, metalness: 0.5, roughness: 0.15 });
      const pearl1Mesh = new THREE.Mesh(pearl1Geo, pearl1Mat);
      const pearl1Holder = new THREE.Group();
      pearl1Holder.add(pearl1Mesh);
      satellitesGroup.add(pearl1Holder);

      // Metallic Pearl 2 (Purple)
      const pearl2Geo = new THREE.SphereGeometry(0.18, 24, 24);
      const pearl2Mat = new THREE.MeshStandardMaterial({ color: 0x9333ea, metalness: 0.5, roughness: 0.15 });
      const pearl2Mesh = new THREE.Mesh(pearl2Geo, pearl2Mat);
      const pearl2Holder = new THREE.Group();
      pearl2Holder.add(pearl2Mesh);
      satellitesGroup.add(pearl2Holder);

      // Metallic Pearl 3 (Emerald Verified)
      const pearl3Geo = new THREE.SphereGeometry(0.15, 24, 24);
      const pearl3Mat = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.5, roughness: 0.15 });
      const pearl3Mesh = new THREE.Mesh(pearl3Geo, pearl3Mat);
      const pearl3Holder = new THREE.Group();
      pearl3Holder.add(pearl3Mesh);
      satellitesGroup.add(pearl3Holder);

      // 7. Mouse Parallax Tracking
      let targetRotX = 0;
      let targetRotY = 0;

      const handlePointerMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const normY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        targetRotY = normX * 0.45;
        targetRotX = -normY * 0.35;
      };

      const handlePointerLeave = () => {
        targetRotX = 0;
        targetRotY = 0;
      };

      container.addEventListener("mousemove", handlePointerMove);
      container.addEventListener("mouseleave", handlePointerLeave);

      // 8. Resize Observer
      const handleResize = () => {
        if (!container || !renderer) return;
        const w = container.clientWidth || 400;
        const h = container.clientHeight || 340;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", handleResize);

      // Helper function to position orbiting satellites
      const updateOrbitItem = (
        holder: THREE.Group,
        time: number,
        speed: number,
        radius: number,
        tiltX: number,
        tiltY: number,
        initialAngle: number,
        bobSpeed: number
      ) => {
        const theta = initialAngle + time * speed;
        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;
        const y = Math.sin(time * bobSpeed + initialAngle) * 0.22;

        const pos = new THREE.Vector3(x, y, z);
        pos.applyAxisAngle(new THREE.Vector3(1, 0, 0), tiltX);
        pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), tiltY);

        holder.position.copy(pos);
        holder.quaternion.copy(camera.quaternion);
      };

      // 9. Animation Loop
      const clock = new THREE.Clock();

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        const delta = Math.min(clock.getDelta(), 0.1);
        const t = clock.getElapsedTime();

        // Orb floating & breathing
        orbGroup.position.y = Math.sin(t * 1.3) * 0.08;
        logoMesh.rotation.y = Math.sin(t * 0.8) * 0.06;

        // Rings rotation
        ringsGroup.rotation.z = t * 0.05;

        // Orbiting items
        updateOrbitItem(doc1Holder, t, 0.48, 2.7, Math.PI / 2.7, 0.12, 0.8, 1.2);
        updateOrbitItem(doc2Holder, t, 0.38, 3.25, Math.PI / 2.5, -0.16, 3.6, 1.4);
        updateOrbitItem(pearl1Holder, t, 0.58, 2.3, Math.PI / 2.7, 0.12, 2.4, 1.8);
        updateOrbitItem(pearl2Holder, t, 0.42, 2.95, Math.PI / 2.5, -0.16, 1.4, 1.5);
        updateOrbitItem(pearl3Holder, t, 0.52, 2.85, Math.PI / 2.6, 0.06, 5.2, 1.6);

        // Smooth mouse parallax lerp
        sceneGroup.position.y = Math.sin(t * 1.2) * 0.08;
        sceneGroup.rotation.y = THREE.MathUtils.damp(sceneGroup.rotation.y, targetRotY, 4, delta);
        sceneGroup.rotation.x = THREE.MathUtils.damp(sceneGroup.rotation.x, targetRotX, 4, delta);

        if (renderer) {
          renderer.render(scene, camera);
        }
      };

      animate();

      // Cleanup
      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener("resize", handleResize);
        container.removeEventListener("mousemove", handlePointerMove);
        container.removeEventListener("mouseleave", handlePointerLeave);

        // Geometries disposal
        sphereGeo.dispose();
        logoGeo.dispose();
        ring1Geo.dispose();
        ring2Geo.dispose();
        ring3Geo.dispose();
        doc1Geo.dispose();
        doc2Geo.dispose();
        pearl1Geo.dispose();
        pearl2Geo.dispose();
        pearl3Geo.dispose();

        // Materials & Textures disposal
        sphereMat.dispose();
        logoMat.dispose();
        ring1Mat.dispose();
        ring2Mat.dispose();
        ring3Mat.dispose();
        doc1Mat.dispose();
        doc2Mat.dispose();
        pearl1Mat.dispose();
        pearl2Mat.dispose();
        pearl3Mat.dispose();
        fallbackTex.dispose();
        docTex1.dispose();
        docTex2.dispose();

        if (renderer) {
          renderer.dispose();
        }
      };
    } catch (e) {
      console.warn("Failed to initialize WebGL scene:", e);
      if (renderer) {
        try {
          (renderer as THREE.WebGLRenderer).dispose();
        } catch {}
      }
    }
  }, [isDark]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[280px] sm:h-[320px] lg:h-[360px] flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing ${className}`}
      aria-label="3D Interactive Baton Knowledge Orb"
    >
      {/* Ambient Radial Aura */}
      <div className="absolute inset-0 pointer-events-none opacity-80">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-200/40 dark:bg-purple-600/25 rounded-full blur-3xl transition-colors duration-500" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-200/40 dark:bg-indigo-600/25 rounded-full blur-2xl transition-colors duration-500" />
      </div>

      <canvas
        ref={canvasRef}
        className="relative z-10 w-full h-full select-none"
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. Exported Main ThreeHeroNode Component
// ---------------------------------------------------------------------------

export const ThreeHeroNode: React.FC<ThreeHeroNodeProps> = ({ className = "" }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Check WebGL availability safely on mount
  const [webglAvailable, setWebglAvailable] = useState<boolean>(true);

  useEffect(() => {
    setWebglAvailable(isWebGLAvailable());
  }, []);

  if (!webglAvailable) {
    return <FallbackHero className={className} isDark={isDark} />;
  }

  return (
    <ThreeErrorBoundary fallback={<FallbackHero className={className} isDark={isDark} />}>
      <ThreeCanvasView isDark={isDark} className={className} />
    </ThreeErrorBoundary>
  );
};

export default ThreeHeroNode;
