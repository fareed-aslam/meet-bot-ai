import HeroSection from "./components/landing/HeroSection";
import FeaturesSection from "./components/landing/FeaturesSection";
import IntegrationsSection from "./components/landing/IntegrationsSection";
import HowItWorksSection from "./components/landing/HowItWorksSection";
import StatsSection from "./components/landing/StatsSection";
import MoreFeaturesSection from "./components/landing/MoreFeaturesSection";
import CTASection from "./components/landing/CTASection";
import Footer from "./components/landing/Footer";
import { Reveal } from "@/components/animations/reveal";
import AmbientGradients from "./components/landing/AmbientGradients";

export default function Home() {
  return (

    <div className="relative min-h-screen bg-background text-foreground transition-colors duration-700 ease-in-out overflow-x-hidden">
      <AmbientGradients />
      <div className="relative z-10">
        <HeroSection />
        <Reveal>
          <FeaturesSection />
        </Reveal>
        <Reveal>
          <IntegrationsSection />
        </Reveal>
        <Reveal>
          <HowItWorksSection />
        </Reveal>
        <Reveal>
          <StatsSection />
        </Reveal>
        <Reveal>
          <MoreFeaturesSection />
        </Reveal>
        <Reveal>
          <CTASection />
        </Reveal>
        <Reveal>
          <Footer />
        </Reveal>
      </div>
    </div>
  );
}