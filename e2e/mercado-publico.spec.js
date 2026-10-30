// e2e/mercado-publico.spec.js
// O marketplace público: quem não tem conta explora o catálogo real da API, sem iniciar sessão — e quem tem sessão
// continua a ir para o seu painel. Só se usam dados que a própria API devolve (nada escrito à mão neste ficheiro).
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const sessao = (nome) => `e2e/.sessoes/${nome}.json`;

async function primeiroProduto(request) {
  const r = await request.get('/api/public/catalog/search?limit=2');
  expect(r.ok()).toBe(true);
  const { items } = await r.json();
  expect(items.length, 'a base de teste precisa de pelo menos 2 produtos públicos').toBeGreaterThanOrEqual(2);
  return items;
}

test.describe('Visitante sem sessão', () => {
  test('a homepage mostra o catálogo real e só chama endpoints públicos', async ({ page }) => {
    const chamadas = []; const recusadas = [];
    page.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/')) chamadas.push(u.pathname); });
    page.on('response', (r) => { if (r.status() === 401 || r.status() === 403) recusadas.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Procurement industrial');
    await expect(page.locator('.pm-cartao').first()).toBeVisible();
    await expect(page.locator('.pm-categoria').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(chamadas.filter((p) => !p.startsWith('/api/public/') && p !== '/api/auth/me')).toEqual([]);
    expect(recusadas).toEqual([]);
  });

  test('catálogo: filtrar por categoria fica no endereço e sobrevive ao recarregar', async ({ page }) => {
    await page.goto('/produtos');
    await expect(page.locator('.pm-cartao').first()).toBeVisible();
    const radiosCategoria = page.locator('fieldset', { has: page.locator('legend', { hasText: 'Categoria' }) }).getByRole('radio');
    await radiosCategoria.nth(1).click();
    await expect(page).toHaveURL(/category=/);
    await expect(page.locator('.pm-chip')).toHaveCount(1);
    const total = await page.locator('.pm-cartao').count();
    await page.reload();
    await expect(page.locator('.pm-chip')).toHaveCount(1);
    expect(await page.locator('.pm-cartao').count()).toBe(total);
  });

  test('ficha → pedir cotação leva ao login; fornecedora → o seu catálogo; comparar dois itens', async ({ page, request }) => {
    const [a, b] = await primeiroProduto(request);
    await page.goto(`/produtos/${a.slug}`);
    await expect(page.getByRole('heading', { level: 1, name: a.name })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Entrar para pedir cotação' })).toHaveAttribute('href', '/login');

    await page.goto('/produtos');
    await page.getByRole('checkbox', { name: new RegExp(`Comparar.*${a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).check();
    await page.getByRole('checkbox', { name: new RegExp(`Comparar.*${b.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).check();
    await page.getByRole('region', { name: 'Comparação de produtos' }).getByRole('link', { name: 'Comparar' }).click();
    await expect(page).toHaveURL(/\/comparar/);
    await expect(page.getByRole('table').getByRole('columnheader')).toHaveCount(2); // um cabeçalho de coluna por item

    await page.goto(`/fornecedoras/${a.supplierId}`);
    await expect(page.locator('.pm-cartao').first()).toBeVisible();
  });

  test('a página corporativa continua a existir em /sobre', async ({ page }) => {
    await page.goto('/sobre');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('E-MARKETPLACE B2B').first()).toBeVisible();
  });
});

test.describe('Quem tem sessão', () => {
  test.use({ storageState: sessao('comprador') });

  test('«/» continua a levar ao painel; o catálogo público também é acessível e a cotação vai para a área do comprador', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/comprador/);
    await page.goto('/produtos');
    await expect(page.locator('.pm-cartao').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pedir cotação' }).first()).toHaveAttribute('href', '/comprador/cotacoes');
    await expect(page.getByRole('link', { name: 'O meu painel' })).toBeVisible();
  });
});

test.describe('Acessibilidade e responsividade', () => {
  const ROTAS = ['/', '/produtos', '/fornecedoras', '/comparar'];
  for (const rota of ROTAS) {
    test(`sem barreiras e sem scroll horizontal (telemóvel): ${rota}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(rota);
      await page.waitForLoadState('networkidle');
      const alargou = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(alargou).toBe(false);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.brand-word').analyze();
      expect(r.violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
    });
  }
});
