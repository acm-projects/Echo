import { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, type } from '../../theme';

// The building blocks of the settings pages: a titled card of rows, an on/off row and a row of choices.
export function Group({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  return (
    <View style={{ marginBottom: 26 }}>
      <View style={s.groupHead}>
        <Ionicons name={icon} size={16} color={colors.pink} />
        <Text style={s.groupTitle}>{title.toUpperCase()}</Text>
      </View>
      <View style={s.card}>{children}</View>
    </View>
  );
}

export function Toggle({ label, hint, value, onChange, last }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void; last?: boolean }) {
  return (
    <View style={[s.row, !last && s.line]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.label}>{label}</Text>
        {hint && <Text style={type.meta}>{hint}</Text>}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: 'rgba(255,255,255,0.15)', true: colors.pink }} thumbColor="#fff" />
    </View>
  );
}

export function Choice<T extends number>({ label, value, options, format, onChange }: { label: string; value: T; options: T[]; format: (value: T) => string; onChange: (value: T) => void }) {
  return (
    <View style={[s.row, s.line, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
      <Text style={s.label}>{label}</Text>
      <View style={s.chips}>
        {options.map((option) => {
          const on = option === value;
          return (
            <Pressable key={option} onPress={() => onChange(option)} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Text style={[s.chipText, on && { color: '#29123C' }]}>{format(option)}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const settingsPage = StyleSheet.create({ page: { paddingHorizontal: 20, paddingBottom: 60 } }).page;

const s = StyleSheet.create({
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginLeft: 4 },
  groupTitle: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 2.2, color: colors.dim },
  card: { borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
  line: { borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { fontFamily: fonts.sansMd, fontSize: 15, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.04)' },
  chipOn: { backgroundColor: colors.pink, borderColor: colors.pink },
  chipText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text },
});
