"use client";

import type { ReactNode } from "react";
import { m } from "motion/react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  yOffset?: number;
}

/**
 * Reusable scroll reveal wrapper component.
 * Performs smooth fade-up on scroll when element enters viewport.
 * Only animates transform (y) and opacity to eliminate CLS.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  duration = 0.5,
  yOffset = 20,
}: RevealProps) {
  return (
    <m.div
      initial={{ opacity: 0.85, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </m.div>
  );
}
