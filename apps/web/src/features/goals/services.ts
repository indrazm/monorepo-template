import type { CreateGoalInput, Goal } from "@repo/contracts/goals";
import { apiClient } from "../../api";

const goals = apiClient.api.v1.goals;

export async function listGoals(siteId: string): Promise<Goal[]> {
  const response = await goals.$get({ query: { siteId } });
  if (!response.ok) throw new Error("Failed to load goals.");
  return (await response.json()).goals;
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const response = await goals.$post({ json: input });
  if (!response.ok) throw new Error("Failed to create goal.");
  return (await response.json()).goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const response = await goals[":id"].$delete({ param: { id } });
  if (!response.ok) throw new Error("Failed to delete goal.");
}
