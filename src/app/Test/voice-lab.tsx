import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { Screen } from '../components/Screen';
import { GradientButton } from '../components/GradientButton';
import { colors, fonts, type } from '../../../theme';

const SERVER_URL = process.env.EXPO_PUBLIC_VOICE_SERVER_URL ?? 'http://127.0.0.1:8787';

export default function VoiceLab() {
  const player = useAudioPlayer(null);
  const [voiceDescription, setVoiceDescription] = useState('A warm, measured audiobook narrator with a low, clear timbre and gentle contemporary English accent.');
  const [text, setText] = useState('The room beneath the stars was silent, except for the soft turning of a page.');
  const [emotion, setEmotion] = useState('quietly mysterious and reflective');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ voiceId: string } | null>(null);

  const generate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`${SERVER_URL}/api/voice/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ voiceDescription, text, emotion, displayName: 'Echo voice lab' }),
      });
      const data = await response.json() as { error?: string; voiceId?: string; audioBase64?: string };
      if (!response.ok || !data.voiceId || !data.audioBase64) throw new Error(data.error ?? 'Voice generation failed.');
      player.replace({ uri: `data:audio/wav;base64,${data.audioBase64}` });
      player.play();
      setResult({ voiceId: data.voiceId });
      Alert.alert('Voice generated', 'Gemini designed the voice and IndexTTS read your text with it.');
    } catch (error) {
      Alert.alert('Generation failed', error instanceof Error ? error.message : 'Could not reach the voice server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={s.screen}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={type.meta}>INTERNAL SAMPLE</Text>
        <Text style={s.title}>Voice lab</Text>
        <Text style={[type.body, s.intro]}>Gemini designs the vocal identity. IndexTTS clones that neutral reference and performs the passage locally.</Text>

        <Text style={s.label}>VOICE DESCRIPTION</Text>
        <TextInput multiline value={voiceDescription} onChangeText={setVoiceDescription} style={s.textArea} placeholderTextColor={colors.faint} />

        <Text style={s.label}>EMOTION / DELIVERY</Text>
        <TextInput value={emotion} onChangeText={setEmotion} style={s.input} placeholderTextColor={colors.faint} />

        <Text style={s.label}>TEXT TO READ</Text>
        <TextInput multiline value={text} onChangeText={setText} style={[s.textArea, s.textInputTall]} placeholderTextColor={colors.faint} />

        <GradientButton title={loading ? 'GENERATING...' : 'GENERATE SAMPLE'} onPress={generate} />
        {loading && <View style={s.status}><ActivityIndicator color={colors.gold} /><Text style={type.meta}>Loading IndexTTS once on the local worker...</Text></View>}
        {result && <Text style={[type.meta, s.success]}>Generated with voice {result.voiceId}</Text>}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  screen: { paddingHorizontal: 24 },
  content: { paddingVertical: 20, paddingBottom: 40 },
  title: { fontFamily: fonts.serif, fontSize: 34, color: colors.text, marginTop: 8 },
  intro: { marginTop: 8, marginBottom: 26, lineHeight: 21 },
  label: { ...type.meta, letterSpacing: 1.2, marginBottom: 8, marginTop: 16 },
  input: { minHeight: 56, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 16, fontFamily: fonts.sans, fontSize: 16 },
  textArea: { minHeight: 112, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.text, padding: 16, fontFamily: fonts.sans, fontSize: 16, textAlignVertical: 'top' },
  textInputTall: { minHeight: 150 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  success: { marginTop: 18, color: colors.gold },
});
