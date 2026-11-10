import type { SceneName } from '../../../theme';
import type { InteriorKind } from './Interiors';

// Which night scene each outdoor route is set in. BatTransition reads this the instant the route changes, so it knows which
// city it is leaving and which it is flying to before the new screen appears. Keep in step with the `scene` each
// screen passes to <Screen>.
const ROUTE_SCENES: Record<string, SceneName> = {
  '/Test/library': 'dusk',
  '/Test/forgot-password': 'dusk',
  '/Test/reset-password': 'dusk',
  '/Test/shelf': 'aurora',
  '/Test/upload': 'tidewater',
  '/Test/player': 'neon',
  '/Test/community': 'ember',
  '/Test/profile': 'midnight',
};

export function sceneForPath(pathname: string): SceneName | null {
  return ROUTE_SCENES[pathname] ?? null;
}

// Pages that live inside a building. Opening one from a tab flies the bat in through a door; leaving flies it out.
// Keep in step with the `interior` each page passes to <Screen>.
const ROUTE_INTERIORS: Record<string, InteriorKind> = {
  '/Test/book_details': 'bookshop',
  '/Test/search': 'bookshop',
  '/Test/catalog': 'harbor',
  '/Test/room': 'cafe',
  '/Test/people': 'cafe',
  '/Test/notification-settings': 'radioroom',
  '/Test/animation-settings': 'radioroom',
  '/Test/help': 'radioroom',
  '/Test/downloads': 'radioroom',
  '/narrator-voices': 'studio',
  '/Test/voice-lab': 'studio',
  '/voice-playground': 'studio',
};

export function interiorForPath(pathname: string): InteriorKind | null {
  return ROUTE_INTERIORS[pathname] ?? null;
}
