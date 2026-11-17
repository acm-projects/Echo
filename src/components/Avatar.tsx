import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { colors, fonts } from '../../theme';
import { useAvatarUrl } from '../data/avatars';

// A reader's profile picture, or their initial on a tinted circle when they haven't set one.
export function Avatar({ name, path, size = 28, style }: { name: string; path?: string | null; size?: number; style?: StyleProp<ViewStyle> }) {
  const url = useAvatarUrl(path);
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[s.circle, box, style]}>
      {url ? (
        <Image source={{ uri: url }} style={box} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Text style={[s.initial, { fontSize: Math.round(size * 0.45) }]}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  circle: { backgroundColor: 'rgba(155,107,214,0.4)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { fontFamily: fonts.sansBold, color: colors.text },
});
