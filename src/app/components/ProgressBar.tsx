import { View } from 'react-native';
import { colors } from '../../../theme';

export function ProgressBar({ value, height = 4 }: { value: number; height?: number }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(value * 100)}%`, height: '100%', backgroundColor: colors.pink }} />
    </View>
  );
}
