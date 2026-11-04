import type { Database } from '../database.types'
import type { DbClient } from './types'

type CommunityBookRow = Database['public']['Tables']['community_books']['Row']
type ReviewRow = Database['public']['Tables']['reviews_comments']['Row']

type CommunityBookDraft = Pick<CommunityBookRow, 'title' | 'description' | 'tags'>

export type CommunityReview = Omit<ReviewRow, 'user_id'> & {
	author: {
		name: string
	}
}

async function getAuthenticatedUserId(supabase: DbClient): Promise<string> {
	const { data, error } = await supabase.auth.getUser()
	if (error) throw error
	if (!data.user) throw new Error('No authenticated user found')

	return data.user.id
}

export async function getCommunityFeed(supabase: DbClient): Promise<CommunityBookRow[]> {
	const { data, error } = await supabase
		.from('community_books')
		.select('*')
		.eq('status', 'published')
		.order('published_at', { ascending: false })

	if (error) throw error
	return data
}


export async function publishBook(
	supabase: DbClient,
	bookId: string,
	title: string,
	description: string | null,
	tags: string[],
): Promise<CommunityBookRow> {
	const userId = await getAuthenticatedUserId(supabase)
	const { data: book, error: bookError } = await supabase
		.from('books')
		.select('language')
		.eq('id', bookId)
		.eq('user_id', userId)
		.is('deleted_at', null)
		.maybeSingle()

	if (bookError) throw bookError
	if (!book) throw new Error(`Could not find owned book ${bookId}`)

	const changes: CommunityBookDraft & {
		language: string
		status: Database['public']['Enums']['publish_status']
	} = { title, description, tags, language: book.language, status: 'published' }

	const { data: existingListing, error: listingError } = await supabase
		.from('community_books')
		.select('id')
		.eq('book_id', bookId)
		.maybeSingle()

	if (listingError) throw listingError

	const result = existingListing
		? await supabase
				.from('community_books')
				.update(changes)
				.eq('id', existingListing.id)
				.select()
				.single()
		: await supabase
				.from('community_books')
				.insert({ ...changes, book_id: bookId, user_id: userId })
				.select()
				.single()

	if (result.error) throw result.error
	return result.data
}

export async function unpublishBook(
	supabase: DbClient,
	listingId: string,
): Promise<CommunityBookRow> {
	const { data, error } = await supabase
		.from('community_books')
		.update({ status: 'removed' })
		.eq('id', listingId)
		.select()
		.single()

	if (error) throw error
	return data
}

export async function getReviewsForBook(
	supabase: DbClient,
	listingId: string,
): Promise<CommunityReview[]> {
	const { data: listing, error: listingError } = await supabase
		.from('community_books')
		.select('id')
		.eq('id', listingId)
		.eq('status', 'published')
		.maybeSingle()

	if (listingError) throw listingError
	if (!listing) return []

	const { data, error } = await supabase
		.from('reviews_comments')
		.select('id, community_book_id, parent_id, rating, title, body, is_edited, deleted_at, created_at, updated_at, author:users!reviews_comments_user_id_fkey(username, display_name)')
		.eq('community_book_id', listingId)
		.is('parent_id', null)
		.is('deleted_at', null)
		.order('created_at', { ascending: false })

	if (error) throw error

	return data.map((review) => {
		if (!review.author) throw new Error(`Could not load author for review ${review.id}`)

		return {
			...review,
			author: { name: review.author.display_name ?? review.author.username },
		}
	})
}

export async function createReview(
	supabase: DbClient,
	listingId: string,
	rating: number | null,
	body: string | null,
): Promise<ReviewRow> {
	if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
		throw new RangeError('rating must be an integer from 1 to 5')
	}
	const normalizedBody = body?.trim() || null
	if (rating === null && normalizedBody === null) {
		throw new Error('A review must include a rating or text')
	}

	const { data: listing, error: listingError } = await supabase
		.from('community_books')
		.select('id')
		.eq('id', listingId)
		.eq('status', 'published')
		.maybeSingle()

	if (listingError) throw listingError
	if (!listing) throw new Error(`Could not find published listing ${listingId}`)

	const userId = await getAuthenticatedUserId(supabase)
	const { data, error } = await supabase
		.from('reviews_comments')
		.insert({
			community_book_id: listingId,
			user_id: userId,
			rating,
			body: normalizedBody,
		})
		.select()
		.single()

	if (error) throw error
	return data
}

export async function deleteReview(
	supabase: DbClient,
	reviewId: string,
): Promise<ReviewRow> {
	const { data, error } = await supabase
		.from('reviews_comments')
		.update({ deleted_at: new Date().toISOString() })
		.eq('id', reviewId)
		.select()
		.single()

	if (error) throw error
	return data
}

