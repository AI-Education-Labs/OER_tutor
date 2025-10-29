import { test, expect } from '@playwright/test'

// load the authenticated state before each test
test.use({ storageState: 'storageState.json' });

test.describe('Flashcards Panel', () => {
    test.beforeEach(async ({ page }) => {
        // open to book page and open quiz panel after selecting chapter
        // open study view for psych book
        await page.goto('study/852f0488-7903-4555-bf5e-a7618f2552ff')
        // select chapter 1
        await page.getByRole('button', { name: 'The Science of Psychology 0%' }).click()
        // open quiz panel
        const openQuizButton = page.getByText('FlashcardsPractice key').first()
        await openQuizButton.click()
    })

    test('flashcards panel opens correctly', async ({ page }) => {
        expect(await page.getByRole('combobox').filter({ hasText: 'Select a subchapter' }))
    })


    // TODO: this shouldn't make real API calls to openAI, backend should mock responses
    test('flashcard generation works', async ({ page }) => {
        // fill form
        await page.getByRole('combobox').filter({ hasText: 'Select a subchapter' }).click();
        await page.getByRole('option', { name: 'Methods of Knowing' }).click();

        // generate flashcards
        await page.getByRole('button', { name: 'Generate Flashcards' }).click();
        await page.locator('.p-6').click();

        // assert that the flashcard container has at least one child element
        const flashcardContainer = page.locator('.p-6');
        const childCount = await flashcardContainer.locator('>*').count();
        expect(childCount).toBeGreaterThan(0);

        // make sure flashcards exist by checking for the next button
        expect(await page.getByRole('button', { name: 'Next', exact: true }).click())

        // page through a few flashcards and shuffle
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByRole('button', { name: 'Shuffle' }).click();

        // back out to flashcard list
        await page.getByRole('button', { name: 'Shuffle' }).click();
        // expect to see the flashcard set in the list
        await page.getByRole('button', { name: 'Shuffle' }).click();

        await page.getByRole('button', { name: 'Shuffle' }).click();
    });

    // previous test generates flashcard needed for this test to pass with listing
    test('flashcard listing works', async ({ page }) => {
        // expect previous decks button to be visible and have children await page.getByRole('button', { name: 'Sign In', exact: true }).click();
        // wait for loading to go away
        await page.locator('div').filter({ hasText: /^Previous Decks Loading$/ }).first().waitFor({ state: 'hidden' })
        expect(await page.getByText('Previous DecksMethods of').first()).toBeVisible();
        expect(await page.getByText('Previous DecksMethods of').first().locator('>*').count()).toBeGreaterThan(0);

    });


    test('flashcard interaction works', async ({ page }) => {
        // wait for loading to go away
        await page.getByText('Previous Decks').first().waitFor({ state: 'visible' });
        // open previous deck and get its second div child
        await page.getByRole('button', { name: 'Methods of Knowing' }).first().click();

        // make sure flashcards exist by checking for the next button
        expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByRole('button', { name: 'Next', exact: true }).click();
    });

    test('flashcards can be deleted', async ({ page }) => {
        // wait for loading to go away
        await page.getByText('Previous Decks').first().waitFor({ state: 'visible' });
        // open previous deck and get its second div child
        const flashcard_deck = page.getByRole('button', { name: 'Methods of Knowing' }).first();
        await flashcard_deck.getByRole('button', { name: 'More options', exact: true }).click();
        // expect delete button
        expect(flashcard_deck.getByRole('menuitem', { name: 'Delete' }))

        // delete flashcard deck
        await page.getByRole('menuitem', { name: 'Delete' }).click();
    });
})