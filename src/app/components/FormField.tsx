import { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, type } from '../theme';

type Props = TextInputProps & { label: string; icon: keyof typeof Ionicons.glyphMap; right?: ReactNode };

export function FormField({ label, icon, right, ...input }: Props) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[type.meta, { letterSpacing: 1.2, marginBottom: 8 }]}>{label}</Text>
      <View style={s.box}>
        <Ionicons name={icon} size={20} color={colors.faint} />
        <TextInput placeholderTextColor={colors.faint} style={s.input} autoCapitalize="none" {...input} />
        {right}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 58, paddingHorizontal: 16, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.text, fontFamily: fonts.sans, fontSize: 16 },
});
