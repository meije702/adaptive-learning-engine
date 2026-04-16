import type { LearnerConfig } from "./config/schemas/index.ts";
import type { DayType } from "./db/types.ts";

export function isFeedbackVisible(
    schedule: LearnerConfig["schedule"],
    dayType: DayType,
    now = new Date(),
): boolean {
    if (dayType !== "assessment") {
        return true;
    }

    const feedbackDay = schedule.feedback_available_day;
    const feedbackTime = schedule.feedback_available_time;
    if (feedbackDay === undefined || !feedbackTime) {
        return true;
    }

    const currentDay = now.getDay();
    if (
        currentDay < feedbackDay ||
        (currentDay === feedbackDay &&
            now.toTimeString().slice(0, 5) < feedbackTime)
    ) {
        return false;
    }

    return true;
}
