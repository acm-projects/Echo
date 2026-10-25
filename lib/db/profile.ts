import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

type UserRow = Database['public']['Tables']['users']['Row']

export type UserProfile = Pick<
	UserRow,
	'id' | 'username' | 'display_name' | 'avatar_url' | 'bio' | 'profile_visibility'
>

export type ProfileChanges = Partial<
	Pick<UserRow, 'display_name' | 'avatar_url' | 'bio' | 'profile_visibility'>
>

type ProfileClient = SupabaseClient<Database>

const profileFields = 'id, username, display_name, avatar_url, bio, profile_visibility'

export async function getMyProfile(supabase: ProfileClient): Promise<UserProfile> {
	const { data, error } = await supabase.auth.getUser()
	if (error) throw error
	if (!data.user) throw new Error('No authenticated user found')

	const { data: profile, error: profileError } = await supabase
		.from('users')
		.select(profileFields)
		.eq('id', data.user.id)
		.single()

	if (profileError) throw profileError
	return profile
}

export async function getProfileById(
	supabase: ProfileClient,
	userId: string,
): Promise<UserProfile> {
	const { data, error } = await supabase
		.from('users')
		.select(profileFields)
		.eq('id', userId)
		.single()

	if (error) throw error
	return data
}

export async function updateMyProfile(
	supabase: ProfileClient,
	changes: ProfileChanges,
): Promise<UserProfile> {
	const { data: authData, error: authError } = await supabase.auth.getUser()
	if (authError) throw authError
	if (!authData.user) throw new Error('No authenticated user found')

	const { data, error } = await supabase
		.from('users')
		.update(changes)
		.eq('id', authData.user.id)
		.select(profileFields)
		.single()

	if (error) throw error
	return data
}
