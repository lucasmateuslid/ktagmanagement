import { ArrowDown, ArrowRight, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import { ContainerScroll } from '../../../components/ui/container-scroll-animation';
import { DashboardPreview } from './ProductPreviews';

function TopographicLines() {
  return <svg className="hero-topography" viewBox="0 0 900 520" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{Array.from({ length: 34 }).map((_, i) => <path key={i} d={`M-180 ${-110 + i * 12} C ${90 + i * 2} ${-30 + i * 7}, ${170 + i * 4} ${330 - i * 2}, ${510 + i * 3} ${250 + i * 8} S 760 ${430 + i * 3}, 1060 ${220 + i * 9}`} stroke="currentColor" strokeWidth={0.45 + i * 0.03} opacity={0.045 + i * 0.009} />)}</svg>;
}

export default function HeroSection() {
  return <>
    <section id="topo" className="marketing-hero marketing-hero--impact">
      <video className="marketing-hero__video" autoPlay loop muted playsInline preload="metadata" aria-hidden="true"><source src="/video.webm" type="video/webm" /></video>
      <div className="marketing-hero__veil" aria-hidden="true" />
      <TopographicLines />
      <div className="hero-signal hero-signal--one" aria-hidden="true"/><div className="hero-signal hero-signal--two" aria-hidden="true"/>
      <div className="marketing-shell marketing-hero__copy">
        <motion.p className="hero-badge" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .6 }}><Radio/> Console de operações · Tracking &amp; dispatch</motion.p>
        <h1><motion.span initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .75, delay: .08 }}>SUA OPERAÇÃO</motion.span><motion.span initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .75, delay: .17 }}>DE RASTREAMENTO.</motion.span><motion.span className="hero-accent-line" initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .75, delay: .26 }}>EM UM SÓ LUGAR.</motion.span></h1>
        <motion.p className="marketing-lead" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .35 }}>Controle veículos, rastreadores, chips, técnicos, estoque e agendamentos sem depender de planilhas e processos espalhados.</motion.p>
        <motion.div className="marketing-actions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .7, delay: .44 }}><a className="marketing-button" href="#demonstracao">Agendar uma demonstração <ArrowRight /></a><a className="marketing-button marketing-button--secondary" href="#produto">Conhecer a plataforma</a></motion.div>
        <a className="marketing-scroll" href="#produto" aria-label="Avançar para o produto"><span>Explore a plataforma</span><ArrowDown /></a>
      </div>
    </section>
    <div id="product-shot" className="product-reveal">
      <ContainerScroll titleComponent={<div className="product-reveal__title"><p className="marketing-kicker">Produto real. Operação visível.</p><h2>Não é mais uma tela de mapa.<br/><span>É a central da sua operação.</span></h2></div>}><DashboardPreview hero /></ContainerScroll>
      <p className="marketing-proof">Criado para operações que precisam controlar rastreamento em escala.</p>
    </div>
  </>;
}
