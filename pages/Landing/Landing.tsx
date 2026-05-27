import { useEffect } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import TrustBar from './components/TrustBar';
import FeaturesGrid from './components/FeaturesGrid';
import { CinematicHero } from './components/CinematicHero';
import StatsSection from './components/StatsSection';
import HowItWorks from './components/HowItWorks';
import ProductShowcase from './components/ProductShowcase';
import Pricing from './components/Pricing';
import FinalCTA from './components/FinalCTA';
import Footer from './components/Footer';
import { BRAND } from './brand';
import './landing.css';

export default function Landing() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${BRAND.name} — Plataforma whitelabel para centrais de rastreamento`;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="landing-root min-h-screen bg-[#0a0a0a] text-white selection:bg-[#F5A623] selection:text-black overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <TrustBar />
      <FeaturesGrid />
      <CinematicHero />
      <StatsSection />
      <HowItWorks />
      <ProductShowcase />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
