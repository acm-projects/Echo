import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fonts, radius } from '../../theme';

/** A printed book jacket: flat colour, an inset rule, the title set in Fraunces and the author below a short bar. */
export function Jacket({ title, author, accent, width, style }: { title: string; author?: string | null; accent: string; width: number; style?: StyleProp<ViewStyle> }) {
  const height = width * 1.42;
  const small = width < 90;
  return (
    <View style={[s.jacket, { width, height, backgroundColor: accent }, style]}>
      <View style={[s.rule, { margin: small ? 5 : 7, padding: small ? 6 : 9 }]}>
        <Text style={[s.title, { fontSize: small ? 11 : 15, lineHeight: small ? 13 : 18 }]} numberOfLines={4}>{title}</Text>
        {author && (
          <>
            <View style={s.bar} />
            <Text style={[s.author, { fontSize: small ? 7 : 9 }]} numberOfLines={1}>{author.toUpperCase()}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  jacket: { borderRadius: radius.sm, overflow: 'hidden' },
  rule: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,233,200,0.45)', justifyContent: 'flex-end' },
  title: { fontFamily: fonts.display, color: '#FFE9C8' },
  bar: { width: 18, height: 2, backgroundColor: 'rgba(255,233,200,0.7)', marginVertical: 5 },
  author: { fontFamily: fonts.sansBold, letterSpacing: 1.2, color: 'rgba(255,233,200,0.8)' },
});
