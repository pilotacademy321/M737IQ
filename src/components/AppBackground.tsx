import React from 'react';

/**
 * AppBackground
 * Official MEDORA Platform Background Component
 * 
 * Uses the exact official attached image (/assets/images/medora-official-background.png)
 * featuring the Iraqi national flag, MEDORA gold-blue emblem, doctor & caduceus,
 * stethoscope, and royal blue-gold sweeping curves.
 * 
 * Fully responsive across:
 * - Desktop & Wide screens (natural landscape framing, preserving outer badges & stethoscopes)
 * - Tablets (portrait & landscape orientation with auto-adjusted positioning)
 * - Mobile Phones (Android & iOS with narrow-screen top framing & contrast protection)
 */
export const AppBackground: React.FC = () => {
  return (
    <div 
      aria-hidden="true"
      className="fixed inset-0 -z-10 w-full h-full overflow-hidden pointer-events-none select-none"
    >
      {/* 1. Base Gradient Canvas matching MEDORA palette */}
      <div className="absolute inset-0 bg-[#eef4fb]" />

      {/* 2. Official MEDORA High-Resolution Image Layer */}
      <div 
        className="absolute inset-0 w-full h-full medora-responsive-bg"
        style={{
          backgroundImage: `url('/assets/images/medora-official-background.png'), url('/assets/aistudio/file_00000000255c8210ac159dc33c5fbcf4_960f577a.png')`,
        }}
      />

      {/* 3. Responsive Soft Protective Wash (ensures 100% text/card legibility on all viewports) */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/55 to-slate-50/80 sm:from-white/20 sm:via-white/45 sm:to-slate-50/70 lg:from-white/10 lg:via-white/30 lg:to-slate-50/60" />
      
      {/* 4. Subtle Vignette Border for Depth */}
      <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,34,68,0.06)]" />
    </div>
  );
};
