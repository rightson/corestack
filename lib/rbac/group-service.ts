/**
 * RBAC Group Service
 *
 * Handles group management operations.
 */

import { db } from '@/lib/db';
import { groups, groupMembers, groupProjects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { CreateGroupInput, Group } from './types';
import { logAccessAttempt } from './audit-service';
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger({ service: 'rbac-group-service' });

/**
 * Create a new group
 */
export async function createGroup(input: CreateGroupInput, createdBy?: number): Promise<Group> {
  try {
    const [group] = await db.insert(groups).values({
      name: input.name,
      description: input.description ?? null,
      groupType: input.groupType,
      metadata: input.metadata ?? null,
    }).returning();

    await logAccessAttempt({
      userId: createdBy,
      action: 'role_created',
      resourceType: 'group',
      resourceId: group.id,
      result: 'success',
      metadata: { groupName: group.name },
    });

    logger.info({ groupId: group.id, groupName: group.name }, 'Group created');

    return group;
  } catch (error) {
    logger.error({ error, input }, 'Failed to create group');
    throw error;
  }
}

/**
 * Get a group by ID
 */
export async function getGroupById(groupId: number): Promise<Group | null> {
  try {
    const [group] = await db
      .select()
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    return group || null;
  } catch (error) {
    logger.error({ error, groupId }, 'Failed to get group by ID');
    return null;
  }
}

/**
 * List all groups
 */
export async function listGroups(options?: {
  groupType?: string;
}): Promise<Group[]> {
  try {
    let query = db.select().from(groups);

    if (options?.groupType) {
      query = query.where(eq(groups.groupType, options.groupType)) as any;
    }

    const result = await query;
    return result;
  } catch (error) {
    logger.error({ error, options }, 'Failed to list groups');
    return [];
  }
}

/**
 * Update a group
 */
export async function updateGroup(
  groupId: number,
  updates: Partial<Omit<CreateGroupInput, 'groupType'>>,
  updatedBy?: number
): Promise<Group | null> {
  try {
    const [group] = await db
      .update(groups)
      .set({
        name: updates.name,
        description: updates.description,
        metadata: updates.metadata,
        updatedAt: new Date(),
      })
      .where(eq(groups.id, groupId))
      .returning();

    await logAccessAttempt({
      userId: updatedBy,
      action: 'role_updated',
      resourceType: 'group',
      resourceId: groupId,
      result: 'success',
      metadata: { updates },
    });

    logger.info({ groupId, groupName: group.name }, 'Group updated');

    return group || null;
  } catch (error) {
    logger.error({ error, groupId, updates }, 'Failed to update group');
    throw error;
  }
}

/**
 * Delete a group
 */
export async function deleteGroup(groupId: number, deletedBy?: number): Promise<boolean> {
  try {
    const existingGroup = await getGroupById(groupId);
    if (!existingGroup) {
      return false;
    }

    await db.delete(groups).where(eq(groups.id, groupId));

    await logAccessAttempt({
      userId: deletedBy,
      action: 'role_updated',
      resourceType: 'group',
      resourceId: groupId,
      result: 'success',
      metadata: { action: 'deleted' },
    });

    logger.info({ groupId, groupName: existingGroup.name }, 'Group deleted');

    return true;
  } catch (error) {
    logger.error({ error, groupId }, 'Failed to delete group');
    throw error;
  }
}

/**
 * Add a user to a group
 */
export async function addUserToGroup(groupId: number, userId: number, addedBy?: number): Promise<void> {
  try {
    await db
      .insert(groupMembers)
      .values({
        groupId,
        userId,
      })
      .onConflictDoNothing();

    await logAccessAttempt({
      userId: addedBy,
      action: 'role_updated',
      resourceType: 'group',
      resourceId: groupId,
      result: 'success',
      metadata: { action: 'user_added', targetUserId: userId },
    });

    logger.info({ groupId, userId }, 'User added to group');
  } catch (error) {
    logger.error({ error, groupId, userId }, 'Failed to add user to group');
    throw error;
  }
}

/**
 * Remove a user from a group
 */
export async function removeUserFromGroup(groupId: number, userId: number, removedBy?: number): Promise<void> {
  try {
    await db
      .delete(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId)
        )
      );

    await logAccessAttempt({
      userId: removedBy,
      action: 'role_updated',
      resourceType: 'group',
      resourceId: groupId,
      result: 'success',
      metadata: { action: 'user_removed', targetUserId: userId },
    });

    logger.info({ groupId, userId }, 'User removed from group');
  } catch (error) {
    logger.error({ error, groupId, userId }, 'Failed to remove user from group');
    throw error;
  }
}

/**
 * Get all members of a group
 */
export async function getGroupMembers(groupId: number): Promise<number[]> {
  try {
    const members = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));

    return members.map(m => m.userId);
  } catch (error) {
    logger.error({ error, groupId }, 'Failed to get group members');
    return [];
  }
}

/**
 * Add a project to a group
 */
export async function addProjectToGroup(groupId: number, projectId: number, addedBy?: number): Promise<void> {
  try {
    await db
      .insert(groupProjects)
      .values({
        groupId,
        projectId,
      })
      .onConflictDoNothing();

    await logAccessAttempt({
      userId: addedBy,
      action: 'role_updated',
      resourceType: 'group',
      resourceId: groupId,
      result: 'success',
      metadata: { action: 'project_added', projectId },
    });

    logger.info({ groupId, projectId }, 'Project added to group');
  } catch (error) {
    logger.error({ error, groupId, projectId }, 'Failed to add project to group');
    throw error;
  }
}

/**
 * Remove a project from a group
 */
export async function removeProjectFromGroup(groupId: number, projectId: number, removedBy?: number): Promise<void> {
  try {
    await db
      .delete(groupProjects)
      .where(
        and(
          eq(groupProjects.groupId, groupId),
          eq(groupProjects.projectId, projectId)
        )
      );

    await logAccessAttempt({
      userId: removedBy,
      action: 'role_updated',
      resourceType: 'group',
      resourceId: groupId,
      result: 'success',
      metadata: { action: 'project_removed', projectId },
    });

    logger.info({ groupId, projectId }, 'Project removed from group');
  } catch (error) {
    logger.error({ error, groupId, projectId }, 'Failed to remove project from group');
    throw error;
  }
}

/**
 * Get all projects in a group
 */
export async function getGroupProjects(groupId: number): Promise<number[]> {
  try {
    const projects = await db
      .select({ projectId: groupProjects.projectId })
      .from(groupProjects)
      .where(eq(groupProjects.groupId, groupId));

    return projects.map(p => p.projectId);
  } catch (error) {
    logger.error({ error, groupId }, 'Failed to get group projects');
    return [];
  }
}

/**
 * Get all groups a user belongs to
 */
export async function getUserGroups(userId: number): Promise<Group[]> {
  try {
    const userGroupsData = await db
      .select({ group: groups })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(eq(groupMembers.userId, userId));

    return userGroupsData.map(g => g.group);
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get user groups');
    return [];
  }
}
