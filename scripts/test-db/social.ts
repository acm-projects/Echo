import { loadEnvFile } from 'node:process'
import { createClient } from '@supabase/supabase-js'
import {
	acceptFriendRequest,
	blockUser,
	declineFriendRequest,
	getFriendActivity,
	getMyFriendships,
	removeFriend,
	searchUsers,
	sendFriendRequest,
} from '../../lib/db/friends.ts'
import { getMyProfile, getProfileById, updateMyProfile } from '../../lib/db/profile.ts'
import { getFriendsLeaderboard } from '../../lib/db/stats.ts'
import type { Database } from '../../lib/database.types.ts'

loadEnvFile('.env')

function requireEnv(name: string): string {
	const value = process.env[name]
	if (!value) throw new Error(`Missing ${name} in .env`)
	return value
}

const supabase = createClient<Database>(
	requireEnv('EXPO_PUBLIC_SUPABASE_URL'),
	requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
	{
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false,
		},
	},
)

const user1 = {
	email: requireEnv('TEST_USER1_EMAIL'),
	password: requireEnv('TEST_USER1_PASSWORD'),
}
const user2 = {
	email: requireEnv('TEST_USER2_EMAIL'),
	password: requireEnv('TEST_USER2_PASSWORD'),
}

async function logResult<T>(label: string, operation: () => Promise<T>): Promise<T> {
	try {
		const result = await operation()
		console.log(label, result)
		return result
	} catch (error) {
		console.log(`${label} error`, error)
		throw error
	}
}

async function expectFailure(label: string, operation: () => Promise<unknown>): Promise<void> {
	try {
		const result = await operation()
		console.log(`${label} unexpectedly succeeded`, result)
	} catch (error) {
		console.log(`${label} failed as expected`, error)
		return
	}
	throw new Error(`${label} should have failed`)
}

async function signIn(label: string, credentials: typeof user1): Promise<string> {
	const { data, error } = await supabase.auth.signInWithPassword(credentials)
	if (error) {
		console.log(`${label} sign-in error`, error)
		throw error
	}
	if (!data.user) throw new Error(`${label} sign-in returned no user`)

	console.log(`${label} signed in`, { userId: data.user.id })
	return data.user.id
}

async function signOut(label: string): Promise<void> {
	const { error } = await supabase.auth.signOut()
	if (error) {
		console.log(`${label} sign-out error`, error)
		throw error
	}
	console.log(`${label} signed out`)
}

async function main(): Promise<void> {
	const user1Id = await signIn('User 1', user1)
	const myProfile = await logResult('User 1 profile', () => getMyProfile(supabase))
	const user2UsernamePrefix = user2.email.split('@')[0].replace(/[^A-Za-z0-9_]/g, '')
	const searchResults = await logResult('Search for User 2', () =>
		searchUsers(supabase, user2UsernamePrefix),
	)
	const target = searchResults.find((profile) => profile.id !== user1Id)
	if (!target) throw new Error('User search did not find the other test account')
	await logResult('User 2 profile', () => getProfileById(supabase, target.id))

	const ownFriendships = await logResult('User 1 friendships before request', () =>
		getMyFriendships(supabase),
	)
	console.log('User 1 existing friend count', ownFriendships.friends.length)
	await logResult('User 1 friend activity before request', () => getFriendActivity(supabase))

	const request = await logResult('User 1 sends friend request', () =>
		sendFriendRequest(supabase, target.id),
	)
	await logResult('User 1 friendships with outgoing request', () => getMyFriendships(supabase))
	await expectFailure('Requester accepting their own request', () =>
		acceptFriendRequest(supabase, request.id),
	)

	await signOut('User 1')
	const user2Id = await signIn('User 2', user2)
	if (target.id !== user2Id) throw new Error('User search matched a different account than User 2')

	await logResult('User 2 incoming friend requests', () => getMyFriendships(supabase))
	const acceptedRequest = await logResult('User 2 accepts friend request', () =>
		acceptFriendRequest(supabase, request.id),
	)
	await logResult('User 2 friendships after accepting', () => getMyFriendships(supabase))
	await logResult('User 2 friend activity', () => getFriendActivity(supabase))

	const today = new Date().toISOString().slice(0, 10)
	const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
	await logResult('User 2 friends leaderboard', () =>
		getFriendsLeaderboard(supabase, monthAgo, today),
	)
	await expectFailure('Declining an already accepted request', () =>
		declineFriendRequest(supabase, acceptedRequest.id),
	)

	await signOut('User 2')
	await signIn('User 1', user1)
	const updatedProfile = await logResult('User 1 blocks User 2', () =>
		blockUser(supabase, acceptedRequest.id),
	)
	const previousVisibility = myProfile.profile_visibility
	await logResult('User 1 makes profile private', () =>
		updateMyProfile(supabase, { profile_visibility: 'private' }),
	)
	await logResult('Blocked friendship status', async () =>
		await supabase.rpc('are_friends', { a: user1Id, b: user2Id }),
	)
	await logResult('User 1 stats visibility', async () =>
		await supabase.rpc('can_view_profile_stats', { p_user: user1Id }),
	)
	await logResult('User 1 friend activity after blocking', () => getFriendActivity(supabase))

	await signOut('User 1')
	await signIn('User 2', user2)
	await expectFailure('User 2 removing a block placed by User 1', () =>
		removeFriend(supabase, updatedProfile.id),
	)
	await logResult('User 2 cannot view User 1 stats', async () =>
		await supabase.rpc('can_view_profile_stats', { p_user: user1Id }),
	)
	await expectFailure('User 2 reading private User 1 stats', async () => {
		const { data, error } = await supabase
			.from('user_streaks')
			.select('user_id')
			.eq('user_id', user1Id)
			.single()
		if (error) throw error
		return data
	})

	await signOut('User 2')
	await signIn('User 1', user1)
	await logResult('User 1 removes blocked friendship', () =>
		removeFriend(supabase, acceptedRequest.id),
	)
	await logResult('User 1 restores profile visibility', () =>
		updateMyProfile(supabase, { profile_visibility: previousVisibility }),
	)

	const secondRequest = await logResult('User 1 sends second friend request', () =>
		sendFriendRequest(supabase, user2Id),
	)
	await signOut('User 1')
	await signIn('User 2', user2)
	await logResult('User 2 declines friend request', () =>
		declineFriendRequest(supabase, secondRequest.id),
	)
	await signOut('User 2')
	await signIn('User 1', user1)
	await logResult('User 1 removes declined request', () =>
		removeFriend(supabase, secondRequest.id),
	)
	await logResult('User 1 final friendships', () => getMyFriendships(supabase))
	await signOut('User 1')
}

void main().catch((error: unknown) => {
	console.log('Social database checks failed', error)
	process.exitCode = 1
})