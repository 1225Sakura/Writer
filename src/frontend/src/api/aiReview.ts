import { api } from "./request";
import type { EntityType } from "../store/settingsStore";

export interface AIReviewResult {
  category: EntityType;
  issues: Array<{
    type: "inconsistency" | "foreshadowing" | "suggestion" | "warning";
    severity: "high" | "medium" | "low";
    title: string;
    description: string;
    entityIds?: number[];
  }>;
  suggestions: Array<{
    type: "optimization" | "enhancement";
    title: string;
    description: string;
  }>;
}

export const aiReviewApi = {
  review: (category: EntityType) =>
    api.post<AIReviewResult>("/ai/review", { category }),
};