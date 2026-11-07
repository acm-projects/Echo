import { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../../theme';

/** Bottom sheet for menus and quick details. Tapping the dimmed sky behind it closes it. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={s.grabber} />
        {title && <Text style={s.title}>{title}</Text>}
        <ScrollView bounces={false} style={{ maxHeight: 520 }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

type Icon = keyof typeof Ionicons.glyphMap;

/** One tappable row inside a Sheet. */
export function SheetItem({ icon, label, detail, danger, onPress }: { icon: Icon; label: string; detail?: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.item, pressed && { backgroundColor: 'rgba(255,255,255,0.05)' }]} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.lilac} />
      <Text style={[s.label, danger && { color: colors.danger }]}>{label}</Text>
      {detail && <Text style={s.detail}>{detail}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,3,20,0.6)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#100E22', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 14 },
  title: { fontFamily: fonts.serif, fontSize: 22, color: colors.text, marginBottom: 10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 6, borderRadius: 10 },
  label: { flex: 1, fontFamily: fonts.sansMd, fontSize: 16, color: colors.text },
  detail: { fontFamily: fonts.sansMd, fontSize: 14, color: colors.dim },
});
