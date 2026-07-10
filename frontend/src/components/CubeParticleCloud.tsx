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
  cubeCount = 280,
  color = "#4da6ff",
  scrollTarget
}: CubeParticleCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 90);
    camera.position.set(0, 0.15, 8.4);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true
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
    const maxScatterDistance = 5.4;
    const gridSize = Math.max(5, Math.ceil(Math.cbrt(cubeCount)));
    const gridSpacing = 0.45;
    const gridOffset = (gridSize - 1) / 2;
    const gridPositions: THREE.Vector3[] = [];

    for (let x = 0; x < gridSize; x += 1) {
      for (let y = 0; y < gridSize; y += 1) {
        for (let z = 0; z < gridSize; z += 1) {
          gridPositions.push(
            new THREE.Vector3(
              (x - gridOffset) * gridSpacing,
              (y - gridOffset) * gridSpacing,
              (z - gridOffset) * gridSpacing
            )
          );
        }
      }
    }

    shuffle(gridPositions);

    for (let index = 0; index < Math.min(cubeCount, gridPositions.length); index += 1) {
      const rawGridPosition = gridPositions[index];
      const gridPosition = rawGridPosition.clone();
      gridPosition.y *= 0.86;
      gridPosition.x += (Math.random() - 0.5) * 0.035;
      gridPosition.y += (Math.random() - 0.5) * 0.035;
      gridPosition.z += (Math.random() - 0.5) * 0.035;

      const direction = rawGridPosition.lengthSq() > 0 ? rawGridPosition.clone().normalize() : randomDirection();
      const coreParticle = Math.random() < 0.58;
      const displacement = coreParticle ? 0.2 + Math.random() * 0.75 : 1.15 + Math.random() * 3.1;
      const randomDrift = randomDirection().multiplyScalar(
        coreParticle ? 0.2 + Math.random() * 0.42 : 0.55 + Math.random() * 1.55
      );

      // Kepadatan gumpalan: posisi grid membentuk kubus besar dulu, lalu scatterPosition
      // membuat sebagian kubus tetap dekat core dan sebagian lain terlempar seperti rubik pecah.
      const scatterPosition = rawGridPosition
        .clone()
        .add(direction.multiplyScalar(displacement))
        .add(randomDrift);
      scatterPosition.y *= 0.72 + Math.random() * 0.16;
      scatterPosition.x += (Math.random() - 0.5) * 0.34;
      scatterPosition.z += (Math.random() - 0.5) * 0.42;

      const scatterDistance = Math.min(scatterPosition.length(), maxScatterDistance);
      const cubeSize = 0.12 + Math.random() * 0.2 + (coreParticle ? 0.035 : 0);
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
      cubeGroup.scale.setScalar(cubeSize * 0.72);
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
      const progress = scrollProgress.value;
      const reveal = smoothstep(0.24, 0.4, progress);
      const explode = smoothstep(0.45, 0.68, progress);
      const operatingBlend = smoothstep(0.72, 0.9, progress);
      const cardZoom = smoothstep(0.58, 0.74, progress) * (1 - smoothstep(0.84, 0.94, progress));
      const fadeOut = 1 - smoothstep(0.82, 0.94, progress);
      const visibility = reveal * fadeOut;
      const zoomScale = 0.72 + reveal * 0.22 + explode * 0.52 + cardZoom * 0.62;

      smoothPointer.x += (pointer.x - smoothPointer.x) * 0.045;
      smoothPointer.y += (pointer.y - smoothPointer.y) * 0.045;

      // Kecepatan animasi gumpalan: nilai ini mengatur auto-rotate sumbu Y.
      group.rotation.y += delta * (0.055 + reveal * 0.085);
      group.rotation.x += (smoothPointer.y * 0.16 - group.rotation.x) * 0.035;
      group.rotation.z += (-smoothPointer.x * 0.042 - group.rotation.z) * 0.035;
      group.position.x += (smoothPointer.x * (0.1 + explode * 0.18) - group.position.x) * 0.045;
      group.position.y += (smoothPointer.y * 0.08 - operatingBlend * 0.12 - group.position.y) * 0.045;
      group.scale.setScalar(zoomScale);

      tempColor.copy(edgeColor).lerp(edgeBlendColor, operatingBlend * 0.68);
      tempSolidColor.copy(solidColor).lerp(solidBlendColor, operatingBlend);

      particles.forEach((particle) => {
        particle.group.visible = visibility > 0.006;

        displayPosition.copy(particle.gridPosition).lerp(particle.scatterPosition, explode);
        particle.group.position.x = displayPosition.x + Math.sin(elapsed * 0.32 + particle.phase) * 0.018;
        particle.group.position.y =
          displayPosition.y + Math.sin(elapsed * particle.floatSpeed + particle.phase) * particle.floatAmplitude;
        particle.group.position.z = displayPosition.z + Math.cos(elapsed * 0.28 + particle.phase) * 0.026;
        const spin = 0.18 + explode * 0.9;
        particle.group.rotation.set(
          THREE.MathUtils.lerp(particle.gridRotation.x, particle.scatterRotation.x, explode) + elapsed * particle.rotationSpeed.x * spin,
          THREE.MathUtils.lerp(particle.gridRotation.y, particle.scatterRotation.y, explode) + elapsed * particle.rotationSpeed.y * spin,
          THREE.MathUtils.lerp(particle.gridRotation.z, particle.scatterRotation.z, explode) + elapsed * particle.rotationSpeed.z * spin
        );
        particle.group.scale.setScalar(particle.baseScale * (0.72 + reveal * 0.2 + Math.sin(elapsed * 0.9 + particle.phase) * 0.03));

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
        particle.solidMaterial.opacity = visibility * THREE.MathUtils.clamp(0.34 + brightness * 0.32, 0.38, 0.68);
        particle.edgeMaterial.opacity = visibility * THREE.MathUtils.clamp(0.34 + brightness * 0.66, 0.6, 1);
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
