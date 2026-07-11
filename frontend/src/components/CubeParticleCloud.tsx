import { useEffect, useRef } from "react";
import * as THREE from "three";

type CubeParticleCloudProps = {
  className?: string;
  cubeCount?: number;
  color?: string;
  scrollTarget?: string;
};

type CubeParticle = {
  group: THREE.Group;
  mesh: THREE.Mesh;
  solidMaterial: THREE.MeshBasicMaterial;
  edgeMaterial: THREE.LineBasicMaterial;
  gridPosition: THREE.Vector3;
  scatterPosition: THREE.Vector3;
  gridRotation: THREE.Vector3;
  scatterRotation: THREE.Vector3;
  scatterDistance: number;
  phase: number;
  floatSpeed: number;
  floatAmplitude: number;
  rotationSpeed: THREE.Vector3;
  opacityJitter: number;
  baseScale: number;
};

export function CubeParticleCloud({
  className = "",
  cubeCount = 520,
  color = "#4da6ff",
  scrollTarget
}: CubeParticleCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 160);
    camera.position.set(0, 0.04, 7.4);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false
    });
    renderer.setClearColor(0x000000, 0);
    renderer.sortObjects = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const edgeGeometry = new THREE.EdgesGeometry(boxGeometry);
    const particles: CubeParticle[] = [];
    const edgeColor = new THREE.Color(color);
    const edgeBlendColor = new THREE.Color("#164c77");
    const solidColor = new THREE.Color("#01040a");
    const solidBlendColor = new THREE.Color("#05070d");
    const tempColor = new THREE.Color();
    const tempSolidColor = new THREE.Color();
    const maxScatterDistance = 7.4;
    const gridSize = Math.max(7, Math.ceil(Math.cbrt(cubeCount)));
    const gridSpacing = 0.36;
    const verticalSpacing = 0.36;
    const gridOffset = (gridSize - 1) / 2;
    const gridPositions: THREE.Vector3[] = [];

    for (let x = 0; x < gridSize; x += 1) {
      for (let y = 0; y < gridSize; y += 1) {
        for (let z = 0; z < gridSize; z += 1) {
          const height01 = y / Math.max(1, gridSize - 1);
          const taper = 1.48 - height01 * 0.62;
          const sideNoise = 0.92 + Math.random() * 0.18;
          gridPositions.push(
            new THREE.Vector3(
              (x - gridOffset) * gridSpacing * taper * sideNoise,
              (y - gridOffset) * verticalSpacing - 0.34,
              (z - gridOffset) * gridSpacing * taper * sideNoise
            )
          );
        }
      }
    }

    const shellPositions = gridPositions.filter((position) => {
      const normalizedX = Math.abs(position.x / gridSpacing);
      const normalizedY = Math.abs(position.y / gridSpacing);
      const normalizedZ = Math.abs(position.z / gridSpacing);
      return Math.max(normalizedX, normalizedY, normalizedZ) >= gridOffset - 0.75;
    });
    const innerPositions = gridPositions.filter((position) => !shellPositions.includes(position));
    shuffle(shellPositions);
    shuffle(innerPositions);
    gridPositions.splice(0, gridPositions.length, ...shellPositions, ...innerPositions);

    for (let index = 0; index < Math.min(cubeCount, gridPositions.length); index += 1) {
      const rawGridPosition = gridPositions[index];
      const gridPosition = rawGridPosition.clone();
      gridPosition.y *= 1.04;
      gridPosition.x += (Math.random() - 0.5) * 0.055;
      gridPosition.y += (Math.random() - 0.5) * 0.05;
      gridPosition.z += (Math.random() - 0.5) * 0.055;

      const direction = rawGridPosition.lengthSq() > 0 ? rawGridPosition.clone().normalize() : randomDirection();
      const coreParticle = Math.random() < 0.52;
      const displacement = coreParticle ? 0.38 + Math.random() * 0.82 : 1.35 + Math.random() * 3.0;
      const randomDrift = randomDirection().multiplyScalar(
        coreParticle ? 0.26 + Math.random() * 0.62 : 0.68 + Math.random() * 1.7
      );

      // Kepadatan gumpalan: posisi grid membentuk kubus besar dulu, lalu scatterPosition
      // membuat sebagian kubus tetap dekat core dan sebagian lain terlempar seperti rubik pecah.
      const scatterPosition = rawGridPosition
        .clone()
        .add(direction.multiplyScalar(displacement))
        .add(randomDrift);
      scatterPosition.y *= 0.82 + Math.random() * 0.18;
      scatterPosition.x += (Math.random() - 0.5) * 0.55;
      scatterPosition.z += (Math.random() - 0.5) * 0.7;

      const scatterDistance = Math.min(scatterPosition.length(), maxScatterDistance);
      const heroBlock = Math.random() < 0.08;
      const cubeSize = heroBlock
        ? 0.24 + Math.random() * 0.26
        : 0.11 + Math.random() * 0.15 + (coreParticle ? 0.035 : 0);
      const solidMaterial = new THREE.MeshBasicMaterial({
        color: solidColor,
        transparent: true,
        opacity: 0,
        depthWrite: true,
        depthTest: true,
        blending: THREE.NormalBlending,
        toneMapped: false
      });
      const edgeMaterial = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      });
      const cubeGroup = new THREE.Group();
      const mesh = new THREE.Mesh(boxGeometry, solidMaterial);
      const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      const gridRotation = new THREE.Vector3(
        (Math.random() - 0.5) * 0.04,
        (Math.random() - 0.5) * 0.04,
        (Math.random() - 0.5) * 0.04
      );
      const scatterRotation = new THREE.Vector3(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

      mesh.renderOrder = 1;
      edges.renderOrder = 2;
      cubeGroup.add(mesh);
      cubeGroup.add(edges);
      cubeGroup.position.copy(gridPosition);
      cubeGroup.scale.setScalar(cubeSize * 0.76);
      cubeGroup.rotation.set(gridRotation.x, gridRotation.y, gridRotation.z);
      cubeGroup.visible = false;
      group.add(cubeGroup);

      particles.push({
        group: cubeGroup,
        mesh,
        solidMaterial,
        edgeMaterial,
        gridPosition,
        scatterPosition,
        gridRotation,
        scatterRotation,
        scatterDistance,
        phase: Math.random() * Math.PI * 2,
        floatSpeed: 0.42 + Math.random() * 0.68,
        floatAmplitude: 0.018 + Math.random() * 0.07,
        // Kecepatan animasi kubus individu: kecilkan angka ini kalau rotasi ingin lebih kalem.
        rotationSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.22,
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.18
        ),
        opacityJitter: 0.78 + Math.random() * 0.38,
        baseScale: cubeSize
      });
    }

    const pointer = { x: 0, y: 0 };
    const smoothPointer = { x: 0, y: 0 };
    const scrollProgress = { value: 0 };
    const smoothProgress = { value: 0 };
    const clock = new THREE.Clock();
    const worldPosition = new THREE.Vector3();
    const displayPosition = new THREE.Vector3();
    let frameId = 0;

    const updateScrollProgress = () => {
      const target =
        (scrollTarget ? document.querySelector<HTMLElement>(scrollTarget) : null) ??
        container.closest<HTMLElement>("section") ??
        container.parentElement;
      if (!target) {
        scrollProgress.value = 0;
        return;
      }

      const rect = target.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      scrollProgress.value = THREE.MathUtils.clamp(-rect.top / travel, 0, 1);
    };

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      updateScrollProgress();
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      pointer.x = ((event.clientX - rect.left) / width - 0.5) * 2;
      pointer.y = -((event.clientY - rect.top) / height - 0.5) * 2;
    };

    const resizeObserver =
      "ResizeObserver" in window
        ? new ResizeObserver(resize)
        : null;

    resize();
    updateScrollProgress();
    resizeObserver?.observe(container);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", updateScrollProgress, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.04);
      const elapsed = clock.elapsedTime;
      const smoothing = 1 - Math.exp(-delta * 7.2);
      smoothProgress.value += (scrollProgress.value - smoothProgress.value) * smoothing;
      const progress = smoothProgress.value;
      const reveal = smoothstep(0.14, 0.22, progress);
      const explode = smoothstep(0.18, 0.34, progress);
      const operatingBlend = smoothstep(0.58, 0.9, progress);
      const cardZoom = smoothstep(0.2, 0.58, progress);
      const fadeOut = 1;
      const visibility = reveal * fadeOut;
      const scrollZoom = smoothstep(0.18, 0.56, progress);
      // Kecepatan animasi scroll utama: pulse membuat kubus besar terasa membesar lalu mengecil.
      const pulsePhase = smoothstep(0.18, 0.74, progress);
      const cubePulse = Math.sin(pulsePhase * Math.PI);
      const zoomScale = 0.98 + reveal * 0.18 + scrollZoom * 0.72 + cubePulse * 0.18;

      camera.position.z = THREE.MathUtils.lerp(7.4, 4.55, scrollZoom);
      camera.position.y = THREE.MathUtils.lerp(0.06, -0.06, scrollZoom);
      const cameraFOV = THREE.MathUtils.lerp(42, 52, smoothstep(0.18, 0.58, progress));
      if (Math.abs(camera.fov - cameraFOV) > 0.08) {
        camera.fov = cameraFOV;
        camera.updateProjectionMatrix();
      }

      smoothPointer.x += (pointer.x - smoothPointer.x) * 0.045;
      smoothPointer.y += (pointer.y - smoothPointer.y) * 0.045;

      // Kecepatan animasi gumpalan: autoYaw memberi flow konstan, pointer cuma jadi bias halus.
      const autoYaw = elapsed * (0.04 + reveal * 0.035);
      group.rotation.y += (autoYaw + smoothPointer.x * 0.12 - group.rotation.y) * 0.028;
      group.rotation.x += (Math.sin(elapsed * 0.22) * 0.055 + smoothPointer.y * 0.1 - group.rotation.x) * 0.035;
      group.rotation.z += (-smoothPointer.x * 0.028 - group.rotation.z) * 0.035;
      group.position.x += (smoothPointer.x * (0.1 + explode * 0.18) - group.position.x) * 0.045;
      group.position.y += (-0.62 + smoothPointer.y * 0.1 - operatingBlend * 0.06 - group.position.y) * 0.045;
      group.position.z += (-cardZoom * 0.82 - group.position.z) * 0.045;
      group.scale.setScalar(zoomScale);

      tempColor.copy(edgeColor).lerp(edgeBlendColor, operatingBlend * 0.68);
      tempSolidColor.copy(solidColor).lerp(solidBlendColor, operatingBlend);

      particles.forEach((particle) => {
        particle.group.visible = visibility > 0.006;

        displayPosition.copy(particle.gridPosition).lerp(particle.scatterPosition, explode * 0.92);
        particle.group.position.x = displayPosition.x + Math.sin(elapsed * 0.32 + particle.phase) * 0.018;
        particle.group.position.y =
          displayPosition.y + Math.sin(elapsed * particle.floatSpeed + particle.phase) * particle.floatAmplitude;
        particle.group.position.z = displayPosition.z + Math.cos(elapsed * 0.28 + particle.phase) * 0.026;
        const spin = 0.16 + explode * 0.22;
        particle.group.rotation.set(
          THREE.MathUtils.lerp(particle.gridRotation.x, particle.scatterRotation.x, explode * 0.18) +
            elapsed * particle.rotationSpeed.x * spin,
          THREE.MathUtils.lerp(particle.gridRotation.y, particle.scatterRotation.y, explode * 0.18) +
            elapsed * particle.rotationSpeed.y * spin,
          THREE.MathUtils.lerp(particle.gridRotation.z, particle.scatterRotation.z, explode * 0.18) +
            elapsed * particle.rotationSpeed.z * spin
        );
        particle.group.scale.setScalar(
          particle.baseScale * (0.82 + reveal * 0.24 + cubePulse * 0.13 + Math.sin(elapsed * 0.9 + particle.phase) * 0.012)
        );

        particle.group.getWorldPosition(worldPosition);
        const depth = THREE.MathUtils.clamp((worldPosition.z + maxScatterDistance) / (maxScatterDistance * 2), 0, 1);
        const edgeFade = 1 - THREE.MathUtils.clamp(particle.scatterDistance / maxScatterDistance, 0, 1);
        const diagonalLight = THREE.MathUtils.clamp(
          0.48 + (-worldPosition.x / maxScatterDistance) * 0.32 + (worldPosition.y / maxScatterDistance) * 0.48,
          0,
          1
        );

        // Kecerahan berdasarkan jarak: kubus dekat kamera lebih terang, sisi jauh lebih redup.
        const brightness = THREE.MathUtils.clamp(
          (0.1 + depth * 0.44 + edgeFade * 0.22 + diagonalLight * 0.28) * particle.opacityJitter,
          0.1,
          1
        );
        particle.solidMaterial.color.copy(tempSolidColor);
        particle.edgeMaterial.color.copy(tempColor);
        particle.solidMaterial.opacity = visibility * THREE.MathUtils.clamp(0.42 + brightness * 0.34, 0.46, 0.78);
        particle.edgeMaterial.opacity = visibility * THREE.MathUtils.clamp(0.46 + brightness * 0.62, 0.68, 1);
      });

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", updateScrollProgress);
      window.removeEventListener("mousemove", handleMouseMove);
      resizeObserver?.disconnect();

      particles.forEach((particle) => {
        group.remove(particle.group);
        particle.group.clear();
        particle.solidMaterial.dispose();
        particle.edgeMaterial.dispose();
      });
      scene.remove(group);
      edgeGeometry.dispose();
      boxGeometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [cubeCount, color, scrollTarget]);

  return <div ref={containerRef} className={className} style={{ height: "100%", pointerEvents: "none", width: "100%" }} aria-hidden="true" />;
}

function randomDirection() {
  const z = Math.random() * 2 - 1;
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(1 - z * z);
  return new THREE.Vector3(radius * Math.cos(angle), z, radius * Math.sin(angle));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function shuffle<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
}
