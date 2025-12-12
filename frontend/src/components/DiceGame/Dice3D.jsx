import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Dice face rotations to show specific numbers on top
// Material mapping: [+X=1, -X=6, +Y=3, -Y=4, +Z=2, -Z=5]
// So by default (no rotation), 3 is on top (+Y)
// To show other numbers, we rotate appropriately
const DICE_ROTATIONS = {
  1: { x: 0, y: 0, z: Math.PI / 2 },       // Rotate +X (1) to top
  2: { x: -Math.PI / 2, y: 0, z: 0 },      // Rotate +Z (2) to top
  3: { x: 0, y: 0, z: 0 },                  // 3 already on top (+Y)
  4: { x: Math.PI, y: 0, z: 0 },            // Rotate -Y (4) to top (flip upside down)
  5: { x: Math.PI / 2, y: 0, z: 0 },        // Rotate -Z (5) to top
  6: { x: 0, y: 0, z: -Math.PI / 2 }        // Rotate -X (6) to top
};

// Create face texture with dots
function createFaceTexture(dots) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Background - dark blue
  ctx.fillStyle = '#1e3a5f';
  ctx.fillRect(0, 0, 128, 128);

  // Border
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 120, 120);

  // Dots positions for each face value
  const dotPositions = {
    1: [[64, 64]],
    2: [[32, 96], [96, 32]],
    3: [[32, 96], [64, 64], [96, 32]],
    4: [[32, 32], [96, 32], [32, 96], [96, 96]],
    5: [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]],
    6: [[32, 32], [96, 32], [32, 64], [96, 64], [32, 96], [96, 96]]
  };

  // Draw white dots
  ctx.fillStyle = '#ffffff';
  dotPositions[dots].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  });

  return canvas;
}

function Dice3D({ rolling, targetValue, onRollComplete, size = 200, topDown = false }) {
  const containerRef = useRef(null);
  const sceneDataRef = useRef(null);

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clean up any existing canvas
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Check WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    // Scene
    const scene = new THREE.Scene();

    // Camera - looking down at dice
    const camera = new THREE.PerspectiveCamera(topDown ? 40 : 50, 1, 0.1, 100);
    if (topDown) {
      // More top-down view, zoomed in on the top face
      camera.position.set(0, 3.5, 1.2);
    } else {
      camera.position.set(0, 2.5, 2.5);
    }
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const blueLight = new THREE.PointLight(0x3b82f6, 0.5, 10);
    blueLight.position.set(-2, 3, 2);
    scene.add(blueLight);

    // Create dice with textured faces
    const materials = [
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(createFaceTexture(1)), roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(createFaceTexture(6)), roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(createFaceTexture(3)), roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(createFaceTexture(4)), roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(createFaceTexture(2)), roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(createFaceTexture(5)), roughness: 0.3 })
    ];

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const dice = new THREE.Mesh(geometry, materials);
    dice.castShadow = true;
    dice.position.set(0, 0, 0);
    scene.add(dice);

    // Ground plane for shadow
    const groundGeo = new THREE.PlaneGeometry(10, 10);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
    ground.receiveShadow = true;
    scene.add(ground);

    // Physics world
    const world = new CANNON.World();
    world.gravity.set(0, -20, 0);

    // Dice physics body
    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)),
      linearDamping: 0.4,
      angularDamping: 0.4
    });
    body.position.set(0, 0, 0);
    world.addBody(body);

    // Ground physics body
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane()
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    groundBody.position.y = -0.6;
    world.addBody(groundBody);

    // Store references
    sceneDataRef.current = {
      scene,
      camera,
      renderer,
      dice,
      world,
      body,
      materials,
      geometry,
      animationId: null
    };

    // Animation loop
    let lastTime = performance.now();

    const animate = () => {
      const animId = requestAnimationFrame(animate);
      if (sceneDataRef.current) {
        sceneDataRef.current.animationId = animId;
      }

      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Step physics
      world.step(delta);

      // Sync mesh with physics body
      dice.position.copy(body.position);
      dice.quaternion.copy(body.quaternion);

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      if (sceneDataRef.current?.animationId) {
        cancelAnimationFrame(sceneDataRef.current.animationId);
      }
      renderer.dispose();
      geometry.dispose();
      materials.forEach(m => {
        m.map?.dispose();
        m.dispose();
      });
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneDataRef.current = null;
    };
  }, [size, topDown]);

  // Continuous roll interval ref
  const rollIntervalRef = useRef(null);

  // Roll dice function - single throw
  const throwDice = useCallback(() => {
    const data = sceneDataRef.current;
    if (!data) return;

    const { body } = data;

    // Start from above
    body.position.set(
      (Math.random() - 0.5) * 0.3,
      2,
      (Math.random() - 0.5) * 0.3
    );

    // Random rotation
    body.quaternion.setFromEuler(
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    );

    // Throw with velocity and spin
    body.velocity.set(
      (Math.random() - 0.5) * 2,
      -5,
      (Math.random() - 0.5) * 2
    );

    body.angularVelocity.set(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20
    );

    body.wakeUp();
  }, []);

  // Start continuous rolling
  const startContinuousRoll = useCallback(() => {
    // Clear any existing interval
    if (rollIntervalRef.current) {
      clearInterval(rollIntervalRef.current);
    }

    // Initial throw
    throwDice();

    // Re-throw every 1.2 seconds to keep dice bouncing
    rollIntervalRef.current = setInterval(() => {
      throwDice();
    }, 1200);
  }, [throwDice]);

  // Stop continuous rolling
  const stopContinuousRoll = useCallback(() => {
    if (rollIntervalRef.current) {
      clearInterval(rollIntervalRef.current);
      rollIntervalRef.current = null;
    }
  }, []);

  // Settle dice to show target value
  const settleDice = useCallback((value) => {
    const data = sceneDataRef.current;
    if (!data || !value) return;

    const { body, dice } = data;
    const rotation = DICE_ROTATIONS[value];
    if (!rotation) return;

    // Stop physics
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.position.set(0, 0, 0);

    // Set rotation to show target value
    const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z);
    const quat = new THREE.Quaternion().setFromEuler(euler);
    body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    dice.quaternion.copy(quat);

    if (onRollComplete) {
      onRollComplete(value);
    }
  }, [onRollComplete]);

  // Handle rolling state changes - continuous roll until result confirmed
  useEffect(() => {
    if (rolling) {
      // Start continuous rolling animation
      startContinuousRoll();

      // Cleanup on unmount or when rolling stops
      return () => {
        stopContinuousRoll();
      };
    } else {
      // Stop rolling when rolling becomes false
      stopContinuousRoll();
    }
  }, [rolling, startContinuousRoll, stopContinuousRoll]);

  // Settle to target value when it's confirmed (rolling stops and targetValue is set)
  useEffect(() => {
    if (!rolling && targetValue && sceneDataRef.current) {
      // Small delay before settling for visual effect
      const timeout = setTimeout(() => {
        settleDice(targetValue);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [rolling, targetValue, settleDice]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="dice-3d-container"
      style={{
        width: size,
        height: size,
        margin: '1rem auto',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.2) 0%, transparent 70%)',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}
    />
  );
}

export default Dice3D;
