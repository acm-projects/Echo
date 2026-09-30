import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../components/Screen';
import { ProgressBar } from '../components/ProgressBar';
import { colors, fonts, gradients, type } from '../theme';

export default function Player() {
  return (
    <Screen style={{ paddingHorizontal: 24 }}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          <Pressable style={s.round}><Ionicons name="chevron-down" size={20} color={colors.text} /></Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={[type.meta, { letterSpacing: 1.5 }]}>NOW PLAYING</Text>
            <Text style={{ fontFamily: fonts.sansBold, fontSize: 16, color: colors.text }}>The Night Circus</Text>
          </View>
          <Pressable style={s.round}><Ionicons name="ellipsis-horizontal" size={20} color={colors.text} /></Pressable>
        </View>

        <LinearGradient colors={['#2A1258', '#7A3C9C']} style={s.art}>
          <View style={{ padding: 18 }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 26, color: colors.text }}>The Night{ '\n' }Circus</Text>
            <Text style={type.body}>Erin Morgenstern</Text>
          </View>
        </LinearGradient>

        <View style={{ alignItems: 'center', marginTop: 24, gap: 4 }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.text }}>The Night Circus</Text>
          <Text style={[type.body, { fontSize: 16 }]}>Erin Morgenstern</Text>
          <Text style={{ fontFamily: fonts.sansMd, fontSize: 14, color: colors.blue }}>Chapter 7 · The room beneath the stars</Text>
        </View>

        <View style={{ marginTop: 22 }}>
          <ProgressBar value={0.36} height={5} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={type.meta}>13:46</Text><Text style={type.meta}>-24:09</Text>
          </View>
        </View>

        <View style={s.controls}>
          <Pressable style={s.skip}><Ionicons name="refresh" size={22} color="#fff" style={{ transform: [{ scaleX: -1 }] }} /><Text style={s.skipText}>15</Text></Pressable>
          <LinearGradient colors={gradients.cta} style={s.pause}><Ionicons name="pause" size={34} color="#fff" /></LinearGradient>
          <Pressable style={s.skip}><Ionicons name="refresh" size={22} color="#fff" /><Text style={s.skipText}>15</Text></Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 32 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  art: { aspectRatio: 1, marginTop: 20, borderRadius: 28, justifyContent: 'flex-end' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', marginTop: 28 },
  skip: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(127,168,230,0.5)', alignItems: 'center', justifyContent: 'center' },
  skipText: { position: 'absolute', fontFamily: fonts.sansBold, fontSize: 9, color: '#fff' },
  pause: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
});
