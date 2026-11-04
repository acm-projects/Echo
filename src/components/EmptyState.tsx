import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, type } from '../../theme';
import { GradientButton } from './GradientButton';
import { HangingBat } from './night/Bat';

/** The mascot asleep on a branch, for screens with nothing to show yet. */
export function EmptyState({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.wrap}>
      <View style={s.branch} />
      <HangingBat size={44} style={{ marginTop: -3 }} />
      <Text style={s.title}>{title}</Text>
      <Text style={[type.body, s.body]}>{body}</Text>
      {action && onAction && <GradientButton title={action} variant="outline" onPress={onAction} style={{ marginTop: 18, alignSelf: 'stretch' }} />}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 36 },
  branch: { width: 110, height: 4, borderRadius: 2, backgroundColor: '#3A2150', transform: [{ rotate: '-3deg' }] },
  title: { fontFamily: fonts.serif, fontSize: 22, color: colors.text, marginTop: 18, textAlign: 'center' },
  body: { textAlign: 'center', marginTop: 8, lineHeight: 21 },
});
