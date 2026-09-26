import Feather from '@react-native-vector-icons/feather';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface BottomNavBarProps {
  currentScreen: 'library' | 'upload' | 'play' | 'characters' | 'profile';
}
export const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentScreen }) => {
  const iconColor = (screen: string) => (screen === currentScreen ? 'blue' : '#A6A6A6');
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.iconButton} onPress={() => router.push('../library/library')}>
        <Feather name='book-open' size={24} color={iconColor('library')} />
        <Text style={{ color: iconColor('library'), fontSize: 12 }}>Library</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.iconButton} onPress={() => router.push('../upload/upload')}>
        <Feather name='upload' size={24} color={iconColor('upload')} />
        <Text style={{ color: iconColor('upload'), fontSize: 12 }}>Upload</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.iconButton} onPress={() => router.push('../play/play')}>
        <Feather name='play' size={24} color={iconColor('play')} />
        <Text style={{ color: iconColor('play'), fontSize: 12 }}>Play</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.iconButton} onPress={() => router.push('../characters/characters')}>
        <Feather name='smile' size={24} color={iconColor('characters')} />
        <Text style={{ color: iconColor('characters'), fontSize: 12 }}>Characters</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.iconButton} onPress={() => router.push('../profile/profile')}>
        <Feather name='user' size={24} color={iconColor('profile')} />
        <Text style={{ color: iconColor('profile'), fontSize: 12 }}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: '#626e82',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 10,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 10
  },
  iconButton: {
    padding: 20, // expands the tappable area without affecting layout
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 50,
    height: 50,
    backgroundColor: '#1c1c1c',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -30,
    elevation: 10
  },
  notificationBadge: {
    position: 'absolute',
    top: -.00025,
    right: -.000025,
    backgroundColor: 'red',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
