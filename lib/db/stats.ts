import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

type StatsClient = SupabaseClient<Database>
type StreakRow = Database['public']['Tables']['user_streaks']['Row']
type ActivityRow = Pick<
	Database['public']['Tables']['reading_activity']['Row'],
	'activity_date' | 'listened_seconds' | 'chapters_completed' | 'goal_met' | 'xp_earned'
>

export type MyStreak = Pick<
	StreakRow,
	'longest_streak' | 'streak_freezes' | 'daily_goal_seconds' | 'total_listen_seconds'
> & { current_streak: number }

export type DailyActivity = ActivityRow

export type LeaderboardEntry =
	Database['public']['Functions']['friends_leaderboard']['Returns'][number]

async function getAuthenticatedUserId(supabase: StatsClient): Promise<string> {
	const { data, error } = await supabase.auth.getUser()
	if (error) throw error
	if (!data.user) throw new Error('No authenticated user found')

	return data.user.id
}

function nextDate(date: string): string {
	const value = new Date(`${date}T00:00:00.000Z`)
	if (Number.isNaN(value.getTime())) throw new Error(`Invalid date: ${date}`)

	value.setUTCDate(value.getUTCDate() + 1)
	return value.toISOString().slice(0, 10)
}

export async function getMyStreak(supabase: StatsClient): Promise<MyStreak> {
	const userId = await getAuthenticatedUserId(supabase)
	const { data, error } = await supabase
		.from('user_streaks_live')
		.select('live_streak, longest_streak, streak_freezes, daily_goal_seconds, total_listen_seconds')
		.eq('user_id', userId)
		.single()

	if (error) throw error
	return {
		current_streak: data.live_streak ?? 0,
		longest_streak: data.longest_streak ?? 0,
		streak_freezes: data.streak_freezes ?? 0,
		daily_goal_seconds: data.daily_goal_seconds ?? 0,
		total_listen_seconds: data.total_listen_seconds ?? 0,
	}
}

export async function updateDailyGoal(
	supabase: StatsClient,
	seconds: number,
): Promise<StreakRow> {
	if (!Number.isInteger(seconds) || seconds < 60 || seconds > 14400) {
		throw new RangeError('Daily goal must be between 60 and 14,400 seconds')
	}

	const userId = await getAuthenticatedUserId(supabase)
	const { data, error } = await supabase
		.from('user_streaks')
		.update({ daily_goal_seconds: seconds })
		.eq('user_id', userId)
		.select()
		.single()

	if (error) throw error
	return data
}

export async function updateTimezone(
	supabase: StatsClient,
	timezone: string,
): Promise<StreakRow> {
	const userId = await getAuthenticatedUserId(supabase)
	const { data, error } = await supabase
		.from('user_streaks')
		.update({ timezone })
		.eq('user_id', userId)
		.select()
		.single()

	if (error) throw error
	return data
}

export async function recordListening(
	supabase: StatsClient,
	seconds: number,
	chaptersCompleted: number,
): Promise<StreakRow> {
	const { data, error } = await supabase.rpc('record_listening', {
		p_seconds: seconds,
		p_chapters_completed: chaptersCompleted,
	})

	if (error) throw error
	return data
}

export async function getMyActivity(
	supabase: StatsClient,
	startDate: string,
	endDate: string,
): Promise<DailyActivity[]> {
	if (startDate > endDate) throw new RangeError('startDate must be on or before endDate')

	const userId = await getAuthenticatedUserId(supabase)
	const { data, error } = await supabase
		.from('reading_activity')
		.select('activity_date, listened_seconds, chapters_completed, goal_met, xp_earned')
		.eq('user_id', userId)
		.gte('activity_date', startDate)
		.lte('activity_date', endDate)
		.order('activity_date', { ascending: true })

	if (error) throw error

	const activityByDate = new Map(data.map((row) => [row.activity_date, row]))
	const activity: DailyActivity[] = []
	for (let date = startDate; date <= endDate; date = nextDate(date)) {
		const row = activityByDate.get(date)
		activity.push(
			row ?? {
				activity_date: date,
				listened_seconds: 0,
				chapters_completed: 0,
				goal_met: false,
				xp_earned: 0,
			},
		)
	}

	return activity
}

export async function getFriendsLeaderboard(
	supabase: StatsClient,
	startDate: string,
	endDate: string,
): Promise<LeaderboardEntry[]> {
	const { data, error } = await supabase.rpc('friends_leaderboard', {
		p_start: startDate,
		p_end: endDate,
	})

	if (error) throw error
	return data
}
