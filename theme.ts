export const colors = {
  bg: '#140B2B', bgMid: '#2A1258', bgLow: '#6B2A86',
  text: '#F3E9FF', dim: 'rgba(243,233,255,0.62)', faint: 'rgba(243,233,255,0.38)',
  card: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)',
  pink: '#D67BB0', lilac: '#9B6BD6', gold: '#F5C65A', blue: '#7FA8E6', danger: '#E0667A',
};
export const gradients = {
  cta: ['#9B5FD0', '#D46AA8'] as const,
  gold: ['#F5C65A', '#D9982E'] as const,
};
// Serif for titles, sans for everything else. Use ONLY these so screens stay consistent.
// Load with @expo-google-fonts/lora and @expo-google-fonts/nunito.
export const fonts = {
  serif: 'Lora_400Regular',
  sans: 'Nunito_400Regular',
  sansMd: 'Nunito_600SemiBold',
  sansBold: 'Nunito_800ExtraBold',
};
export const type = {
  h1: { fontFamily: fonts.sansBold, fontSize: 28, color: colors.text },
  h2: { fontFamily: fonts.sansBold, fontSize: 20, color: colors.text },
  title: { fontFamily: fonts.serif, fontSize: 17, color: colors.text },
  body: { fontFamily: fonts.sans, fontSize: 14, color: colors.dim },
  meta: { fontFamily: fonts.sansMd, fontSize: 12, color: colors.faint },
};
