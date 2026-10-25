import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

type FriendshipRow = Database['public']['Tables']['friendships']['Row']
type UserRow = Database['public']['Tables']['users']['Row']
type ActivityRow = Database['public']['Tables']['reading_activity']['Row']
type FriendshipClient = SupabaseClient<Database>

type FriendProfile = Pick<UserRow, 'id' | 'username' | 'display_name' | 'avatar_url'>

export type FriendshipWithProfile = FriendshipRow & { other_user: FriendProfile }

export type MyFriendships = {
	friends: FriendshipWithProfile[]
	incomingRequests: FriendshipWithProfile[]
	outgoingRequests: FriendshipWithProfile[]
}

export type UserSearchResult = FriendProfile

export type FriendActivity = Pick<
	ActivityRow,
	'activity_date' | 'listened_seconds' | 'chapters_completed'
> & FriendProfile

async function getAuthenticatedUserId(supabase: FriendshipClient): Promise<string> {
	const { data, error } = await supabase.auth.getUser()
	if (error) throw error
	if (!data.user) throw new Error('No authenticated user found')

	return data.user.id
}

export async function sendFriendRequest(
	supabase: FriendshipClient,
	otherUserId: string,
): Promise<FriendshipRow> {
	const requesterId = await getAuthenticatedUserId(supabase)
	const { data, error } = await supabase
		.from('friendships')
		.insert({ requester_id: requesterId, addressee_id: otherUserId, status: 'pending' })
		.select()
		.single()

	if (error) throw error
	return data
}

export async function acceptFriendRequest(
	supabase: FriendshipClient,
	friendshipId: string,
): Promise<FriendshipRow> {
	const { data, error } = await supabase
		.from('friendships')
		.update({ status: 'accepted' })
		.eq('id', friendshipId)
		.select()
		.single()

	if (error) throw error
	return data
}

export async function declineFriendRequest(
	supabase: FriendshipClient,
	friendshipId: string,
): Promise<FriendshipRow> {
	const { data, error } = await supabase
		.from('friendships')
		.update({ status: 'declined' })
		.eq('id', friendshipId)
		.select()
		.single()

	if (error) throw error
	return data
}

export async function removeFriend(
	supabase: FriendshipClient,
	friendshipId: string,
): Promise<FriendshipRow> {
	const { data, error } = await supabase
		.from('friendships')
		.delete()
		.eq('id', friendshipId)
		.select()
		.single()

	if (error) throw error
	return data
}

export async function blockUser(
	supabase: FriendshipClient,
	friendshipId: string,
): Promise<FriendshipRow> {
	const userId = await getAuthenticatedUserId(supabase)
	const { data, error } = await supabase
		.from('friendships')
		.update({ status: 'blocked', blocked_by: userId })
		.eq('id', friendshipId)
		.select()
		.single()

	if (error) throw error
	return data
}

export async function getMyFriendships(supabase: FriendshipClient): Promise<MyFriendships> {
	const userId = await getAuthenticatedUserId(supabase)
	const { data: friendships, error } = await supabase
		.from('friendships')
		.select('*')
		.in('status', ['accepted', 'pending'])

	if (error) throw error
	if (friendships.length === 0) {
		return { friends: [], incomingRequests: [], outgoingRequests: [] }
	}

	const otherUserIds = friendships.map((friendship) =>
		friendship.requester_id === userId ? friendship.addressee_id : friendship.requester_id,
	)
	const { data: profiles, error: profilesError } = await supabase
		.from('users')
		.select('id, username, display_name, avatar_url')
		.in('id', otherUserIds)

	if (profilesError) throw profilesError

	const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
	const result: MyFriendships = { friends: [], incomingRequests: [], outgoingRequests: [] }

	for (const friendship of friendships) {
		const otherUserId = friendship.requester_id === userId
			? friendship.addressee_id
			: friendship.requester_id
		const otherUser = profilesById.get(otherUserId)
		if (!otherUser) throw new Error(`Could not load profile for friend ${otherUserId}`)

		const entry = { ...friendship, other_user: otherUser }
		if (friendship.status === 'accepted') {
			result.friends.push(entry)
		} else if (friendship.addressee_id === userId) {
			result.incomingRequests.push(entry)
		} else {
			result.outgoingRequests.push(entry)
		}
	}

	return result
}

export async function searchUsers(
	supabase: FriendshipClient,
	text: string,
): Promise<UserSearchResult[]> {
	const userId = await getAuthenticatedUserId(supabase)
	const query = text.trim()
	if (!query) return []

	const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`
	const [usernameResults, displayNameResults] = await Promise.all([
		supabase
			.from('users')
			.select('id, username, display_name, avatar_url')
			.neq('id', userId)
			.ilike('username', pattern)
			.limit(20),
		supabase
			.from('users')
			.select('id, username, display_name, avatar_url')
			.neq('id', userId)
			.ilike('display_name', pattern)
			.limit(20),
	])

	if (usernameResults.error) throw usernameResults.error
	if (displayNameResults.error) throw displayNameResults.error

	const usersById = new Map<string, UserSearchResult>()
	for (const user of [...usernameResults.data, ...displayNameResults.data]) {
		usersById.set(user.id, user)
	}

	return [...usersById.values()]
		.sort((first, second) => first.username.localeCompare(second.username))
		.slice(0, 20)
}

export async function getFriendActivity(
	supabase: FriendshipClient,
	days = 7,
): Promise<FriendActivity[]> {
	if (!Number.isInteger(days) || days < 1) {
		throw new RangeError('days must be a positive integer')
	}

	const { friends } = await getMyFriendships(supabase)
	if (friends.length === 0) return []

	const today = new Date()
	const start = new Date(today)
	start.setDate(start.getDate() - days + 1)
	const formatDate = (date: Date) =>
		`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
	const startDate = formatDate(start)
	const endDate = formatDate(today)
	const friendById = new Map(friends.map(({ other_user }) => [other_user.id, other_user]))
	const { data, error } = await supabase
		.from('reading_activity')
		.select('user_id, activity_date, listened_seconds, chapters_completed')
		.in('user_id', [...friendById.keys()])
		.gte('activity_date', startDate)
		.lte('activity_date', endDate)
		.order('activity_date', { ascending: false })
		.order('user_id', { ascending: true })

	if (error) throw error

	return data.map((activity) => {
		const friend = friendById.get(activity.user_id)
		if (!friend) throw new Error(`Could not load profile for friend ${activity.user_id}`)

		return {
			id: friend.id,
			username: friend.username,
			display_name: friend.display_name,
			avatar_url: friend.avatar_url,
			activity_date: activity.activity_date,
			listened_seconds: activity.listened_seconds,
			chapters_completed: activity.chapters_completed,
		}
	})
}
