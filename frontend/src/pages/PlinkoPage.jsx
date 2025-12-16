import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import Matter from 'matter-js';
import { useGameContext } from '../contexts/GameContext';
import { useDemoContext } from '../contexts/DemoContext';
import NeedTickets from '../components/NeedTickets';
import { CURRENT_NETWORK, getContract } from '../config/sui-config';

// Get plinko contract address (null until deployed)
const PLINKO_CONTRACT = getContract('plinko');

const RISK_LEVELS = ['Low', 'Medium', 'High'];
const ROW_OPTIONS = [8, 10, 12];
const BET_PRESETS = [1, 5, 10, 25, 50, 100];

// Physics configuration from reference implementation
const BALL_FRICTIONS = {
  friction: 0.5,
  frictionAirByRowCount: {
    8: 0.0395,
    9: 0.041,
    10: 0.038,
    11: 0.0355,
    12: 0.0414,
    13: 0.0437,
    14: 0.0401,
    15: 0.0418,
    16: 0.0364,
  },
};

// Canvas dimensions (from reference)
const CANVAS = {
  WIDTH: 760,
  HEIGHT: 570,
  PADDING_X: 52,
  PADDING_TOP: 36,
  PADDING_BOTTOM: 28,
};

// Multiplier tables (same as contract, divided by 100)
const MULTIPLIERS = {
  8: {
    0: [5.5, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.5],
    1: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    2: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29]
  },
  10: {
    0: [8, 3, 1.5, 1.1, 1.0, 0.5, 1.0, 1.1, 1.5, 3, 8],
    1: [22, 5, 2, 1.2, 0.6, 0.4, 0.6, 1.2, 2, 5, 22],
    2: [50, 6, 2.5, 1, 0.4, 0.2, 0.4, 1, 2.5, 6, 50]
  },
  12: {
    0: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
    1: [33, 5, 2, 1.4, 0.9, 0.6, 0.4, 0.6, 0.9, 1.4, 2, 5, 33],
    2: [75, 7, 2.5, 1.2, 0.5, 0.3, 0.2, 0.3, 0.5, 1.2, 2.5, 7, 75]
  }
};

// Collision categories
const PIN_CATEGORY = 0x0001;
const BALL_CATEGORY = 0x0002;

