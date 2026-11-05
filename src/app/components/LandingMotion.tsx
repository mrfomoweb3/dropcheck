'use client';

import { useEffect } from 'react';

export function LandingMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });

    document.querySelectorAll('.reveal-section').forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return null;
}
