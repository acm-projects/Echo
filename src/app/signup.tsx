import { Feather } from '@react-native-vector-icons/feather';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';


WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const handleSignin =  async () => {
    const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { username } }, 
})
  router.push('/login');
  };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
   const [showCPassword, setShowCPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');



  const router = useRouter(); 

  

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4285F4" />
      </View>
    );
  }

  return (
    
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        

        <Text style={styles.title}>Create Your Echo Account!</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            placeholder="yourusername"
            placeholderTextColor="#999"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="youremail@example.com"
            placeholderTextColor="#999"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor="#999"
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Feather
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#999"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor="#999"
              secureTextEntry={!showCPassword}
            />
            <TouchableOpacity
              onPress={() => setShowCPassword(!showCPassword)}
              style={styles.eyeIcon}
            >
              <Feather
                name={showCPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#999"
              />
            </TouchableOpacity>
          </View>
          {confirmPassword !== password && confirmPassword.length > 0 && (
            <Text style={{ color: 'red', marginTop: 5 }}>Passwords do not match</Text>
          )}
        </View>
        
        

        <TouchableOpacity style={styles.loginButton} onPress={handleSignin}>
          <Text style={styles.loginText}>Create Account</Text>
        </TouchableOpacity>

        

       
      </KeyboardAvoidingView>
    
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "white",
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
    color: "#222",
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    color: '#444',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    outlineWidth: 0,
    fontSize: 16,
    color: '#000',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
    outlineWidth: 0,
  },
  eyeIcon: {
    paddingLeft: 10,
  },
  loginButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 10,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryAction: {
    marginTop: 20,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#4285F4',
    fontSize: 14,
    fontWeight: '500',
  },
});
