import { View } from "react-native";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Fraunces_400Regular_Italic, Fraunces_600SemiBold, Fraunces_800ExtraBold } from "@expo-google-fonts/fraunces";
import { BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque";
import { useEffect } from "react";
import { BatTransition } from "../components/night/BatTransition";
import { loadSettings } from "../data/settings";
import { syncBedtimeReminder } from "../data/notifications";

export default function RootLayout() {
  // Names match the keys in theme.ts `fonts`. Render nothing until they load so text never flashes in the system font.
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_400Regular_Italic,
    Fraunces_800ExtraBold,
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    MoonveilStellarion: require('../../assets/fonts/MoonveilStellarion-PersonalUse.ttf'),
    Inter_600SemiBold,
    Inter_400Regular,
  });
  // The bedtime reminder is a scheduled local notification; re-sync it at launch so it matches the saved setting.
  useEffect(() => {
    loadSettings().then((settings) => syncBedtimeReminder(settings.dailyReminder)).catch(() => {});
  }, []);
  if (!loaded && !error) return null;

  // Screens cross-fade while the bat swoops over the change (BatTransition), instead of sliding like a stock app.
  return (
    <View style={{ flex: 1, backgroundColor: "#030818" }}>
      <Stack screenOptions={{ headerShown: false, animation: "fade", animationDuration: 320, contentStyle: { backgroundColor: "#030818" } }} />
      <BatTransition />
    </View>
  );
}