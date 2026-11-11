
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type CassetteCardProps = {
  title: string;
  author: string;
  genre?: string;
  accent?: string;
  onPress: () => void;
};

export function CassetteCard({
  title,
  author,
  genre = 'AUDIOBOOK',
  accent = '#A881CE',
  onPress,
}: CassetteCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.shell, { borderColor: accent }]}>
        <View style={styles.topEdge}>
          <View style={styles.screw} />
          <Text style={styles.brand}>ECHO AUDIO</Text>
          <View style={styles.screw} />
        </View>

        <View style={styles.label}>
          <View style={[styles.labelStripe, { backgroundColor: accent }]} />

          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>

          <Text style={styles.author} numberOfLines={1}>
            {author}
          </Text>

          <View style={styles.reelWindow}>
            <View style={styles.reel}>
              <View style={styles.reelCenter}>
                <View style={styles.reelHole} />
              </View>
            </View>

            <View style={styles.tapeStrip} />

            <View style={styles.reel}>
              <View style={styles.reelCenter}>
                <View style={styles.reelHole} />
              </View>
            </View>
          </View>

          <View style={styles.labelBottom}>
            <Text style={styles.genre} numberOfLines={1}>
              {genre.toUpperCase()}
            </Text>
            <Text style={styles.side}>SIDE A</Text>
          </View>
        </View>

        <View style={styles.bottomEdge}>
          <View style={styles.screw} />
          <View style={styles.tapeNotch} />
          <View style={styles.screw} />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText} numberOfLines={1}>
          LISTEN TO STORY
        </Text>
        <Ionicons
          name="play-circle"
          size={24}
          color={accent}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 260,
    padding: 12,
    backgroundColor: 'rgba(12, 10, 29, 0.92)',
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(218, 194, 240, 0.2)',
    marginRight: 14,
  },
  shell: {
    height: 185,
    borderRadius: 13,
    borderWidth: 2,
    backgroundColor: '#211C35',
    paddingHorizontal: 11,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  topEdge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: '#C9B5DA',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  screw: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#8F829F',
    backgroundColor: '#393047',
  },
  label: {
    backgroundColor: '#F0DDED',
    borderRadius: 6,
    paddingHorizontal: 13,
    paddingTop: 7,
    paddingBottom: 7,
    overflow: 'hidden',
  },
  labelStripe: {
    height: 5,
    borderRadius: 3,
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 17,
    fontWeight: '700',
    color: '#25162F',
    minHeight: 40,
  },
  author: {
    fontSize: 10,
    fontWeight: '600',
    color: '#765F7C',
    marginBottom: 8,
  },
  reelWindow: {
    backgroundColor: '#191326',
    height: 43,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  reel: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#5F526F',
    borderWidth: 4,
    borderColor: '#30263D',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  reelCenter: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#D6C4DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelHole: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#3A294A',
  },
  tapeStrip: {
    position: 'absolute',
    width: '65%',
    height: 19,
    backgroundColor: '#382B44',
    borderRadius: 6,
  },
  labelBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  genre: {
    color: '#5B4767',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    flex: 1,
  },
  side: {
    color: '#5B4767',
    fontSize: 8,
    fontWeight: '800',
    marginLeft: 8,
  },
  bottomEdge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tapeNotch: {
    width: 65,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#544365',
  },
  footer: {
    marginTop: 12,
    paddingHorizontal: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerText: {
    color: '#E8D7F2',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.7,
    flex: 1,
  },
});