function PlinkoPage() {
  // Get settings from context
  const { plinkoSettings } = useGameContext();
  const { isDemoMode, demoBalance, setDemoBalance, realTickets, setRealTickets } = useDemoContext();
  const account = useCurrentAccount();
  const isWalletConnected = !!account;

  // Current balance based on mode
  const currentBalance = isDemoMode ? demoBalance : realTickets;

  const [betAmount, setBetAmount] = useState(10);
  const [rows, setRows] = useState(plinkoSettings?.defaultRows || 10);
  const [risk, setRisk] = useState(plinkoSettings?.defaultRisk || 1);
  const [balance, setBalance] = useState('0');
  const [houseReserve, setHouseReserve] = useState('0');
  const [houseReserveRaw, setHouseReserveRaw] = useState(0);

  const [gameState, setGameState] = useState('idle');
  const [activeGameId, setActiveGameId] = useState(null);
  const [blocksRemaining, setBlocksRemaining] = useState(0);
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [landingSlot, setLandingSlot] = useState(null);

  // Session stats
  const [sessionStats, setSessionStats] = useState({
    wins: 0,
    losses: 0,
    totalProfit: 0,
    profitHistory: [0]
  });

  // Update session stats when a game completes (called after result displays)
  const updateStats = useCallback((profit, isWin) => {
    setSessionStats(prev => {
      const newTotal = prev.totalProfit + profit;
      return {
        wins: prev.wins + (isWin ? 1 : 0),
        losses: prev.losses + (isWin ? 0 : 1),
        totalProfit: newTotal,
        profitHistory: [...prev.profitHistory, newTotal].slice(-20) // Keep last 20 points
      };
    });
  }, []);

  // Track if stats have been updated for current result
  const statsUpdatedRef = useRef(false);

  // Update stats after result is displayed (with delay for visual effect)
  useEffect(() => {
    if (gameState === 'complete' && lastResult && !statsUpdatedRef.current) {
      statsUpdatedRef.current = true;
      // Delay stats update so chart animates after result shows
      const timer = setTimeout(() => {
        updateStats(lastResult.profit, lastResult.win);
      }, 800); // Update after result overlay animation
      return () => clearTimeout(timer);
    }
    // Reset flag when game resets
    if (gameState === 'idle') {
      statsUpdatedRef.current = false;
    }
  }, [gameState, lastResult, updateStats]);

  // Matter.js refs
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const pinsLastRowXCoordsRef = useRef([]);
  const targetSlotRef = useRef(null);
  const ballRef = useRef(null);
  const handleBallEnterBinRef = useRef(null);

  // Recorded paths for realistic playback
  const [recordedPaths, setRecordedPaths] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem(`plinko-paths-${rows}`);
    return saved ? JSON.parse(saved) : {};
  });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const recordingRef = useRef(false);
  const currentPathRef = useRef([]);

  // Get current multipliers (with fallback for safety)
  const validRows = MULTIPLIERS[rows] ? rows : 10;
  const validRisk = MULTIPLIERS[validRows]?.[risk] !== undefined ? risk : 1;
  const multipliers = MULTIPLIERS[validRows][validRisk];
  const slots = validRows + 1;
  const maxMultiplier = Math.max(...multipliers);

  const isBetValid = (amount) => {
    const maxPayout = amount * maxMultiplier;
    return maxPayout <= houseReserveRaw;
  };

  const maxValidBet = houseReserveRaw / maxMultiplier;

  // Calculate pin distance and radius based on row count
  const getPinDistanceX = useCallback((rowCount) => {
    const lastRowPinCount = 3 + rowCount - 1;
    return (CANVAS.WIDTH - CANVAS.PADDING_X * 2) / (lastRowPinCount - 1);
  }, []);

  const getPinRadius = useCallback((rowCount) => {
    return (24 - rowCount) / 2;
  }, []);

  // Initialize Matter.js engine
  const initEngine = useCallback(() => {
    if (!canvasRef.current) return;

    // Clean up existing engine
    if (engineRef.current) {
      Matter.Render.stop(renderRef.current);
      Matter.Runner.stop(runnerRef.current);
      Matter.Engine.clear(engineRef.current);
    }

    const engine = Matter.Engine.create({
      timing: { timeScale: 1 }
    });
    engineRef.current = engine;

    const render = Matter.Render.create({
      engine: engine,
      canvas: canvasRef.current,
      options: {
        width: CANVAS.WIDTH,
        height: CANVAS.HEIGHT,
        background: 'transparent',
        wireframes: false,
      },
    });
    renderRef.current = render;

    const runner = Matter.Runner.create();
    runnerRef.current = runner;

    // Place pins and walls (inlined from reference implementation)
    const pinDistanceX = getPinDistanceX(rows);
    const pinRadius = getPinRadius(rows);
    const pins = [];
    const lastRowXCoords = [];

    for (let row = 0; row < rows; ++row) {
      const rowY = CANVAS.PADDING_TOP +
        ((CANVAS.HEIGHT - CANVAS.PADDING_TOP - CANVAS.PADDING_BOTTOM) / (rows - 1)) * row;
      const rowPaddingX = CANVAS.PADDING_X + ((rows - 1 - row) * pinDistanceX) / 2;

      for (let col = 0; col < 3 + row; ++col) {
        const colX = rowPaddingX + ((CANVAS.WIDTH - rowPaddingX * 2) / (3 + row - 1)) * col;
        const pin = Matter.Bodies.circle(colX, rowY, pinRadius, {
          isStatic: true,
          render: { fillStyle: '#3b82f6' },
          collisionFilter: {
            category: PIN_CATEGORY,
            mask: BALL_CATEGORY,
          },
        });
        pins.push(pin);

        if (row === rows - 1) {
          lastRowXCoords.push(colX);
        }
      }
    }
    Matter.Composite.add(engine.world, pins);
    pinsLastRowXCoordsRef.current = lastRowXCoords;

    // Create angled walls
    const firstPinX = pins[0].position.x;
    const leftWallAngle = Math.atan2(
      firstPinX - lastRowXCoords[0],
      CANVAS.HEIGHT - CANVAS.PADDING_TOP - CANVAS.PADDING_BOTTOM
    );
    const leftWallX = firstPinX - (firstPinX - lastRowXCoords[0]) / 2 - pinDistanceX * 0.25;

    const leftWall = Matter.Bodies.rectangle(
      leftWallX,
      CANVAS.HEIGHT / 2,
      10,
      CANVAS.HEIGHT,
      {
        isStatic: true,
        angle: leftWallAngle,
        render: { visible: false },
      }
    );
    const rightWall = Matter.Bodies.rectangle(
      CANVAS.WIDTH - leftWallX,
      CANVAS.HEIGHT / 2,
      10,
      CANVAS.HEIGHT,
      {
        isStatic: true,
        angle: -leftWallAngle,
        render: { visible: false },
      }
    );
    Matter.Composite.add(engine.world, [leftWall, rightWall]);

    // Create sensor at bottom - must have PIN_CATEGORY so ball can detect it
    const sensor = Matter.Bodies.rectangle(
      CANVAS.WIDTH / 2,
      CANVAS.HEIGHT - 30,
      CANVAS.WIDTH,
      20,
      {
        isSensor: true,
        isStatic: true,
        render: { visible: false },
        label: 'sensor',
        collisionFilter: {
          category: PIN_CATEGORY,
          mask: BALL_CATEGORY
        }
      }
    );
    Matter.Composite.add(engine.world, sensor);

    // Collision detection - use ref so we always have latest callback
    Matter.Events.on(engine, 'collisionStart', ({ pairs }) => {
      pairs.forEach(({ bodyA, bodyB }) => {
        if (bodyA.label === 'sensor' && bodyB.label === 'ball') {
          if (handleBallEnterBinRef.current) handleBallEnterBinRef.current(bodyB);
        } else if (bodyB.label === 'sensor' && bodyA.label === 'ball') {
          if (handleBallEnterBinRef.current) handleBallEnterBinRef.current(bodyA);
        }
      });
    });

    // Fallback: position-based detection if collision doesn't trigger
    let ballDetected = false;
    Matter.Events.on(engine, 'afterUpdate', () => {
      if (ballDetected) return;
      const bodies = Matter.Composite.allBodies(engine.world);
      const ball = bodies.find(b => b.label === 'ball');
      if (ball && ball.position.y > CANVAS.HEIGHT - 60) {
        ballDetected = true;
        console.log('Fallback detection triggered at y:', ball.position.y);
        if (handleBallEnterBinRef.current) {
          handleBallEnterBinRef.current(ball);
        }
        // Reset flag after a delay so next ball can be detected
        setTimeout(() => { ballDetected = false; }, 1000);
      }
    });

    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);
  }, [rows, getPinDistanceX, getPinRadius]);

  // Handle ball entering bin - determine slot from physics position
  const handleBallEnterBin = useCallback((ball) => {
    const lastRowXCoords = pinsLastRowXCoordsRef.current;

    // Determine which slot the ball landed in based on physics
    // Use the same method as reference: find the last pin whose x is less than ball x
    const physicsSlot = lastRowXCoords.findLastIndex((pinX) => pinX < ball.position.x);

    // targetSlot can be: null (free test), 'demo_bet', 'real_bet', or a number (contract result)
    const targetSlot = targetSlotRef.current;

    // For slot number: use physics for demo/real bets, contract result for blockchain bets
    const isLocalBet = targetSlot === null || targetSlot === 'demo_bet' || targetSlot === 'real_bet';
    const finalSlot = isLocalBet ? physicsSlot : targetSlot;

    console.log('Ball landed - Physics slot:', physicsSlot, 'Target type:', targetSlot, 'Final slot:', finalSlot);

    if (finalSlot >= 0 && finalSlot < lastRowXCoords.length) {
      // Snap ball to the slot center for visual clarity
      if (lastRowXCoords[finalSlot] !== undefined) {
        const nextPinX = lastRowXCoords[finalSlot + 1] || (lastRowXCoords[finalSlot] + 50);
        const slotCenterX = (lastRowXCoords[finalSlot] + nextPinX) / 2;
        Matter.Body.setPosition(ball, { x: slotCenterX, y: ball.position.y });
      }

      setLandingSlot(finalSlot);

      // Calculate and show result for all local bets
      if (isLocalBet) {
        const mult = MULTIPLIERS[rows]?.[risk]?.[finalSlot] || 1;
        const payout = betAmount * mult;
        const profit = payout - betAmount;
        const isWin = mult >= 1;

        // Credit demo balance if this was a demo bet
        if (targetSlot === 'demo_bet' && isDemoMode) {
          setDemoBalance(prev => prev + payout);
        }

        // Credit real tickets if this was a real bet
        if (targetSlot === 'real_bet' && !isDemoMode) {
          setRealTickets(prev => prev + payout);
        }

        setLastResult({
          slot: finalSlot,
          multiplier: mult,
          payout,
          profit,
          win: isWin
        });
        // Stats updated via useEffect after result displays
      }

      setIsProcessing(false);
      setGameState('complete');
    } else {
      console.error('Invalid slot calculated:', finalSlot, 'from ball position:', ball.position.x);
    }

    // Remove ball after a short delay
    setTimeout(() => {
      if (engineRef.current && ball) {
        Matter.Composite.remove(engineRef.current.world, ball);
        ballRef.current = null;
      }
    }, 500);
  }, [rows, risk, betAmount, isDemoMode, setDemoBalance, setRealTickets]);

  // Keep ref updated for event handler
  useEffect(() => {
    handleBallEnterBinRef.current = handleBallEnterBin;
  }, [handleBallEnterBin]);

  // Play back a recorded path by animating ball through saved positions
  const playRecordedPath = useCallback((path, targetSlot) => {
    if (!engineRef.current || !path || path.length === 0) return;

    targetSlotRef.current = targetSlot;
    const pinRadius = getPinRadius(rows);
    const ballRadius = pinRadius * 2;

    // Create ball at starting position
    const ball = Matter.Bodies.circle(
      path[0].x,
      path[0].y,
      ballRadius,
      {
        isStatic: true, // Static since we're animating it manually
        render: { fillStyle: '#ef4444' },
        label: 'ball',
        collisionFilter: {
          category: BALL_CATEGORY,
          mask: 0, // No collisions during playback
        }
      }
    );

    ballRef.current = ball;
    Matter.Composite.add(engineRef.current.world, ball);

    // Animate through path positions
    let frameIndex = 0;
    const playbackInterval = setInterval(() => {
      if (frameIndex >= path.length || !ballRef.current) {
        clearInterval(playbackInterval);
        // Trigger the bin detection manually
        if (ballRef.current && handleBallEnterBinRef.current) {
          handleBallEnterBinRef.current(ballRef.current);
        }
        return;
      }

      const pos = path[frameIndex];
      Matter.Body.setPosition(ballRef.current, { x: pos.x, y: pos.y });
      frameIndex++;
    }, 1000 / (60 * (plinkoSettings?.ballSpeed || 1))); // Adjust FPS by ball speed
  }, [rows, getPinRadius, plinkoSettings?.ballSpeed]);

  // Drop ball with recorded path playback or fallback to guided physics
  const dropBall = useCallback((targetSlot) => {
    if (!engineRef.current) return;

    // Check if recorded paths feature is enabled AND we have paths for this slot
    const useRecordedPaths = plinkoSettings?.recordedPathsEnabled;
    const slotPaths = recordedPaths[targetSlot];
    if (useRecordedPaths && slotPaths && slotPaths.length > 0) {
      // Use a random recorded path
      const randomPath = slotPaths[Math.floor(Math.random() * slotPaths.length)];
      console.log(`Playing recorded path for slot ${targetSlot} (${slotPaths.length} available)`);
      playRecordedPath(randomPath, targetSlot);
      return;
    }

    // Fallback: guided physics (original behavior)
    console.log(`Using guided physics for slot ${targetSlot}`);
    targetSlotRef.current = targetSlot;
    const pinDistanceX = getPinDistanceX(rows);
    const pinRadius = getPinRadius(rows);
    const ballRadius = pinRadius * 2;

    const lastRowXCoords = pinsLastRowXCoordsRef.current;
    const targetX = lastRowXCoords.length > targetSlot + 1
      ? (lastRowXCoords[targetSlot] + lastRowXCoords[targetSlot + 1]) / 2
      : CANVAS.WIDTH / 2;

    const firstRowPaddingX = CANVAS.PADDING_X + ((rows - 1) * pinDistanceX) / 2;
    const firstRowLeft = firstRowPaddingX + pinDistanceX * 0.5;
    const firstRowRight = CANVAS.WIDTH - firstRowPaddingX - pinDistanceX * 0.5;

    const centerX = CANVAS.WIDTH / 2;
    const biasStrength = 0.4;
    const idealStartX = centerX + (targetX - centerX) * biasStrength;
    const clampedX = Math.max(firstRowLeft, Math.min(firstRowRight, idealStartX));
    const randomOffset = (Math.random() - 0.5) * pinDistanceX * 0.3;
    const startX = clampedX + randomOffset;

    const ball = Matter.Bodies.circle(startX, 0, ballRadius, {
      restitution: 0.8,
      friction: BALL_FRICTIONS.friction,
      frictionAir: BALL_FRICTIONS.frictionAirByRowCount[rows] || 0.038,
      collisionFilter: { category: BALL_CATEGORY, mask: PIN_CATEGORY },
      render: { fillStyle: '#ef4444' },
      label: 'ball'
    });

    ballRef.current = ball;
    Matter.Composite.add(engineRef.current.world, ball);

    const guideInterval = setInterval(() => {
      if (!ballRef.current || !engineRef.current) {
        clearInterval(guideInterval);
        return;
      }
      const ballPos = ballRef.current.position;
      if (ballPos.y > CANVAS.HEIGHT - 100) {
        clearInterval(guideInterval);
        return;
      }
      const offsetFromTarget = targetX - ballPos.x;
      const forceStrength = 0.00002 * Math.sign(offsetFromTarget) * Math.min(Math.abs(offsetFromTarget), 50);
      if (Math.abs(offsetFromTarget) > 10) {
        Matter.Body.applyForce(ballRef.current, ballPos, { x: forceStrength, y: 0 });
      }
    }, 50);

    setTimeout(() => clearInterval(guideInterval), 10000);
  }, [rows, getPinDistanceX, getPinRadius, recordedPaths, playRecordedPath, plinkoSettings?.recordedPathsEnabled]);

  // Record sample paths for all slots
  const recordSamplePaths = useCallback(async () => {
    if (isRecording) return;

    setIsRecording(true);
    setRecordingProgress(0);
    recordingRef.current = true;

    const samplesPerSlot = 20;
    const totalSlots = rows + 1;
    const paths = {};

    // Initialize paths for each slot
    for (let i = 0; i < totalSlots; i++) {
      paths[i] = [];
    }

    const pinDistanceX = getPinDistanceX(rows);
    const pinRadius = getPinRadius(rows);
    const ballRadius = pinRadius * 2;

    // Calculate pin positions for this row count
    const lastRowXCoords = [];
    for (let row = 0; row < rows; ++row) {
      const rowPaddingX = CANVAS.PADDING_X + ((rows - 1 - row) * pinDistanceX) / 2;
      if (row === rows - 1) {
        for (let col = 0; col < 3 + row; ++col) {
          const colX = rowPaddingX + ((CANVAS.WIDTH - rowPaddingX * 2) / (3 + row - 1)) * col;
          lastRowXCoords.push(colX);
        }
      }
    }

    console.log('Recording paths for', rows, 'rows,', totalSlots, 'slots');
    console.log('Last row X coords:', lastRowXCoords);

    // First row bounds for starting position
    const firstRowPaddingX = CANVAS.PADDING_X + ((rows - 1) * pinDistanceX) / 2;
    const firstRowLeft = firstRowPaddingX + pinDistanceX * 0.5;
    const firstRowRight = CANVAS.WIDTH - firstRowPaddingX - pinDistanceX * 0.5;

    let totalRecorded = 0;
    let totalAttempts = 0;
    const targetTotal = samplesPerSlot * totalSlots;
    const maxAttempts = targetTotal * 50; // Allow many attempts since edge slots are rare

    // Keep running drops until we have enough samples for each slot
    while (recordingRef.current && totalAttempts < maxAttempts) {
      // Check if we have enough for all slots
      let allComplete = true;
      for (let i = 0; i < totalSlots; i++) {
        if (paths[i].length < samplesPerSlot) {
          allComplete = false;
          break;
        }
      }
      if (allComplete) break;

      totalAttempts++;

      // Create a headless physics simulation
      const simEngine = Matter.Engine.create({ timing: { timeScale: 1 } });

      // Add pins
      for (let row = 0; row < rows; ++row) {
        const rowY = CANVAS.PADDING_TOP +
          ((CANVAS.HEIGHT - CANVAS.PADDING_TOP - CANVAS.PADDING_BOTTOM) / (rows - 1)) * row;
        const rowPaddingX = CANVAS.PADDING_X + ((rows - 1 - row) * pinDistanceX) / 2;

        for (let col = 0; col < 3 + row; ++col) {
          const colX = rowPaddingX + ((CANVAS.WIDTH - rowPaddingX * 2) / (3 + row - 1)) * col;
          const pin = Matter.Bodies.circle(colX, rowY, pinRadius, {
            isStatic: true,
            collisionFilter: { category: PIN_CATEGORY, mask: BALL_CATEGORY }
          });
          Matter.Composite.add(simEngine.world, pin);
        }
      }

      // Add walls
      const leftWallAngle = Math.atan2(
        (CANVAS.PADDING_X + ((rows - 1) * pinDistanceX) / 2) - lastRowXCoords[0],
        CANVAS.HEIGHT - CANVAS.PADDING_TOP - CANVAS.PADDING_BOTTOM
      );
      const leftWallX = (CANVAS.PADDING_X + ((rows - 1) * pinDistanceX) / 2) -
        ((CANVAS.PADDING_X + ((rows - 1) * pinDistanceX) / 2) - lastRowXCoords[0]) / 2 - pinDistanceX * 0.25;

      Matter.Composite.add(simEngine.world, [
        Matter.Bodies.rectangle(leftWallX, CANVAS.HEIGHT / 2, 10, CANVAS.HEIGHT, { isStatic: true, angle: leftWallAngle, render: { visible: false } }),
        Matter.Bodies.rectangle(CANVAS.WIDTH - leftWallX, CANVAS.HEIGHT / 2, 10, CANVAS.HEIGHT, { isStatic: true, angle: -leftWallAngle, render: { visible: false } })
      ]);

      // Random starting position within triangle
      const startX = firstRowLeft + Math.random() * (firstRowRight - firstRowLeft);

      // Create ball
      const ball = Matter.Bodies.circle(startX, 0, ballRadius, {
        restitution: 0.8,
        friction: BALL_FRICTIONS.friction,
        frictionAir: BALL_FRICTIONS.frictionAirByRowCount[rows] || 0.038,
        collisionFilter: { category: BALL_CATEGORY, mask: PIN_CATEGORY }
      });
      Matter.Composite.add(simEngine.world, ball);

      // Record path
      const path = [];
      let frames = 0;
      const maxFrames = 600; // 10 seconds at 60fps

      while (frames < maxFrames) {
        Matter.Engine.update(simEngine, 1000 / 60);
        path.push({ x: ball.position.x, y: ball.position.y });

        // Check if ball has reached bottom
        if (ball.position.y > CANVAS.HEIGHT - 60) {
          break;
        }
        frames++;
      }

      // Determine which slot the ball landed in based on final X position
      let landedSlot = -1;
      const finalX = ball.position.x;

      // Find which slot the ball is in
      for (let i = 0; i < lastRowXCoords.length - 1; i++) {
        const leftPin = lastRowXCoords[i];
        const rightPin = lastRowXCoords[i + 1];
        if (finalX >= leftPin && finalX < rightPin) {
          landedSlot = i;
          break;
        }
      }
      // Handle edge cases
      if (landedSlot === -1) {
        if (finalX < lastRowXCoords[0]) {
          landedSlot = 0; // Far left
        } else if (finalX >= lastRowXCoords[lastRowXCoords.length - 1]) {
          landedSlot = lastRowXCoords.length - 2; // Far right
        }
      }

      // Save path if we need more samples for this slot
      if (landedSlot >= 0 && landedSlot < totalSlots && paths[landedSlot].length < samplesPerSlot) {
        paths[landedSlot].push(path);
        totalRecorded++;
        setRecordingProgress(Math.round((totalRecorded / targetTotal) * 100));

        // Update state periodically so user can see progress
        if (totalRecorded % 10 === 0) {
          setRecordedPaths({...paths});
        }
      }

      // Clean up
      Matter.Engine.clear(simEngine);

      // Small delay to prevent UI freeze
      if (totalAttempts % 10 === 0) {
        await new Promise(r => setTimeout(r, 1));
      }
    }

    // Save to localStorage and state
    console.log('Saving paths to localStorage...');
    localStorage.setItem(`plinko-paths-${rows}`, JSON.stringify(paths));
    setRecordedPaths({...paths});
    setIsRecording(false);
    setRecordingProgress(100);
    recordingRef.current = false;

    // Log results
    let logMsg = `Recording complete for ${rows} rows (${totalAttempts} attempts):\n`;
    for (let i = 0; i < totalSlots; i++) {
      logMsg += `  Slot ${i}: ${paths[i].length} paths\n`;
    }
    console.log(logMsg);

    const totalPaths = Object.values(paths).reduce((sum, p) => sum + p.length, 0);
    console.log(`Total paths recorded: ${totalPaths}`);
  }, [rows, isRecording, getPinDistanceX, getPinRadius]);

  // Stop recording
  const stopRecording = useCallback(() => {
    recordingRef.current = false;
  }, []);

  // Initialize engine on mount and row change
  useEffect(() => {
    initEngine();
    return () => {
      if (renderRef.current) Matter.Render.stop(renderRef.current);
      if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
      if (engineRef.current) Matter.Engine.clear(engineRef.current);
    };
  }, [initEngine]);

  // Reload recorded paths when row count changes
  useEffect(() => {
    const saved = localStorage.getItem(`plinko-paths-${rows}`);
    setRecordedPaths(saved ? JSON.parse(saved) : {});
  }, [rows]);

  // Fetch balance and contract data
  useEffect(() => {
    // Contract not deployed yet - skip blockchain fetches
    if (!PLINKO_CONTRACT || !isWalletConnected) return;

    // TODO: Implement Sui contract integration when deployed
    console.log('Plinko contract integration pending');
  }, [isWalletConnected]);

  // Auto-reveal polling (blockchain mode - not yet implemented)
  const autoRevealTriggered = useRef(false);

  useEffect(() => {
    // Contract polling disabled until Sui contract is deployed
    if (!activeGameId || !PLINKO_CONTRACT) return;

    // TODO: Implement Sui contract polling when deployed
  }, [activeGameId]);

  // Real mode drop handler (uses real tickets)
  const handleDropBall = () => {
    if (!isWalletConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (gameState !== 'idle') return;

    if (betAmount > realTickets) {
      setError('Insufficient ticket balance! Buy tickets at the Cashier.');
      return;
    }

    // Deduct from real tickets
    setRealTickets(prev => prev - betAmount);

    setError(null);
    setLastResult(null);
    setLandingSlot(null);
    targetSlotRef.current = null;
    setGameState('dropping');
    setIsProcessing(true);

    // Mark as real bet for payout handling
    targetSlotRef.current = 'real_bet';

    // Drop ball using physics
    if (!engineRef.current) {
      initEngine();
    }

    const pinDistanceX = getPinDistanceX(rows);
    const pinRadius = getPinRadius(rows);
    const ballOffsetRangeX = pinDistanceX * 0.8;
    const ballRadius = pinRadius * 2;

    const startX = CANVAS.WIDTH / 2 + (Math.random() - 0.5) * ballOffsetRangeX;

    const ball = Matter.Bodies.circle(
      startX,
      0,
      ballRadius,
      {
        restitution: 0.8,
        friction: BALL_FRICTIONS.friction,
        frictionAir: BALL_FRICTIONS.frictionAirByRowCount[rows] || 0.038,
        collisionFilter: {
          category: BALL_CATEGORY,
          mask: PIN_CATEGORY,
        },
        render: { fillStyle: '#3b82f6' }, // Blue for real mode
        label: 'ball'
      }
    );

    ballRef.current = ball;
    Matter.Composite.add(engineRef.current.world, ball);
  };

  const resetGame = () => {
    setGameState('idle');
    setActiveGameId(null);
    setLastResult(null);
    setLandingSlot(null);
    setIsProcessing(false);
    setError(null);
    autoRevealTriggered.current = false;
    targetSlotRef.current = null;

    // Remove any existing balls
    if (engineRef.current && ballRef.current) {
      Matter.Composite.remove(engineRef.current.world, ballRef.current);
      ballRef.current = null;
    }
  };

  // Test drop - no blockchain, physics determines outcome
  // In demo mode, this uses demo balance and tracks winnings
  const handleTestDrop = (useBalance = false) => {
    if (gameState !== 'idle') return;

    // If in demo mode and useBalance is true, deduct from demo balance
    if (isDemoMode && useBalance) {
      if (betAmount > demoBalance) {
        setError('Insufficient demo balance!');
        return;
      }
      setDemoBalance(prev => prev - betAmount);
    }

    setError(null);
    setLastResult(null);
    setLandingSlot(null);
    targetSlotRef.current = null; // Let physics decide
    setGameState('dropping');
    setIsProcessing(true);

    // Store whether this is a bet or free drop
    targetSlotRef.current = useBalance ? 'demo_bet' : null;

    // Drop ball without target - physics will determine slot
    if (!engineRef.current) {
      initEngine();
    }

    const pinDistanceX = getPinDistanceX(rows);
    const pinRadius = getPinRadius(rows);
    const ballOffsetRangeX = pinDistanceX * 0.8;
    const ballRadius = pinRadius * 2;

    // Random starting position like reference
    const startX = CANVAS.WIDTH / 2 + (Math.random() - 0.5) * ballOffsetRangeX;

    const ball = Matter.Bodies.circle(
      startX,
      0,
      ballRadius,
      {
        restitution: 0.8,
        friction: BALL_FRICTIONS.friction,
        frictionAir: BALL_FRICTIONS.frictionAirByRowCount[rows] || 0.038,
        collisionFilter: {
          category: BALL_CATEGORY,
          mask: PIN_CATEGORY,
        },
        render: { fillStyle: isDemoMode && useBalance ? '#8b5cf6' : '#ef4444' },
        label: 'ball'
      }
    );

    ballRef.current = ball;
    Matter.Composite.add(engineRef.current.world, ball);
  };

  // Demo drop with balance
  const handleDemoDrop = () => handleTestDrop(true);

  const getSlotColor = (mult) => {
    if (mult >= 10) return '#ef4444';
    if (mult >= 5) return '#f97316';
    if (mult >= 2) return '#eab308';
    if (mult >= 1) return '#3b82f6';
    return '#6b7280';
  };

  // Check if user needs tickets
  const needsTickets = currentBalance <= 0;

  return (
    <div className="plinko-page">
      {/* Need Tickets Overlay */}
      {needsTickets && <NeedTickets gameName="SUITRUMP Plinko" isWalletConnected={isWalletConnected} />}

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="demo-mode-banner">
          <span className="demo-icon">🎮</span>
          <span className="demo-text">
            <strong>FREE PLAY MODE</strong> - Practice with {demoBalance.toLocaleString()} tickets. No wallet needed!
          </span>
        </div>
      )}

      {/* Real Mode - Not Connected Banner */}
      {!isDemoMode && !isWalletConnected && (
        <div className="connect-wallet-banner">
          <span className="wallet-icon">🔗</span>
          <span className="wallet-text">
            <strong>TESTNET MODE</strong> - Connect your Sui wallet to play with test tokens
          </span>
          <ConnectButton />
        </div>
      )}

      {/* Real Mode - Connected Banner */}
      {!isDemoMode && isWalletConnected && (
        <div className="testnet-mode-banner">
          <span className="testnet-icon">🧪</span>
          <span className="testnet-text">
            <strong>TESTNET MODE</strong> - Playing with TEST_SUITRUMP on {CURRENT_NETWORK}
          </span>
          <span className="wallet-address">
            {account?.address?.slice(0, 6)}...{account?.address?.slice(-4)}
          </span>
        </div>
      )}

      <div className="plinko-header">
        <div className="plinko-title">
          <span className="plinko-icon">🎯</span>
          <div>
            <h2>SUITRUMP Plinko</h2>
            <p>{isDemoMode ? 'FREE PLAY | Demo Mode' : 'Drop the ball and watch it bounce!'}</p>
          </div>
        </div>

        {/* Live Stats Panel - conditional */}
        {plinkoSettings?.showLiveStats !== false && (
          <div className="live-stats-panel">
            <div className="live-stats-header">
              <span>📊 Live Stats</span>
            </div>
            <div className="live-stats-content">
              <div className="live-stats-numbers">
                <div className="live-stat">
                  <span className="live-stat-label">Profit</span>
                  <span className={`live-stat-value ${sessionStats.totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                    {sessionStats.totalProfit >= 0 ? '+' : ''}{sessionStats.totalProfit.toFixed(2)} tickets
                  </span>
                </div>
                <div className="live-stat">
                  <span className="live-stat-label">Wins</span>
                  <span className="live-stat-value wins">{sessionStats.wins}</span>
                </div>
                <div className="live-stat">
                  <span className="live-stat-label">Losses</span>
                  <span className="live-stat-value losses">{sessionStats.losses}</span>
                </div>
              </div>
              <div className="profit-chart">
                <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                  {sessionStats.profitHistory.length > 1 && (() => {
                    const points = sessionStats.profitHistory;
                    const min = Math.min(...points, 0);
                    const max = Math.max(...points, 0);
                    const range = max - min || 1;
                    const zeroY = 40 - ((0 - min) / range) * 40;

                    const pathPoints = points.map((p, i) => {
                      const x = (i / (points.length - 1)) * 100;
                      const y = 40 - ((p - min) / range) * 40;
                      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                    }).join(' ');

                    return (
                      <>
                        <line x1="0" y1={zeroY} x2="100" y2={zeroY} stroke="#475569" strokeWidth="0.5" strokeDasharray="2,2" />
                        <path d={pathPoints} fill="none" stroke={sessionStats.totalProfit >= 0 ? '#3b82f6' : '#ef4444'} strokeWidth="2" />
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>
          </div>
        )}

        <div className="plinko-balance">
          <span className="balance-label">{isDemoMode ? 'Demo Balance' : 'Ticket Balance'}</span>
          <span className="balance-value" style={isDemoMode ? { color: '#c4b5fd' } : {}}>{currentBalance.toLocaleString()} tickets</span>
        </div>
      </div>

      <div className="plinko-stats">
        <div className="stat-box">
          <span className="stat-label">House Reserve</span>
          <span className="stat-value">{houseReserve} tickets</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Risk Level</span>
          <span className="stat-value">{RISK_LEVELS[risk]}</span>
        </div>
        <div className="stat-box">
          <span className="stat-label">Rows</span>
          <span className="stat-value">{rows}</span>
        </div>
      </div>

      <div className="plinko-game">
        <div className="plinko-board">
          <canvas
            ref={canvasRef}
            width={CANVAS.WIDTH}
            height={CANVAS.HEIGHT}
            className="plinko-canvas"
          />

          {/* Multiplier slots */}
          <div className="slots-container">
            {multipliers.map((mult, i) => (
              <div
                key={i}
                className={`slot ${landingSlot === i ? 'active' : ''}`}
                style={{ backgroundColor: getSlotColor(mult) }}
              >
                <span>{mult}x</span>
              </div>
            ))}
          </div>
        </div>

        {/* Result overlay */}
        {gameState === 'complete' && lastResult && (
          <div className={`result-overlay ${lastResult.win ? 'win' : 'lose'}`}>
            <div className="result-content">
              <span className="result-mult">{lastResult.multiplier}x</span>
              <span className="result-amount">
                {lastResult.win ? '+' : ''}{lastResult.profit.toFixed(2)} tickets
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="plinko-controls">
        {gameState === 'idle' && (
          <>
            <div className="button-row">
              <button
                className="action-btn drop"
                onClick={isDemoMode ? handleDemoDrop : handleDropBall}
                disabled={isProcessing || (!isDemoMode && !PLINKO_CONTRACT)}
              >
                {isProcessing ? 'Dropping...' : `🎯 DROP BALL - ${betAmount} tickets`}
              </button>
              {plinkoSettings?.testDropEnabled !== false && (
                <button
                  className="action-btn test"
                  onClick={() => handleTestDrop(false)}
                  disabled={isProcessing}
                >
                  🧪 TEST DROP (Free)
                </button>
              )}
            </div>

            <div className="potential-win">
              Max Win: <strong>{(betAmount * Math.max(...multipliers)).toFixed(1)} tickets</strong>
            </div>

            <div className="controls-row">
              <div className="control-box">
                <h4>Risk Level</h4>
                <div className="risk-buttons">
                  {RISK_LEVELS.map((level, i) => (
                    <button
                      key={level}
                      className={`risk-btn ${risk === i ? 'active' : ''} risk-${level.toLowerCase()}`}
                      onClick={() => setRisk(i)}
                      disabled={isProcessing}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-box">
                <h4>Rows</h4>
                <div className="row-buttons">
                  {ROW_OPTIONS.map(r => (
                    <button
                      key={r}
                      className={`row-btn ${rows === r ? 'active' : ''}`}
                      onClick={() => setRows(r)}
                      disabled={isProcessing}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-box">
                <h4>Bet Amount</h4>
                <div className="bet-row">
                  <div className="bet-presets">
                    {BET_PRESETS.map(preset => {
                      const isValid = isBetValid(preset);
                      return (
                        <button
                          key={preset}
                          className={`bet-btn ${betAmount === preset ? 'selected' : ''} ${!isValid ? 'invalid' : ''}`}
                          onClick={() => {
                            setBetAmount(preset);
                            if (isValid && error?.includes('house reserve')) {
                              setError(null);
                            }
                          }}
                          disabled={isProcessing || !isValid}
                          title={!isValid ? `Max payout would exceed house reserve` : ''}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>
                  <div className="custom-bet">
                    <input
                      type="number"
                      value={betAmount}
                      onChange={(e) => {
                        const newBet = Math.max(1, parseInt(e.target.value) || 1);
                        setBetAmount(newBet);
                        if (isBetValid(newBet) && error?.includes('house reserve')) {
                          setError(null);
                        }
                      }}
                      disabled={isProcessing}
                      min="1"
                    />
                    <span>tickets</span>
                    <span className="usd-hint">= ${(betAmount * 0.10).toFixed(2)} USD</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {gameState === 'submitting' && (
          <div className="waiting-state">
            <div className="waiting-message">
              <span className="waiting-icon">✍️</span>
              Please confirm in your wallet...
            </div>
            <button className="action-btn waiting" disabled>
              ✍️ Confirm in Wallet...
            </button>
          </div>
        )}

        {gameState === 'waiting' && (
          <div className="waiting-state">
            <div className="waiting-message">
              <span className="waiting-icon">⏳</span>
              Waiting for {blocksRemaining} block{blocksRemaining !== 1 ? 's' : ''}...
            </div>
            <button className="action-btn waiting" disabled>
              ⏳ Confirming...
            </button>
          </div>
        )}

        {gameState === 'dropping' && (
          <button className="action-btn dropping" disabled>
            🎯 BALL DROPPING...
          </button>
        )}

        {gameState === 'complete' && (
          <button className="action-btn reset" onClick={resetGame}>
            🔄 PLAY AGAIN
          </button>
        )}

        {error && <div className="error-message">{error}</div>}

        {!PLINKO_CONTRACT && (
          <div className="deploy-notice">
            Contract not deployed. Run deployment script first.
          </div>
        )}

        {/* Path Recording Controls - only show when feature is enabled */}
        {plinkoSettings?.recordedPathsEnabled && (
          <div className="recording-controls">
            <div className="recording-header">
              <span>Path Recording</span>
              <span className="recording-status">
                {Object.keys(recordedPaths).length > 0
                  ? `${Object.values(recordedPaths).reduce((sum, paths) => sum + paths.length, 0)} paths saved`
                  : 'No paths recorded'}
              </span>
            </div>
            <div className="recording-buttons">
              {!isRecording ? (
                <>
                  <button
                    className="record-btn"
                    onClick={recordSamplePaths}
                    disabled={isProcessing || gameState !== 'idle'}
                  >
                    Record Sample Paths ({rows} rows)
                  </button>
                  {Object.keys(recordedPaths).length > 0 && (
                    <button
                      className="clear-btn"
                      onClick={() => {
                        localStorage.removeItem(`plinko-paths-${rows}`);
                        setRecordedPaths({});
                      }}
                    >
                      Clear Paths
                    </button>
                  )}
                </>
              ) : (
                <div className="recording-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${recordingProgress}%` }}></div>
                  </div>
                  <span>Recording... {recordingProgress}%</span>
                  <button className="stop-btn" onClick={stopRecording}>Stop</button>
                </div>
              )}
            </div>
            <p className="recording-hint">
              Record paths to enable realistic ball physics that matches blockchain results.
            </p>
          </div>
        )}
      </div>

      {/* Multiplier Table */}
      <div className="multiplier-table">
        <h3>Multipliers ({RISK_LEVELS[risk]} Risk, {rows} Rows)</h3>
        <div className="multiplier-row">
          {multipliers.map((mult, i) => (
            <div
              key={i}
              className="multiplier-cell"
              style={{ backgroundColor: getSlotColor(mult), opacity: 0.8 }}
            >
              {mult}x
            </div>
          ))}
        </div>
      </div>

      {/* How to Play Section */}
      <div className="how-to-play-card">
        <h2 className="how-to-play-title">How to Play Plinko</h2>
        <div className="how-to-play-content">
          <div className="instructions-column">
            <ol className="instructions-list">
              <li><strong>Choose Risk Level:</strong> Low, Medium, or High - affects multiplier distribution</li>
              <li><strong>Select Rows:</strong> 8, 10, or 12 rows - more rows = more variance</li>
              <li><strong>Set Bet Amount:</strong> Enter your bet in tickets (1 ticket = $0.10)</li>
              <li><strong>Drop Ball:</strong> Approve tokens and drop the ball</li>
              <li><strong>Wait:</strong> Wait ~6 seconds for block confirmation</li>
              <li><strong>Watch:</strong> Ball drops automatically when ready!</li>
            </ol>
          </div>
          <div className="payout-column">
            <h3>Risk Levels</h3>
            <table className="payout-table">
              <thead>
                <tr><th>Risk</th><th>Center</th><th>Edge (Max)</th></tr>
              </thead>
              <tbody>
                <tr><td>Low</td><td>0.5x</td><td>10x</td></tr>
                <tr><td>Medium</td><td>0.4x</td><td>33x</td></tr>
                <tr className="jackpot-row"><td>High</td><td>0.2x</td><td>75x</td></tr>
              </tbody>
            </table>
          </div>
          <div className="jackpot-win-column">
            <h3>Game Info</h3>
            <ul className="distribution-list">
              <li><span className="highlight">Provably fair</span> using blockhash</li>
              <li>Each peg: 50/50 left or right</li>
              <li>More rows = more variance</li>
              <li>Higher risk = bigger edge multipliers</li>
              <li>House edge: ~3%</li>
            </ul>
          </div>
        </div>
      </div>

      <style>{`
        .plinko-page { width: 100%; }

        .plinko-header { display: flex; justify-content: space-between; align-items: center; padding: 20px; background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 16px; margin-bottom: 20px; border: 2px solid #2563eb; gap: 20px; flex-wrap: wrap; }

        .live-stats-panel {
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid #334155;
          border-radius: 12px;
          padding: 12px 16px;
          min-width: 200px;
        }
        .live-stats-header {
          font-size: 0.85rem;
          color: #94a3b8;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .live-stats-content {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .live-stats-numbers {
          display: flex;
          gap: 16px;
        }
        .live-stat {
          display: flex;
          flex-direction: column;
        }
        .live-stat-label {
          font-size: 0.7rem;
          color: #64748b;
          text-transform: uppercase;
        }
        .live-stat-value {
          font-size: 1rem;
          font-weight: 700;
        }
        .live-stat-value.profit-positive { color: #3b82f6; }
        .live-stat-value.profit-negative { color: #ef4444; }
        .live-stat-value.wins { color: #3b82f6; }
        .live-stat-value.losses { color: #ef4444; }
        .profit-chart {
          height: 40px;
          background: rgba(15, 23, 42, 0.5);
          border-radius: 6px;
          overflow: hidden;
        }
        .profit-chart svg {
          width: 100%;
          height: 100%;
        }
        .plinko-title { display: flex; align-items: center; gap: 12px; }
        .plinko-icon { font-size: 2.5rem; }
        .plinko-title h2 { margin: 0; color: #f8fafc; }
        .plinko-title p { margin: 0; color: #94a3b8; font-size: 0.85rem; }
        .plinko-balance { text-align: right; }
        .balance-label { display: block; color: #94a3b8; font-size: 0.85rem; }
        .balance-value { color: #3b82f6; font-size: 1.25rem; font-weight: 700; }

        .plinko-stats { display: flex; gap: 16px; margin-bottom: 20px; }
        .stat-box { flex: 1; background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 12px; padding: 12px 16px; text-align: center; border: 2px solid #2563eb; }
        .stat-label { display: block; color: #94a3b8; font-size: 0.8rem; margin-bottom: 4px; }
        .stat-value { color: #f8fafc; font-size: 1.1rem; font-weight: 700; }

        .plinko-game { position: relative; margin-bottom: 20px; }

        .plinko-board {
          position: relative;
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
          background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
          border-radius: 16px;
          border: 2px solid #2563eb;
          overflow: hidden;
        }

        .plinko-canvas {
          display: block;
          width: 100%;
          height: auto;
        }

        .slots-container {
          display: flex;
          padding: 0 ${CANVAS.PADDING_X * (100 / CANVAS.WIDTH)}%;
          height: 50px;
          background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
        }

        .slot {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 0.75rem;
          font-weight: 700;
          border-left: 1px solid rgba(0,0,0,0.3);
          transition: all 0.3s ease;
          border-radius: 4px;
          margin: 4px 1px;
        }

        .slot:first-child { border-left: none; }

        .slot.active {
          transform: scale(1.15);
          box-shadow: 0 0 20px currentColor;
          z-index: 5;
        }

        .result-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.9);
          border-radius: 16px;
          padding: 30px 50px;
          text-align: center;
          animation: resultPop 0.3s ease;
          z-index: 10;
        }

        .result-overlay.win { border: 3px solid #3b82f6; }
        .result-overlay.lose { border: 3px solid #ef4444; }

        @keyframes resultPop {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }

        .result-mult { display: block; font-size: 3rem; font-weight: 800; color: #f8fafc; }
        .result-amount { display: block; font-size: 1.5rem; font-weight: 600; margin-top: 10px; }
        .result-overlay.win .result-amount { color: #3b82f6; }
        .result-overlay.lose .result-amount { color: #ef4444; }

        .plinko-controls {
          background: linear-gradient(135deg, #1e293b, #0f172a);
          border-radius: 16px;
          padding: 25px;
          border: 2px solid #2563eb;
          margin-bottom: 20px;
        }

        .controls-row { display: flex; gap: 15px; flex-wrap: wrap; }

        .control-box {
          flex: 1;
          min-width: 150px;
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid #2563eb;
          border-radius: 10px;
          padding: 12px;
        }

        .control-box h4 {
          color: #94a3b8;
          margin: 0 0 10px 0;
          font-size: 0.85rem;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .risk-buttons, .row-buttons { display: flex; gap: 8px; justify-content: center; }

        .risk-btn, .row-btn {
          flex: 1;
          padding: 12px;
          border: 2px solid #334155;
          border-radius: 8px;
          background: #1e293b;
          color: #94a3b8;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .risk-btn:hover, .row-btn:hover { border-color: #3b82f6; }
        .risk-btn.active, .row-btn.active { background: #3b82f6; border-color: #3b82f6; color: white; }

        .risk-btn.risk-low.active { background: #3b82f6; border-color: #3b82f6; }
        .risk-btn.risk-medium.active { background: #eab308; border-color: #eab308; color: #0f172a; }
        .risk-btn.risk-high.active { background: #ef4444; border-color: #ef4444; }

        .bet-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; }
        .bet-presets { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
        .bet-btn { padding: 8px 12px; background: #334155; border: 2px solid #475569; border-radius: 6px; color: #f8fafc; font-weight: 600; cursor: pointer; transition: all 0.2s; font-size: 0.85rem; }
        .bet-btn:hover:not(:disabled) { border-color: #3b82f6; }
        .bet-btn.selected { background: #3b82f6; border-color: #3b82f6; }
        .bet-btn.invalid { background: #1e293b; border-color: #334155; color: #475569; cursor: not-allowed; opacity: 0.5; }

        .custom-bet { display: flex; align-items: center; gap: 6px; }
        .custom-bet input { width: 70px; padding: 8px; background: #334155; border: 2px solid #475569; border-radius: 6px; color: #f8fafc; font-size: 0.85rem; text-align: center; }
        .custom-bet input:focus { outline: none; border-color: #3b82f6; }
        .custom-bet span { color: #94a3b8; font-weight: 600; font-size: 0.85rem; }

        .potential-win { text-align: center; color: #94a3b8; margin: 15px 0; }
        .potential-win strong { color: #3b82f6; }

        .action-btn {
          width: 100%;
          padding: 18px;
          font-size: 1.2rem;
          font-weight: 700;
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .button-row { display: flex; gap: 12px; margin-bottom: 10px; }
        .button-row .action-btn { flex: 1; }
        .action-btn.drop { background: linear-gradient(135deg, #3b82f6, #2563eb); }
        .action-btn.drop:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(59, 130, 246, 0.4); }
        .action-btn.test { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
        .action-btn.test:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(139, 92, 246, 0.4); }
        .action-btn.waiting { background: #475569; cursor: not-allowed; }
        .action-btn.dropping { background: linear-gradient(135deg, #f97316, #ea580c); }
        .action-btn.reset { background: linear-gradient(135deg, #6366f1, #4f46e5); }
        .action-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .waiting-state { text-align: center; }
        .waiting-message { margin-bottom: 15px; color: #94a3b8; font-size: 1.1rem; }
        .waiting-icon { margin-right: 8px; animation: spin 1s linear infinite; display: inline-block; }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .error-message { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 12px; border-radius: 8px; margin-top: 15px; text-align: center; }
        .deploy-notice { background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); color: #fbbf24; padding: 12px; border-radius: 8px; margin-top: 15px; text-align: center; }

        .multiplier-table {
          background: linear-gradient(135deg, #1e293b, #0f172a);
          border-radius: 16px;
          padding: 20px;
          border: 2px solid #2563eb;
        }

        .multiplier-table h3 { color: #f8fafc; margin: 0 0 15px 0; font-size: 1rem; text-align: center; }

        .multiplier-row { display: flex; gap: 2px; }
        .multiplier-cell {
          flex: 1;
          padding: 8px 4px;
          text-align: center;
          color: white;
          font-size: 0.7rem;
          font-weight: 600;
          border-radius: 4px;
        }

        .how-to-play-card {
          background: linear-gradient(135deg, #1e293b, #0f172a);
          border-radius: 16px;
          padding: 25px;
          margin-top: 20px;
          border: 2px solid #2563eb;
        }

        .how-to-play-title { color: #f8fafc; font-size: 1.3rem; margin: 0 0 20px 0; text-align: center; }

        .how-to-play-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 25px;
        }

        .instructions-column, .payout-column, .jackpot-win-column {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 12px;
          padding: 20px;
          border: 2px solid #2563eb;
        }

        .instructions-list { list-style-position: inside; padding-left: 0; margin: 0; color: #94a3b8; }
        .instructions-list li { margin-bottom: 10px; line-height: 1.5; }
        .instructions-list li strong { color: #3b82f6; }

        .payout-column h3, .jackpot-win-column h3 { color: #f8fafc; font-size: 1rem; margin: 0 0 15px 0; text-align: center; }

        .payout-table { width: 100%; border-collapse: collapse; }
        .payout-table th, .payout-table td { padding: 10px; text-align: center; border-bottom: 1px solid rgba(59,130,246,0.2); }
        .payout-table th { color: #94a3b8; font-weight: 600; font-size: 0.85rem; }
        .payout-table td { color: #f8fafc; }
        .payout-table .jackpot-row td { color: #3b82f6; font-weight: 700; }

        .distribution-list { list-style: none; padding: 0; margin: 0; color: #94a3b8; }
        .distribution-list li { padding: 8px 0; border-bottom: 1px solid rgba(59,130,246,0.1); }
        .distribution-list li:last-child { border-bottom: none; }
        .distribution-list .highlight { color: #3b82f6; font-weight: 600; }

        .recording-controls {
          margin-top: 20px;
          padding: 15px;
          background: rgba(15, 23, 42, 0.5);
          border: 1px solid #334155;
          border-radius: 10px;
        }
        .recording-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .recording-header > span:first-child {
          color: #94a3b8;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.8rem;
        }
        .recording-status {
          color: #3b82f6;
          font-size: 0.85rem;
        }
        .recording-buttons {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .record-btn {
          padding: 10px 20px;
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          border: none;
          border-radius: 8px;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .record-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(139, 92, 246, 0.4);
        }
        .record-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .clear-btn {
          padding: 10px 20px;
          background: #334155;
          border: 1px solid #475569;
          border-radius: 8px;
          color: #94a3b8;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .clear-btn:hover {
          border-color: #ef4444;
          color: #ef4444;
        }
        .recording-progress {
          display: flex;
          align-items: center;
          gap: 15px;
          flex: 1;
        }
        .progress-bar {
          flex: 1;
          height: 8px;
          background: #334155;
          border-radius: 4px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #8b5cf6, #3b82f6);
          transition: width 0.3s ease;
        }
        .recording-progress span {
          color: #94a3b8;
          font-size: 0.85rem;
          min-width: 120px;
        }
        .stop-btn {
          padding: 8px 16px;
          background: #ef4444;
          border: none;
          border-radius: 6px;
          color: white;
          font-weight: 600;
          cursor: pointer;
        }
        .recording-hint {
          margin: 10px 0 0 0;
          color: #64748b;
          font-size: 0.8rem;
        }

        @media (max-width: 768px) {
          .plinko-stats { flex-direction: column; }
          .plinko-header { flex-direction: column; gap: 15px; text-align: center; }
          .controls-row { flex-direction: column; gap: 15px; }
          .slot { font-size: 0.55rem; }
          .slots-container { height: 40px; }
        }
      `}</style>
    </div>
  );
}

export default PlinkoPage;
