import { test, expect } from '@playwright/test';

test.describe('Ribbon - Review tab', () => {
  test('shows comments toggle and editing mode control', async ({ page }) => {
    await page.goto('/?toolbar=ribbon');
    await page.waitForSelector('[data-testid="docx-editor"]');

    await page.getByRole('tab', { name: 'Review' }).click();

    const ribbon = page.getByTestId('ribbon');
    await expect(ribbon).toHaveAttribute('data-has-toggle-comments', 'true');
    const showCommentsButton = ribbon.getByRole('button', { name: 'Show Comments' });
    await expect(showCommentsButton).toBeVisible();
    await expect(showCommentsButton).toBeEnabled();
    await expect(page.getByTestId('editing-mode-dropdown')).toBeVisible();

    const editor = page.getByTestId('docx-editor');
    const initialState = (await editor.getAttribute('data-comments-open')) ?? 'false';

    await showCommentsButton.click();
    const expected = initialState === 'true' ? 'false' : 'true';
    await expect(editor).toHaveAttribute('data-comments-open', expected);
  });
});
