import { useEffect } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import { AudienceSection, BenefitsSection, ComparisonSection, EditorialBreak, FAQSection, IntegrationsSection, InventorySection, MultiCompanySection, PlatformOverview, ProblemSection, SchedulingSection, TechnicianSection, TrackingSection, WorkflowSection } from './components/MarketingSections';
import LeadForm from './components/LeadForm';
import Footer from './components/Footer';
import { OperationParallax } from '../../components/ui/parallax-scrolling';
import './landing.css';
import './motion.css';
import './impact.css';

export default function Landing() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = 'Centralize veículos, rastreadores, chips, técnicos, estoque, agendamentos e clientes no Monitora360.';
    document.title = 'Monitora360 — Sua operação de rastreamento em um só lugar';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = meta?.content;
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
    meta.content = description;
    return () => { document.title = previousTitle; if (meta && previousDescription !== undefined) meta.content = previousDescription; };
  }, []);

  return (
    <div className="landing-root">
      <Navbar />
      <main>
        <HeroSection />
        <ProblemSection />
        <PlatformOverview />
        <TrackingSection />
        <InventorySection />
        <TechnicianSection />
        <SchedulingSection />
        <MultiCompanySection />
        <IntegrationsSection />
        <ComparisonSection />
        <AudienceSection />
        <WorkflowSection />
        <OperationParallax />
        <EditorialBreak />
        <BenefitsSection />
        <FAQSection />
        <LeadForm />
      </main>
      <Footer />
    </div>
  );
}
