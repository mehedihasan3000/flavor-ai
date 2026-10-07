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
 * Transform-only rise (no opacity fade) on the page's smooth ease-out curve:
 * the headline, subcopy, and CTAs paint immediately for LCP, then glide up
 * into place. Stays off the critical paint path while still feeling smooth.
 */
export function HeroFadeIn({ children, className = "", delay = 0 }: HeroMotionWrapperProps) {
  return (
    <m.div
      initial={{ y: 14 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </m.div>
  );
}

/**
 * Infinite gentle floating animation for small Hero accents (badges).
 * Transform-only (translateY 7px, 7s ease-in-out) on the compositor thread.
 * Keep this away from large layers (images, blurred cards) — floating those
 * repaints a huge surface every frame and reads as jank.
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
      style={{ willChange: "transform" }}
      className={className}
    >
      {children}
    </m.div>
  );
}
