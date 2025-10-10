/* eslint-disable react/no-unknown-property */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { Box, Button, Divider, Stack, Typography } from "@mui/material";

import useGameSound from "@/hooks/useGameSound.js";
import logError from "@/utils/logError.js";

const LRP_GREEN = "#4cbb17";

function CanvasShell({ children }) {
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "clamp(320px, 56vw, 540px)",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        flex: "0 0 auto",
        bgcolor: "#101010",
      }}
    >
      {children}
    </Box>
  );
}

function Ship({ xRef }) {
  const ref = useRef(null);

  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.x += (xRef.current - ref.current.position.x) * 0.18;
  });

  return (
    <mesh ref={ref} position={[0, 0, 4]}>
      <coneGeometry args={[0.3, 1, 10]} />
      <meshStandardMaterial
        color={LRP_GREEN}
        emissive={LRP_GREEN}
        emissiveIntensity={0.6}
      />
    </mesh>
  );
}

function Orbs({ poolSize = 160, speedRef, runningRef, scoreBumpRef, play }) {
  const meshRef = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const hiddenMatrix = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.set(0, 0, 1000);
    obj.updateMatrix();
    return obj.matrix.clone();
  }, []);
  const lanes = useMemo(() => [-3, 0, 3], []);
  const data = useRef(
    Array.from({ length: poolSize }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: -20,
    })),
  );
  const nextSpawn = useRef(0);

  const activate = useCallback(
    (slot) => {
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      const orb = data.current[slot];
      orb.active = true;
      orb.x = lane;
      orb.y = (Math.random() - 0.5) * 2.6;
      orb.z = -30 - Math.random() * 10;
    },
    [lanes],
  );

  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < poolSize; i += 1) {
      meshRef.current.setMatrixAt(i, hiddenMatrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [hiddenMatrix, poolSize]);

  useFrame((_, dt) => {
    if (!meshRef.current) return;

    nextSpawn.current -= dt;
    if (runningRef.current && nextSpawn.current <= 0) {
      const slot = data.current.findIndex((orb) => !orb.active);
      if (slot >= 0) {
        activate(slot);
      }
      nextSpawn.current = 0.22;
    }

    let needsUpdate = false;
    for (let i = 0; i < poolSize; i += 1) {
      const orb = data.current[i];
      if (!orb.active) {
        continue;
      }

      orb.z += speedRef.current * dt * 18;
      if (orb.z > 4.2) {
        orb.active = false;
        scoreBumpRef.current += 10;
        if (typeof play === "function") {
          try {
            play("ring");
          } catch (error) {
            logError(error, { where: "LRPStarRunner.collect" });
          }
        }
        meshRef.current.setMatrixAt(i, hiddenMatrix);
        needsUpdate = true;
        continue;
      }

      dummy.position.set(orb.x, orb.y, orb.z);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      needsUpdate = true;
    }

    if (needsUpdate) {
      meshRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, poolSize]}>
      <sphereGeometry args={[0.18, 12, 12]} />
      <meshStandardMaterial
        color={LRP_GREEN}
        emissive={LRP_GREEN}
        emissiveIntensity={0.85}
      />
    </instancedMesh>
  );
}

function Scene({ runningRef, speedRef, shipXRef, scoreBumpRef, play }) {
  useFrame(() => {
    const target = runningRef.current ? 1 : 0;
    speedRef.current += (target - speedRef.current) * 0.08;
  });

  return (
    <>
      <ambientLight intensity={0.45} />
      <pointLight position={[10, 10, 10]} />
      <fog attach="fog" args={["#060606", 5, 32]} />
      <Stars radius={80} depth={30} count={1500} factor={3} fade speed={0.6} />
      <Ship xRef={shipXRef} />
      <Orbs
        poolSize={150}
        speedRef={speedRef}
        runningRef={runningRef}
        scoreBumpRef={scoreBumpRef}
        play={play}
      />
      {[-3, 0, 3].map((x) => (
        <mesh key={x} position={[x, 0, -6]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.2, 40]} />
          <meshBasicMaterial color="rgba(255,255,255,0.06)" transparent />
        </mesh>
      ))}
    </>
  );
}

export default function LRPStarRunner() {
  const { play } = useGameSound();
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);

  const runningRef = useRef(false);
  const speedRef = useRef(0);
  const shipXRef = useRef(0);
  const scoreBumpRef = useRef(0);
  const rafScoreRef = useRef(0);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "ArrowLeft" || event.key === "a") {
        shipXRef.current = Math.max(-3, shipXRef.current - 3);
      }
      if (event.key === "ArrowRight" || event.key === "d") {
        shipXRef.current = Math.min(3, shipXRef.current + 3);
      }
      if (event.key === " ") {
        setRunning((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleTap = useCallback((side) => {
    if (side === "L") {
      shipXRef.current = Math.max(-3, shipXRef.current - 3);
    }
    if (side === "R") {
      shipXRef.current = Math.min(3, shipXRef.current + 3);
    }
  }, []);

  useEffect(() => {
    const loop = () => {
      if (scoreBumpRef.current) {
        setScore((prev) => {
          const next = prev + scoreBumpRef.current;
          scoreBumpRef.current = 0;
          return next;
        });
      }
      rafScoreRef.current = window.requestAnimationFrame(loop);
    };

    rafScoreRef.current = window.requestAnimationFrame(loop);
    return () => {
      if (rafScoreRef.current) {
        window.cancelAnimationFrame(rafScoreRef.current);
      }
    };
  }, []);

  return (
    <Stack
      spacing={1.25}
      alignItems="center"
      sx={{ width: "100%", color: "#fff" }}
    >
      <CanvasShell>
        <Box
          onPointerDown={() => handleTap("L")}
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "50%",
            zIndex: 1,
          }}
        />
        <Box
          onPointerDown={() => handleTap("R")}
          sx={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "50%",
            zIndex: 1,
          }}
        />
        <Box
          component={Canvas}
          sx={{ position: "absolute", inset: 0 }}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            alpha: true,
          }}
          dpr={[1, 2]}
          camera={{ position: [0, 0, 8], fov: 55 }}
        >
          <Scene
            runningRef={runningRef}
            speedRef={speedRef}
            shipXRef={shipXRef}
            scoreBumpRef={scoreBumpRef}
            play={play}
          />
        </Box>
      </CanvasShell>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
        <Typography
          variant="h6"
          sx={{ color: LRP_GREEN, fontWeight: 800, minWidth: 120 }}
        >
          Score: {score}
        </Typography>
        <Divider
          flexItem
          orientation="vertical"
          sx={{ borderColor: "rgba(255,255,255,0.08)" }}
        />
        <Button
          variant="contained"
          onClick={() => {
            setScore(0);
            scoreBumpRef.current = 0;
            shipXRef.current = 0;
            setRunning(true);
            if (typeof play === "function") {
              try {
                play("start");
              } catch (error) {
                logError(error, { where: "LRPStarRunner.start" });
              }
            }
          }}
          sx={{
            bgcolor: LRP_GREEN,
            color: "#000",
            fontWeight: 900,
            "&:hover": { bgcolor: "#45a915" },
          }}
        >
          Start
        </Button>
        <Button
          variant="outlined"
          onClick={() => setRunning(false)}
          sx={{ borderColor: LRP_GREEN, color: LRP_GREEN, fontWeight: 900 }}
        >
          Stop
        </Button>
      </Stack>
      <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.25 }}>
        Controls: ← / → or tap left/right. Space toggles Start/Stop.
      </Typography>
    </Stack>
  );
}
