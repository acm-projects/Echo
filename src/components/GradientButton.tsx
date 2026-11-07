import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../../theme';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline';
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  // Shows a spinner and ignores presses while work is in flight.
  loading?: boolean;
  // Fill colour for primary buttons; defaults to lamplight gold. Pass a scene accent to match a screen.
  color?: string;
};

const INK = '#16121F';

// Kept under its old name so existing screens don't change imports; it is now a flat, solid button.
export function GradientButton({ title, onPress, variant = 'primary', icon, style, loading, color = colors.gold }: Props) {
  const outline = variant === 'outline';
  const fg = outline ? colors.text : INK;
  return (
    <Pressable
      onPress={loading ? undefined : onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.btn, outline ? s.outline : { backgroundColor: color }, pressed && { transform: [{ translateY: 1 }], opacity: 0.9 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 8 }} />}
          <Text style={[s.label, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
const s = StyleSheet.create({
  btn: { height: 52, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  outline: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' },
  label: { fontFamily: fonts.sansBold, fontSize: 16, letterSpacing: 0.2 },
});
