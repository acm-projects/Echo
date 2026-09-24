import { View } from 'react-native';

type Props = {
  percent: number; // 0 to 100
  height?: number;
  fillColor?: string;
  trackColor?: string;
};

export function ProgressBar({
  percent,
  height = 8,
  fillColor = '#4f46e5',
  trackColor = '#e5e7eb',
}: Props) {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: trackColor,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          width: `${clamped}%`,
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
}