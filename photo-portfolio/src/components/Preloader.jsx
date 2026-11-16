import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function Preloader({ name }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem('photo-portfolio-visited') === 'true') {
      setVisible(false);
      return undefined;
    }
    sessionStorage.setItem('photo-portfolio-visited', 'true');
    const timeout = window.setTimeout(() => setVisible(false), 2200);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="preloader" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.55 } }} aria-label="Loading gallery">
          <div className="preloader-name" aria-hidden="true">
            {[...String(name || '')].map((letter, index) => (
              <motion.span key={`${letter}-${index}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.045, duration: 0.3 }}>{letter === ' ' ? '\u00a0' : letter}</motion.span>
            ))}
          </div>
          <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.25, duration: 1.2, ease: 'easeInOut' }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
