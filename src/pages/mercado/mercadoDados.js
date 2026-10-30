// src/pages/mercado/mercadoDados.js
// Regras de apresentação do catálogo público. Só transforma o que a API devolve; nunca preenche lacunas.
import { LIMITE_MAXIMO, ORDENACOES, TIPOS } from '../../api/publicCatalog';

const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Preço a mostrar: { tipo: 'preco' | 'promo' | 'cotacao', valor, antigo, moeda }.
 * Sem preço público (ou 0) é «sob cotação» — nunca se inventa um valor.
 */
export function precoDe(p) {
  const base = numero(p?.unitPrice);
  const promo = numero(p?.promoPrice);
  const moeda = p?.currency || 'AOA';
  if (promo && promo > 0 && base && base > promo) return { tipo: 'promo', valor: promo, antigo: base, moeda };
  if (base && base > 0) return { tipo: 'preco', valor: base, antigo: null, moeda };
  return { tipo: 'cotacao', valor: null, antigo: null, moeda };
}

const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Até `max` especificações curtas e reais para o cartão (norma, material, marca/modelo, certificação). */
export function especificacoes(p, max = 3) {
  const marcaModelo = [texto(p?.brand), texto(p?.model)].filter(Boolean).join(' ');
  const certs = Array.isArray(p?.certifications) ? p.certifications.filter(texto) : [];
  const todas = [texto(p?.keySpec), texto(p?.standard), texto(p?.material), marcaModelo || null, ...certs];
  return [...new Set(todas.filter(Boolean))].slice(0, max);
}

/** «Luanda, Angola», só com o que existir. */
export function localizacaoDe(p) {
  return [texto(p?.city), texto(p?.country)].filter(Boolean).join(', ');
}

export const urlProduto = (p) => `/produtos/${encodeURIComponent(p.slug)}`;
export const urlCategoria = (nome) => `/categorias/${encodeURIComponent(nome)}`;
export const urlFornecedora = (id) => `/fornecedoras/${encodeURIComponent(id)}`;

// --- Filtros do catálogo <-> endereço ---------------------------------------
// Todos os filtros vivem no endereço: o resultado filtrado partilha-se, recarrega-se e o «voltar» funciona.

export const FILTROS_VAZIOS = Object.freeze({
  q: '', category: '', kind: '', country: '', certs: [], minPrice: '', maxPrice: '', minRating: '', promo: false,
  sort: 'relevantes', page: 1, vista: 'grelha',
});

const inteiroPositivo = (v, porOmissao) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : porOmissao;
};

/** Preço vindo do endereço: só um número >= 0 escrito mesmo (a ausência não é «0»). */
function precoDoEndereco(v) {
  if (v === null || v.trim() === '') return '';
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? String(n) : '';
}

export function lerFiltros(sp, fixos = {}) {
  const sort = sp.get('sort');
  const kind = sp.get('kind');
  const certs = (sp.get('certs') || '').split(',').map((c) => c.trim()).filter(Boolean);
  return {
    ...FILTROS_VAZIOS,
    q: (sp.get('q') || '').slice(0, 120),
    category: sp.get('category') || '',
    kind: TIPOS.includes(kind) ? kind : '',
    country: sp.get('country') || '',
    certs,
    minPrice: precoDoEndereco(sp.get('minPrice')),
    maxPrice: precoDoEndereco(sp.get('maxPrice')),
    minRating: ['3', '4'].includes(sp.get('minRating')) ? sp.get('minRating') : '',
    promo: sp.get('promo') === 'true',
    sort: ORDENACOES.includes(sort) ? sort : 'relevantes',
    page: inteiroPositivo(sp.get('page'), 1),
    vista: sp.get('vista') === 'lista' ? 'lista' : 'grelha',
    ...fixos,
  };
}

/** Filtros -> parâmetros do endereço (só o que difere do estado vazio). `omitir` = chaves fixadas pela rota. */
export function escreverFiltros(f, omitir = []) {
  const sp = new URLSearchParams();
  const pôr = (k, v) => { if (!omitir.includes(k) && v !== '' && v !== false && v != null) sp.set(k, String(v)); };
  pôr('q', f.q); pôr('category', f.category); pôr('kind', f.kind); pôr('country', f.country);
  if (f.certs.length) sp.set('certs', f.certs.join(','));
  pôr('minPrice', f.minPrice); pôr('maxPrice', f.maxPrice); pôr('minRating', f.minRating);
  if (f.promo) sp.set('promo', 'true');
  if (f.sort !== 'relevantes') sp.set('sort', f.sort);
  if (f.page > 1) sp.set('page', String(f.page));
  if (f.vista === 'lista') sp.set('vista', 'lista');
  return sp;
}

/** Filtros -> parâmetros da API. */
export function paraApi(f, limit = 24) {
  return {
    q: f.q, category: f.category, kind: f.kind, country: f.country, certifications: f.certs,
    minPrice: f.minPrice, maxPrice: f.maxPrice, minRating: f.minRating, promo: f.promo ? 'true' : '',
    sort: f.sort === 'relevantes' ? '' : f.sort, page: f.page > 1 ? f.page : '', limit: Math.min(limit, LIMITE_MAXIMO),
  };
}

/** Quantos filtros (além de pesquisa e ordenação) estão ativos. */
export function contarFiltros(f) {
  return [f.category, f.kind, f.country, f.minPrice, f.maxPrice, f.minRating, f.promo ? '1' : ''].filter(Boolean).length + f.certs.length;
}

/**
 * Para onde leva «Pedir cotação». Só quem tem conta de COMPRADOR pode pedir: sem sessão vai à entrada, e as outras
 * contas não veem a ação (não a podem usar). `null` = não mostrar.
 */
export function destinoCotacao(user) {
  if (!user) return '/login';
  return user.role === 'COMPRADOR' ? '/comprador/cotacoes' : null;
}
