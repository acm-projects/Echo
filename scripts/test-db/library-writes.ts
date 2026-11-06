import assert from 'node:assert/strict'
import { loadEnvFile } from 'node:process'
import { createClient } from '@supabase/supabase-js'
import {
	createBook,
	deleteBook,
	getBookById,
	getMyBooks,
	updateBook,
} from '../../lib/db/books.ts'
import { getCharactersForBook, updateCharacterVoice } from '../../lib/db/characters.ts'
import { deleteProgress, getProgressForBook, saveProgress } from '../../lib/db/progress.ts'
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

async function expectNoRowsError(label: string, operation: () => Promise<unknown>): Promise<void> {
	try {
		const result = await operation()
		console.log(`${label} result`, result)
		throw new Error(`${label} unexpectedly changed a row`)
	} catch (error) {
		if (
			typeof error === 'object' &&
			error !== null &&
			'code' in error &&
			error.code === 'PGRST116'
		) {
			console.log(`${label} returned no row as expected`, error)
			return
		}
		throw error
	}
}

async function main(): Promise<void> {
	const user1Id = await signIn('User 1', user1)
	const user1Books = await logResult('User 1 books', () => getMyBooks(supabase))
	const sampleBook = user1Books.find((book) => book.title === 'The Lantern Keeper')
	if (!sampleBook) throw new Error('Seeded User 1 book "The Lantern Keeper" was not found')

	const { data: catalogBook, error: catalogError } = await supabase
		.from('catalog_books')
		.select('id')
		.eq('source', 'seed')
		.eq('source_id', 'echo-seed-1')
		.maybeSingle()
	if (catalogError) throw catalogError
	if (!catalogBook) throw new Error('Seeded catalog book was not found')

	const { data: chapters, error: chaptersError } = await supabase
		.from('chapters')
		.select('id, chapter_index')
		.eq('book_id', sampleBook.id)
		.order('chapter_index', { ascending: true })
	if (chaptersError) throw chaptersError
	const chapter = chapters[2]
	if (!chapter) throw new Error('Seeded book is missing chapter 2')

	const originalProgress = await logResult('Original User 1 progress', () =>
		getProgressForBook(supabase, sampleBook.id),
	)
	if (!originalProgress) throw new Error('Seeded User 1 progress was not found')

	const characters = await logResult('User 1 characters', () =>
		getCharactersForBook(supabase, sampleBook.id, 3),
	)
	if (characters.length === 0) throw new Error('Seeded User 1 characters were not found')

	const { data: originalJobs, error: originalJobsError } = await supabase
		.from('voice_jobs')
		.select('id, character_id, status')
		.in('character_id', characters.map((entry) => entry.id))
	if (originalJobsError) throw originalJobsError
	const queuedCharacterIds = new Set(
		originalJobs.filter((job) => job.status === 'queued').map((job) => job.character_id),
	)
	const character = characters.find((entry) => !queuedCharacterIds.has(entry.id))
	if (!character) {
		throw new Error('Could not find a seeded character without a queued voice job')
	}
	const originalCharacterJobs = originalJobs.filter((job) => job.character_id === character.id)

	const originalVoice = {
		voice_description: character.voice_description,
		voice_settings: character.voice_settings,
		voice_sample_path: character.voice_sample_path,
	}
	const changes = {
		voice_description: `Temporary library-writes test voice ${Date.now()}`,
		voice_settings: { pitch: 1.1, speed: 1.05 },
		voice_sample_path: 'test/library-writes-voice-sample.mp3',
	}

	let createdBookId: string | undefined
	let testVoiceChanged = false
	let testProgressTimestamp: string | undefined

	try {
		const savedProgress = await logResult('User 1 saves progress', () =>
			saveProgress(supabase, sampleBook.id, chapter.id, 123456, 1.25, false),
		)
		testProgressTimestamp = savedProgress.client_updated_at
		assert.equal(savedProgress?.position_ms, 123456)
		const currentProgress = await logResult('Progress after save', () =>
			getProgressForBook(supabase, sampleBook.id),
		)
		assert.equal(currentProgress?.position_ms, 123456)

		const { data: staleSave, error: staleSaveError } = await supabase.rpc('upsert_progress', {
			p_book_id: sampleBook.id,
			p_chapter_id: chapter.id,
			p_position_ms: 111,
			p_client_updated_at: '2000-01-01T00:00:00.000Z',
			p_playback_speed: 0.75,
			p_is_completed: false,
		})
		if (staleSaveError) throw staleSaveError
		console.log('Stale-device progress save', staleSave)
		const afterStaleSave = await logResult('Progress after stale save', () =>
			getProgressForBook(supabase, sampleBook.id),
		)
		assert.equal(afterStaleSave?.position_ms, 123456, 'Older progress must not overwrite newer progress')

		await logResult('User 1 deletes progress', () => deleteProgress(supabase, sampleBook.id))
		const progressAfterDelete = await logResult('Progress after reset', () =>
			getProgressForBook(supabase, sampleBook.id),
		)
		assert.equal(progressAfterDelete, null)
		testVoiceChanged = true
		const firstVoiceChange = await logResult(`User 1 changes ${character.name} voice`, () =>
			updateCharacterVoice(supabase, character.id, changes),
		)
		assert.equal(firstVoiceChange.character.voice_description, changes.voice_description)
		const firstJob = firstVoiceChange.job
		if (firstJob) assert.equal(firstJob.status, 'queued')

		const secondVoiceChange = await logResult(`User 1 changes ${character.name} voice again`, () =>
			updateCharacterVoice(supabase, character.id, {
				...changes,
				voice_description: `${changes.voice_description} (updated)`,
			}),
		)
		assert.equal(secondVoiceChange.character.voice_description, `${changes.voice_description} (updated)`)
		const { data: voiceJobStatus, error: voiceJobError } = await supabase
			.from('voice_jobs')
			.select('id, status, created_at')
			.eq('character_id', character.id)
			.order('created_at', { ascending: false })
		if (voiceJobError) throw voiceJobError
		console.log('User 1 voice job status', voiceJobStatus)
		assert.ok(
			voiceJobStatus.filter((job) => job.status === 'queued').length <= 1,
			'There must not be more than one queued voice job for a character',
		)
		assert.ok(
			voiceJobStatus.length > originalCharacterJobs.length,
			'A voice job should have been created',
		)

		const newBook = await logResult('User 1 creates catalog book copy', () =>
			createBook(
				supabase,
				`Library writes test ${Date.now()}`,
				'Test Author',
				'test/library-writes-upload.pdf',
				'pdf',
				catalogBook.id,
			),
		)
		createdBookId = newBook.id
		const booksAfterCreate = await logResult('User 1 books after creation', () =>
			getMyBooks(supabase),
		)
		assert.ok(booksAfterCreate.some((book) => book.id === newBook.id))
		const { data: catalogCopy, error: catalogCopyError } = await supabase
			.from('books')
			.select('id, catalog_book_id, user_id')
			.eq('id', newBook.id)
			.single()
		if (catalogCopyError) throw catalogCopyError
		console.log('User 1 copy of seeded catalog book', catalogCopy)
		assert.equal(catalogCopy.catalog_book_id, catalogBook.id)
		assert.equal(catalogCopy.user_id, user1Id)

		const updatedBook = await logResult('User 1 updates book', () =>
			updateBook(supabase, newBook.id, {
				title: `${newBook.title} edited`,
				author: 'Edited Test Author',
				description: 'Edited by the library-writes terminal test.',
			}),
		)
		assert.equal(updatedBook.title, `${newBook.title} edited`)
		const fetchedUpdatedBook = await logResult('Get updated book', () =>
			getBookById(supabase, newBook.id),
		)
		assert.equal(fetchedUpdatedBook?.description, 'Edited by the library-writes terminal test.')

		await logResult('User 1 soft-deletes new book', () => deleteBook(supabase, newBook.id))
		const booksAfterDelete = await logResult('User 1 books after deletion', () =>
			getMyBooks(supabase),
		)
		assert.ok(!booksAfterDelete.some((book) => book.id === newBook.id))
		createdBookId = undefined

		await signOut('User 1')
		await signIn('User 2', user2)

		await expectNoRowsError('User 2 updates User 1 book', () =>
			updateBook(supabase, sampleBook.id, { title: 'Unauthorized library-writes edit' }),
		)
		await logResult('User 2 attempts to delete User 1 book', () =>
			deleteBook(supabase, sampleBook.id),
		)
		await expectNoRowsError('User 2 changes User 1 character voice', () =>
			updateCharacterVoice(supabase, character.id, {
				voice_description: 'Unauthorized voice edit',
				voice_settings: { pitch: 2, speed: 2 },
				voice_sample_path: null,
			}),
		)
		const user2VoiceJobs = await logResult('User 2 voice jobs for User 1 character', async () => {
			const { data, error } = await supabase
				.from('voice_jobs')
				.select('id')
				.eq('character_id', character.id)
			if (error) throw error
			return data
		})
		assert.equal(user2VoiceJobs.length, 0, 'User 2 must not create a job for User 1 character')

		await signOut('User 2')
		await signIn('User 1 verification', user1)

		const bookAfterPrivacyAttempts = await logResult('User 1 verifies book unchanged', () =>
			getBookById(supabase, sampleBook.id),
		)
		assert.equal(bookAfterPrivacyAttempts?.title, sampleBook.title)
		assert.equal(bookAfterPrivacyAttempts?.author, sampleBook.author)

		const characterAfterPrivacyAttempt = await logResult('User 1 verifies voice unchanged', async () => {
			const { data, error } = await supabase
				.from('characters')
				.select('voice_description, voice_settings, voice_sample_path')
				.eq('id', character.id)
				.single()
			if (error) throw error
			return data
		})
		assert.deepEqual(characterAfterPrivacyAttempt, {
			voice_description: `${changes.voice_description} (updated)`,
			voice_settings: changes.voice_settings,
			voice_sample_path: changes.voice_sample_path,
		})
	} finally {
		const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
		if (sessionError) throw sessionError
		if (sessionData.session?.user.id !== user1Id) {
			await signOut('Current user cleanup')
			await signIn('User 1 cleanup', user1)
		}

		if (createdBookId) {
			const { error } = await supabase
				.from('books')
				.update({ deleted_at: new Date().toISOString() })
				.eq('id', createdBookId)
			if (error) console.log('Created book cleanup error', error)
		}

		if (testVoiceChanged) {
			const restoredVoice = await updateCharacterVoice(supabase, character.id, originalVoice)
			console.log('Restore original User 1 voice', restoredVoice)
		}

		if (testProgressTimestamp) {
			const { data: currentProgress, error: currentProgressError } = await supabase
				.from('user_progress')
				.select('client_updated_at')
				.eq('book_id', sampleBook.id)
				.maybeSingle()
			if (currentProgressError) {
				console.log('Progress cleanup check error', currentProgressError)
			} else if (currentProgress?.client_updated_at === testProgressTimestamp) {
				const { error: restoreProgressError } = await supabase.rpc('upsert_progress', {
					p_book_id: sampleBook.id,
					p_chapter_id: originalProgress.chapter_id ?? chapter.id,
					p_position_ms: originalProgress.position_ms,
					p_client_updated_at: new Date(Date.now() + 1000).toISOString(),
					p_playback_speed: originalProgress.playback_speed,
					p_is_completed: originalProgress.is_completed,
				})
				if (restoreProgressError) console.log('Progress cleanup error', restoreProgressError)
			} else {
				console.log('Progress cleanup skipped because another save changed the row')
			}
		}

		await signOut('User 1 cleanup')
	}

	console.log('All library write checks passed.')
}

void main().catch((error: unknown) => {
	console.log('Library write checks failed', error)
	process.exitCode = 1
})
