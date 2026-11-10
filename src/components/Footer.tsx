import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Logo } from './Logo';
import { MessageSquare, Mail, Heart, Stethoscope, ExternalLink, Instagram } from 'lucide-react';

interface FooterProps {
  onNavigate: (sectionId: string) => void;
  onOpenLegal: (type: 'privacy' | 'terms') => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenLegal }) => {
  const { t, language } = useLanguage();

  const whatsappHref = 'https://wa.me/9647885663748';
  const emailHref = 'mailto:bcgmoc@gmail.com';

  return (
    <footer className="bg-[#00172e] text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-slate-800/80">
          {/* Brand & Slogan Column */}
          <div className="md:col-span-5 space-y-4">
            <div className="inline-block p-2 rounded-xl bg-white/5 border border-white/10">
              <Logo size="md" showTagline={true} light={true} />
            </div>

            <p className="text-xs sm:text-sm text-slate-300 max-w-sm leading-relaxed">
              {t.footer.brandDesc}
            </p>
          </div>

          {/* Quick Links Column */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              {language === 'ar' ? 'روابط المنصة' : 'Platform Links'}
            </h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              <li>
                <button
                  onClick={() => onNavigate('home')}
                  className="hover:text-white transition-colors cursor-pointer text-start"
                >
                  {t.nav.home}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('portals')}
                  className="hover:text-white transition-colors cursor-pointer text-start"
                >
                  {t.nav.portals}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('support')}
                  className="hover:text-white transition-colors cursor-pointer text-start"
                >
                  {language === 'ar' ? 'الدعم الفني والتواصل' : 'Support & Contact'}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('about')}
                  className="hover:text-white transition-colors cursor-pointer text-start"
                >
                  {t.nav.about}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('install')}
                  className="text-emerald-400 hover:text-emerald-300 font-bold transition-colors cursor-pointer text-start flex items-center gap-1.5"
                >
                  <span>{language === 'ar' ? 'تثبيت التطبيق (أندرويد وآيفون)' : 'Install App (Android & iPhone)'}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenLegal('terms')}
                  className="hover:text-white transition-colors cursor-pointer text-start text-slate-400 hover:text-slate-200"
                >
                  {t.footer.links.terms}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenLegal('privacy')}
                  className="hover:text-white transition-colors cursor-pointer text-start text-slate-400 hover:text-slate-200"
                >
                  {t.footer.links.privacy}
                </button>
              </li>
            </ul>
          </div>

          {/* Official Support Channels Column */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              {t.footer.supportTitle}
            </h4>
            
            <div className="space-y-3 text-xs sm:text-sm">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">{t.contact.whatsappTitle}</div>
                  <div className="font-bold text-white font-mono">{t.contact.whatsappNumber}</div>
                </div>
              </a>

              <a
                href={emailHref}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Mail size={16} />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">{t.contact.emailTitle}</div>
                  <div className="font-semibold text-white font-mono break-all">{t.contact.emailAddress}</div>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Medical Motif */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>{t.footer.copyright}</div>
        </div>
      </div>
    </footer>
  );
};
