"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { MAX_TRAIL_LENGTH, MAX_SPARKS, PORTAL_BLUE } from "@/app/constants";
interface SparkPoint {
  id: number;
  x: number;
  y: number;
  life: number;
  blur: number;
}

let nextId = 1;

export default function MouseTrail() {
  const [sparks, setSparks] = useState<SparkPoint[]>([]);
  const [mounted, setMounted] = useState(false);

  // Pre-compute static styles
  const baseStyles = useMemo(
    () => ({
      pointerEvents: "none" as const,
      position: "fixed" as const,
      zIndex: 50,
      width: "1px",
      height: "1px",
      borderRadius: "50%",
      mixBlendMode: "screen" as const,
      willChange: "transform, opacity, filter",
    }),
    [],
  );

  const addSpark = useCallback((x: number, y: number) => {
    setSparks((current) =>
      [
        ...current,
        {
          id: nextId++,
          x,
          y,
          life: 1,
          blur: 5,
        },
      ].slice(-MAX_SPARKS),
    );
  }, []);

  useEffect(() => {
    setMounted(true);
    let rafId: number;
    let positions: { x: number; y: number }[] = [];

    const handleMouseMove = (e: MouseEvent) => {
      positions.push({ x: e.clientX, y: e.clientY });

      // Limit stored positions for smooth trailing
      if (positions.length > MAX_TRAIL_LENGTH) {
        positions = positions.slice(-MAX_TRAIL_LENGTH);
      }
    };

    const animate = () => {
      // Process stored positions for smooth trail
      if (positions.length > 0) {
        const pos = positions.shift();
        if (pos) {
          addSpark(pos.x, pos.y);
        }
      }

      setSparks((current) =>
        current
          .map((spark) => ({
            ...spark,
            life: spark.life - 0.02,
            blur: spark.blur + 0.2,
          }))
          .filter((spark) => spark.life > 0),
      );

      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, [addSpark]);

  if (!mounted) return null;

  return (
    <>
      {sparks.map((spark) => (
        <div
          key={spark.id}
          style={{
            ...baseStyles,
            transform: `translate(${spark.x}px, ${spark.y}px)`,
            opacity: spark.life * 0.4,
            filter: `blur(${spark.blur}px)`,
            backgroundColor: `rgba(${PORTAL_BLUE}, ${spark.life * 0.3})`,
            boxShadow: `
                            0 0 20px 10px rgba(${PORTAL_BLUE}, ${spark.life * 0.15}),
                            0 0 30px 15px rgba(${PORTAL_BLUE}, ${spark.life * 0.1})
                        `,
          }}
        />
      ))}
    </>
  );
}
