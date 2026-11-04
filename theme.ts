export const colors = {
  bg: '#140B2B', bgMid: '#2A1258', bgLow: '#6B2A86',
  text: '#F3E9FF', dim: 'rgba(243,233,255,0.62)', faint: 'rgba(243,233,255,0.38)',
  // Cards are nearly opaque so the night city behind them never fights with text.
  // Neutral ink rather than purple, so each screen's own scene colours show around it.
  card: 'rgba(10,10,26,0.8)', border: 'rgba(255,255,255,0.12)',
  pink: '#D67BB0', lilac: '#9B6BD6', gold: '#F5C65A', blue: '#7FA8E6', danger: '#E0667A',
};
// The night city: sky from zenith down to the horizon glow, and the skyline layers in front of it.
export const night = {
  sky: ['#0E0624', '#1D0B40', '#3A1763'] as const,
  farCity: '#2B1452',
  nearCity: '#1E0F3E',
  window: '#F5C65A',
  windowDim: '#8E6A3A',
  // Neon accents for signs and a few windows; used sparingly so the city stays cozy.
  neonPink: '#FF6FD0',
  neonCyan: '#62E6F0',
  aurora: '#3FD1C6',
  midCity: '#25113F',
  star: '#F7E2BE',
  batBody: '#4A2A66',
  batWing: '#7A4A9E',
  batWingDark: '#55307A',
  batEar: '#E59BC0',
};
// Each screen gets its own night. Same city and mascot, different sky, horizon glow and window light.
export type Landmark = 'billboard' | 'lighthouse' | 'marquee' | 'clocktower' | 'radiotower' | 'ferris';
export type Scene = {
  sky: readonly [string, string, string];
  far: string;
  mid: string;
  near: string;
  windows: readonly string[];
  glow: string;
  accent: string;
  // The shape of this city: its own random seed, how tall it builds, and which roofs it favours.
  city: { seed: number; tall: number; roofs: readonly string[] };
  // One animated building at the back of the skyline that makes the place recognisable.
  landmark: Landmark;
  // Where the mascot sleeps on this screen: on the landmark, the rooftop antenna, or a button the screen provides.
  perch: 'landmark' | 'antenna' | 'button';
};
export const scenes = {
  dusk: { sky: ['#0B1030', '#2E1B5E', '#C65A74'], far: '#3D2463', mid: '#2A1849', near: '#150D2C', windows: ['#F5C65A', '#FF9A7A'], glow: '#FF8A7A', accent: '#FF9A7A', city: { seed: 19, tall: 0.62, roofs: ['flat', 'flat', 'setback', 'tank', 'plant', 'slant', 'crown', 'dome', 'spire'] }, landmark: 'billboard', perch: 'landmark' },
  tidewater: { sky: ['#03141D', '#0A3140', '#1E7279'], far: '#0F3D4A', mid: '#0A2C38', near: '#051A23', windows: ['#7FF0F0', '#F5C65A'], glow: '#5FE3D4', accent: '#5FE3D4', city: { seed: 53, tall: 0.46, roofs: ['flat', 'pitched', 'pitched', 'tank', 'tank', 'slant', 'plant'] }, landmark: 'lighthouse', perch: 'button' },
  ember: { sky: ['#100A1C', '#3A1530', '#C8703A'], far: '#4A2436', mid: '#33192A', near: '#1B0E19', windows: ['#FFB45E', '#F5C65A'], glow: '#FFB45E', accent: '#FFB45E', city: { seed: 97, tall: 0.52, roofs: ['pitched', 'pitched', 'flat', 'tank', 'dome', 'crown', 'plant'] }, landmark: 'clocktower', perch: 'landmark' },
  neon: { sky: ['#0A0418', '#2B0A44', '#A8248F'], far: '#3B1458', mid: '#290D41', near: '#150626', windows: ['#FF6FD0', '#62E6F0'], glow: '#FF6FD0', accent: '#FF6FD0', city: { seed: 71, tall: 0.72, roofs: ['setback', 'setback', 'spire', 'crown', 'flat', 'plant', 'slant'] }, landmark: 'marquee', perch: 'landmark' },
  midnight: { sky: ['#030818', '#0C1B45', '#2A4A88'], far: '#16295A', mid: '#0F1F45', near: '#08122B', windows: ['#FFE9A8', '#9CC2FF'], glow: '#8FB8FF', accent: '#9CC2FF', city: { seed: 131, tall: 0.7, roofs: ['flat', 'setback', 'setback', 'spire', 'slant', 'slant', 'plant'] }, landmark: 'radiotower', perch: 'button' },
  aurora: { sky: ['#020C14', '#0A2A2F', '#2C7E66'], far: '#123B37', mid: '#0C2B2A', near: '#061A1B', windows: ['#7CF2B8', '#F5C65A'], glow: '#7CF2B8', accent: '#7CF2B8', city: { seed: 151, tall: 0.58, roofs: ['dome', 'spire', 'pitched', 'flat', 'flat', 'plant', 'crown'] }, landmark: 'ferris', perch: 'antenna' },
} satisfies Record<string, Scene>;
export type SceneName = keyof typeof scenes;

export const gradients = {
  cta: ['#9B5FD0', '#D46AA8'] as const,
  gold: ['#F5C65A', '#D9982E'] as const,
};
// Serif for titles, sans for everything else. Use ONLY these so screens stay consistent.
// Loaded in src/app/_layout.tsx. Fraunces (a soft, slightly wonky storybook serif) for headings and titles;
// Bricolage Grotesque for interface text. Token names are kept so every screen picks these up.
export const fonts = {
  serif: 'Fraunces_600SemiBold',
  serifItalic: 'Fraunces_400Regular_Italic',
  display: 'Fraunces_800ExtraBold',
  sans: 'BricolageGrotesque_400Regular',
  sansMd: 'BricolageGrotesque_500Medium',
  sansBold: 'BricolageGrotesque_700Bold',
};
// Small, consistent corners. Large pill shapes are only for circular controls.
export const radius = { sm: 4, md: 8, lg: 12 };
export const type = {
  h1: { fontFamily: fonts.display, fontSize: 32, letterSpacing: -0.5, color: colors.text },
  h2: { fontFamily: fonts.serif, fontSize: 21, color: colors.text },
  title: { fontFamily: fonts.serif, fontSize: 17, color: colors.text },
  body: { fontFamily: fonts.sans, fontSize: 14, color: colors.dim },
  meta: { fontFamily: fonts.sansMd, fontSize: 12, color: colors.faint },
};
