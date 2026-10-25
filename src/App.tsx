/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { AppSidebar } from './components/AppSidebar';
import { HomePageView } from './components/HomePageView';
import { PortalsSelectionPage } from './components/PortalsSelectionPage';
import { AboutUsPage } from './components/AboutUsPage';
import { SupportContactPage } from './components/SupportContactPage';
import { PortalShellView } from './components/PortalShellView';
import { Footer } from './components/Footer';
import { LegalModal } from './components/LegalModals';
import { OnboardingModal } from './components/OnboardingModal';
import { AuthDomainGuideModal } from './components/AuthDomainGuideModal';
import { FeaturesGuideModal } from './components/FeaturesGuideModal';
import { PortalId } from './types';
import { parseCurrentRoute, navigateTo, RouteState } from './utils/navigation';

const MainAppContent: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const [routeState, setRouteState] = useState<RouteState>(() => parseCurrentRoute());
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [featuresGuideOpen, setFeaturesGuideOpen] = useState(false);
  const [domainHelpOpen, setDomainHelpOpen] = useState(false);

  const [legalModal, setLegalModal] = useState<{
    isOpen: boolean;
    type: 'privacy' | 'terms' | null;
  }>({
    isOpen: false,
    type: null,
  });

  // Handle URL Synchronization, Browser Back/Forward buttons and direct navigation
  useEffect(() => {
    const handleLocationChange = () => {
      const parsed = parseCurrentRoute();
      setRouteState(parsed);
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const handleNavigate = (target: string) => {
    navigateTo(target);
  };

  const handleSelectPortal = (portalId: PortalId) => {
    navigateTo(portalId);
  };

  const handleResetToHome = () => {
    navigateTo('home');
  };

  const handleNavigateToPortals = () => {
    navigateTo('portals');
  };

  const handleOpenLegal = (type: 'privacy' | 'terms') => {
    setLegalModal({ isOpen: true, type });
  };

  const handleCloseLegal = () => {
    setLegalModal({ isOpen: false, type: null });
  };

  // Render appropriate view based on routeState
  const renderCurrentView = () => {
    // 1. Dedicated Portal Page
    if (routeState.portalId) {
      return (
        <PortalShellView
          portalId={routeState.portalId}
          onBackToHome={handleResetToHome}
          onBackToPortals={handleNavigateToPortals}
          onSelectPortal={handleSelectPortal}
        />
      );
    }

    // 2. Dedicated Portal Selection Page (Triggered by START button or /portals)
    if (routeState.route === 'portals') {
      return (
        <PortalsSelectionPage
          onNavigateHome={handleResetToHome}
          onSelectPortal={handleSelectPortal}
        />
      );
    }

    // 3. Dedicated About Us Page (/about)
    if (routeState.route === 'about') {
      return (
        <AboutUsPage
          onNavigateHome={handleResetToHome}
          onNavigatePortals={handleNavigateToPortals}
          onNavigateSupport={() => handleNavigate('support')}
        />
      );
    }

    // 4. Dedicated Support & Contact Page (/support)
    if (routeState.route === 'support') {
      return (
        <SupportContactPage
          onNavigateHome={handleResetToHome}
          onNavigatePortals={handleNavigateToPortals}
        />
      );
    }

    // 5. Dedicated Welcome Landing Page (Default: / or /home matching mockup)
    return (
      <HomePageView
        onNavigate={handleNavigate}
        onSelectPortal={handleSelectPortal}
      />
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 transition-colors duration-200">
      {/* Right Persistent Dark-Navy Sidebar (Matching Mockup) */}
      <AppSidebar
        currentRoute={routeState.route}
        selectedPortalId={routeState.portalId}
        onNavigateHome={handleResetToHome}
        onSelectPortal={handleSelectPortal}
        onNavigate={handleNavigate}
        onOpenProfile={() => {
          handleNavigate('patient');
        }}
        onOpenSettings={() => setDomainHelpOpen(true)}
        onOpenFeaturesGuide={() => setFeaturesGuideOpen(true)}
        mobileOpen={sidebarMobileOpen}
        onCloseMobile={() => setSidebarMobileOpen(false)}
      />

      {/* Main Content Area (With right offset on desktop for RTL sidebar) */}
      <div className={`flex-1 flex flex-col min-w-0 ${isRTL ? 'lg:pe-72' : 'lg:ps-72'} transition-all`}>
        {/* Global Top Navigation Header (Matching Mockup with Search & User Pill) */}
        <Header
          activeSection={routeState.route}
          onNavigate={handleNavigate}
          selectedPortalId={routeState.portalId}
          onResetToHome={handleResetToHome}
          onToggleSidebar={() => setSidebarMobileOpen((prev) => !prev)}
          onSelectPortal={handleSelectPortal}
        />

        {/* Routed View Container */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 max-w-7xl w-full mx-auto">
          {renderCurrentView()}
        </main>

        {/* Global Footer */}
        <Footer onNavigate={handleNavigate} onOpenLegal={handleOpenLegal} />
      </div>

      {/* Legal Terms & Privacy Modal */}
      <LegalModal
        isOpen={legalModal.isOpen}
        type={legalModal.type}
        onClose={handleCloseLegal}
      />

      {/* New User Role Setup & Accreditation Modal */}
      <OnboardingModal />

      {/* Features Guide Modal */}
      <FeaturesGuideModal
        isOpen={featuresGuideOpen}
        onClose={() => setFeaturesGuideOpen(false)}
        onSelectPortal={handleSelectPortal}
      />

      {/* Firebase Domain Guide & Instant Sandbox Modal */}
      <AuthDomainGuideModal 
        onSelectPortal={handleSelectPortal} 
      />
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}
