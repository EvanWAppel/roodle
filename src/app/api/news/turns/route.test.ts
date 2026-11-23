// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '@/db/testDb';
import { __setTestDb } from '@/db/client';
import type { DB } from '@/db/client';
import { createFriendPair } from '@/db/friends';
import { turns } from '@/db/schema';
import { DELETE, GET, PATCH, POST, PUT } from './route';

const TOKEN = 'test-read-token-0123456789abcdef';
const ME = 'evan@example.com';
const BASE = 'https://roodle.evanappel.me';

function get(auth?: string): Request {
  return new Request('http://test/api/news/turns', {
    headers: auth ? { authorization: auth } : {},
  });
}

interface Entry {
  opponent: string;
  turn: 'you' | 'them';
  action: 'guess' | 'draw';
  pending: number | null;
  since: string | null;
  url: string;
}

async function entries(): Promise<Entry[]> {
  const res = await GET(get(`Bearer ${TOKEN}`));
  expect(res.status).toBe(200);
  return ((await res.json()) as { games: Entry[] }).games;
}

describe('GET /api/news/turns (X8)', () => {
  let db: DB;

  beforeEach(async () => {
    db = await createTestDb();
    __setTestDb(db);
    vi.stubEnv('ROODLE_READ_TOKEN', TOKEN);
    vi.stubEnv('NEWS_PLAYER_EMAIL', ME);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function friend(email: string, display: string) {
    return createFriendPair(db, {
      emailA: ME,
      displayA: 'Evan',
      emailB: email,
      displayB: display,
    });
  }

  function turn(
    pair: Awaited<ReturnType<typeof friend>>,
    by: 'me' | 'them',
    at: string,
    word = 'elephant',
  ) {
    const me = pair.userA;
    const them = pair.userB;
    return db
      .insert(turns)
      .values({
        gameId: pair.game.id,
        drawerId: by === 'me' ? me.id : them.id,
        guesserId: by === 'me' ? them.id : me.id,
        word,
        strokes: [
          {
            color: '#a855f7',
            width: 7,
            points: [{ x: 0.123456, y: 0.654321 }],
          },
        ],
        createdAt: new Date(at),
      })
      .returning()
      .then(([t]) => t);
  }

  it('returns the schema-1 envelope', async () => {
    const res = await GET(get(`Bearer ${TOKEN}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    const body = await res.json();
    expect(body).toMatchObject({ schema: 1, game: 'roodle', games: [] });
    expect(body.generated_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  });

  it('you/guess when Evan has drawings to guess, linking the oldest', async () => {
    const pair = await friend('christine@example.com', 'Christine');
    await turn(pair, 'them', '2026-11-21T10:00:00Z');
    const oldest = await turn(pair, 'them', '2026-11-21T09:00:00Z');
    await turn(pair, 'me', '2026-11-20T09:00:00Z');
    expect(await entries()).toEqual([
      {
        opponent: 'Christine',
        turn: 'you',
        action: 'guess',
        pending: 2,
        since: '2026-11-21T09:00:00Z',
        url: `${BASE}/play?turn=${oldest.id}`,
      },
    ]);
  });

  it('them/guess when only the friend has drawings to guess', async () => {
    const pair = await friend('christine@example.com', 'Christine');
    await turn(pair, 'me', '2026-11-21T08:30:00Z');
    expect(await entries()).toEqual([
      {
        opponent: 'Christine',
        turn: 'them',
        action: 'guess',
        pending: 1,
        since: '2026-11-21T08:30:00Z',
        url: `${BASE}/play`,
      },
    ]);
  });

  it('you/draw when nothing is pending', async () => {
    const pair = await friend('christine@example.com', 'Christine');
    expect(await entries()).toEqual([
      {
        opponent: 'Christine',
        turn: 'you',
        action: 'draw',
        pending: null,
        since: null,
        url: `${BASE}/draw?game=${pair.game.id}`,
      },
    ]);
  });

  it('orders turn:you first, then oldest since, then name', async () => {
    const zed = await friend('zed@example.com', 'Zed');
    const amy = await friend('amy@example.com', 'Amy');
    const bob = await friend('bob@example.com', 'Bob');
    const cat = await friend('cat@example.com', 'Cat');
    const dan = await friend('dan@example.com', 'Dan');
    await friend('eve@example.com', 'Eve'); // nothing pending → you/draw
    await friend('abe@example.com', 'Abe'); // nothing pending → you/draw
    await turn(zed, 'them', '2026-11-21T12:00:00Z'); // you/guess, newer
    await turn(amy, 'them', '2026-11-21T09:00:00Z'); // you/guess, older
    await turn(bob, 'them', '2026-11-21T09:00:00Z'); // you/guess, same as Amy
    await turn(cat, 'me', '2026-11-19T09:00:00Z'); // them/guess, oldest overall
    await turn(dan, 'me', '2026-11-18T09:00:00Z'); // them/guess, older still
    const got = (await entries()).map((e) => `${e.opponent}:${e.turn}`);
    expect(got).toEqual([
      'Amy:you',
      'Bob:you',
      'Zed:you',
      'Abe:you',
      'Eve:you',
      'Dan:them',
      'Cat:them',
    ]);
  });

  it('caps the list at 20 entries', async () => {
    for (let i = 0; i < 22; i++) {
      await friend(`f${i}@example.com`, `Friend ${String(i).padStart(2, '0')}`);
    }
    expect(await entries()).toHaveLength(20);
  });

  it('never leaks a word, stroke data or an email', async () => {
    const pair = await friend('christine@example.com', 'Christine');
    await turn(pair, 'them', '2026-11-21T09:00:00Z', 'zeppelin');
    await turn(pair, 'me', '2026-11-21T09:30:00Z', 'quokka');
    const other = await friend('nameless@example.com', 'x@y.example');
    await turn(other, 'me', '2026-11-21T09:00:00Z', 'walrus');
    const res = await GET(get(`Bearer ${TOKEN}`));
    const text = await res.text();
    for (const secret of ['zeppelin', 'quokka', 'walrus', 'elephant']) {
      expect(text.toLowerCase()).not.toContain(secret);
    }
    expect(text).not.toContain('@');
    expect(text).not.toContain('0.123456');
    expect(text).not.toContain('#a855f7');
    expect(text).not.toMatch(/strokes|"word"|email/i);
    expect(text).toContain('"a friend"');
  });

  it('truncates long display names to 40 characters', async () => {
    await friend('long@example.com', 'L'.repeat(60));
    const [e] = await entries();
    expect(e.opponent).toHaveLength(40);
  });

  it('returns no games when the news player has no account', async () => {
    vi.stubEnv('NEWS_PLAYER_EMAIL', 'nobody@example.com');
    await friend('christine@example.com', 'Christine');
    expect(await entries()).toEqual([]);
  });

  it('401s without a bearer, with a wrong one, or with the wrong scheme', async () => {
    for (const auth of [
      undefined,
      'Bearer nope',
      `Bearer ${TOKEN}x`,
      `Basic ${TOKEN}`,
      TOKEN,
    ]) {
      const res = await GET(get(auth));
      expect(res.status).toBe(401);
      expect(await res.text()).toBe('');
    }
  });

  it('401s even a matching bearer when ROODLE_READ_TOKEN is unset', async () => {
    vi.stubEnv('ROODLE_READ_TOKEN', '');
    expect((await GET(get('Bearer '))).status).toBe(401);
    expect((await GET(get(`Bearer ${TOKEN}`))).status).toBe(401);
  });

  it('405s every other verb, with or without a token', async () => {
    for (const handler of [POST, PUT, PATCH, DELETE]) {
      const res = await handler();
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('GET');
    }
  });
});
