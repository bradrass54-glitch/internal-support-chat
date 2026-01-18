import { getDb } from "../db";
import * as supportService from "./supportService";
import { departments, patterns, alerts } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Background Jobs Service
 * Runs periodic tasks for pattern detection, alert management, and system monitoring
 */

let isRunning = false;

/**
 * Start background job scheduler
 */
export function startBackgroundJobs() {
  if (isRunning) {
    console.log("[Background Jobs] Already running");
    return;
  }

  isRunning = true;
  console.log("[Background Jobs] Started");

  // Run pattern detection every 30 minutes
  setInterval(runPatternDetection, 30 * 60 * 1000);

  // Run alert cleanup every hour
  setInterval(runAlertCleanup, 60 * 60 * 1000);

  // Run initial checks
  runPatternDetection();
  runAlertCleanup();
}

/**
 * Stop background jobs
 */
export function stopBackgroundJobs() {
  isRunning = false;
  console.log("[Background Jobs] Stopped");
}

/**
 * Pattern detection job - identifies recurring issues across conversations
 */
async function runPatternDetection() {
  try {
    console.log("[Background Jobs] Running pattern detection...");

    const db = await getDb();
    if (!db) {
      console.warn("[Background Jobs] Database not available");
      return;
    }

    // Get all active departments
    const allDepartments = await db.select().from(departments);

    for (const dept of allDepartments) {
      try {
        await supportService.detectPatterns(dept.id);
        console.log(`[Background Jobs] Pattern detection completed for department: ${dept.name}`);
      } catch (error) {
        console.error(`[Background Jobs] Failed to detect patterns for department ${dept.id}:`, error);
      }
    }
  } catch (error) {
    console.error("[Background Jobs] Pattern detection job failed:", error);
  }
}

/**
 * Alert cleanup job - expires old alerts and manages alert lifecycle
 */
async function runAlertCleanup() {
  try {
    console.log("[Background Jobs] Running alert cleanup...");

    const db = await getDb();
    if (!db) {
      console.warn("[Background Jobs] Database not available");
      return;
    }

    // Deactivate expired alerts
    const now = new Date();
    await db
      .update(alerts)
      .set({ isActive: false })
      .where(
        sql`${alerts.expiresAt} < ${now} AND ${alerts.isActive} = true`
      );

    console.log("[Background Jobs] Alert cleanup completed");
  } catch (error) {
    console.error("[Background Jobs] Alert cleanup job failed:", error);
  }
}

/**
 * Generate system health report
 */
export async function generateHealthReport() {
  try {
    const db = await getDb();
    if (!db) return null;

    const report = {
      timestamp: new Date(),
      status: "healthy" as const,
      checks: {
        database: "ok" as const,
        backgroundJobs: isRunning ? ("ok" as const) : ("stopped" as const),
      },
    };

    return report;
  } catch (error) {
    console.error("[Background Jobs] Failed to generate health report:", error);
    return null;
  }
}

// Import sql for query building
import { sql } from "drizzle-orm";
