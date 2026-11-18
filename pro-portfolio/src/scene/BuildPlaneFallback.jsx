import { useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

const NODE_LAYOUT = [
  [18, 30], [73, 24], [48, 47], [23, 65], [78, 70], [53, 82], [42, 18]
];
const CONNECTIONS = [[0, 2], [1, 2], [2, 3], [2, 4], [3, 5], [2, 6]];

function NetworkNode({ label, index, total, progress, reducedMotion }) {
  const [left, top] = NODE_LAYOUT[index % NODE_LAYOUT.length];
  const center = (index + 1) / (total + 1);
  const opacity = useTransform(
    progress,
    [Math.max(0, center - 0.24), center, Math.min(1, center + 0.24)],
    [0.28, 0.9, 0.28]
  );
  const scale = useTransform(
    progress,
    [Math.max(0, center - 0.24), center, Math.min(1, center + 0.24)],
    [0.82, 1.15, 0.82]
  );
  const drift = useTransform(progress, [0, 1], [18, -18]);

  return (
    <motion.div
      className="build-fallback-node"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        opacity: reducedMotion ? 0.45 : opacity,
        scale: reducedMotion ? 1 : scale,
        y: reducedMotion ? 0 : drift
      }}
    >
      <span className="build-fallback-node-light" />
      <span className="build-fallback-node-label">{label}</span>
    </motion.div>
  );
}

function sceneClearance(startTrigger, endTrigger) {
  const topbarHeight = document.querySelector('.topbar')?.offsetHeight || 76;
  const startPosition = startTrigger.getBoundingClientRect().top + window.scrollY - topbarHeight;
  const endPosition = endTrigger.getBoundingClientRect().top + window.scrollY - window.innerHeight;
  return Math.min(300, Math.floor(Math.max(0, endPosition - startPosition) * 0.2));
}

export default function BuildPlaneFallback({ content, reducedMotion, startSection }) {
  const progress = useMotionValue(0);
  const nodes = [
    ...(content.skills || []).flatMap((category) => category.items || []),
    ...(content.projects || [])
  ].map((item) => typeof item === 'string' ? item : item?.name || item?.title)
    .filter((label) => typeof label === 'string' && label.trim())
    .slice(0, NODE_LAYOUT.length);

  useEffect(() => {
    if (reducedMotion || !startSection) return undefined;
    const journey = document.getElementById('journey');
    const startTrigger = document.getElementById(startSection);
    const endTrigger = document.querySelector('#contact .contact-form') ||
      document.getElementById('contact') ||
      document.querySelector('.site-footer') ||
      journey;
    if (!journey || !startTrigger || !endTrigger) return undefined;

    progress.set(0);
    let frame = 0;
    const updateProgress = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const topbarHeight = document.querySelector('.topbar')?.offsetHeight || 76;
        const startPosition = startTrigger.getBoundingClientRect().top + window.scrollY - topbarHeight;
        const endPosition = endTrigger.getBoundingClientRect().top + window.scrollY - window.innerHeight -
          sceneClearance(startTrigger, endTrigger);
        const range = Math.max(1, endPosition - startPosition);
        progress.set(Math.max(0, Math.min(1, (window.scrollY - startPosition) / range)));
      });
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateProgress);
      resizeObserver.observe(journey);
      resizeObserver.observe(startTrigger);
      resizeObserver.observe(endTrigger);
    }
    updateProgress();
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [progress, reducedMotion, startSection]);

  return (
    <div className="build-plane-fallback" aria-hidden="true">
      <div className="build-fallback-glow" />
      <svg className="build-fallback-connections" viewBox="0 0 100 100" preserveAspectRatio="none">
        {CONNECTIONS.map(([from, to]) => {
          const start = NODE_LAYOUT[from];
          const end = NODE_LAYOUT[to];
          return <line key={`${from}-${to}`} x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />;
        })}
      </svg>
      <div className="build-fallback-nodes">
        {nodes.map((label, index) => (
          <NetworkNode
            key={`${label}-${index}`}
            label={label}
            index={index}
            total={nodes.length}
            progress={progress}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>
      <div className="build-fallback-grid" />
    </div>
  );
}
