"use client";

import type { ReactNode } from "react";
import { m } from "motion/react";

interface HeroMotionWrapperProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Fast entry animation for Hero LCP content.
 * Keeps initial opacity visible (opacity 1 or fast 0.1s transition) to ensure LCP performance.
 */
export function HeroFadeIn({ children, className = "", delay = 0 }: HeroMotionWrapperProps) {
  return (
    <m.div
      initial={{ opacity: 0.9, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </m.div>
  );
}

/**
 * Infinite gentle floating animation for Hero visual showcase cards and badges.
 * Uses hardware-accelerated transform translateY only (6-8px, 7s duration, ease-in-out).
 */
export function HeroFloat({ children, className = "", delay = 0 }: HeroMotionWrapperProps) {
  return (
    <m.div
      animate={{ y: [0, -7, 0] }}
      transition={{
        duration: 7,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
      className={className}
    >
      {children}
    </m.div>
  );
}
