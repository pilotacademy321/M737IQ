import { PortalId } from '../types';

export type AppRoute =
  | 'home'
  | 'portals'
  | 'about'
  | 'support'
  | PortalId;

export const VALID_PORTAL_IDS: PortalId[] = [
  'patient',
  'doctor',
  'pharmacy',
  'laboratory',
  'radiology',
  'wholesaler',
  'secretary',
  'super_admin',
];

export interface RouteState {
  route: AppRoute;
  portalId: PortalId | null;
  path: string;
}

/**
 * Normalizes and extracts current route from pathname and hash.
 * Supports:
 * - /
 * - /portals or /portal
 * - /about or /about-us
 * - /support or /contact
 * - /doctor, /radiology, /laboratory, /pharmacy, /wholesaler, /patient, /super_admin, /secretary
 * - or hash equivalents e.g. #portals, #about, #doctor
 */
export function parseCurrentRoute(): RouteState {
  if (typeof window === 'undefined') {
    return { route: 'home', portalId: null, path: '/' };
  }

  // 1. Pathname check (strip leading and trailing slashes)
  const pathname = window.location.pathname.replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
  
  // 2. Hash check (strip leading # and slashes)
  const hash = window.location.hash.replace(/^#\/?/, '').replace(/\/+$/, '').toLowerCase();

  // Effective token (hash takes priority for compatibility if user specifically typed #...)
  const token = hash || pathname;

  if (!token || token === 'home') {
    return { route: 'home', portalId: null, path: '/' };
  }

  if (token === 'portals' || token === 'portal' || token === 'explore') {
    return { route: 'portals', portalId: null, path: '/portals' };
  }

  if (token === 'about' || token === 'about-us' || token === 'vision') {
    return { route: 'about', portalId: null, path: '/about' };
  }

  if (token === 'support' || token === 'contact' || token === 'contact-us' || token === 'help') {
    return { route: 'support', portalId: null, path: '/support' };
  }

  // Portal paths, e.g. /portal/doctor or /doctor
  let portalKey = token;
  if (portalKey.startsWith('portal/')) {
    portalKey = portalKey.replace('portal/', '');
  }

  // Aliases normalization
  if (portalKey === 'radiology_center' || portalKey === 'xray') portalKey = 'radiology';
  if (portalKey === 'lab' || portalKey === 'labs') portalKey = 'laboratory';
  if (portalKey === 'superadmin' || portalKey === 'admin') portalKey = 'super_admin';
  if (portalKey === 'warehouse' || portalKey === 'wholesalers') portalKey = 'wholesaler';

  if (VALID_PORTAL_IDS.includes(portalKey as PortalId)) {
    return {
      route: portalKey as PortalId,
      portalId: portalKey as PortalId,
      path: `/${portalKey}`,
    };
  }

  return { route: 'home', portalId: null, path: '/' };
}

/**
 * Programmatic client-side navigation that preserves browser history,
 * supports back/forward navigation, and syncs URLs without full page reload.
 */
export function navigateTo(target: AppRoute | string) {
  if (typeof window === 'undefined') return;

  let targetPath = '/';
  let targetRoute: AppRoute = 'home';

  if (target === 'home' || target === '/' || !target) {
    targetPath = '/';
    targetRoute = 'home';
  } else if (target === 'portals' || target === '/portals') {
    targetPath = '/portals';
    targetRoute = 'portals';
  } else if (target === 'about' || target === '/about') {
    targetPath = '/about';
    targetRoute = 'about';
  } else if (target === 'support' || target === 'contact' || target === '/support') {
    targetPath = '/support';
    targetRoute = 'support';
  } else {
    // Portal route
    const cleanId = target.replace(/^\/+/, '').replace(/^portal\//, '');
    let normId = cleanId;
    if (normId === 'radiology_center') normId = 'radiology';
    if (normId === 'lab') normId = 'laboratory';
    if (normId === 'admin' || normId === 'superadmin') normId = 'super_admin';

    if (VALID_PORTAL_IDS.includes(normId as PortalId)) {
      targetPath = `/${normId}`;
      targetRoute = normId as PortalId;
    } else {
      targetPath = '/';
      targetRoute = 'home';
    }
  }

  // Check if current URL already matches
  const currentPath = window.location.pathname;
  if (currentPath !== targetPath || window.location.hash) {
    // Update browser history with clean path
    window.history.pushState({ route: targetRoute, path: targetPath }, '', targetPath);
  }

  // Notify listeners via popstate
  window.dispatchEvent(new PopStateEvent('popstate', { state: { route: targetRoute } }));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
