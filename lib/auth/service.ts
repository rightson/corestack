import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from './password';
import { authenticateLDAP } from './ldap';
import { signToken, type JWTPayload } from './jwt';

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: any;
  mustChangePassword?: boolean;
  error?: string;
}

export async function authenticateUser(
  username: string,
  password: string,
  authType: 'email' | 'ldap' = 'email'
): Promise<AuthResult> {
  try {
    // Find user in database
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    let user = userList[0];

    // Email authentication
    if (authType === 'email') {
      if (!user) {
        return { success: false, error: 'Invalid credentials' };
      }

      if (!user.password) {
        return { success: false, error: 'Password not set for this user' };
      }

      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        return { success: false, error: 'Invalid credentials' };
      }
    }
    // LDAP authentication
    else if (authType === 'ldap') {
      const ldapResult = await authenticateLDAP(username, password);

      if (!ldapResult.success || !ldapResult.userInfo) {
        return { success: false, error: ldapResult.error };
      }

      // Create or update user from LDAP info
      if (!user) {
        const newUser = await db
          .insert(users)
          .values({
            username: ldapResult.userInfo.username,
            name: ldapResult.userInfo.name || ldapResult.userInfo.username,
            email: ldapResult.userInfo.email || `${username}@example.com`,
            authType: 'ldap',
            mustChangePassword: false,
          })
          .returning();
        user = newUser[0];
      } else {
        // Update last login
        await db
          .update(users)
          .set({ lastLogin: new Date() })
          .where(eq(users.id, user.id));
      }
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    // Generate JWT token
    const token = await signToken({
      userId: user.id,
      username: user.username,
      email: user.email,
      authType: user.authType,
    });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        authType: user.authType,
      },
      mustChangePassword: user.mustChangePassword || false,
    };
  } catch (error: any) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

export async function changePassword(
  userId: number,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const hashedPassword = await hashPassword(newPassword);
    await db
      .update(users)
      .set({
        password: hashedPassword,
        mustChangePassword: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to change password' };
  }
}

// Seed default root user
export async function seedDefaultUser() {
  try {
    // Check if root user exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, 'root'))
      .limit(1);

    if (existing.length === 0) {
      const hashedPassword = await hashPassword('Must-Changed');
      await db.insert(users).values({
        username: 'root',
        name: 'Root User',
        email: 'root@example.com',
        password: hashedPassword,
        authType: 'email',
        mustChangePassword: true,
      });
      console.log('Default root user created with password: Must-Changed');
    }
  } catch (error) {
    console.error('Error seeding default user:', error);
  }
}
