import type { DbClient } from './types'
import type { Database } from '../database.types'

const roomPostFields =
	'*, author:users!room_posts_user_id_fkey(username, display_name, avatar_url)' as const

type RoomPostRow = Database['public']['Views']['room_posts_visible']['Row'] & {
	author: Pick<
		Database['public']['Tables']['users']['Row'],
		'username' | 'display_name' | 'avatar_url'
	> | null
}

export type RoomPost = Omit<RoomPostRow, 'body' | 'author'> & {
	body: string
	author: {
		name: string
		avatar_url: string | null
	}
}

function mapRoomPosts(posts: RoomPostRow[]): RoomPost[] {
	return posts.map((post) => {
		if (!post.author) throw new Error(`Could not load author for room post ${post.id}`)

		return {
			...post,
			body: post.body ?? '',
			author: {
				name: post.author.display_name ?? post.author.username,
				avatar_url: post.author.avatar_url,
			},
		}
	})
}

export async function getRoomPosts(supabase: DbClient, roomId: string): Promise<RoomPost[]> {
	const { data, error } = await supabase
		.from('room_posts_visible')
		.select(roomPostFields)
		.eq('room_id', roomId)
		.is('parent_id', null)
		.order('created_at', { ascending: false })

	if (error) throw error
	return mapRoomPosts(data)
}

export async function getRepliesForPost(supabase: DbClient, postId: string): Promise<RoomPost[]> {
	const { data, error } = await supabase
		.from('room_posts_visible')
		.select(roomPostFields)
		.eq('parent_id', postId)
		.order('created_at', { ascending: true })

	if (error) throw error
	return mapRoomPosts(data)
}

export async function revealSpoiler(supabase: DbClient, postId: string) {
	const { data, error } = await supabase
		.from('room_posts')
		.select('body')
		.eq('id', postId)
		.single()

	if (error) throw error
	return data.body
}
