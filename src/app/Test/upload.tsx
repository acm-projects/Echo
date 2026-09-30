import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { colors, fonts, type } from '../../../theme';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'sparkles-outline', label: 'Narration' },
  { icon: 'book-outline', label: 'Chapters' },
  { icon: 'people-outline', label: 'Characters' },
];

export default function Upload() {
  return (
    <Screen>
      <View style={s.header}>
        <Text style={type.h1}>Upload a book</Text>
        <Pressable style={s.help}><Ionicons name="help" size={18} color={colors.dim} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Pressable style={s.drop}>
          <View style={s.dropIcon}><Ionicons name="cloud-upload-outline" size={28} color={colors.blue} /></View>
          <Text style={[type.h2, { fontSize: 18 }]}>Choose a file</Text>
          <Text style={type.meta}>PDF, EPUB, MOBI · Up to 50 MB</Text>
        </Pressable>

        <View style={s.file}>
          <Ionicons name="document-text-outline" size={24} color={colors.dim} />
          <View style={{ flex: 1 }}>
            <Text style={[type.title, { fontFamily: fonts.sansBold, fontSize: 15 }]}>Dune.epub</Text>
            <Text style={type.meta}>2.4 MB · Ready to upload</Text>
          </View>
          <Pressable hitSlop={10}><Ionicons name="close" size={20} color={colors.dim} /></Pressable>
        </View>

        <GradientButton title="Upload & process" icon="sparkles" style={{ marginTop: 18 }} />

        {/* Secondary info: dimmed and faded out so it doesn't compete with the button */}
        <View style={s.faded}>
          <Text style={[type.meta, { letterSpacing: 1.2, marginBottom: 12 }]}>WHAT ECHO CREATES</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {FEATURES.map((f) => (
              <View key={f.label} style={s.feature}>
                <Ionicons name={f.icon} size={20} color={colors.blue} />
                <Text style={type.meta}>{f.label}</Text>
              </View>
            ))}
          </View>
          <LinearGradient pointerEvents="none" colors={['rgba(42,18,88,0)', colors.bgMid]} style={StyleSheet.absoluteFill} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  help: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  drop: { height: 190, borderRadius: 26, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(214,123,176,0.4)', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', gap: 8 },
  dropIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(127,168,230,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14, padding: 14, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  faded: { marginTop: 36, opacity: 0.5, overflow: 'hidden', paddingBottom: 24 },
  feature: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 18, backgroundColor: colors.card },
});
