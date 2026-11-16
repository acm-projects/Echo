
import { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Jacket } from './Jacket';
import { mediaUrl } from '../data/voiceServer';
import { radius } from '../../theme';
import { File } from 'expo-file-system';

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
  const isCustomCover = coverPath?.includes('cover-custom-') ?? false;

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

  return (
    <View
        style={[
            styles.container,
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
  container: {
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
