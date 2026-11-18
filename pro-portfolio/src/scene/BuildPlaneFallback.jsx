import { motion, useScroll, useTransform } from 'framer-motion';

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

export default function BuildPlaneFallback({ content, reducedMotion }) {
  const { scrollYProgress } = useScroll();
  const nodes = [
    ...(content.skills || []).flatMap((category) => category.items || []),
    ...(content.projects || [])
  ].map((item) => typeof item === 'string' ? item : item?.name || item?.title)
    .filter((label) => typeof label === 'string' && label.trim())
    .slice(0, NODE_LAYOUT.length);

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
            progress={scrollYProgress}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>
      <div className="build-fallback-grid" />
    </div>
  );
}
