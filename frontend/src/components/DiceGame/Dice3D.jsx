import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// CSS Fallback dice face patterns
const DICE_DOTS = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]]
};

// CSS Fallback Component - only used when WebGL completely fails
function CssDiceFallback({ value, size, rolling }) {
  const dots = DICE_DOTS[value] || DICE_DOTS[1];
  const dotSize = size / 6;
  const padding = size / 8;

  return (
    <div
      className={`css-dice-fallback ${rolling ? 'rolling' : ''}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #1e3a5f, #0f172a)',
        border: '3px solid #3b82f6',
        borderRadius: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        padding: padding,
        boxSizing: 'border-box',
        margin: '1rem auto',
        position: 'relative'
      }}
    >
      {[0, 1, 2].map(row =>
        [0, 1, 2].map(col => {
          const hasDot = dots.some(([r, c]) => r === row && c === col);
          return (
            <div
              key={`${row}-${col}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {hasDot && (
                <div
                  style={{
                    width: dotSize,
                    height: dotSize,
                    background: '#fff',
                    borderRadius: '50%',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}
                />
              )}
            </div>
          );
        })
      )}
      <style>{`
        .css-dice-fallback.rolling {
          animation: diceSpin 0.3s linear infinite;
        }
        @keyframes diceSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Dice face rotations to show specific numbers on top
// Material mapping: [+X=1, -X=6, +Y=3, -Y=4, +Z=2, -Z=5]
const DICE_ROTATIONS = {
  1: { x: 0, y: 0, z: Math.PI / 2 },
  2: { x: -Math.PI / 2, y: 0, z: 0 },
  3: { x: 0, y: 0, z: 0 },
  4: { x: Math.PI, y: 0, z: 0 },
  5: { x: Math.PI / 2, y: 0, z: 0 },
  6: { x: 0, y: 0, z: -Math.PI / 2 }
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
  const [webglFailed, setWebglFailed] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [displayValue, setDisplayValue] = useState(targetValue || 1);
  const rollIntervalRef = useRef(null);

  // Update display value when targetValue changes
  useEffect(() => {
    if (targetValue) {
      setDisplayValue(targetValue);
    }
  }, [targetValue]);

  // Handle rolling animation for CSS fallback
  useEffect(() => {
    if (webglFailed && rolling) {
      const interval = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [webglFailed, rolling]);

  // Initialize Three.js scene
  useEffect(() => {
    // Skip if already failed
    if (webglFailed) return;

    const container = containerRef.current;
    if (!container) return;

    // Clean up any existing content
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Check WebGL support
    let gl = null;
    try {
      const testCanvas = document.createElement('canvas');
      gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        console.warn('WebGL not supported, using CSS fallback');
        setWebglFailed(true);
        return;
      }
    } catch (e) {
      console.warn('WebGL check failed:', e);
      setWebglFailed(true);
      return;
    }

    let scene, camera, renderer, dice, world, body, materials, geometry;
    let animationId = null;

    try {
      // Scene
      scene = new THREE.Scene();

      // Camera
      camera = new THREE.PerspectiveCamera(topDown ? 40 : 50, 1, 0.1, 100);
      if (topDown) {
        camera.position.set(0, 3.5, 1.2);
      } else {
        camera.position.set(0, 2.5, 2.5);
      }
      camera.lookAt(0, 0, 0);

      // Renderer with explicit context attributes
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'default',
        failIfMajorPerformanceCaveat: false
      });
      renderer.setSize(size, size);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.setClearColor(0x000000, 0);

      // Add canvas to container
      container.appendChild(renderer.domElement);

      // Verify canvas was added
      if (!container.contains(renderer.domElement)) {
        throw new Error('Failed to append renderer canvas');
      }

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

      // Create dice materials with textures
      materials = [
        new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(createFaceTexture(1)), roughness: 0.3 }),
        new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(createFaceTexture(6)), roughness: 0.3 }),
        new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(createFaceTexture(3)), roughness: 0.3 }),
        new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(createFaceTexture(4)), roughness: 0.3 }),
        new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(createFaceTexture(2)), roughness: 0.3 }),
        new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(createFaceTexture(5)), roughness: 0.3 })
      ];

      geometry = new THREE.BoxGeometry(1, 1, 1);
      dice = new THREE.Mesh(geometry, materials);
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
      world = new CANNON.World();
      world.gravity.set(0, -20, 0);

      // Dice physics body
      body = new CANNON.Body({
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
        geometry
      };

      // Animation loop - only steps physics when rolling
      let lastTime = performance.now();
      let isRolling = rolling; // Track rolling state for animation loop

      const animate = () => {
        animationId = requestAnimationFrame(animate);

        const now = performance.now();
        const delta = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;

        // Only step physics when rolling
        if (isRolling) {
          world.step(delta);
          // Sync mesh with physics body
          dice.position.copy(body.position);
          dice.quaternion.copy(body.quaternion);
        }

        renderer.render(scene, camera);
      };

      // Store function to update rolling state from outside
      sceneDataRef.current.setRolling = (val) => { isRolling = val; };

      animate();
      setIsInitialized(true);

      // If we have a target value and not rolling, set initial static position
      if (targetValue && !rolling) {
        const rotation = DICE_ROTATIONS[targetValue];
        if (rotation) {
          // Stop physics completely
          body.velocity.set(0, 0, 0);
          body.angularVelocity.set(0, 0, 0);
          body.position.set(0, 0, 0);
          body.sleep(); // Put body to sleep

          // Set rotation directly on both body and mesh
          const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z);
          const quat = new THREE.Quaternion().setFromEuler(euler);
          body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
          dice.position.set(0, 0, 0);
          dice.quaternion.copy(quat);
        }
      }

    } catch (e) {
      console.error('THREE.js initialization failed:', e);
      setWebglFailed(true);
      return;
    }

    // Cleanup function
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (renderer) {
        renderer.dispose();
        if (container && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      }
      if (geometry) {
        geometry.dispose();
      }
      if (materials) {
        materials.forEach(m => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
      sceneDataRef.current = null;
      setIsInitialized(false);
    };
  }, [size, topDown, webglFailed]);

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
    if (rollIntervalRef.current) {
      clearInterval(rollIntervalRef.current);
    }

    throwDice();

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

  // Handle rolling state changes
  useEffect(() => {
    if (!isInitialized || !sceneDataRef.current) return;

    // Update the animation loop's rolling state
    if (sceneDataRef.current.setRolling) {
      sceneDataRef.current.setRolling(rolling);
    }

    if (rolling) {
      // Wake up the physics body when starting to roll
      if (sceneDataRef.current.body) {
        sceneDataRef.current.body.wakeUp();
      }
      startContinuousRoll();
      return () => stopContinuousRoll();
    } else {
      stopContinuousRoll();
      // Put body to sleep when not rolling
      if (sceneDataRef.current.body) {
        sceneDataRef.current.body.sleep();
      }
    }
  }, [rolling, isInitialized, startContinuousRoll, stopContinuousRoll]);

  // Settle to target value when rolling stops
  useEffect(() => {
    if (!rolling && targetValue && isInitialized && sceneDataRef.current) {
      const timeout = setTimeout(() => {
        settleDice(targetValue);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [rolling, targetValue, isInitialized, settleDice]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (rollIntervalRef.current) {
        clearInterval(rollIntervalRef.current);
      }
    };
  }, []);

  // Use CSS fallback only if WebGL failed
  if (webglFailed) {
    return <CssDiceFallback value={displayValue} size={size} rolling={rolling} />;
  }

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
