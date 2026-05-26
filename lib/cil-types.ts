/**
 * CIL types — frontend declarations for the Layer 2 (Contextual
 * Intelligence Layer) outputs that the backend doesn't yet persist.
 *
 * These live OUTSIDE `lib/types.ts` so the protected types file
 * stays untouched. When Jenil ships `semantic_type`, `blast_radius`,
 * and the 4 context snapshots on the backend (see Engineering Sprint
 * Board tickets 1 + 2), the canonical home for these types is
 * `lib/types.ts` directly — at that point this file gets deleted
 * and every import is rewritten.
 *
 * Until then: frontend reads CIL fields off rows as OPTIONAL. Every
 * surface that renders a SemanticTypeChip / 4-context panel guards
 * on field presence. When fields are absent (the state today, on
 * both demo and real workspace), the surface renders nothing.
 * When fields are present (after backend persistence ships), the
 * surface lights up — automatically, with no further frontend
 * coordination.
 *
 * This is the "frontend half of the persistence gap fix" called out
 * in the v3 → prod handoff doc.
 */

/** The 10 canonical semantic_type values from the Layer 2
 *  classifier. Each maps to one of four decisions (ALLOW / DENY /
 *  REWRITE / REQUIRE_APPROVAL) via PRODUCT.md. */
export type SemanticType =
  | 'working_commit'            // ALLOW
  | 'ephemeral_force_push'      // ALLOW
  | 'test_only_change'          // ALLOW
  | 'protected_branch_write'    // REWRITE — the differentiator
  | 'freeze_window_violation'   // DENY
  | 'credential_exposure'       // DENY (hard)
  | 'autonomous_merge_attempt'  // DENY
  | 'large_blast_radius_change' // REQUIRE_APPROVAL
  | 'sensitive_path_change'     // REQUIRE_APPROVAL
  | 'sequence_anomaly';         // REQUIRE_APPROVAL

/** Canonical blast_radius values. */
export type BlastRadiusLevel =
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

/** SessionContext snapshot — agent identity + recent history at
 *  decision time. */
export interface SessionContextSnapshot {
  session_id?: string;
  agent_id?: string;
  agent_name?: string;
  human_initiator?: string | null;
  started_at?: string;
  push_count?: number;
  denial_count?: number;
  ci_failure_streak?: number;
  sequence_order?: number;
  linked_ticket?: string | null;
  workflow_stage?: 'planning' | 'coding' | 'review' | 'deploy' | 'incident';
  active_approval_count?: number;
  last_action_type?: string;
}

/** RepoContext snapshot — repo metadata + protected branches +
 *  freeze state at decision time. */
export interface RepoContextSnapshot {
  repo_id?: string;
  owner?: string;
  target_branch?: string;
  is_protected_branch?: boolean;
  protected_branches?: string[];
  ci_passing?: boolean;
  ci_failure_reason?: string | null;
  freeze_window_active?: boolean;
  freeze_window_label?: string | null;
  freeze_window_expires?: string | null;
  open_pr_count?: number;
  last_deployment_at?: string | null;
  sensitivity_level?: 'standard' | 'elevated' | 'critical';
}

/** BranchContext snapshot — target branch nature at decision time. */
export interface BranchContextSnapshot {
  branch_name?: string;
  is_aegis_managed?: boolean;
  session_owner_match?: boolean;
  has_open_pr?: boolean;
  pr_number?: number | null;
  pr_reviewers?: string[];
  branch_age_seconds?: number;
  commit_count_this_session?: number;
  last_pushed_by?: string | null;
}

/** EnvContext snapshot — deployment posture + incident state at
 *  decision time. */
export interface EnvContextSnapshot {
  environment_tier?: 'dev' | 'staging' | 'production';
  active_incident?: boolean;
  incident_id?: string | null;
  incident_severity?: 'p1' | 'p2' | 'p3' | null;
  within_business_hours?: boolean;
  timezone?: string;
  deploy_locked?: boolean;
}

/** The 4-context bundle stored on every action record. Backend
 *  persists this once Jenil ships the tickets. */
export interface ActionContexts {
  session?: SessionContextSnapshot;
  repo?: RepoContextSnapshot;
  branch?: BranchContextSnapshot;
  env?: EnvContextSnapshot;
}

/** Generic mixin for rows that may carry CIL data. Use as:
 *    `function Row({ row }: { row: SessionAction & CILFields }) { … }`
 *  so callsites get optional autocomplete on the CIL fields. */
export interface CILFields {
  semantic_type?: SemanticType;
  blast_radius?: BlastRadiusLevel;
  contexts?: ActionContexts;
  /** Short structured string capturing the classifier's reasoning
   *  trail. Example: "branch=main + caller=DEVELOPER → protected
   *  branch write → REWRITE". */
  decision_path?: string;
}
