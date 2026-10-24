import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import HeroSection from "./components/HeroSection";
import OperationPreview from "./components/OperationPreview";
import {
  GrowthSection,
  ReferenceCompanies,
  ImplementationSteps,
  OperationModes,
  SalesFAQ,
} from "./components/SalesSections";
import Pricing from "./components/Pricing";
import UsageCalculator from "./components/UsageCalculator";
import LeadForm from "./components/LeadForm";
import Footer from "./components/Footer";
import type { BillingPeriod, CommercialQuote, OperationMode } from "./pricing";
import "./landing.css";
export default function Landing() {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [mode, setMode] = useState<OperationMode>("integrated");
  const [quote, setQuote] = useState<CommercialQuote | null>(null);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Monitora 360 — Proteja muito mais, gastando bem menos";
    const existingMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const meta = existingMeta ?? document.createElement("meta");
    const previousDescription = meta.content;
    if (!existingMeta) {
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content =
      "Localização, rastreamento, estoque, chips e ocorrências para empresas de rastreamento e proteção veicular. Integre sua operação, simule o uso e encontre seu plano Monitora 360.";
    return () => {
      document.title = previousTitle;
      if (existingMeta) meta.content = previousDescription;
      else meta.remove();
    };
  }, []);
  const changePeriod = (value: BillingPeriod) => {
    setPeriod(value);
    setQuote((current) => (current ? { ...current, period: value } : null));
  };
  const changeMode = (value: OperationMode) => {
    setMode(value);
    setQuote((current) => (current ? { ...current, mode: value } : null));
  };
  return (
    <div className="sales-landing">
      <a className="sales-skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <Navbar />
      <main id="conteudo">
        <HeroSection />
        <ReferenceCompanies />
        <OperationPreview />
        <OperationModes mode={mode} onModeChange={changeMode} />
        <GrowthSection />
        <UsageCalculator
          period={period}
          onPeriodChange={changePeriod}
          mode={mode}
          onSelect={setQuote}
        />
        <Pricing
          period={period}
          onPeriodChange={changePeriod}
          mode={mode}
          onSelect={setQuote}
        />
        <ImplementationSteps />
        <SalesFAQ />
        <LeadForm quote={quote} mode={mode} />
      </main>
      <Footer />
    </div>
  );
}
