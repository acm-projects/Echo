import { signedInClient } from './supabaseRows';
import { supabase as sharedClient } from '../../lib/supabase';
import { getFriendActivity, getMyFriendships, sendFriendRequest } from '../../lib/db/friends';

// The Community tab, from Supabase. Readers make book rooms about any book (book_rooms + room_members):
//   public   listed and searchable; anyone signed in can join
//   private  hidden; joined with its invite code
// A room isn't tied to anyone's upload. If the reader has the room's book on their shelf (same catalog entry, or the
// same title ignoring case and punctuation), my_room_shelf() says which copy, and that copy's progress decides which
// chapter-tagged posts they can read (room_posts_visible withholds the rest). With nobody signed in every read throws
// NotSignedIn, and the screens ask the reader to sign in.

export class NotSignedIn extends Error {
  constructor() {
    super('Sign in to see the community.');
  }
}

async function client() {
  const c = await signedInClient();
  if (!c) throw new NotSignedIn();
  return c;
}

export type Visibility = 'public' | 'private';

export type Room = {
  id: string;
  name: string;
  bookTitle: string;
  bookAuthor: string | null;
  description: string | null;
  visibility: Visibility;
  // Only members of a private room see its code.
  inviteCode: string | null;
  // The reader made the room / has joined it.
  owner: boolean;
  joined: boolean;
  members: number;
  // Posts in the room, and how many different people wrote them.
  posts: number;
  people: number;
  lastPostAt: string | null;
  // The reader's copy of the room's book, if it's on their shelf.
  myBookId: string | null;
  // 0-based chapter the reader has reached in that copy (null without one, -1 not started); finished reads as Infinity.
  myChapter: number | null;
  createdAt: string;
};

export type RoomPost = {
  id: string;
  userId: string;
  author: string;
  avatarPath: string | null;
  mine: boolean;
  // 0-based chapter the post is about, or null for a general post.
  chapterIndex: number | null;
  // True while the post is about a chapter the reader hasn't reached; its body is withheld until then.
  spoiler: boolean;
  body: string | null;
  createdAt: string;
};

export type Member = { id: string; name: string; username: string; avatarPath: string | null; owner: boolean; me: boolean };

export type Activity =
  | { kind: 'listened'; userId: string; name: string; date: string; seconds: number; chapters: number }
  | { kind: 'posted'; userId: string; name: string; date: string; roomId: string; roomTitle: string; chapterIndex: number | null; spoiler: boolean; body: string | null };

const FINISHED = 2147483647;
const displayName = (u: { display_name: string | null; username: string } | undefined) => u?.display_name || u?.username || 'A listener';
const ROOM_COLUMNS = 'id, name, book_title, book_author, description, visibility, invite_code, created_by, created_at';

/** Every room the reader can see: the ones they've joined first, then public rooms, busiest first. */
export async function getRooms(): Promise<Room[]> {
  const { supabase, userId } = await client();
  const [rooms, members, posts, shelf] = await Promise.all([
    supabase.from('book_rooms').select(ROOM_COLUMNS).order('created_at', { ascending: false }).limit(500),
    supabase.from('room_members').select('room_id, user_id').limit(5000),
    supabase.from('room_posts').select('room_id, user_id, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(2000),
    supabase.rpc('my_room_shelf'),
  ]);
  if (rooms.error) throw rooms.error;
  const memberCount = new Map<string, number>();
  const joined = new Set<string>();
  for (const m of members.data ?? []) {
    memberCount.set(m.room_id, (memberCount.get(m.room_id) ?? 0) + 1);
    if (m.user_id === userId) joined.add(m.room_id);
  }
  const stats = new Map<string, { posts: number; people: Set<string>; last: string | null }>();
  for (const post of posts.data ?? []) {
    const entry = stats.get(post.room_id) ?? { posts: 0, people: new Set<string>(), last: null };
    entry.posts += 1;
    entry.people.add(post.user_id);
    entry.last ??= post.created_at;
    stats.set(post.room_id, entry);
  }
  const copies = new Map((shelf.data ?? []).map((row) => [row.room_id, row]));
  const list = (rooms.data ?? []).map((room) => {
    const s = stats.get(room.id);
    const copy = copies.get(room.id);
    const chapter = copy?.book_id ? copy.chapter_index : null;
    return {
      id: room.id,
      name: room.name,
      bookTitle: room.book_title,
      bookAuthor: room.book_author,
      description: room.description,
      visibility: room.visibility,
      inviteCode: room.invite_code,
      owner: room.created_by === userId,
      joined: joined.has(room.id),
      members: memberCount.get(room.id) ?? 0,
      posts: s?.posts ?? 0,
      people: s?.people.size ?? 0,
      lastPostAt: s?.last ?? null,
      myBookId: copy?.book_id ?? null,
      myChapter: chapter === null || chapter === undefined ? null : chapter === FINISHED ? Infinity : chapter,
      createdAt: room.created_at,
    } satisfies Room;
  });
  return list.sort((a, b) => Number(b.joined) - Number(a.joined) || b.posts - a.posts || b.members - a.members || a.name.localeCompare(b.name));
}

export async function getRoom(roomId: string): Promise<Room | null> {
  return (await getRooms()).find((room) => room.id === roomId) ?? null;
}

/**
 * Makes a room about a book; the reader becomes its owner. A private room gets an invite code to share. Title and
 * author are what decide whether other readers "have" the book, so they should match the book's real title.
 */
export async function createRoom(input: { name?: string; bookTitle: string; bookAuthor?: string | null; visibility: Visibility; description?: string }) {
  const { supabase } = await client();
  const { data, error } = await supabase.rpc('create_book_room', {
    p_name: input.name?.trim() || input.bookTitle.trim(),
    p_book_title: input.bookTitle.trim(),
    p_book_author: input.bookAuthor?.trim() || undefined,
    p_visibility: input.visibility,
    p_description: input.description?.trim() || undefined,
  });
  if (error) throw error;
  return data as unknown as { id: string; invite_code: string | null };
}

export async function joinRoom(roomId: string) {
  const { supabase, userId } = await client();
  const { error } = await supabase.from('room_members').insert({ room_id: roomId, user_id: userId });
  if (error && error.code !== '23505') throw error;
}

/** Joins the private (or public) room with this code and returns its id. */
export async function joinRoomByCode(code: string): Promise<string> {
  const { supabase } = await client();
  const { data, error } = await supabase.rpc('join_room_by_code', { p_code: code });
  if (error) throw new Error(error.message.includes('invite code') ? 'No room has that invite code. Check it and try again.' : error.message);
  return data;
}

export async function leaveRoom(roomId: string) {
  const { supabase, userId } = await client();
  const { error } = await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId);
  if (error) throw error;
}

