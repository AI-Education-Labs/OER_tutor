export interface TutorialPersistence {
  hasSeenTutorial(tutorialId: string): boolean
  markTutorialSeen(tutorialId: string): void
  resetTutorial(tutorialId: string): void
  resetAll(): void
}

const STORAGE_KEY_PREFIX = "textbookai_tutorial_"

export function createLocalPersistence(): TutorialPersistence {
  return {
    hasSeenTutorial(tutorialId: string): boolean {
      if (typeof window === "undefined") return false
      return localStorage.getItem(`${STORAGE_KEY_PREFIX}${tutorialId}`) === "seen"
    },
    markTutorialSeen(tutorialId: string): void {
      if (typeof window === "undefined") return
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${tutorialId}`, "seen")
    },
    resetTutorial(tutorialId: string): void {
      if (typeof window === "undefined") return
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${tutorialId}`)
    },
    resetAll(): void {
      if (typeof window === "undefined") return
      Object.keys(localStorage)
        .filter((k) => k.startsWith(STORAGE_KEY_PREFIX))
        .forEach((k) => localStorage.removeItem(k))
    },
  }
}
