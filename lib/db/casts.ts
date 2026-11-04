import type { Database } from '../database.types'
import type { DbClient } from './types'

type SharedCastRow = Database['public']['Tables']['shared_casts']['Row']
type SharedCastVoiceRow = Database['public']['Tables']['shared_cast_voices']['Row']
type CastVoiceInput = Pick<
	Database['public']['Tables']['characters']['Row'],
	'name' | 'voice_description' | 'voice_settings' | 'voice_sample_path'
>

const sharedCastFields =
	'*, voices:shared_cast_voices(*), sharer:users!shared_casts_user_id_fkey(username, display_name, avatar_url)' as const

type SharedCastResult = SharedCastRow & {
	voices: SharedCastVoiceRow[]
	sharer: {
		name: string
		avatar_url: string | null
	}
}

export async function getSharedCasts(
	supabase: DbClient,
	catalogBookId: string,
): Promise<SharedCastResult[]> {
	const { data, error } = await supabase
		.from('shared_casts')
		.select(sharedCastFields)
		.eq('catalog_book_id', catalogBookId)
		.order('created_at', { ascending: false })

	if (error) throw error

	return data.map((cast) => {
		if (!cast.sharer) throw new Error(`Could not load sharer for shared cast ${cast.id}`)

		return {
			...cast,
			sharer: {
				name: cast.sharer.display_name ?? cast.sharer.username,
				avatar_url: cast.sharer.avatar_url,
			},
		}
	})
}

export async function shareCast(
	supabase: DbClient,
	bookId: string,
	title: string,
	description: string | null,
): Promise<SharedCastRow & { voices: SharedCastVoiceRow[] }> {
	const { data: book, error: bookError } = await supabase
		.from('books')
		.select('catalog_book_id')
		.eq('id', bookId)
		.maybeSingle()

	if (bookError) throw bookError
	if (!book?.catalog_book_id) {
		throw new Error('Cannot share a cast for a book that is not linked to the catalog')
	}

	const { data: characters, error: charactersError } = await supabase
		.from('characters')
		.select('name, voice_description, voice_settings, voice_sample_path')
		.eq('book_id', bookId)

	if (charactersError) throw charactersError

	const { data: cast, error: castError } = await supabase
		.from('shared_casts')
		.insert({
			catalog_book_id: book.catalog_book_id,
			title,
			description,
		})
		.select()
		.single()

	if (castError) throw castError

	const voiceRows: CastVoiceInput[] = characters
	const voices = voiceRows.map((character) => ({
		cast_id: cast.id,
		character_name: character.name,
		voice_description: character.voice_description,
		voice_settings: character.voice_settings,
		voice_sample_path: character.voice_sample_path,
	}))

	if (voices.length === 0) return { ...cast, voices: [] }

	const { data: createdVoices, error: voicesError } = await supabase
		.from('shared_cast_voices')
		.insert(voices)
		.select()

	if (voicesError) throw voicesError
	return { ...cast, voices: createdVoices }
}
