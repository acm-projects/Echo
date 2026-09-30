import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { colors, fonts } from '../../../theme';

export default function Welcome() {
  return (
    <Screen style={{ paddingHorizontal: 28 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {/* TODO: swap for mascot + moon artwork */}
        <Ionicons name="moon" size={110} color={colors.gold} />
        <Text style={{ fontFamily: fonts.serif, fontSize: 64, letterSpacing: 14, color: colors.pink, marginTop: 24 }}>Echo</Text>
        <Text style={{ fontFamily: fonts.sansMd, fontSize: 13, letterSpacing: 5, color: colors.faint, marginTop: 6 }}>AUDIOBOOKS ALIVE</Text>
      </View>
      <View style={{ gap: 12, paddingBottom: 40 }}>
        <GradientButton title="LOG IN" onPress={() => router.push('/Test/login')} />
        <GradientButton title="Create account" variant="outline" onPress={() => router.push('/signup')} />
      </View>
    </Screen>
  );
}
