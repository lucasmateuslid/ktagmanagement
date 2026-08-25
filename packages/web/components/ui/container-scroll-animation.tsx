import React, { useEffect, useRef, useState } from 'react';
import { motion, MotionValue, useReducedMotion, useScroll, useTransform } from 'framer-motion';

export function ContainerScroll({ titleComponent, children }: { titleComponent: React.ReactNode; children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(false);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start end', 'end start'] });
  const rotate = useTransform(scrollYProgress, [0.05, 0.48], [reduceMotion ? 0 : 18, 0]);
  const scale = useTransform(scrollYProgress, [0.05, 0.48], reduceMotion ? [1, 1] : mobile ? [0.82, 1] : [0.9, 1]);
  const translate = useTransform(scrollYProgress, [0.05, 0.48], reduceMotion ? [0, 0] : [90, -40]);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return <section className="container-scroll" ref={containerRef}><div className="container-scroll__stage"><Header translate={translate}>{titleComponent}</Header><Card rotate={rotate} scale={scale}>{children}</Card></div></section>;
}

function Header({ translate, children }: { translate: MotionValue<number>; children: React.ReactNode }) {
  return <motion.div className="container-scroll__header" style={{ y: translate }}>{children}</motion.div>;
}

function Card({ rotate, scale, children }: { rotate: MotionValue<number>; scale: MotionValue<number>; children: React.ReactNode }) {
  return <motion.div className="container-scroll__card" style={{ rotateX: rotate, scale }}>{children}</motion.div>;
}
