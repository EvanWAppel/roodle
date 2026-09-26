// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/db/testDb';
import { __setTestDb } from '@/db/client';
import { users } from '@/db/schema';
import type { DB } from '@/db/client';
import type { User } from '@/db/schema';

const currentUser = vi.fn<() => Promise<User | null>>();
vi.mock('@/auth/currentUser', () => ({
  getCurrentUser: () => currentUser(),
}));

import { GET as getNotify, PATCH as patchNotify } from './route';

function patch(body: unknown): Request {
  return new Request('http://test/api/notify', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET/PATCH /api/notify (NOTIF-05)', () => {
  let db: DB;
  let me: User;

  beforeEach(async () => {
    db = await createTestDb();
    __setTestDb(db);
    const [u] = await db
      .insert(users)
      .values({ email: 'me@example.com', displayName: 'Me' })
      .returning();
    me = u;
    currentUser.mockReset();
    currentUser.mockResolvedValue(me);
  });

  it('GET returns the current preference (defaults to true)', async () => {
    const res = await getNotify();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notifyEnabled: true });
  });

  it('PATCH { enabled: false } disables nudges and persists it', async () => {
    const res = await patchNotify(patch({ enabled: false }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notifyEnabled: false });

    const [row] = await db.select().from(users).where(eq(users.id, me.id));
    expect(row.notifyEnabled).toBe(false);
  });

  it('PATCH can re-enable nudges', async () => {
    await patchNotify(patch({ enabled: false }));
    const res = await patchNotify(patch({ enabled: true }));
    expect(await res.json()).toEqual({ notifyEnabled: true });
  });

  it('PATCH rejects a non-boolean body with 400', async () => {
    const res = await patchNotify(patch({ enabled: 'nope' }));
    expect(res.status).toBe(400);
  });

  it('401s both verbs when signed out', async () => {
    currentUser.mockResolvedValue(null);
    expect((await getNotify()).status).toBe(401);
    expect((await patchNotify(patch({ enabled: false }))).status).toBe(401);
  });
});
