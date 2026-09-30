import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

type Pct = `${number}%`;
const STARS: [number, number, number][] = [[8, 6, 2], [22, 14, 1.5], [70, 9, 2.5], [90, 22, 1.5], [40, 30, 1.5], [12, 48, 2], [85, 55, 2], [55, 70, 1.5]];

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <LinearGradient colors={[colors.bg, colors.bgMid, colors.bgLow]} locations={[0, 0.6, 1]} style={s.fill}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {STARS.map(([x, y, r], i) => (
          <View key={i} style={{ position: 'absolute', left: `${x}%` as Pct, top: `${y}%` as Pct, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: '#fff', opacity: 0.7 }} />
        ))}
      </View>
      <SafeAreaView style={[s.fill, style]} edges={['top']}>{children}</SafeAreaView>
    </LinearGradient>
  );
}
const s = StyleSheet.create({ fill: { flex: 1 } });
