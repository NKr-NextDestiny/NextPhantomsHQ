export interface UserPublic {
  id: string;
  numericId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}

export interface TeamPublic {
  id: string;
  name: string;
  tag: string;
  game: string;
  logoUrl: string | null;
}

export type AttendanceVote = "AVAILABLE" | "UNAVAILABLE" | "MAYBE";
export type TeamRoleType = "TRYOUT" | "PLAYER" | "ANALYST" | "COACH" | "CAPTAIN" | "ADMIN";
export type TrainingTypeEnum = "RANKED" | "CUSTOM" | "AIM_TRAINING" | "VOD_REVIEW" | "STRAT_PRACTICE" | "OTHER";
export type MapSideType = "ATTACK" | "DEFENSE";
export type StratTypeEnum = "DEFAULT" | "ANTI_STRAT" | "RETAKE" | "POST_PLANT" | "RUSH" | "SLOW_EXECUTE" | "OTHER";
export type MatchResultType = "WIN" | "LOSS" | "DRAW";
export type ThreatLevelType = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RecurrenceTypeEnum = "NONE" | "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
