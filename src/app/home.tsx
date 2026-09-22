import expo from '@/assets/images/icon.png';
import {View, Text, Image, StyleSheet} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

export default function HomeScreen() {
    const [username, setUsername] = useState<string | null>(null);
    async function getUsername() {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
            console.log('No user logged in:', error?.message)
            return null
        }
        return user.user_metadata.username ?? null
    }
    useEffect(() => {
        const load = async () => {
            const username = await getUsername()
            setUsername(username)
        }
        load()
    }, [])
  return (
    <View style={styles.container}>
      <Image source={expo} style={styles.image} />
      <Text style={styles.text}>Welcome {username !== null ? username : 'User'} to Echo and Expo!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  image: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});