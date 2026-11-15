import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router, type ErrorBoundaryProps } from "expo-router";
import { useFonts } from "expo-font";
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Fraunces_400Regular_Italic, Fraunces_600SemiBold, Fraunces_800ExtraBold } from "@expo-google-fonts/fraunces";
import { BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_700Bold } from "@expo-google-fonts/bricolage-grotesque";
import { useEffect } from "react";
import { BatTransition } from "../components/night/BatTransition";
import { loadSettings } from "../data/settings";
import { syncBedtimeReminder } from "../data/notifications";
import { colors, fonts } from "../../theme";

// A screen that throws while rendering lands here instead of closing the app. The message is shown so it can be
// reported, and the reader can retry the screen or go back to the library.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={eb.root}>
      <ScrollView contentContainerStyle={eb.content}>
        <Text style={eb.eyebrow}>SOMETHING WENT WRONG</Text>
        <Text style={eb.title}>This page couldn’t be shown</Text>
        <Text style={eb.body}>Echo hit a problem drawing this screen. Try again, or head back to the library.</Text>
        <View style={eb.detail}>
          <Text style={eb.detailText} selectable>{error.message}</Text>
        </View>
        <Pressable style={eb.primary} onPress={() => void retry()} accessibilityRole="button">
          <Text style={eb.primaryText}>Try again</Text>
        </Pressable>
        <Pressable style={eb.secondary} onPress={() => router.replace("/Test/library")} accessibilityRole="button">
          <Text style={eb.secondaryText}>Back to the library</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const eb = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#030818" },
  content: { flexGrow: 1, justifyContent: "center", padding: 28, gap: 12 },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 2.5, color: colors.pink },
  title: { fontFamily: fonts.serif, fontSize: 28, color: colors.text },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.dim },
  detail: { marginTop: 8, padding: 14, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.border },
  detailText: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.dim },
  primary: { marginTop: 16, height: 50, borderRadius: 25, backgroundColor: colors.pink, alignItems: "center", justifyContent: "center" },
  primaryText: { fontFamily: fonts.sansBold, fontSize: 15, color: "#18131E" },
  secondary: { height: 46, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.text },
});

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