/** Owners only. Deletes the room and every post in it. */
export async function deleteRoom(roomId: string) {
  const { supabase } = await client();
  const { error } = await supabase.from('book_rooms').delete().eq('id', roomId);
  if (error) throw error;
}

export async function getRoomMembers(roomId: string): Promise<Member[]> {
  const { supabase, userId } = await client();
  const { data, error } = await supabase.from('room_members').select('user_id, role, joined_at').eq('room_id', roomId).order('joined_at', { ascending: true }).limit(500);
  if (error) throw error;
  const ids = (data ?? []).map((m) => m.user_id);
  const { data: people } = ids.length ? await supabase.from('users').select('id, username, display_name, avatar_url').in('id', ids) : { data: [] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  return (data ?? []).map((m) => ({
    id: m.user_id,
    name: m.user_id === userId ? 'You' : displayName(byId.get(m.user_id)),
    username: byId.get(m.user_id)?.username ?? '',
    avatarPath: byId.get(m.user_id)?.avatar_url ?? null,
    owner: m.role === 'owner',
    me: m.user_id === userId,
  }));
}

/** A room's posts, newest first, with spoilers masked for the reader. */
export async function getRoomPosts(roomId: string): Promise<RoomPost[]> {
  const { supabase, userId } = await client();
  const { data, error } = await supabase
    .from('room_posts_visible')
    .select('id, user_id, chapter_index, is_spoiler, is_deleted, body, created_at')
    .eq('room_id', roomId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const ids = [...new Set((data ?? []).map((p) => p.user_id).filter(Boolean) as string[])];
  const { data: people } = ids.length ? await supabase.from('users').select('id, username, display_name, avatar_url').in('id', ids) : { data: [] };
  const byId = new Map((people ?? []).map((p) => [p.id, p]));
  return (data ?? []).map((p) => ({
    id: p.id!,
    userId: p.user_id!,
    author: p.user_id === userId ? 'You' : displayName(byId.get(p.user_id!)),
    avatarPath: byId.get(p.user_id!)?.avatar_url ?? null,
    mine: p.user_id === userId,
    chapterIndex: p.chapter_index,
    spoiler: Boolean(p.is_spoiler),
    body: p.body,
    createdAt: p.created_at!,
  }));
}

/**
 * Posts to a room the reader has joined. `aboutChapter` tags the post with a 0-based chapter, which hides it from
 * readers who haven't got that far; leave it out for a general post everyone can read.
 */
export async function addRoomPost(roomId: string, body: string, aboutChapter?: number) {
  const { supabase, userId } = await client();
  const { error } = await supabase.from('room_posts').insert({ room_id: roomId, user_id: userId, body: body.trim(), chapter_index: aboutChapter ?? null });
  if (error) throw new Error(error.code === '42501' ? 'Join the room to post in it.' : error.message);
}

export async function deleteRoomPost(postId: string) {
  const { supabase } = await client();
  const { error } = await supabase.from('room_posts').update({ deleted_at: new Date().toISOString() }).eq('id', postId);
  if (error) throw error;
}

/**
 * Live updates for an open room without database load: a Realtime Broadcast channel per room carries a bare "posts
 * changed" ping (no post content, so spoiler masking still happens when each reader re-fetches through
 * room_posts_visible). `changed` sends the ping after you post or delete; `stop` closes the channel.
 */
export function watchRoom(roomId: string, onPing: () => void) {
  const channel = sharedClient.channel(`room-posts:${roomId}`, { config: { broadcast: { self: false } } });
  channel.on('broadcast', { event: 'posts' }, () => onPing()).subscribe();
  return {
    changed: () => { void channel.send({ type: 'broadcast', event: 'posts', payload: {} }).catch(() => {}); },
    stop: () => { void sharedClient.removeChannel(channel); },
  };
}

// ---- Friends, as the community screens need them ------------------------------------------------------------------

export type FriendState = 'friend' | 'sent' | 'received' | 'none';

/** Where the reader stands with everyone they've friended or been asked by. Anyone missing is 'none'. */
export async function getFriendStates(): Promise<Map<string, FriendState>> {
  const { supabase } = await client();
  const { friends, incomingRequests, outgoingRequests } = await getMyFriendships(supabase);
  return new Map<string, FriendState>([
    ...friends.map((f) => [f.other_user.id, 'friend'] as const),
    ...incomingRequests.map((f) => [f.other_user.id, 'received'] as const),
    ...outgoingRequests.map((f) => [f.other_user.id, 'sent'] as const),
  ]);
}

/** Sends a friend request; asking someone who already asked (or was asked) isn't an error. */
export async function requestFriend(userId: string) {
  const { supabase } = await client();
  try {
    await sendFriendRequest(supabase, userId);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === '23505') return;
    throw new Error(err.message ?? 'Could not send the request.');
  }
}

/** What the reader's friends have been doing lately: days they listened, and posts in book rooms. Newest first. */
export async function getFollowingFeed(days = 14): Promise<{ friends: number; items: Activity[] }> {
  const { supabase } = await client();
  const { friends } = await getMyFriendships(supabase);
  if (!friends.length) return { friends: 0, items: [] };
  const ids = friends.map((f) => f.other_user.id);
  const names = new Map(friends.map((f) => [f.other_user.id, displayName(f.other_user)]));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  // Posts in private rooms the reader isn't in don't come back: RLS hides them.
  const [listening, posts, rooms] = await Promise.all([
    getFriendActivity(supabase, days).catch(() => []),
    supabase.from('room_posts_visible').select('id, user_id, room_id, chapter_index, is_spoiler, body, created_at').in('user_id', ids).eq('is_deleted', false).gte('created_at', since).order('created_at', { ascending: false }).limit(50),
    supabase.from('book_rooms').select('id, name'),
  ]);
  const roomTitle = new Map((rooms.data ?? []).map((r) => [r.id, r.name]));
  const items: Activity[] = [
    ...listening
      .filter((a) => a.listened_seconds > 0 || a.chapters_completed > 0)
      .map((a) => ({ kind: 'listened' as const, userId: a.id, name: names.get(a.id) ?? displayName(a), date: a.activity_date, seconds: a.listened_seconds, chapters: a.chapters_completed })),
    ...(posts.data ?? [])
      .filter((p) => roomTitle.has(p.room_id!))
      .map((p) => ({
        kind: 'posted' as const,
        userId: p.user_id!,
        name: names.get(p.user_id!) ?? 'A friend',
        date: p.created_at!,
        roomId: p.room_id!,
        roomTitle: roomTitle.get(p.room_id!) ?? 'a book room',
        chapterIndex: p.chapter_index,
        spoiler: Boolean(p.is_spoiler),
        body: p.body,
      })),
  ];
  return { friends: friends.length, items: items.sort((a, b) => b.date.localeCompare(a.date)) };
}

// Each room keeps one colour, picked from its book's title, so it looks the same in the list and inside.
const ROOM_COLORS = ['#806039', '#563B68', '#405541', '#385A6B', '#4A5A4D', '#6B3A4A'];
export function roomColor(title: string) {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ROOM_COLORS[Math.abs(h) % ROOM_COLORS.length];
}

/** "On your shelf · chapter 3" or "Not on your shelf", for room cards and the room's banner. */
export function shelfLabel(room: Pick<Room, 'myBookId' | 'myChapter'>) {
  if (!room.myBookId) return 'Not on your shelf';
  if (room.myChapter === Infinity) return 'On your shelf · finished';
  if (room.myChapter === null || room.myChapter < 0) return 'On your shelf · not started';
  return `On your shelf · chapter ${room.myChapter + 1}`;
}

/** "5m", "3h", "2d" for a timestamp; a bare date (activity days) reads as "today", "yesterday" or the date. */
export function ago(iso: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    if (iso === today) return 'today';
    if (iso === yesterday) return 'yesterday';
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (60 * 24))}d`;
}

export function listenedLabel(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${Math.max(1, minutes)} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
