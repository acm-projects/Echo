import { loadEnvFile } from 'node:process'
import { createClient } from '@supabase/supabase-js'
import {
	createReview,
	deleteReview,
	getCommunityFeed,
	getReviewsForBook,
	publishBook,
	unpublishBook,
} from '../../lib/db/community.ts'
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

type TestUser = typeof user1

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

async function expectAccessDenied(
	label: string,
	operation: () => Promise<unknown>,
): Promise<void> {
	let succeeded = false
	try {
		const result = await operation()
		console.log(`${label} unexpectedly succeeded`, result)
		succeeded = true
	} catch (error) {
		const code =
			typeof error === 'object' && error !== null && 'code' in error
				? error.code
				: undefined
		console.log(`${label} error`, error)
		if (code === '42501' || code === 'PGRST116') {
			console.log(`${label} denied as expected`)
			return
		}
		throw error
	}
	if (succeeded) throw new Error(`${label} should have been denied`)
}

async function signIn(label: string, credentials: TestUser): Promise<string> {
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
	const { data: books, error: booksError } = await supabase
		.from('books')
		.select('id, title')
		.eq('user_id', user1Id)
		.is('deleted_at', null)
		.order('created_at', { ascending: false })

	if (booksError) throw booksError
	const book = books[0]
	if (!book) throw new Error('User 1 has no books available to publish')

	const { data: originalListing, error: listingError } = await supabase
		.from('community_books')
		.select('id, title, description, tags, language, status')
		.eq('book_id', book.id)
		.maybeSingle()

	if (listingError) throw listingError

	let listingId: string | undefined
	let reviewId: string | undefined

	try {
		await logResult('Community feed before publishing', () => getCommunityFeed(supabase))
		const listing = await logResult('User 1 publishes book', () =>
			publishBook(
				supabase,
				book.id,
				`Community DB test ${Date.now()}`,
				'Temporary listing created by the community database test.',
				['community-db-test'],
			),
		)
		listingId = listing.id
		await logResult('Community feed after publishing', () => getCommunityFeed(supabase))
		await logResult('User 1 reviews listing', () => getReviewsForBook(supabase, listing.id))

		const review = await logResult('User 1 creates review', () =>
			createReview(
				supabase,
				listing.id,
				null,
				'Temporary review created by the community database test.',
			),
		)
		reviewId = review.id
		await logResult('User 1 reviews listing after creation', () =>
			getReviewsForBook(supabase, listing.id),
		)

		await signOut('User 1')
		await signIn('User 2', user2)
		await expectAccessDenied('User 2 unpublishing User 1 listing', () =>
			unpublishBook(supabase, listing.id),
		)
		await expectAccessDenied('User 2 deleting User 1 review', () =>
			deleteReview(supabase, review.id),
		)

		await signOut('User 2')
		await signIn('User 1', user1)
		await logResult('User 1 deletes review', () => deleteReview(supabase, review.id))
		await logResult('User 1 unpublishes book', () => unpublishBook(supabase, listing.id))
		await logResult('Community feed after unpublishing', () => getCommunityFeed(supabase))
	} finally {
		const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
		if (sessionError) throw sessionError
		if (sessionData.session?.user.id !== user1Id) {
			await signOut('Current user cleanup')
			await signIn('User 1 cleanup', user1)
		}

		if (reviewId) {
			const { error } = await supabase
				.from('reviews_comments')
				.update({ deleted_at: new Date().toISOString() })
				.eq('id', reviewId)
				.is('deleted_at', null)
			if (error) console.log('Review cleanup error', error)
		}

		if (originalListing && listingId) {
			const { error } = await supabase
				.from('community_books')
				.update({
					title: originalListing.title,
					description: originalListing.description,
					tags: originalListing.tags,
					language: originalListing.language,
					status: originalListing.status,
				})
				.eq('id', listingId)
			if (error) console.log('Listing cleanup error', error)
		}

		await signOut('User 1 cleanup')
	}
}

void main().catch((error: unknown) => {
	console.log('Community database checks failed', error)
	process.exitCode = 1
})
