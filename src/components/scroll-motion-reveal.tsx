"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ArticleElementMotionEffect, ArticleMotionSpeed } from "@/lib/newsletter-repository";

type ScrollMotionRevealProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  motionEffect: ArticleElementMotionEffect;
  motionSpeed: ArticleMotionSpeed;
  threshold?: number;
};

export function ScrollMotionReveal({
  children,
  className = "",
  disabled = false,
  motionEffect,
  motionSpeed,
  threshold = 0.22,
}: ScrollMotionRevealProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(disabled || motionEffect === "none");

  useEffect(() => {
    const element = elementRef.current;

    if (!element || disabled || motionEffect === "none") {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      const timeoutId = globalThis.setTimeout(() => setIsReady(true), 0);

      return () => globalThis.clearTimeout(timeoutId);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        setIsReady(true);
        observer.disconnect();
      },
      {
        root: null,
        rootMargin: "0px 0px -10% 0px",
        threshold,
      },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [disabled, motionEffect, threshold]);

  return (
    <div
      ref={elementRef}
      className={`article-motion-reveal ${className}`}
      data-motion-effect={motionEffect}
      data-motion-ready={isReady ? "true" : "false"}
      data-motion-speed={motionSpeed}
    >
      {children}
    </div>
  );
}
