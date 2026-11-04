// Mock book-room discussions until community tables exist. Keyed by the room ids used on the Community tab.
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

export async function getRoomDiscussion(roomId: string): Promise<RoomPost[]> {
  return POSTS[roomId] ?? GENERIC;
}
