export type TutorialId = "study-interface" | "dashboard"

export type StepPlacement = "top" | "bottom" | "left" | "right"

export type UserRole = "student" | "professor"

export interface TutorialStep {
  /** Unique id within the tutorial */
  id: string
  /** CSS selector for the target element */
  targetSelector: string
  /** Card title */
  title: string
  /** Card description */
  description: string
  /** Preferred placement of tooltip relative to target */
  placement: StepPlacement
  /** If true, user must interact with the target before Next is enabled */
  interactive?: boolean
  /** DOM event on target that counts as "completed". Default: "click" */
  interactionEvent?: string
  /** Narrower selector for where to listen for the interaction event */
  interactionTargetSelector?: string
  /** If set, this step only shows for this role */
  role?: UserRole
  /** Key into beforeShowHandlers map — called before this step is shown */
  beforeShow?: string
  /** If true, skip this step when the target element is not in the DOM */
  skipIfMissing?: boolean
}

export interface TutorialConfig {
  id: TutorialId
  /** Steps for desktop (>= 768px) */
  steps: TutorialStep[]
  /** Steps for mobile (< 768px). Falls back to `steps` if omitted. */
  mobileSteps?: TutorialStep[]
}
