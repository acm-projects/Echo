
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState, Platform } from 'react-native'
import type { Database } from './database.types'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

const isServer = typeof window === 'undefined'

const safeStorage = {
  getItem: (key: string) => (isServer ? Promise.resolve(null) : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) => (isServer ? Promise.resolve() : AsyncStorage.setItem(key, value)),
  removeItem: (key: string) => (isServer ? Promise.resolve() : AsyncStorage.removeItem(key)),
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: safeStorage,
    // Web pages are also rendered once in Node by the dev server (web output "static"). There, a session refresh
    // timer would never stop and keep every render's copy of the app in memory until Metro ran out of heap.
    persistSession: !isServer,
    autoRefreshToken: !isServer,
    detectSessionInUrl: false,
  },
})

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh()
    else supabase.auth.stopAutoRefresh()
  })
}