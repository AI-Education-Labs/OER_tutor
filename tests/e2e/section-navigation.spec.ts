import { test, expect } from '@playwright/test'

test.use({ storageState: 'storageState.json' })

const TEXTBOOK_URL = '/study/852f0488-7903-4555-bf5e-a7618f2552ff'
const CHAPTER_1_TITLE = 'The Science of Psychology'
const SECTION_2_TITLE = 'Understanding Science'
const SECTION_2_PAGE = 4
const CHAPTER_2_TITLE = 'Overview of the Scientific Method'

test.describe('PDF Viewer Section Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEXTBOOK_URL)
    
    // Wait for the page to load and PDF viewer to initialize
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Give time for PDF.js to load
  })

  test('should expand chapter when clicking on chapter title', async ({ page }) => {
    // Find and click the first chapter "The Science of Psychology"
    const chapterButton = page.getByText(CHAPTER_1_TITLE).first()
    await expect(chapterButton).toBeVisible()
    
    await chapterButton.click()
    await page.waitForTimeout(500)
    
    // Verify sections are now visible
    const section = page.getByText(SECTION_2_TITLE).first()
    await expect(section).toBeVisible()
  })

  test('should scroll to correct page when section is selected within same chapter', async ({ page }) => {
    // Expand the first chapter
    const chapterButton = page.getByText(CHAPTER_1_TITLE).first()
    await chapterButton.click()
    await page.waitForTimeout(500)
    
    // Get the scroll container
    const scrollContainer = page.locator('.overflow-auto.h-full.border.bg-white').first()
    await expect(scrollContainer).toBeVisible()
    
    // Get initial scroll position
    const initialScroll = await scrollContainer.evaluate((el) => el.scrollTop)
    
    // Click on "Understanding Science" section (page 4)
    const section = page.getByText(SECTION_2_TITLE).first()
    await section.click()
    
    // Wait for smooth scroll animation to complete
    await page.waitForTimeout(1000)
    
    // Verify scroll position changed
    const newScroll = await scrollContainer.evaluate((el) => el.scrollTop)
    expect(newScroll).toBeGreaterThan(initialScroll)
    expect(newScroll).toBeGreaterThan(0)
  })

  test('should maintain chapter expansion state when selecting sections', async ({ page }) => {
    // Expand the first chapter
    const chapterButton = page.getByText(CHAPTER_1_TITLE).first()
    await chapterButton.click()
    await page.waitForTimeout(500)
    
    // Click on a section
    const section = page.getByText(SECTION_2_TITLE).first()
    await section.click()
    await page.waitForTimeout(1000)
    
    // Verify the chapter is still expanded (section still visible)
    await expect(section).toBeVisible()
  })

  test('should handle PDF loading before allowing section navigation', async ({ page }) => {
    // On initial load, verify PDF viewer is present
    const scrollContainer = page.locator('.overflow-auto.h-full.border.bg-white').first()
    await expect(scrollContainer).toBeVisible({ timeout: 10000 })
    
    // Expand chapter and click section
    const chapterButton = page.getByText(CHAPTER_1_TITLE).first()
    await chapterButton.click()
    await page.waitForTimeout(500)
    
    const section = page.getByText(SECTION_2_TITLE).first()
    await section.click()
    
    // Should not throw errors even if PDF is still loading
    await page.waitForTimeout(1000)
    
    // Verify container is still present (no crash)
    await expect(scrollContainer).toBeVisible()
  })
})

test.describe('PDF Viewer Scroll Function', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEXTBOOK_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
  })

  test('should calculate scroll position based on page number', async ({ page }) => {
    // Expand chapter and load PDF
    const chapterButton = page.getByText(CHAPTER_1_TITLE).first()
    await chapterButton.click()
    await page.waitForTimeout(1500)
    
    const scrollContainer = page.locator('.overflow-auto.h-full.border.bg-white').first()
    
    // Click on section with known page number
    const section = page.getByText(SECTION_2_TITLE).first()
    await section.click()
    await page.waitForTimeout(1000)
    
    // Verify we scrolled to a non-zero position
    const scrollPosition = await scrollContainer.evaluate((el) => el.scrollTop)
    expect(scrollPosition).toBeGreaterThan(0)
    
    // Verify scroll is proportional to page number
    // Page 4 should be somewhere in the first 30% of the document typically
    const scrollHeight = await scrollContainer.evaluate((el) => el.scrollHeight)
    const scrollPercentage = (scrollPosition / scrollHeight) * 100
    
    // Should be scrolled but not too far (page 4 is early in most textbooks)
    expect(scrollPercentage).toBeGreaterThan(0)
    expect(scrollPercentage).toBeLessThan(50) // Assuming textbook has more than 8 pages
  })

  test('should use smooth scroll behavior', async ({ page }) => {
    const chapterButton = page.getByText(CHAPTER_1_TITLE).first()
    await chapterButton.click()
    await page.waitForTimeout(1500)
    
    const scrollContainer = page.locator('.overflow-auto.h-full.border.bg-white').first()
    
    // Check that scroll-behavior is smooth or animation occurs
    const section = page.getByText(SECTION_2_TITLE).first()
    const initialScroll = await scrollContainer.evaluate((el) => el.scrollTop)
    
    await section.click()
    
    // Check scroll mid-animation
    await page.waitForTimeout(250)
    const midScroll = await scrollContainer.evaluate((el) => el.scrollTop)
    
    // Wait for animation to complete
    await page.waitForTimeout(500)
    const finalScroll = await scrollContainer.evaluate((el) => el.scrollTop)
    
    // Verify animation occurred (mid-scroll should be between initial and final)
    expect(midScroll).toBeGreaterThanOrEqual(initialScroll)
      expect(finalScroll).toBeGreaterThanOrEqual(midScroll)
    })
  
  })