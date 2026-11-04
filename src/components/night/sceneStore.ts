import type { SceneName } from '../../../theme';

// Which night scene each route is set in. BatTransition reads this the instant the route changes, so it knows which
// city it is leaving and which it is flying to before the new screen appears. Keep in step with the `scene` each
// screen passes to <Screen>.
const ROUTE_SCENES: Record<string, SceneName> = {
  '/Test/library': 'dusk',
  '/Test/book_details': 'dusk',
  '/Test/forgot-password': 'dusk',
  '/Test/reset-password': 'dusk',
  '/Test/upload': 'tidewater',
  '/Test/player': 'neon',
  '/Test/voice-lab': 'neon',
  '/narrator-voices': 'neon',
  '/voice-playground': 'neon',
  '/Test/community': 'ember',
  '/Test/catalog': 'ember',
  '/Test/search': 'aurora',
  '/Test/room': 'aurora',
  '/Test/people': 'aurora',
  '/Test/profile': 'midnight',
  '/Test/settings': 'midnight',
  '/Test/help': 'midnight',
  '/Test/downloads': 'midnight',
};

export function sceneForPath(pathname: string): SceneName | null {
  return ROUTE_SCENES[pathname] ?? null;
}
