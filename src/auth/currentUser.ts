import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { users, type User } from '@/db/schema';
import { SESSION_COOKIE, verifySessionToken } from './session';

/** Resolve the signed-in user from the session cookie, or null. Server-only. */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const uid = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!uid) return null;
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  return user ?? null;
}
