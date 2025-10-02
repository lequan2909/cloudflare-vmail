import { count, desc, eq, and } from "drizzle-orm";
import { DrizzleD1Database } from 'drizzle-orm/d1'
import { emails, InsertEmail, mailboxes, InsertMailbox, apiKeys, InsertApiKey } from "./schema"

export async function insertEmail(db: DrizzleD1Database, email: InsertEmail) {
  try {
    await db.insert(emails).values(email).execute();
  } catch (e) {
    console.error(e);
  }
}

export async function getEmails(db: DrizzleD1Database) {
  try {
    return await db.select().from(emails).all();
  } catch (e) {
    return [];
  }
}

export async function deleteEmail(db: DrizzleD1Database, id: string) {
  try {
    return await db.delete(emails).where(eq(emails.id, id)).execute();
  } catch (e) {
    return [];
  }
}

export async function deleteAllEmailsByMessageTo(db: DrizzleD1Database, messageTo: string) {
  try {
    return await db.delete(emails).where(eq(emails.messageTo, messageTo)).execute();
  } catch (e) {
    return [];
  }
}

export async function getEmail(db: DrizzleD1Database, id: string) {
  try {
    const result = await db
      .select()
      .from(emails)
      .where(and(eq(emails.id, id)))
      .all();
    if (result.length != 1) {
      return null;
    }
    return result[0];
  } catch (e) {
    return null;
  }
}

export async function getMailboxOfEmail(db: DrizzleD1Database, id: string) {
  try {
    const result = await db
      .select({ messageTo: emails.messageTo })
      .from(emails)
      .where(and(eq(emails.id, id)))
      .limit(1)
      .all();
    return result[0];
  } catch (e) {
    return null;
  }
}

export async function getEmailsByMessageTo(
  db: DrizzleD1Database,
  messageTo: string
) {
  try {
    return await db
      .select()
      .from(emails)
      .where(eq(emails.messageTo, messageTo))
      .orderBy(desc(emails.createdAt))
      .all();
  } catch (e) {
    return [];
  }
}

export async function getEmailsCount(db: DrizzleD1Database) {
  try {
    const res = await db.select({ count: count() }).from(emails);
    return res[0]?.count;
  } catch (e) {
    return 0;
  }
}

export async function markEmailAsRead(
  db: DrizzleD1Database,
  id: string
) {
  try {
    return await db
      .update(emails)
      .set({
        isRead: true,
        readAt: new Date()
      })
      .where(eq(emails.id, id))
      .execute();
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function markAllAsRead(
  db: DrizzleD1Database,
  messageTo: string
) {
  try {
    return await db
      .update(emails)
      .set({
        isRead: true,
        readAt: new Date()
      })
      .where(eq(emails.messageTo, messageTo))
      .execute();
  } catch (e) {
    console.error(e);
    return null;
  }
}

export async function getMailboxStats(
  db: DrizzleD1Database,
  messageTo: string
) {
  try {
    const [total, unread] = await Promise.all([
      db.select({ count: count() })
        .from(emails)
        .where(eq(emails.messageTo, messageTo)),
      db.select({ count: count() })
        .from(emails)
        .where(and(
          eq(emails.messageTo, messageTo),
          eq(emails.isRead, false)
        ))
    ]);

    return {
      total: total[0]?.count || 0,
      unread: unread[0]?.count || 0,
      read: (total[0]?.count || 0) - (unread[0]?.count || 0)
    };
  } catch (e) {
    console.error(e);
    return {
      total: 0,
      unread: 0,
      read: 0
    };
  }
}

// ============ Mailbox Functions ============

// Generate a random salt
async function generateSalt(): Promise<string> {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Hash password with salt using Web Crypto API
async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

// Verify password
async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  return computedHash === hash;
}

// Check if mailbox is claimed
export async function isMailboxClaimed(
  db: DrizzleD1Database,
  address: string
): Promise<boolean> {
  try {
    const result = await db
      .select()
      .from(mailboxes)
      .where(eq(mailboxes.address, address))
      .limit(1)
      .all();
    return result.length > 0;
  } catch (e) {
    console.error(e);
    return false;
  }
}

// Claim a mailbox with password
export async function claimMailbox(
  db: DrizzleD1Database,
  address: string,
  password: string,
  expiresInDays: number = 30
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if already claimed
    const claimed = await isMailboxClaimed(db, address);
    if (claimed) {
      return { success: false, error: 'Mailbox already claimed' };
    }

    const salt = await generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    await db.insert(mailboxes).values({
      address,
      passwordHash,
      salt,
      createdAt: now,
      expiresAt,
      lastLoginAt: now
    }).execute();

    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'Failed to claim mailbox' };
  }
}

