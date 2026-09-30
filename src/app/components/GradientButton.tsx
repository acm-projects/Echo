import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, gradients } from '../../../theme';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline';
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

export function GradientButton({ title, onPress, variant = 'primary', icon, style }: Props) {
  const content = (
    <>
      {icon && <Ionicons name={icon} size={18} color="#fff" style={{ marginRight: 8 }} />}
      <Text style={s.label}>{title}</Text>
    </>
  );
  if (variant === 'outline') {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [s.btn, s.outline, pressed && { opacity: 0.7 }, style]}>
        {content}
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }, style]}>
      <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.btn}>
        {content}
      </LinearGradient>
    </Pressable>
  );
}
const s = StyleSheet.create({
  btn: { height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  outline: { borderWidth: 1.5, borderColor: colors.pink, backgroundColor: 'rgba(214,123,176,0.12)' },
  label: { color: '#fff', fontFamily: fonts.sansBold, fontSize: 16, letterSpacing: 1 },
});
