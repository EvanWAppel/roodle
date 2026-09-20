import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/currentUser';

/** GET /api/auth/me — the signed-in user, or null. */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({
    user: user ? { id: user.id, displayName: user.displayName, email: user.email } : null,
  });
}
