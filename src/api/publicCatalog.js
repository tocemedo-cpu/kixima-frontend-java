// src/api/publicCatalog.js
// Montra pública do catálogo — SÓ LEITURA, sem sessão. Fala com GET /api/public/catalog/* do backend, que devolve apenas
// produtos e serviços ATIVOS de fornecedoras APROVADAS e só os campos próprios para o público (sem custos, stock nem
// documentos internos). Os filtros e as ordenações são os mesmos do marketplace autenticado.
//
// Nada aqui inventa dados: o que a API não devolve fica `null`/vazio e quem desenha decide o que mostrar.
import { api } from './client';

const BASE = '/api/public/catalog';

// Ordenações aceites pela API (o resto dá 422).
export const ORDENACOES = ['relevantes', 'recentes', 'avaliacao', 'preco_asc', 'preco_desc', 'solicitados', 'vendidos'];
export const TIPOS = ['PRODUTO', 'SERVICO'];
export const LIMITE_MAXIMO = 48;

const lista = (v) => (Array.isArray(v) ? v : []);
const contagens = (v) => lista(v).filter((c) => c && typeof c.name === 'string').map((c) => ({ name: c.name, count: Number(c.count) || 0 }));

/** Resposta de /search: { items, total, page, pages, limit } com a forma garantida. */
export function normalizarPesquisa(r) {
  const items = lista(r?.items).filter((p) => p && p.id && p.slug);
  return {
    items,
    total: Number(r?.total) || 0,
    page: Number(r?.page) || 1,
    pages: Number(r?.pages) || 1,
    limit: Number(r?.limit) || items.length,
  };
}

/** Resposta de /facets: contagens por categoria, tipo, país e certificação + limites de preço. */
export function normalizarFacetas(r) {
  const min = Number(r?.priceBounds?.min);
  const max = Number(r?.priceBounds?.max);
  return {
    categories: contagens(r?.categories),
    kinds: contagens(r?.kinds),
    countries: contagens(r?.countries),
    certifications: contagens(r?.certifications),
    priceBounds: Number.isFinite(min) && Number.isFinite(max) && max > 0 ? { min, max } : null,
  };
}

/** Tira vazios e ordena as chaves: o mesmo filtro dá sempre o mesmo pedido (e a mesma chave de cache). */
export function limparParametros(params = {}) {
  const out = {};
  for (const k of Object.keys(params).sort()) {
    const v = params[k];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    out[k] = Array.isArray(v) ? v.join(',') : v;
  }
  return out;
}

export async function pesquisar(params) {
  return normalizarPesquisa(await api.get(`${BASE}/search`, limparParametros(params)));
}

export async function facetas(params) {
  return normalizarFacetas(await api.get(`${BASE}/facets`, limparParametros(params)));
}

/** Fornecedoras verificadas (a API limita a 24). */
export async function fornecedoras(limit = 24) {
  const r = await api.get(`${BASE}/suppliers`, { limit });
  return lista(r).filter((f) => f && f.id && f.name);
}

export async function produto(slug) {
  return api.get(`${BASE}/products/${encodeURIComponent(slug)}`);
}

export async function avaliacoes(slug) {
  return lista(await api.get(`${BASE}/products/${encodeURIComponent(slug)}/reviews`));
}

/**
 * Produtos de UMA fornecedora. A API pública não filtra por fornecedora, por isso percorre-se a pesquisa (48 por página,
 * no máximo `paginasMax` páginas) e filtra-se aqui. Devolve { items, completo }: `completo` = false se houver mais
 * resultados do que se leu (o ecrã avisa em vez de fingir que é tudo).
 */
export async function produtosDeFornecedora(id, { paginasMax = 5 } = {}) {
  const items = [];
  let completo = true;
  for (let page = 1; page <= paginasMax; page += 1) {
    // eslint-disable-next-line no-await-in-loop
    const r = await pesquisar({ limit: LIMITE_MAXIMO, page: page > 1 ? page : '' });
    items.push(...r.items.filter((p) => p.supplierId === id || p.supplier?.id === id));
    if (page >= r.pages) break;
    if (page === paginasMax) completo = false;
  }
  return { items, completo };
}
