/**
 * GET /api/dashboard/stats
 * Returns lite hosted dashboard stats that require server-side DB access.
 *
 * Shape consumed by useDashboardData.ts — keep backward-compatible.
 */
import { NextResponse } from "next/server";
import { getHostedDashboardLiteData } from "@/lib/dashboard/lite-queries";

export async function GET() {
  try {
    const data = await getHostedDashboardLiteData();

    return NextResponse.json({
      accuracy: data.qbank.accuracy,
      weakAreaCount: data.weakAreaCount,
      qbank: data.qbank,
      flashcards: data.flashcards,
      fsrsStatsByChapter: data.fsrsStatsByChapter,
      readerStatsByChapter: data.readerStatsByChapter,
      planner: data.planner,
      recentExams: data.recentExams,
      studyTimeToday: data.studyTimeToday,
      weeklyActivity: data.weeklyActivity,
      chapterPerformance: data.chapterPerformance,
      domainMastery: data.domainMastery,
      analyticsSnapshot: data.analyticsSnapshot,
      strengthsAndWeaknesses: data.strengthsAndWeaknesses,
      readinessScore: data.readinessScore,
      detailedWeakAreas: data.detailedWeakAreas,
      dashboardRecommendations: data.dashboardRecommendations,
      trapQuestions: data.trapQuestions,
      studyNotes: data.studyNotes,
      weakSpots: data.weakSpots,
      activityFeed: data.activityFeed,
      fsrsStats: data.fsrsStats,
      plannerDetailedStats: data.plannerDetailedStats,
      monthlyActivity: data.monthlyActivity,
      dashboardSnapshot: data.dashboardSnapshot,
      todayTasks: data.tasks.today,
      overdueTasks: data.tasks.overdue,
      activePlan: data.activePlan,
    });
  } catch {
    // On error, return a 500 with a clear error message instead of a silent
    // 200 with empty/zeroed data. This helps debugging and prevents the UI
    // from showing a misleading "empty" state.
    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
    /*
    return NextResponse.json({
      accuracy: 0,
      weakAreaCount: 0,
      qbank: {
        totalQuestions: 0,
        attemptedQuestions: 0,
        correctAnswers: 0,
        totalAttempts: 0,
        testCount: 0,
        accuracy: 0,
        usage: 0,
      },
      flashcards: {
        total: 0,
        dueToday: 0,
        mastered: 0,
      },
      fsrsStatsByChapter: [],
      readerStatsByChapter: [],
      planner: {
        totalTasks: 0,
        completedTasks: 0,
        completedPlanTasks: 0,
        overdueTasks: 0,
        todayTasks: 0,
        completionRate: 0,
      },
      recentExams: [],
      studyTimeToday: 0,
      weeklyActivity: [],
      chapterPerformance: [],
      domainMastery: null,
      analyticsSnapshot: null,
      strengthsAndWeaknesses: {
        strengths: [],
        weaknesses: [],
      },
      readinessScore: {
        score: 0,
        level: "not_ready",
        factors: {
          coverage: 0,
          accuracy: 0,
          retention: 0,
          consistency: 0,
          weakAreas: 100,
        },
        trend: "stable",
      },
      detailedWeakAreas: [],
      dashboardRecommendations: [],
      trapQuestions: [],
      studyNotes: [],
      weakSpots: [],
      activityFeed: [],
      fsrsStats: {
        dueToday: 0,
        dueThisWeek: 0,
        reviewedToday: 0,
        retentionRate: 0,
        leechCount: 0,
        avgStability: 0,
        avgDifficulty: 0,
        matureCards: 0,
        totalCards: 0,
        overdue: 0,
        learningCards: 0,
        newCards: 0,
      },
      plannerDetailedStats: {
        todayTasks: 0,
        completedToday: 0,
        overdueTasks: 0,
        upcomingTasks: [],
        dailyGoalMinutes: 120,
        dailyGoalProgress: 0,
        examDate: null,
        daysToExam: null,
        studyStreak: 0,
      },
      monthlyActivity: [],
      dashboardSnapshot: {
        readinessScore: {
          score: 0,
          level: "not_ready",
          factors: {
            coverage: 0,
            accuracy: 0,
            retention: 0,
            consistency: 0,
            weakAreas: 100,
          },
          trend: "stable",
        },
        weakAreas: [],
        recommendations: [],
        trapQuestions: [],
        recentNotes: [],
        activityFeed: [],
        fsrsStats: {
          dueToday: 0,
          dueThisWeek: 0,
          reviewedToday: 0,
          retentionRate: 0,
          leechCount: 0,
          avgStability: 0,
          avgDifficulty: 0,
          matureCards: 0,
          totalCards: 0,
          overdue: 0,
          learningCards: 0,
          newCards: 0,
        },
        plannerStats: {
          todayTasks: 0,
          completedToday: 0,
          overdueTasks: 0,
          upcomingTasks: [],
          dailyGoalMinutes: 120,
          dailyGoalProgress: 0,
          examDate: null,
          daysToExam: null,
          studyStreak: 0,
        },
        monthlyActivity: [],
      },
      todayTasks: [],
      overdueTasks: [],
      activePlan: null,
    });
    */
  }
}
