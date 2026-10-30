// src/api/publicCatalog.test.js
import { beforeEach, describe, expect, test, vi } from 'vitest';

const apiGet = vi.fn();
vi.mock('./client', () => ({ api: { get: (...a) => apiGet(...a) } }));

// eslint-disable-next-line import/first
import { facetas, limparParametros, normalizarFacetas, normalizarPesquisa, produtosDeFornecedora, pesquisar } from './publicCatalog';

beforeEach(() => apiGet.mockReset());

describe('normalização das respostas', () => {
  test('pesquisa: descarta itens sem id/slug e dá valores por omissão', () => {
    expect(normalizarPesquisa({ items: [{ id: 'a', slug: 'a' }, { id: 'b' }, null], total: '2' })).toMatchObject({ items: [{ id: 'a', slug: 'a' }], total: 2, page: 1, pages: 1 });
    expect(normalizarPesquisa(null)).toEqual({ items: [], total: 0, page: 1, pages: 1, limit: 0 });
  });
  test('facetas: contagens válidas e limites de preço só se fizerem sentido', () => {
    const f = normalizarFacetas({ categories: [{ name: 'A', count: 2 }, { count: 1 }], priceBounds: { min: 10, max: 99 } });
    expect(f.categories).toEqual([{ name: 'A', count: 2 }]);
    expect(f.priceBounds).toEqual({ min: 10, max: 99 });
    expect(normalizarFacetas({ priceBounds: { min: 0, max: 0 } }).priceBounds).toBeNull();
    expect(normalizarFacetas(undefined).kinds).toEqual([]);
  });
});

describe('pedidos', () => {
  test('limparParametros tira vazios, junta listas e ordena as chaves', () => {
    expect(limparParametros({ b: 1, a: '', c: ['x', 'y'], d: [], e: null, f: 0 })).toEqual({ b: 1, c: 'x,y', f: 0 });
    expect(Object.keys(limparParametros({ z: 1, a: 2 }))).toEqual(['a', 'z']);
  });
  test('pesquisar e facetas falam SÓ com /api/public/catalog (nunca com os endpoints que exigem sessão)', async () => {
    apiGet.mockResolvedValue({ items: [] });
    await pesquisar({ q: 'x' }); await facetas({});
    expect(apiGet.mock.calls.map((c) => c[0])).toEqual(['/api/public/catalog/search', '/api/public/catalog/facets']);
  });
  test('produtosDeFornecedora filtra no cliente, percorre as páginas e avisa se ficou incompleto', async () => {
    const pagina = (n, pages) => ({ items: [{ id: `p${n}a`, slug: `a${n}`, supplierId: 'F1' }, { id: `p${n}b`, slug: `b${n}`, supplierId: 'F2' }], pages, page: n });
    apiGet.mockImplementation((_u, p = {}) => Promise.resolve(pagina(Number(p.page || 1), 3)));
    const r = await produtosDeFornecedora('F1');
    expect(r.items.map((p) => p.id)).toEqual(['p1a', 'p2a', 'p3a']);
    expect(r.completo).toBe(true);
    apiGet.mockImplementation((_u, p = {}) => Promise.resolve(pagina(Number(p.page || 1), 99)));
    const longo = await produtosDeFornecedora('F1', { paginasMax: 2 });
    expect(longo.items).toHaveLength(2);
    expect(longo.completo).toBe(false);
  });
});
