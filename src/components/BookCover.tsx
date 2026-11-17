
import { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Jacket } from './Jacket';
import { mediaUrl } from '../data/voiceServer';
import { radius } from '../../theme';

type BookCoverProps = {
  title: string;
  author?: string | null;
  accent: string;
  width: number;
  coverPath?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function BookCover({
  title,
  author,
  accent,
  width,
  coverPath,
  style,
}: BookCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    setCoverUrl(null);
    setFailed(false);

    if (coverPath) {
      mediaUrl(coverPath)
        .then((url) => {
          if (active) setCoverUrl(url);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    }

    return () => {
      active = false;
    };
  }, [coverPath]);

  const height = width * 1.42;
  const compact = width < 110;
  const isCustomCover = coverPath?.includes('cover-custom-') ?? false;
  const isPdfCover = coverPath?.includes('cover-original.png') ?? false;

  if (!coverUrl || failed) {
    return (
      <Jacket
        title={title}
        author={author}
        accent={accent}
        width={width}
        style={style}
      />
    );
  }

  if (isPdfCover) {
    return (
      <View
        style={[
          styles.hardcover,
          {
            width,
            height,
            padding: compact ? 9 : 13,
            paddingLeft: compact ? 13 : 19,
          },
          style,
        ]}
      >
        <View style={styles.innerFrame}>

          <View
            style={[
              styles.previewFrame,
              {
                width: '94%',
                height: '82%',
                padding: compact ? 2 : 4,
              },
            ]}
          >
            <Image
              source={{ uri: coverUrl }}
              style={styles.image}
              resizeMode="contain"
              onError={() => setFailed(true)}
            />
          </View>
        </View>

        <View pointerEvents="none" style={styles.bookSpine} />
        <View pointerEvents="none" style={styles.bookmark} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.photoContainer,
        {
          width,
          height,
          backgroundColor: isCustomCover ? '#000000' : 'transparent',
        },
        style,
      ]}
    >
      <Image
        source={{ uri: coverUrl }}
        style={styles.image}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hardcover: {
    backgroundColor: '#261047',
    borderRadius: radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  innerFrame: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D8B46A',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  topDecoration: {
    width: '75%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorationLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(216,180,106,0.6)',
  },
  moon: {
    color: '#F5C65A',
    marginHorizontal: 10,
  },
  previewFrame: {
    borderWidth: 1,
    borderColor: 'rgba(245,198,90,0.8)',
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  bookSpine: {
    position: 'absolute',
    left: 7,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: 'rgba(216,180,106,0.45)',
  },
  bookmark: {
    position: 'absolute',
    top: 0,
    right: 22,
    width: 10,
    height: 27,
    backgroundColor: '#E2B657',
  },
  photoContainer: {
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
});
