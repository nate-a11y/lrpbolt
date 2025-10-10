/* eslint-disable react/no-unknown-property */
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { OrbitControls, Stars } from "@react-three/drei";
import { Box, Button, Stack, Typography } from "@mui/material";

import useGameSound from "@/hooks/useGameSound.js";

const LRP_GREEN = "#4cbb17";

function Ship() {
  const ref = useRef(null);
  const speed = useRef(0.05);
  const x = useRef(0);

  useFrame(() => {
    if (!ref.current) return;
    x.current += speed.current;
    ref.current.position.x = Math.sin(x.current) * 3;
  });

  return (
    <mesh ref={ref}>
      <coneGeometry args={[0.3, 1, 8]} />
      <meshStandardMaterial
        color={LRP_GREEN}
        emissive={LRP_GREEN}
        emissiveIntensity={0.6}
      />
    </mesh>
  );
}

function Orb({ position, onCollect }) {
  const ref = useRef(null);
  const [collected, setCollected] = useState(false);

  useFrame(() => {
    if (!ref.current || collected) return;
    ref.current.position.z += 0.1;
    if (ref.current.position.z > 5) setCollected(true);
  });

  useEffect(() => {
    if (collected && onCollect) onCollect();
  }, [collected, onCollect]);

  return !collected ? (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshStandardMaterial
        color={LRP_GREEN}
        emissive={LRP_GREEN}
        emissiveIntensity={0.8}
      />
    </mesh>
  ) : null;
}

export default function LRPStarRunner() {
  const { play } = useGameSound();
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [orbs, setOrbs] = useState([]);

  useEffect(() => {
    if (!running) return undefined;
    const spawn = window.setInterval(() => {
      const x = (Math.random() - 0.5) * 6;
      const y = (Math.random() - 0.5) * 3;
      const z = -20;
      setOrbs((current) => [
        ...current,
        { id: Date.now() + Math.random(), pos: [x, y, z] },
      ]);
    }, 800);
    return () => {
      window.clearInterval(spawn);
    };
  }, [running]);

  const collectOrb = () => {
    setScore((value) => value + 10);
    play("ring");
  };

  return (
    <Stack
      spacing={1.5}
      alignItems="center"
      sx={{ width: "100%", height: "100%" }}
    >
      <Box
        sx={{
          flex: 1,
          width: "100%",
          height: 500,
          borderRadius: 2,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Canvas camera={{ position: [0, 0, 5] }}>
          <ambientLight intensity={0.4} />
          <pointLight position={[10, 10, 10]} />
          <Stars radius={100} depth={50} count={2000} factor={4} fade />
          <Ship />
          {orbs.map((orb) => (
            <Orb key={orb.id} position={orb.pos} onCollect={collectOrb} />
          ))}
          <OrbitControls enableZoom={false} />
        </Canvas>
      </Box>
      <Typography variant="h6" sx={{ color: LRP_GREEN, fontWeight: 800 }}>
        Score: {score}
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          onClick={() => {
            setScore(0);
            setOrbs([]);
            setRunning(true);
            play("start");
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
    </Stack>
  );
}
