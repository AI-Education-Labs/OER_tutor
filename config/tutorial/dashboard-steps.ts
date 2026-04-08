import type { TutorialConfig } from "./types"

export const dashboardTutorial: TutorialConfig = {
  id: "dashboard",
  steps: [
    {
      id: "course-tabs",
      targetSelector: "[data-tutorial='course-tabs']",
      title: "Course Tabs",
      description:
        "Switch between your enrolled courses and the full course catalog to find what you need.",
      placement: "bottom",
    },
    {
      id: "join-course",
      targetSelector: "[data-tutorial='join-course-btn']",
      title: "Join a Course",
      description:
        "Have an invite code from your instructor? Click here to join a course instantly.",
      placement: "bottom",
      skipIfMissing: true,
    },
    {
      id: "course-card",
      targetSelector: "[data-tutorial='course-card']",
      title: "Open a Course",
      description:
        "Click any course card to view its textbooks and start studying.",
      placement: "bottom",
      skipIfMissing: true,
    },
    {
      id: "create-course",
      targetSelector: "[data-tutorial='create-course-btn']",
      title: "Create a Course",
      description:
        "As an educator, you can create courses and invite students with a unique code.",
      placement: "bottom",
      role: "professor",
      skipIfMissing: true,
    },
  ],
}
