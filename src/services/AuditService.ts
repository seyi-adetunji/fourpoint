import prisma from "@/lib/prisma";

export class AuditService {
  /**
   * Logs an action performed by a user in the system.
   */
  static async logAction(userId: string, action: string, details?: string | object) {
    try {
      const detailsStr = typeof details === 'object' ? JSON.stringify(details) : details;
      
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          details: detailsStr || null
        }
      });
    } catch (error) {
      // We don't want audit log failures to crash the main request usually,
      // but we should log them to the server console.
      console.error("Failed to write to AuditLog:", error);
    }
  }
}
