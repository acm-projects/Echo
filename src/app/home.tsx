import { View, Text, StyleSheet } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { BookCard } from './components/BookCard';

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
          <Text style={styles.text}>Welcome {username !== null ? username : 'User'} to Echo and Expo!</Text>
          <BookCard title="The Great Gatsby" author="F. Scott Fitzgerald" tint={['#2F6B3A', '#10281A']} progress={0.5} />
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
  text: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});