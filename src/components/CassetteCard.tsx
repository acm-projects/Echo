
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { fonts } from '../../theme';
import {
  genreOf,
  type DiscoverBook,
} from '../data/discover';

type CassetteCardProps = {
  book: DiscoverBook;
  compact?: boolean;
};

function TapeReel({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[s.reel, compact && s.reelSmall]}>
      <View style={[s.reelInner, compact && s.reelInnerSmall]}>
        <View style={s.reelCenter} />
      </View>
    </View>
  );
}

export function CassetteCard({
  book,
  compact = false,
}: CassetteCardProps) {
  const accent = book.accent || '#B18BCA';
  const genre = genreOf(book.genre);

  function openBook() {
    router.push({
      pathname: '/Test/book_details',
      params: {
        title: book.title,
        author: book.author,
      },
    });
  }

  return (
    <Pressable
      onPress={openBook}
      accessibilityRole="button"
      accessibilityLabel={`${book.title} by ${book.author}`}
      style={({ pressed }) => [
        s.card,
        compact && s.cardCompact,
        pressed && s.pressed,
      ]}
    >
      <View style={[s.shell, compact && s.shellCompact]}>
        <View style={s.shellHighlight} />

        <View style={s.top}>
          <View style={s.screw} />

          <Text style={[s.brand, compact && s.brandCompact]}>
            ECHO AUDIO
          </Text>

          <View style={s.screw} />
        </View>

        <View style={[s.paper, compact && s.paperCompact]}>
          <View
            style={[
              s.stripe,
              { backgroundColor: accent },
            ]}
          />

          <View style={s.paperHeading}>
            <Text style={s.edition}>
              THE STORY COLLECTION
            </Text>

            <Text style={s.edition}>
              VOL. 01
            </Text>
          </View>

          <Text
            style={[s.title, compact && s.titleCompact]}
            numberOfLines={2}
          >
            {book.title}
          </Text>

          <Text
            style={[s.author, compact && s.authorCompact]}
            numberOfLines={1}
          >
            {book.author}
          </Text>

          <View style={[s.window, compact && s.windowCompact]}>
            <View style={s.tapeBand} />
            <View style={s.tapeBridge} />

            <TapeReel compact={compact} />
            <TapeReel compact={compact} />
          </View>

          <View style={s.info}>
            <Text style={s.genre} numberOfLines={1}>
              {genre.label.toUpperCase()}
            </Text>

            <View style={s.sideBadge}>
              <Text style={s.sideLabel}>A</Text>
            </View>
          </View>
        </View>

        <View style={s.bottom}>
          <View style={s.screw} />

          <View style={s.notch}>
            <View style={s.notchDetail} />
            <View style={s.notchDetail} />
            <View style={s.notchDetail} />
          </View>

          <View style={s.screw} />
        </View>
      </View>

      {!compact ? (
        <View style={s.footer}>
          <View style={s.footerText}>
            <Text style={s.eyebrow}>
              ECHO RECOMMENDS
            </Text>

            <Text style={s.action}>
              Discover this story
            </Text>
          </View>

          <View
            style={[
              s.playButton,
              { backgroundColor: accent },
            ]}
          >
            <Ionicons
              name="play"
              size={17}
              color="#21152C"
            />
          </View>
        </View>
      ) : (
        <Text style={s.compactLabel} numberOfLines={2}>
          {book.title}
        </Text>
      )}
    </Pressable>
  );
}

export default CassetteCard;

const s = StyleSheet.create({
  card: {
    width: 280,
    borderRadius: 20,
    backgroundColor: 'rgba(18,13,36,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(218,194,240,0.16)',
    padding: 12,
  },
  cardCompact: {
    width: 176,
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ translateY: -2 }],
  },
  shell: {
    height: 208,
    borderWidth: 1.5,
    borderRadius: 14,
    backgroundColor: '#695579',
    borderColor: '#A38CB6',
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  shellCompact: {
    height: 164,
    paddingHorizontal: 7,
    paddingVertical: 7,
    borderRadius: 11,
  },
  shellHighlight: {
    position: 'absolute',
    top: 3,
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.23)',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screw: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#B7A7C5',
    backgroundColor: '#382D46',
  },
  brand: {
    fontFamily: fonts.sansBold,
    color: '#F3E9FF',
    fontSize: 9,
    letterSpacing: 2,
  },
  brandCompact: {
    fontSize: 7,
    letterSpacing: 1.2,
  },
  paper: {
    backgroundColor: '#F2E5E1',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 7,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DCC7D5',
  },
  paperCompact: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 5,
  },
  stripe: {
    height: 6,
    borderRadius: 3,
    marginBottom: 7,
  },
  paperHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 4,
  },
  edition: {
    fontFamily: fonts.sansBold,
    fontSize: 7,
    letterSpacing: 0.3,
    color: '#8B7390',
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 21,
    color: '#2B1C39',
    minHeight: 42,
  },
  titleCompact: {
    fontSize: 12,
    lineHeight: 14,
    minHeight: 28,
  },
  author: {
    fontFamily: fonts.serifItalic,
    fontSize: 12,
    color: '#725B7C',
    marginTop: 3,
    marginBottom: 8,
  },
  authorCompact: {
    fontSize: 9,
    marginTop: 1,
    marginBottom: 5,
  },
  window: {
    height: 43,
    backgroundColor: '#20162D',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#C4B1C8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'hidden',
  },
  windowCompact: {
    height: 30,
    borderWidth: 1.5,
  },
  tapeBand: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    height: 19,
    borderRadius: 5,
    backgroundColor: '#463450',
  },
  tapeBridge: {
    position: 'absolute',
    width: '48%',
    height: 9,
    borderRadius: 3,
    backgroundColor: '#302238',
  },
  reel: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: '#4C3A59',
    borderWidth: 4,
    borderColor: '#2A2035',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
  },
  reelInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E0D1E5',
    borderWidth: 2,
    borderColor: '#A994B6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelInnerSmall: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  reelCenter: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4C3659',
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  genre: {
    fontFamily: fonts.sansBold,
    fontSize: 8,
    letterSpacing: 0.8,
    color: '#735B7B',
    flex: 1,
  },
  sideBadge: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: '#392747',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  sideLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: '#F5E5F2',
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notch: {
    height: 7,
    width: 72,
    borderRadius: 4,
    backgroundColor: '#3C2D4C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  notchDetail: {
    width: 6,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#A38EB5',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 2,
  },
  footerText: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#B7A1CD',
  },
  action: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: '#F3E9FF',
    marginTop: 4,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactLabel: {
    fontFamily: fonts.serif,
    fontSize: 14,
    lineHeight: 18,
    color: '#FFFFFF',
    marginTop: 9,
  },
});
