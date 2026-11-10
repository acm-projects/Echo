import { supabaseRoomPosts } from './supabaseRows';

// Sample book-room discussions for the Community tab's sample rooms, keyed by their ids.
export type RoomPost = { id: string; author: string; chapter: number; body: string; spoiler: boolean; likes: number; ago: string };

const POSTS: Record<string, RoomPost[]> = {
  dune: [
    { id: 'd1', author: 'Maya R.', chapter: 7, body: 'The voice for the Reverend Mother gave me actual chills. Slow, dry, every word weighed.', spoiler: false, likes: 41, ago: '2h' },
    { id: 'd2', author: 'Theo K.', chapter: 7, body: 'What the gom jabbar test says about Paul sets up so much of what comes later.', spoiler: true, likes: 18, ago: '5h' },
    { id: 'd3', author: 'Priya S.', chapter: 6, body: 'Listening at 1.25× with the wind going outside my window is a whole mood.', spoiler: false, likes: 27, ago: '1d' },
  ],
  'night-circus': [
    { id: 'n1', author: 'Jun L.', chapter: 4, body: 'The way Celia’s voice shifts when she’s performing versus when she’s alone. So good.', spoiler: false, likes: 33, ago: '1h' },
    { id: 'n2', author: 'Ava M.', chapter: 4, body: 'Pay attention to the clockmaker. He knows more than he says.', spoiler: true, likes: 12, ago: '3h' },
  ],
};

const GENERIC: RoomPost[] = [
  { id: 'g1', author: 'Sam W.', chapter: 1, body: 'Just started tonight. Who else is listening before bed?', spoiler: false, likes: 9, ago: '4h' },
  { id: 'g2', author: 'Rin T.', chapter: 3, body: 'That chapter three reveal. I had to pause and stare at the ceiling for a minute.', spoiler: true, likes: 15, ago: '1d' },
];

function ago(iso: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (60 * 24))}d`;
}

// Rooms with a real id (book_rooms in Supabase) show their posts; the Community tab's sample rooms keep the samples.
// Posts have no spoiler flag or likes in the database yet, so those read as off and zero.
export async function getRoomDiscussion(roomId: string): Promise<RoomPost[]> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(roomId)) {
    const posts = await supabaseRoomPosts(roomId);
    return posts.map((post) => ({
      id: post.id,
      author: post.users?.display_name ?? post.users?.username ?? 'A listener',
      chapter: (post.chapter_index ?? 0) + 1,
      body: post.body,
      spoiler: false,
      likes: 0,
      ago: ago(post.created_at),
    }));
  }
  return POSTS[roomId] ?? GENERIC;
}