// Login to claimed mailbox
export async function loginMailbox(
  db: DrizzleD1Database,
  address: string,
  password: string
): Promise<{ success: boolean; error?: string; mailbox?: typeof mailboxes.$inferSelect }> {
  try {
    const result = await db
      .select()
      .from(mailboxes)
      .where(eq(mailboxes.address, address))
      .limit(1)
      .all();

    if (result.length === 0) {
      return { success: false, error: 'Mailbox not found' };
    }

    const mailbox = result[0];
    if (!mailbox) {
      return { success: false, error: 'Mailbox not found' };
    }

    // Check if expired
    if (mailbox.expiresAt && new Date(mailbox.expiresAt) < new Date()) {
      return { success: false, error: 'Mailbox has expired' };
    }

    // Verify password
    const isValid = await verifyPassword(password, mailbox.salt, mailbox.passwordHash);
    if (!isValid) {
      return { success: false, error: 'Invalid password' };
    }

    // Update last login time
    await db
      .update(mailboxes)
      .set({ lastLoginAt: new Date() })
      .where(eq(mailboxes.address, address))
      .execute();

    return { success: true, mailbox };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'Login failed' };
  }
}

// Get mailbox info
export async function getMailbox(
  db: DrizzleD1Database,
  address: string
) {
  try {
    const result = await db
      .select()
      .from(mailboxes)
      .where(eq(mailboxes.address, address))
      .limit(1)
      .all();
    return result[0] || null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// Extend mailbox expiration
export async function extendMailboxExpiration(
  db: DrizzleD1Database,
  address: string,
  additionalDays: number = 30
) {
  try {
    const mailbox = await getMailbox(db, address);
    if (!mailbox) {
      return { success: false, error: 'Mailbox not found' };
    }

    const currentExpiry = new Date(mailbox.expiresAt);
    const newExpiry = new Date(currentExpiry.getTime() + additionalDays * 24 * 60 * 60 * 1000);

    await db
      .update(mailboxes)
      .set({ expiresAt: newExpiry })
      .where(eq(mailboxes.address, address))
      .execute();

    return { success: true, expiresAt: newExpiry };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'Failed to extend expiration' };
  }
}

// ============ API Key Functions ============

// Generate a random API key
function generateApiKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return 'vmails_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Generate unique ID
function generateId(): string {
  return crypto.randomUUID();
}

// Create API key
export async function createApiKey(
  db: DrizzleD1Database,
  name: string,
  mailboxAddress?: string,
  expiresInDays?: number
): Promise<{ success: boolean; apiKey?: string; error?: string }> {
  try {
    const id = generateId();
    const key = generateApiKey();
    const now = new Date();
    const expiresAt = expiresInDays
      ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await db.insert(apiKeys).values({
      id,
      key,
      name,
      mailboxAddress: mailboxAddress || null,
      createdAt: now,
      expiresAt,
      lastUsedAt: null,
      isActive: true,
      rateLimit: 100
    }).execute();

    return { success: true, apiKey: key };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'Failed to create API key' };
  }
}

// Verify API key
export async function verifyApiKey(
  db: DrizzleD1Database,
  key: string
): Promise<{ valid: boolean; apiKey?: typeof apiKeys.$inferSelect; error?: string }> {
  try {
    const result = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.key, key))
      .limit(1)
      .all();

    if (result.length === 0) {
      return { valid: false, error: 'Invalid API key' };
    }

    const apiKey = result[0];
    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' };
    }

    // Check if active
    if (!apiKey.isActive) {
      return { valid: false, error: 'API key is inactive' };
    }

    // Check if expired
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return { valid: false, error: 'API key has expired' };
    }

    // Update last used timestamp
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.key, key))
      .execute();

    return { valid: true, apiKey };
  } catch (e) {
    console.error(e);
    return { valid: false, error: 'Failed to verify API key' };
  }
}

// Revoke API key
export async function revokeApiKey(
  db: DrizzleD1Database,
  key: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.key, key))
      .execute();

    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'Failed to revoke API key' };
  }
}

// Get all API keys for a mailbox
export async function getApiKeysByMailbox(
  db: DrizzleD1Database,
  mailboxAddress: string
) {
  try {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.mailboxAddress, mailboxAddress))
      .orderBy(desc(apiKeys.createdAt))
      .all();
  } catch (e) {
    console.error(e);
    return [];
  }
}

