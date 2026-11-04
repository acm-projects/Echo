import type { Database } from '../database.types'
import type { DbClient } from './types'

type CatalogBookRow = Database['public']['Tables']['catalog_books']['Row']

export type CatalogBook = Pick<
	CatalogBookRow,
	'id' | 'title' | 'author' | 'cover_image_path'
>

const catalogFields = 'id, title, author, cover_image_path' as const

export async function getCatalog(supabase: DbClient): Promise<CatalogBook[]> {
	const { data, error } = await supabase
		.from('catalog_books')
		.select(catalogFields)
		.eq('is_public_domain', true)
		.order('title', { ascending: true })

	if (error) throw error
	return data
}

export async function searchCatalog(
	supabase: DbClient,
	text: string,
): Promise<CatalogBook[]> {
	const query = text.trim()
	if (!query) return []

	const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`
	const [titleResults, authorResults] = await Promise.all([
		supabase
			.from('catalog_books')
			.select(catalogFields)
			.eq('is_public_domain', true)
			.ilike('title', pattern),
		supabase
			.from('catalog_books')
			.select(catalogFields)
			.eq('is_public_domain', true)
			.ilike('author', pattern),
	])

	if (titleResults.error) throw titleResults.error
	if (authorResults.error) throw authorResults.error

	const booksById = new Map<string, CatalogBook>()
	for (const book of [...titleResults.data, ...authorResults.data]) {
		booksById.set(book.id, book)
	}

	return [...booksById.values()].sort((first, second) =>
		first.title.localeCompare(second.title),
	)
}
