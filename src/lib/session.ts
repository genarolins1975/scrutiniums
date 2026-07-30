import { cookies } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, newId, schema } from "./db";
import { generateSessionToken, hashToken } from "./crypto";
import type { User } from "./schema";

const COOKIE_NAME = "scrutiniums_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 dias

export async function createSession(userId: string): Promise<void> {
  const db = await getDb();
  const token = generateSessionToken();
  const now = Date.now();
  await db.insert(schema.sessions).values({
    id: newId(),
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(now + SESSION_TTL_MS),
    createdAt: new Date(now),
  });
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function getSessionUser(): Promise<User | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const db = await getDb();
  const rows = await db
    .select({ user: schema.users, session: schema.sessions })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.tokenHash, hashToken(token)),
        isNull(schema.sessions.revokedAt),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0]?.user ?? null;
}

export async function destroySession(): Promise<void> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (token) {
    const db = await getDb();
    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.sessions.tokenHash, hashToken(token)));
  }
  cookies().delete(COOKIE_NAME);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
}
