"use client";

import type { ReactNode } from "react";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";

interface MotionProviderProps {
  children: ReactNode;
}

/**
 * Scoped Motion provider for home page components.
 * Loads lightweight DOM animation features asynchronously and respects user reduced-motion settings.
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
