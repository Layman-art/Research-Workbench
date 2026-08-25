import { test, expect } from '@playwright/test';

test('应用启动并展示工作台总览', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: '工作台总览' })).toBeVisible();
  await expect(page.locator('.sidebar').getByRole('button', { name: /科研项目/ })).toBeVisible();
  await expect(page.locator('.sidebar').getByRole('button', { name: /待办事项/ })).toBeVisible();
  await expect(page.locator('.titlebar-brand')).toBeVisible();
  await expect(page.locator('.titlebar-controls')).toHaveCount(0);
  await expect(page.getByText('月相 · 记录分布')).toBeVisible();
  await expect(page.getByText('声浪 · 近 14 天活跃')).toBeVisible();
});

test('待办视图可以快速添加事项', async ({ page }) => {
  await page.goto('/');
  await page.locator('.sidebar').getByRole('button', { name: /待办事项/ }).click();
  const input = page.getByPlaceholder(/添加.*回车创建/);
  await input.fill('端到端测试待办');
  await input.press('Enter');
  await expect(page.getByText('端到端测试待办')).toBeVisible();
});
