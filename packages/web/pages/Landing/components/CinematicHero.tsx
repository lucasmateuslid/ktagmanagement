import { useEffect, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { BRAND } from '../brand';

const INJECTED_STYLES = `
  .gsap-reveal { visibility: hidden; }

  .film-grain {
      position: absolute; inset: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 50; opacity: 0.05; mix-blend-mode: overlay;
      background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noiseFilter)"/></svg>');
  }

  .bg-grid-theme {
      background-size: 60px 60px;
      background-image:
          linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
  }

  .text-3d-matte {
      color: #FFFFFF;
      text-shadow:
          0 10px 30px rgba(255,255,255, 0.4),
          0 2px 4px rgba(255,255,255, 0.2);
  }

  .text-silver-matte {
      background: linear-gradient(180deg, #FFFFFF 0%, rgba(255,255,255, 0.6) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      transform: translateZ(0);
      filter:
          drop-shadow(0px 10px 20px rgba(255,255,255, 0.3))
          drop-shadow(0px 2px 4px rgba(255,255,255, 0.15));
  }

  .text-card-silver-matte {
      background: linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      transform: translateZ(0);
      filter:
          drop-shadow(0px 12px 24px rgba(0,0,0,0.8))
          drop-shadow(0px 4px 8px rgba(0,0,0,0.6));
  }

  .premium-depth-card {
      background: linear-gradient(145deg, #111111 0%, #050505 100%);
      box-shadow:
          0 40px 100px -20px rgba(0, 0, 0, 0.9),
          0 20px 40px -20px rgba(0, 0, 0, 0.8),
          inset 0 1px 2px rgba(255, 255, 255, 0.2),
          inset 0 -2px 4px rgba(0, 0, 0, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.04);
      position: relative;
  }

  .card-sheen {
      position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 50;
      background: radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(245, 166, 35, 0.06) 0%, transparent 40%);
      mix-blend-mode: screen; transition: opacity 0.3s ease;
  }

  .iphone-bezel {
      background-color: #111;
      box-shadow:
          inset 0 0 0 2px #52525B,
          inset 0 0 0 7px #000,
          0 40px 80px -15px rgba(0,0,0,0.9),
          0 15px 25px -5px rgba(0,0,0,0.7);
      transform-style: preserve-3d;
  }

  .hardware-btn {
      background: linear-gradient(90deg, #404040 0%, #171717 100%);
      box-shadow:
          -2px 0 5px rgba(0,0,0,0.8),
          inset -1px 0 1px rgba(255,255,255,0.15),
          inset 1px 0 2px rgba(0,0,0,0.8);
      border-left: 1px solid rgba(255,255,255,0.05);
  }

  .screen-glare {
      background: linear-gradient(110deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 45%);
  }

  .floating-ui-badge {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.01) 100%);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.1),
          0 25px 50px -12px rgba(0, 0, 0, 0.8),
          inset 0 1px 1px rgba(255,255,255,0.2),
          inset 0 -1px 1px rgba(0,0,0,0.5);
  }

  .btn-modern-light, .btn-modern-dark {
      transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
  }
  .btn-modern-light {
      background: linear-gradient(180deg, #F5A623 0%, #E39512 100%);
      color: #000000;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.1), 0 12px 24px -4px rgba(245, 166, 35, 0.3), inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -3px 6px rgba(0,0,0,0.2);
  }
  .btn-modern-light:hover {
      transform: translateY(-3px);
      box-shadow: 0 0 0 1px rgba(0,0,0,0.05), 0 6px 12px -2px rgba(245, 166, 35, 0.15), 0 20px 32px -6px rgba(245, 166, 35, 0.4), inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -3px 6px rgba(0,0,0,0.2);
  }
  .btn-modern-light:active {
      transform: translateY(1px);
      background: linear-gradient(180deg, #E39512 0%, #D48809 100%);
  }
  .btn-modern-dark {
      background: linear-gradient(180deg, #27272A 0%, #18181B 100%);
      color: #FFFFFF;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.1), 0 2px 4px rgba(0,0,0,0.6), 0 12px 24px -4px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.15), inset 0 -3px 6px rgba(0,0,0,0.8);
  }
  .btn-modern-dark:hover {
      transform: translateY(-3px);
      background: linear-gradient(180deg, #3F3F46 0%, #27272A 100%);
  }
`;

export interface CinematicHeroProps extends HTMLAttributes<HTMLDivElement> {
  brandName?: string;
  tagline1?: string;
  tagline2?: string;
  cardHeading?: string;
  cardDescription?: ReactNode;
  metricValue?: number;
  metricLabel?: string;
  ctaHeading?: string;
  ctaDescription?: string;
  className?: string;
}

export function CinematicHero({
  brandName = BRAND.name.toLowerCase(),
  tagline1 = 'Controle a jornada,',
  tagline2 = 'não só a frota.',
  cardHeading = 'Gestão Operacional Redefinida',
  cardDescription = (
    <>
      <span className="text-white font-semibold text-[#F5A623]">{BRAND.name.toLowerCase()}</span> embarca as melhores práticas de telemetria, oferecendo alertas precisos, agendamentos fluídos e controle absoluto da sua operação.
    </>
  ),
  metricValue = 4800,
  ctaHeading = 'Escale sua central.',
  ctaDescription = 'Junte-se a dezenas de centrais de rastreamento que confiam na nossa tecnologia whitelabel.',
  className,
  ...props
}: CinematicHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCardRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);

  // GSAP carregado dinamicamente: a landing degrada graciosamente se a lib
  // ainda não estiver instalada (mostra o conteúdo estático sem timeline).
  useEffect(() => {
    let revert: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([
          import('gsap'),
          import('gsap/ScrollTrigger'),
        ]);
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);

        const isMobile = window.innerWidth < 768;

        const ctx = gsap.context(() => {
          gsap.set('.text-track', {
            autoAlpha: 0,
            y: 60,
            scale: 0.85,
            filter: 'blur(20px)',
            rotationX: -20,
          });
          gsap.set('.text-days', { autoAlpha: 1, clipPath: 'inset(0 100% 0 0)' });
          gsap.set('.main-card', { y: window.innerHeight + 200, autoAlpha: 1 });
          gsap.set(
            ['.card-left-text', '.card-right-text', '.mockup-scroll-wrapper', '.floating-badge', '.phone-widget'],
            { autoAlpha: 0 },
          );
          gsap.set('.cta-wrapper', { autoAlpha: 0, scale: 0.8, filter: 'blur(30px)' });

          const introTl = gsap.timeline({
            scrollTrigger: { trigger: containerRef.current, start: 'top 70%' },
          });

          introTl
            .to('.text-track', {
              duration: 1.8,
              autoAlpha: 1,
              y: 0,
              scale: 1,
              filter: 'blur(0px)',
              rotationX: 0,
              ease: 'expo.out',
            })
            .to(
              '.text-days',
              { duration: 1.4, clipPath: 'inset(0 0% 0 0)', ease: 'power4.inOut' },
              '-=1.0',
            );

          const scrollTl = gsap.timeline({
            scrollTrigger: {
              trigger: containerRef.current,
              start: 'top top',
              end: '+=7000',
              pin: true,
              scrub: 1,
              anticipatePin: 1,
            },
          });

          scrollTl
            .to(
              ['.hero-text-wrapper', '.bg-grid-theme'],
              { scale: 1.15, filter: 'blur(20px)', opacity: 0.2, ease: 'power2.inOut', duration: 2 },
              0,
            )
            .to('.main-card', { y: 0, ease: 'power3.inOut', duration: 2 }, 0)
            .to('.main-card', {
              width: '100%',
              height: '100%',
              borderRadius: '0px',
              ease: 'power3.inOut',
              duration: 1.5,
            })
            .fromTo(
              '.mockup-scroll-wrapper',
              { y: 300, z: -500, rotationX: 50, rotationY: -30, autoAlpha: 0, scale: 0.6 },
              {
                y: 0,
                z: 0,
                rotationX: 0,
                rotationY: 0,
                autoAlpha: 1,
                scale: 1,
                ease: 'expo.out',
                duration: 2.5,
              },
              '-=0.8',
            )
            .fromTo(
              '.phone-widget',
              { y: 40, autoAlpha: 0, scale: 0.95 },
              { y: 0, autoAlpha: 1, scale: 1, stagger: 0.15, ease: 'back.out(1.2)', duration: 1.5 },
              '-=1.5',
            )
            .to('.counter-val', { innerHTML: metricValue, snap: { innerHTML: 1 }, duration: 2, ease: 'expo.out' }, '-=2.0')
            .fromTo(
              '.floating-badge',
              { y: 100, autoAlpha: 0, scale: 0.7, rotationZ: -10 },
              { y: 0, autoAlpha: 1, scale: 1, rotationZ: 0, ease: 'back.out(1.5)', duration: 1.5, stagger: 0.2 },
              '-=2.0',
            )
            .fromTo(
              '.card-left-text',
              { x: -50, autoAlpha: 0 },
              { x: 0, autoAlpha: 1, ease: 'power4.out', duration: 1.5 },
              '-=1.5',
            )
            .fromTo(
              '.card-right-text',
              { x: 50, autoAlpha: 0, scale: 0.8 },
              { x: 0, autoAlpha: 1, scale: 1, ease: 'expo.out', duration: 1.5 },
              '<',
            )
            .to({}, { duration: 2.5 })
            .set('.hero-text-wrapper', { autoAlpha: 0 })
            .set('.cta-wrapper', { autoAlpha: 1 })
            .to({}, { duration: 1.5 })
            .to(['.mockup-scroll-wrapper', '.floating-badge', '.card-left-text', '.card-right-text'], {
              scale: 0.9,
              y: -40,
              z: -200,
              autoAlpha: 0,
              ease: 'power3.in',
              duration: 1.2,
              stagger: 0.05,
            })
            .to(
              '.main-card',
              {
                width: isMobile ? '92vw' : '85vw',
                height: isMobile ? '92vh' : '85vh',
                borderRadius: isMobile ? '32px' : '40px',
                ease: 'expo.inOut',
                duration: 1.8,
              },
              'pullback',
            )
            .to('.cta-wrapper', { scale: 1, filter: 'blur(0px)', ease: 'expo.inOut', duration: 1.8 }, 'pullback')
            .to('.main-card', { y: -window.innerHeight - 300, ease: 'power3.in', duration: 1.5 });
        }, containerRef);

        revert = () => ctx.revert();
      } catch {
        // gsap não instalado — landing continua funcional sem timeline cinemática
      }
    })();

    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const componentRect = containerRef.current.getBoundingClientRect();
        if (componentRect.top > window.innerHeight || componentRect.bottom < 0) return;
      }

      cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(() => {
        if (mainCardRef.current) {
          const rect = mainCardRef.current.getBoundingClientRect();
          mainCardRef.current.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
          mainCardRef.current.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
        }
      });
    };
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      cancelled = true;
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(requestRef.current);
      revert?.();
    };
  }, [metricValue]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-screen overflow-hidden flex items-center justify-center bg-transparent text-white font-sans antialiased',
        className,
      )}
      style={{ perspective: '1500px', colorScheme: 'dark' }}
      {...props}
    >
      <style dangerouslySetInnerHTML={{ __html: INJECTED_STYLES }} />
      <div className="film-grain" aria-hidden="true" />
      <div className="bg-grid-theme absolute inset-0 z-0 pointer-events-none opacity-50" aria-hidden="true" />

      <div className="hero-text-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-full px-4 will-change-transform">
        <h1 className="text-track gsap-reveal text-3d-matte text-white text-5xl md:text-7xl lg:text-[6rem] font-bold tracking-tight mb-2 max-w-[90vw] mx-auto">
          {tagline1}
        </h1>
        <h1 className="text-days gsap-reveal text-silver-matte text-white text-5xl md:text-7xl lg:text-[6rem] font-extrabold tracking-tighter max-w-[90vw] mx-auto">
          {tagline2}
        </h1>
      </div>

      <div className="cta-wrapper absolute z-10 flex flex-col items-center justify-center text-center w-full px-4 gsap-reveal pointer-events-auto will-change-transform">
        <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight text-silver-matte">
          {ctaHeading}
        </h2>
        <p className="text-neutral-400 text-lg md:text-xl mb-12 max-w-xl mx-auto font-medium leading-relaxed">
          {ctaDescription}
        </p>
        <div className="flex flex-col sm:flex-row gap-6">
          <a
            href="#solicitar"
            aria-label="Solicitar Acesso"
            className="btn-modern-light flex items-center justify-center gap-3 px-10 py-5 rounded-[1.25rem] group focus:outline-none focus:ring-2 focus:ring-[#F5A623] focus:ring-offset-2 focus:ring-offset-black"
          >
            <span className="text-xl font-bold leading-none tracking-tight">Solicitar Acesso</span>
            <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
          <a
            href="#demonstracao"
            aria-label="Ver Demonstração"
            className="btn-modern-dark flex items-center justify-center gap-3 px-10 py-5 rounded-[1.25rem] group focus:outline-none focus:ring-2 focus:ring-[#F5A623] focus:ring-offset-2 focus:ring-offset-black"
          >
            <span className="text-xl font-bold leading-none tracking-tight text-white">Ver Demonstração</span>
          </a>
        </div>
      </div>

      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none" style={{ perspective: '1500px' }}>
        <div
          ref={mainCardRef}
          className="main-card premium-depth-card relative overflow-hidden gsap-reveal flex items-center justify-center pointer-events-auto w-[92vw] md:w-[85vw] h-[92vh] md:h-[85vh] rounded-[32px] md:rounded-[40px]"
        >
          <div className="card-sheen" aria-hidden="true" />

          <div className="relative w-full h-full max-w-7xl mx-auto px-4 lg:px-12 flex flex-col justify-evenly lg:grid lg:grid-cols-3 items-center lg:gap-8 z-10 py-6 lg:py-0">
            <div className="card-right-text gsap-reveal order-1 lg:order-3 flex justify-center lg:justify-end z-20 w-full">
              <h2 className="text-6xl md:text-[6rem] lg:text-[7rem] font-black uppercase tracking-tighter text-card-silver-matte lg:mt-0 text-center lg:text-right leading-[0.85]">
                {brandName}
              </h2>
            </div>

            <div
              className="mockup-scroll-wrapper order-2 lg:order-2 relative w-full h-[380px] lg:h-[600px] flex items-center justify-center z-10"
              style={{ perspective: '1000px' }}
            >
              <div className="relative w-full h-full flex items-center justify-center transform scale-[0.65] md:scale-90 lg:scale-100">
                <div
                  ref={mockupRef}
                  className="relative w-[280px] h-[580px] rounded-[3rem] iphone-bezel flex flex-col will-change-transform bg-[#0A0A0A]"
                >
                  <div className="absolute top-[120px] -left-[3px] w-[3px] h-[25px] hardware-btn rounded-l-md z-0" aria-hidden="true" />
                  <div className="absolute top-[160px] -left-[3px] w-[3px] h-[45px] hardware-btn rounded-l-md z-0" aria-hidden="true" />
                  <div className="absolute top-[220px] -left-[3px] w-[3px] h-[45px] hardware-btn rounded-l-md z-0" aria-hidden="true" />
                  <div className="absolute top-[170px] -right-[3px] w-[3px] h-[70px] hardware-btn rounded-r-md z-0 scale-x-[-1]" aria-hidden="true" />

                  <div className="absolute inset-[7px] bg-[#F4F4F5] rounded-[2.5rem] overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.5)] z-10 font-sans">
                    <div className="absolute inset-0 screen-glare z-40 pointer-events-none" aria-hidden="true" />

                    <div className="absolute top-[5px] left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-black rounded-full z-50 flex items-center justify-end px-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#F5A623] shadow-[0_0_8px_rgba(245,166,35,0.8)] animate-pulse" />
                    </div>

                    <div className="relative w-full h-full flex flex-col font-sans">
                      <div className="w-full bg-white pt-[50px] pb-3 px-4 flex justify-between items-center shadow-sm relative z-30">
                        <svg className="w-5 h-5 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        <div className="flex gap-2">
                          <div className="w-8 h-8 rounded-xl bg-neutral-50 flex items-center justify-center border border-neutral-100">
                            <svg className="w-4 h-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                          </div>
                          <div className="w-8 h-8 rounded-xl bg-neutral-50 flex items-center justify-center relative border border-neutral-100">
                            <div className="absolute top-1.5 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
                            <svg className="w-4 h-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                          </div>
                          <div className="w-8 h-8 rounded-xl bg-neutral-50 flex items-center justify-center border border-neutral-100">
                            <svg className="w-4 h-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 overflow-hidden" style={{ maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)' }}>
                        <div className="phone-widget">
                          <div className="px-4 mt-4 flex gap-2">
                            <div className="flex-1 bg-white rounded-2xl py-2 px-3 flex items-center gap-2 shadow-sm border border-neutral-100">
                              <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              <div className="flex flex-col">
                                <span className="text-[5px] text-[#F5A623] font-bold uppercase tracking-wider">Agenda</span>
                                <span className="text-[7.5px] font-bold text-neutral-800 leading-tight">AGENDAR SERVIÇO</span>
                              </div>
                            </div>
                            <div className="flex-1 bg-white rounded-2xl py-2 px-3 flex items-center gap-2 shadow-sm border border-neutral-100">
                              <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                              <div className="flex flex-col">
                                <span className="text-[5px] text-neutral-400 font-bold uppercase tracking-wider">Tempo Real</span>
                                <span className="text-[7.5px] font-bold text-neutral-800 leading-tight">MONITORAMENTO</span>
                              </div>
                            </div>
                          </div>

                          <div className="px-4 mt-6">
                            <div className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest flex items-center gap-2">
                              <div className="w-[3px] h-3 bg-neutral-400 rounded-sm" />
                              Veículos e Equipamentos
                            </div>

                            <div className="mt-4 bg-white rounded-3xl p-5 shadow-[0_4px_10px_rgba(0,0,0,0.03)] border border-neutral-100/50 relative overflow-hidden">
                              <div className="text-[9px] text-neutral-500 font-extrabold tracking-widest mb-1 uppercase">Total Equipamentos</div>
                              <div className="text-[2.25rem] leading-none font-extrabold text-[#1a1a1a] tracking-tight">649</div>
                              <div className="absolute right-5 top-5 w-10 h-10 bg-[#FAFAFA] rounded-2xl flex items-center justify-center">
                                <svg className="w-5 h-5 text-[#F5A623]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                              </div>
                              <div className="absolute bottom-0 left-0 w-full h-[60%] bg-gradient-to-t from-[#F5A623]/[0.08] to-transparent pointer-events-none" />
                              <svg className="absolute bottom-0 left-0 w-full h-8 text-[#F5A623]/10" preserveAspectRatio="none" viewBox="0 0 100 100"><path d="M0,100 L0,50 Q25,30 50,45 T100,60 L100,100 Z" fill="currentColor" /></svg>
                            </div>

                            <div className="mt-4 bg-[#111111] rounded-[28px] p-5 shadow-xl relative overflow-hidden">
                              <div className="flex justify-between items-start mb-5">
                                <div>
                                  <div className="text-[9px] text-neutral-400 font-extrabold tracking-widest mb-1 uppercase">Total de Veículos</div>
                                  <div className="text-[2.25rem] leading-none font-extrabold text-white tracking-tight">435</div>
                                </div>
                                <div className="w-10 h-10 border border-[#F5A623]/30 bg-[#F5A623]/5 rounded-2xl flex items-center justify-center">
                                  <svg className="w-5 h-5 text-[#F5A623]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l2-6h10l2 6M5 10v10a2 2 0 002 2h10a2 2 0 002-2V10M5 10h14M8 14h.01M16 14h.01" /></svg>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                {[
                                  { label: 'Carro', value: '292' },
                                  { label: 'Motocicleta', value: '127' },
                                  { label: 'Pickup/SUV', value: '8' },
                                  { label: 'Caminhão', value: '7' },
                                ].map((item) => (
                                  <div key={item.label} className="bg-[#1C1C1E] rounded-2xl p-3 border border-white/5">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <span className="text-[8px] text-neutral-500 font-extrabold uppercase tracking-wider">
                                        {item.label}
                                      </span>
                                    </div>
                                    <div className="text-xl font-bold text-white leading-none">{item.value}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="absolute bottom-5 right-5 w-12 h-12 bg-[#F5A623] rounded-full shadow-[0_8px_16px_rgba(245,166,35,0.4)] flex items-center justify-center z-50 cursor-pointer">
                        <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white" />
                        <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                      </div>

                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[120px] h-[4px] bg-black/20 rounded-full z-50" />
                    </div>
                  </div>
                </div>

                <div className="floating-badge absolute flex top-6 lg:top-12 left-[-15px] lg:left-[-80px] floating-ui-badge rounded-xl lg:rounded-2xl p-3 lg:p-4 items-center gap-3 lg:gap-4 z-30">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-b from-[#F5A623]/20 to-[#F5A623]/10 flex items-center justify-center border border-[#F5A623]/30 shadow-inner">
                    <span className="text-base lg:text-xl drop-shadow-lg text-[#F5A623]" aria-hidden="true">📡</span>
                  </div>
                  <div>
                    <p className="text-white text-xs lg:text-sm font-bold tracking-tight">Veículo Online</p>
                    <p className="text-[#F5A623]/70 text-[10px] lg:text-xs font-medium">Conexão estável</p>
                  </div>
                </div>

                <div className="floating-badge absolute flex bottom-12 lg:bottom-20 right-[-15px] lg:right-[-80px] floating-ui-badge rounded-xl lg:rounded-2xl p-3 lg:p-4 items-center gap-3 lg:gap-4 z-30">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-b from-blue-500/20 to-blue-900/10 flex items-center justify-center border border-blue-400/30 shadow-inner">
                    <span className="text-base lg:text-lg drop-shadow-lg" aria-hidden="true">📍</span>
                  </div>
                  <div>
                    <p className="text-white text-xs lg:text-sm font-bold tracking-tight">Cerca Violada</p>
                    <p className="text-blue-200/50 text-[10px] lg:text-xs font-medium">Alerta despachado</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-left-text gsap-reveal order-3 lg:order-1 flex flex-col justify-center text-center lg:text-left z-20 w-full lg:max-w-none px-4 lg:px-0">
              <h3 className="text-white text-2xl md:text-3xl lg:text-5xl font-bold mb-4 lg:mb-5 tracking-tight">
                {cardHeading}
              </h3>
              <p className="hidden md:block text-white/70 text-sm md:text-base lg:text-lg font-medium leading-relaxed mx-auto lg:mx-0 max-w-sm lg:max-w-none">
                {cardDescription}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
