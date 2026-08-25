import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

export function OperationParallax() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const back = useTransform(scrollYProgress, [0, 1], reduceMotion ? ['0%', '0%'] : ['-8%', '18%']);
  const mid = useTransform(scrollYProgress, [0, 1], reduceMotion ? ['0%', '0%'] : ['8%', '-12%']);
  const title = useTransform(scrollYProgress, [0, 1], reduceMotion ? ['0%', '0%'] : ['24%', '-24%']);
  return (
    <section className="operation-parallax" ref={ref} aria-label="Operação conectada">
      <motion.div className="operation-parallax__orb operation-parallax__orb--a" style={{ y: back }} />
      <motion.div className="operation-parallax__orb operation-parallax__orb--b" style={{ y: mid }} />
      <motion.svg className="operation-parallax__lines" style={{ y: back }} viewBox="0 0 900 520" fill="none" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => <path key={i} d={`M-80 ${20 + i * 17} C 180 ${-50 + i * 22}, 350 ${210 + i * 5}, 540 ${120 + i * 12} S 800 ${60 + i * 15}, 980 ${180 + i * 10}`} stroke="currentColor" strokeWidth={0.5 + i * 0.035} opacity={0.07 + i * 0.012} />)}
      </motion.svg>
      <motion.div className="operation-parallax__content" style={{ y: title }}><span>Informação no lugar certo</span><strong>OPERAÇÃO<br/><i>CONECTADA</i></strong><p>Rastreamento, campo e equipamentos trabalhando como uma única estrutura.</p></motion.div>
    </section>
  );
}
