'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

function subscribeMotion(change: () => void) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  preference.addEventListener('change', change);
  return () => preference.removeEventListener('change', change);
}

function subscribeVisibility(change: () => void) {
  document.addEventListener('visibilitychange', change);
  return () => document.removeEventListener('visibilitychange', change);
}

const readReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const readPageVisible = () => document.visibilityState === 'visible';
const motionOnServer = () => true;
const visibleOnServer = () => false;

export function useMotionActivity<T extends Element>(active = true) {
  const ref = useRef<T>(null);
  const [visibility, setVisibility] = useState({ visible: false, entered: false });
  const reducedMotion = useSyncExternalStore(subscribeMotion, readReducedMotion, motionOnServer);
  const pageVisible = useSyncExternalStore(subscribeVisibility, readPageVisible, visibleOnServer);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisibility((previous) => ({
        visible: entry.isIntersecting && entry.intersectionRatio >= 0.1,
        entered: previous.entered || (entry.isIntersecting && entry.intersectionRatio >= 0.1 && active),
      }));
    }, { threshold: 0.1 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);

  return { ref, reducedMotion, entered: visibility.entered,
    active: active && visibility.visible && pageVisible };
}

type MotionVideoProps = {
  src: string;
  poster: string;
  label: string;
  className?: string;
  active?: boolean;
  controls?: boolean;
  onError?: () => void;
};

export default function MotionVideo({ src, poster, label, className, active = true,
  controls = true, onError }: MotionVideoProps) {
  const { ref: videoRef, reducedMotion, entered, active: isActive } = useMotionActivity<HTMLVideoElement>(active);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isActive && !reducedMotion && entered) {
      void video.play().catch(() => { /* Native controls remain available if autoplay is blocked. */ });
    } else {
      video.pause();
    }
  }, [isActive, reducedMotion, entered, videoRef, src]);

  if (failed) {
    return <Image className={className} src={poster} width={768} height={1024} alt={`${label} — photo guide`} />;
  }

  return <video
    ref={videoRef}
    className={className}
    src={entered ? src : undefined}
    muted
    loop={!reducedMotion}
    playsInline
    controls={controls || reducedMotion}
    preload={isActive ? 'metadata' : 'none'}
    poster={poster}
    aria-label={label}
    onPlay={(event) => { if (!isActive) event.currentTarget.pause(); }}
    onError={() => { setFailed(true); onError?.(); }}
  />;
}
