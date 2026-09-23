import { eq, and } from "drizzle-orm";
import type { DatabaseInstance } from "@/db";
import {
  userWorkspaces,
  type UserWorkspace,
  type NewUserWorkspace,
} from "@/db/schema";

export const workspaceRepository = {
  async getWorkspaceById(
    db: DatabaseInstance,
    id: string
  ): Promise<UserWorkspace | null> {
    const rows = await db
      .select()
      .from(userWorkspaces)
      .where(eq(userWorkspaces.id, id))
      .limit(1);
    return rows[0] || null;
  },

  async getWorkspacesByUserId(
    db: DatabaseInstance,
    userId: string
  ): Promise<UserWorkspace[]> {
    return db
      .select()
      .from(userWorkspaces)
      .where(eq(userWorkspaces.userId, userId))
      .orderBy(userWorkspaces.createdAt);
  },

  async getActiveWorkspace(
    db: DatabaseInstance,
    userId: string
  ): Promise<UserWorkspace | null> {
    const rows = await db
      .select()
      .from(userWorkspaces)
      .where(
        and(
          eq(userWorkspaces.userId, userId),
          eq(userWorkspaces.isActive, true)
        )
      )
      .limit(1);
    return rows[0] || null;
  },

  async createWorkspace(
    db: DatabaseInstance,
    data: NewUserWorkspace
  ): Promise<UserWorkspace> {
    const rows = await db.insert(userWorkspaces).values(data).returning();
    return rows[0];
  },

  async setActiveWorkspace(
    db: DatabaseInstance,
    userId: string,
    workspaceId: string
  ): Promise<void> {
    // Deactivate all workspaces for this user
    await db
      .update(userWorkspaces)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(userWorkspaces.userId, userId));

    // Activate the targeted workspace
    await db
      .update(userWorkspaces)
      .set({ isActive: true, updatedAt: new Date() })
      .where(
        and(
          eq(userWorkspaces.id, workspaceId),
          eq(userWorkspaces.userId, userId)
        )
      );
  },
};
