import { motion, useScroll, useTransform } from 'framer-motion';
import { cloudinaryUrl } from '../api';

const PHOTO_LAYOUT = [
  { left: '6%', top: '21%', width: '47%', rotation: -7 },
  { left: '53%', top: '37%', width: '42%', rotation: 6 },
  { left: '12%', top: '59%', width: '43%', rotation: 4 },
  { left: '56%', top: '71%', width: '39%', rotation: -5 }
];

function FloatingPhoto({ photo, index, total, progress, reducedMotion }) {
  const layout = PHOTO_LAYOUT[index];
  const center = (index + 1) / (total + 1);
  const opacity = useTransform(
    progress,
    [Math.max(0, center - 0.22), center, Math.min(1, center + 0.22)],
    [0.2, 0.62, 0.2]
  );
  const scale = useTransform(
    progress,
    [Math.max(0, center - 0.22), center, Math.min(1, center + 0.22)],
    [0.92, 1.04, 0.92]
  );
  const drift = useTransform(progress, [0, 1], [22, -22]);

  return (
    <motion.figure
      className="light-field-fallback-photo"
      style={{
        left: layout.left,
        top: layout.top,
        width: layout.width,
        rotateY: reducedMotion ? 0 : layout.rotation,
        opacity: reducedMotion ? 0.16 : opacity,
        scale: reducedMotion ? 1 : scale,
        y: reducedMotion ? 0 : drift
      }}
    >
      <img src={cloudinaryUrl(photo.src, 520)} alt="" loading="lazy" />
      <span />
    </motion.figure>
  );
}

export default function LightFieldFallback({ photos, reducedMotion }) {
  const { scrollYProgress } = useScroll();
  const selectedPhotos = photos.slice(0, PHOTO_LAYOUT.length);

  return (
    <div className="light-field-fallback" aria-hidden="true">
      <div className="light-field-fallback-shaft" />
      <div className="light-field-fallback-photos">
        {selectedPhotos.map((photo, index) => (
          <FloatingPhoto
            key={photo.id || photo.publicId || photo.src}
            photo={photo}
            index={index}
            total={selectedPhotos.length}
            progress={scrollYProgress}
            reducedMotion={reducedMotion}
          />
        ))}
      </div>
    </div>
  );
}
