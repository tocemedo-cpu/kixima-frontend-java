// src/pages/mercado/Paginas.test.jsx
// Homepage, ficha, fornecedoras e comparação: dados reais, secções vazias desaparecem, falhas dizem-se.
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../../i18n';

const apiGet = vi.fn();
vi.mock('../../api/client', () => ({ api: { get: (...a) => apiGet(...a) } }));
let sessao = { user: null, loading: false };
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => sessao }));

/* eslint-disable import/first */
import Comparar from './Comparar';
import Fornecedoras, { Fornecedora } from './Fornecedoras';
import MercadoHome from './MercadoHome';
import { MercadoProvider } from './MercadoContexto';
import Produto, { linhasTecnicas } from './Produto';
/* eslint-enable import/first */

const F = { id: 'F1', name: 'Fornecedora Teste, Lda', verified: true, logoUrl: null };
const P1 = { id: 'p1', slug: 'valvula', name: 'Válvula 4"', kind: 'PRODUTO', category: 'Válvulas', unitPrice: '850000', currency: 'AOA', imageUrl: '/catalog/v.jpg', supplier: F, supplierId: 'F1', material: 'Aço inox', standard: 'API 6D', rating: 4.8, reviewCount: 2, certifications: ['ISO 9001'], city: 'Luanda', country: 'Angola' };
const P2 = { id: 'p2', slug: 'inspecao', name: 'Inspeção UT', kind: 'SERVICO', category: 'Inspeção & Ensaios', unitPrice: null, currency: 'AOA', imageUrl: null, supplier: F, supplierId: 'F1', specialty: 'Inspeção', leadTimeDays: 5 };
const FACETAS = { categories: [{ name: 'Válvulas', count: 1 }], kinds: [], countries: [], certifications: [], priceBounds: null };

function api({ itens = [P1, P2], erro = false } = {}) {
  apiGet.mockImplementation((url, params = {}) => {
    if (erro) return Promise.reject(new Error('rede'));
    if (url.endsWith('/facets')) return Promise.resolve(FACETAS);
    if (url.endsWith('/search')) {
      const lista = itens.filter((p) => !params.kind || p.kind === params.kind);
      return Promise.resolve({ items: lista, total: lista.length, page: 1, pages: 1, limit: 48 });
    }
    if (url.endsWith('/suppliers')) return Promise.resolve([{ id: 'F1', name: F.name, city: 'Luanda', country: 'Angola', rating: 4.6, productCount: 2, logoUrl: null }]);
    if (url.includes('/products/') && url.endsWith('/reviews')) return Promise.resolve([{ id: 'r1', authorName: 'Ana M.', rating: 5, comment: 'Excelente.' }]);
    const m = url.match(/\/products\/([^/]+)$/);
    if (m) { const p = itens.find((x) => x.slug === decodeURIComponent(m[1])); return p ? Promise.resolve(p) : Promise.reject(Object.assign(new Error('nf'), { status: 404 })); }
    if (url === '/api/public/stats') return Promise.resolve({ empresasVerificadas: 6, fornecedoresQualificados: 1, ordensProcessadas: 0, pagamentoSlaDias: 7 });
    return Promise.reject(new Error('inesperado ' + url));
  });
}

const rota = (caminho, padrao, el) => render(
  <MemoryRouter initialEntries={[caminho]}><I18nProvider><MercadoProvider><Routes><Route path={padrao} element={el} /></Routes></MercadoProvider></I18nProvider></MemoryRouter>,
);

beforeEach(() => { apiGet.mockReset(); window.localStorage.clear(); sessao = { user: null, loading: false }; });

describe('Homepage', () => {
  test('mostra categorias e prateleiras reais; um item aparece numa só prateleira (sem «recentes» repetidos)', async () => {
    api();
    rota('/', '/', <MercadoHome />);
    expect(await screen.findByRole('heading', { name: 'Produtos populares' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Serviços técnicos' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Válvula 4"' })).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'Adicionados recentemente' })).not.toBeInTheDocument();
  });
  test('«ordens processadas: 0» não é apresentado como número (só estatísticas > 0)', async () => {
    api();
    rota('/', '/', <MercadoHome />);
    expect(await screen.findByText('empresas compradoras verificadas')).toBeInTheDocument();
    expect(screen.queryByText('ordens de compra processadas')).not.toBeInTheDocument();
    const faixa = screen.getByRole('list', { name: 'A KIXIMA em números' });
    expect(within(faixa).getAllByRole('listitem')).toHaveLength(2); // empresas e fornecedoras; as ordens (0) ficam de fora
  });
  test('sem estatísticas da API não há faixa de números (nada inventado)', async () => {
    api();
    const original = apiGet.getMockImplementation();
    apiGet.mockImplementation((url, params) => (url === '/api/public/stats' ? Promise.reject(new Error('rede')) : original(url, params)));
    rota('/', '/', <MercadoHome />);
    await screen.findByRole('heading', { name: 'Produtos populares' });
    expect(screen.queryByRole('list', { name: 'A KIXIMA em números' })).not.toBeInTheDocument();
  });
  test('coluna de categorias: links reais com contagem; o catálogo vem logo a seguir à abertura', async () => {
    api();
    rota('/', '/', <MercadoHome />);
    const coluna = await screen.findByRole('navigation', { name: 'Categorias' });
    expect(within(coluna).getByRole('link', { name: /Válvulas/ })).toHaveAttribute('href', '/categorias/V%C3%A1lvulas');
    expect(within(coluna).getByRole('link', { name: /Ver todo o catálogo/ })).toHaveAttribute('href', '/produtos');
    // Ordem comercial: produtos populares → serviços → fornecedoras verificadas → categorias industriais.
    const titulos = (await screen.findAllByRole('heading', { level: 2 })).map((h) => h.textContent);
    const ordem = ['Produtos populares', 'Serviços técnicos', 'Fornecedoras e prestadoras de serviços verificadas', 'Categorias industriais'];
    expect(ordem.map((t) => titulos.indexOf(t))).toEqual([...ordem.map((t) => titulos.indexOf(t))].sort((a, b) => a - b));
    expect(ordem.every((t) => titulos.includes(t))).toBe(true);
  });
  test('enquanto as facetas carregam, a coluna mostra esqueletos (aria-busy) e não fica vazia', async () => {
    let resolver;
    apiGet.mockImplementation((url) => {
      if (url.endsWith('/facets')) return new Promise((ok) => { resolver = () => ok(FACETAS); });
      if (url.endsWith('/search')) return Promise.resolve({ items: [], total: 0, page: 1, pages: 1, limit: 48 });
      if (url.endsWith('/suppliers')) return Promise.resolve([]);
      return Promise.resolve({});
    });
    rota('/', '/', <MercadoHome />);
    const coluna = await screen.findByRole('navigation', { name: 'Categorias' });
    expect(coluna).toHaveAttribute('aria-busy', 'true');
    expect(coluna.querySelectorAll('.pm-trilho-esq').length).toBeGreaterThan(0);
    resolver();
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Categorias' })).toHaveAttribute('aria-busy', 'false'));
    expect(within(screen.getByRole('navigation', { name: 'Categorias' })).getByRole('link', { name: /Válvulas/ })).toBeInTheDocument();
  });
  test('sem categorias a coluna desaparece (sem coluna vazia) e o catálogo vazio diz-se', async () => {
    apiGet.mockImplementation((url) => {
      if (url.endsWith('/facets')) return Promise.resolve({ categories: [], kinds: [], countries: [], certifications: [], priceBounds: null });
      if (url.endsWith('/search')) return Promise.resolve({ items: [], total: 0, page: 1, pages: 1, limit: 48 });
      if (url.endsWith('/suppliers')) return Promise.resolve([]);
      return Promise.resolve({ empresasVerificadas: 0, fornecedoresQualificados: 0, ordensProcessadas: 0 });
    });
    const { container } = rota('/', '/', <MercadoHome />);
    expect(await screen.findByText('O catálogo ainda não tem itens publicados.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Categorias' })).not.toBeInTheDocument();
    expect(container.querySelector('.pm-heroi')).toHaveClass('pm-heroi-sem-trilho');
    const vazio = screen.getByText('O catálogo ainda não tem itens publicados.').closest('[role="status"]');
    expect(within(vazio).getByRole('link', { name: 'Registar a minha empresa' })).toHaveAttribute('href', '/cadastro');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument(); // vazio não é erro
  });
  test('três colunas: categorias, banner e, à direita, cotação + fornecedoras em destaque (dados reais)', async () => {
    api();
    const { container } = rota('/', '/', <MercadoHome />);
    const direita = (await screen.findByRole('heading', { name: 'Fornecedoras em destaque' })).closest('aside');
    expect(direita).toHaveClass('pm-direita');
    expect(within(direita).getByRole('heading', { name: 'Peça cotações' })).toBeInTheDocument();
    expect(within(direita).getByRole('link', { name: F.name })).toHaveAttribute('href', '/fornecedoras/F1');
    expect(within(direita).getByText(/Luanda, Angola/)).toBeInTheDocument();
    expect(within(direita).getByRole('link', { name: /Ver todas/ })).toHaveAttribute('href', '/fornecedoras');
    expect(container.querySelector('.pm-heroi > .pm-trilho')).not.toBeNull();
    expect(container.querySelector('.pm-heroi > .pm-banner h1')).not.toBeNull();
  });
  test('sem fornecedoras o painel «em destaque» não aparece, mas a cotação fica (sem painel vazio)', async () => {
    api();
    const original = apiGet.getMockImplementation();
    apiGet.mockImplementation((url, params) => (url.endsWith('/suppliers') ? Promise.resolve([]) : original(url, params)));
    rota('/', '/', <MercadoHome />);
    expect(await screen.findByRole('heading', { name: 'Peça cotações' })).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Produtos populares' });
    expect(screen.queryByRole('heading', { name: 'Fornecedoras em destaque' })).not.toBeInTheDocument();
  });
  test('a fornecedora usa o logótipo da API quando existe; senão, a inicial (sem imagem inventada)', async () => {
    api();
    const original = apiGet.getMockImplementation();
    apiGet.mockImplementation((url, params) => (url.endsWith('/suppliers')
      ? Promise.resolve([{ id: 'F1', name: F.name, city: 'Luanda', country: 'Angola', rating: null, productCount: 2, logoUrl: '/logos/f1.png' },
        { id: 'F2', name: 'Outra, Lda', city: null, country: null, rating: null, productCount: 0, logoUrl: null }])
      : original(url, params)));
    const { container } = rota('/', '/', <MercadoHome />);
    await screen.findByRole('heading', { name: 'Fornecedoras e prestadoras de serviços verificadas' });
    expect(container.querySelector('img.pm-logo')).toHaveAttribute('src', '/logos/f1.png');
    expect(container.querySelector('span.pm-logo')).toHaveTextContent('O');
  });
  test('produtos populares em grelha (não em carrossel) e com a fotografia que a API devolve', async () => {
    api();
    const { container } = rota('/', '/', <MercadoHome />);
    const seccao = (await screen.findByRole('heading', { name: 'Produtos populares' })).closest('section');
    expect(seccao.querySelector('.pm-grade-grelha')).not.toBeNull();
    expect(container.querySelector('.pm-prateleira')).toBeNull();
    expect(seccao.querySelector('img.pm-foto')).toHaveAttribute('src', '/catalog/v.jpg');
  });
  test('fornecedoras verificadas mostram localização, itens ativos e a avaliação real', async () => {
    api();
    rota('/', '/', <MercadoHome />);
    const seccao = (await screen.findByRole('heading', { name: 'Fornecedoras e prestadoras de serviços verificadas' })).closest('section');
    expect(within(seccao).getByRole('link', { name: F.name })).toHaveAttribute('href', '/fornecedoras/F1');
    expect(within(seccao).getByText(/Luanda, Angola/)).toBeInTheDocument();
    expect(within(seccao).getByText('4,6')).toBeInTheDocument();
  });
  test('sem produtos publicados: as prateleiras desaparecem (sem enchimento)', async () => {
    api({ itens: [] });
    rota('/', '/', <MercadoHome />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    await screen.findByText('Peça cotações');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Produtos populares' })).not.toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Serviços técnicos' })).not.toBeInTheDocument();
  });
  test('API em baixo: aviso honesto e nenhum produto', async () => {
    api({ erro: true });
    rota('/', '/', <MercadoHome />);
    expect(await screen.findByText('O catálogo está indisponível neste momento.')).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.queryByRole('navigation', { name: 'Categorias' })).not.toBeInTheDocument(); // sem coluna vazia
    expect(screen.queryByText('O catálogo ainda não tem itens publicados.')).not.toBeInTheDocument(); // erro ≠ vazio
  });
  test('cotação: sem sessão leva ao login; comprador à sua área; outras contas veem «O meu painel»', async () => {
    api();
    const { unmount } = rota('/', '/', <MercadoHome />);
    expect((await screen.findAllByRole('link', { name: 'Entrar para pedir cotação' }))[0]).toHaveAttribute('href', '/login');
    unmount();
    sessao = { user: { role: 'COMPRADOR' }, loading: false };
    const r2 = rota('/', '/', <MercadoHome />);
    expect((await screen.findAllByRole('link', { name: 'Pedir cotação' }))[0]).toHaveAttribute('href', '/comprador/cotacoes');
    r2.unmount();
    sessao = { user: { role: 'FORNECEDOR' }, loading: false };
    rota('/', '/', <MercadoHome />);
    expect(await screen.findByRole('link', { name: 'O meu painel' })).toHaveAttribute('href', '/fornecedor');
    expect(screen.queryByRole('link', { name: 'Pedir cotação' })).not.toBeInTheDocument();
  });
});

describe('Ficha do produto', () => {
  test('mostra especificações só com valor, avaliações reais e CTA conforme a sessão', async () => {
    api();
    rota('/produtos/valvula', '/produtos/:slug', <Produto />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Válvula 4"' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Material\s+Aço inox/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Pressão/ })).not.toBeInTheDocument();
    expect(await screen.findByText('Excelente.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar para pedir cotação' })).toHaveAttribute('href', '/login');
  });
  test('produto retirado: mensagem clara (404), sem erro técnico', async () => {
    api();
    rota('/produtos/nao-existe', '/produtos/:slug', <Produto />);
    expect(await screen.findByText('Este produto já não está disponível.')).toBeInTheDocument();
  });
  test('linhasTecnicas ignora vazios e junta as dimensões só se existirem as três', () => {
    const t = (s) => s;
    expect(linhasTecnicas({ length: 1, width: 2 }, t)).toEqual([]);
    expect(linhasTecnicas({ length: 1, width: 2, height: 3, brand: 'X' }, t)).toEqual([['Marca', 'X'], ['Dimensões (C × L × A)', '1 × 2 × 3']]);
  });
});

describe('Fornecedoras', () => {
  test('diretório com a fornecedora verificada e os números reais; pesquisa sem acentos', async () => {
    api();
    rota('/fornecedoras?q=fornecedora', '/fornecedoras', <Fornecedoras />);
    expect(await screen.findByRole('link', { name: 'Fornecedora Teste, Lda' })).toHaveAttribute('href', '/fornecedoras/F1');
    expect(screen.getByText('2 produtos e serviços ativos')).toBeInTheDocument();
  });
  test('perfil: os produtos dela (filtrados no cliente) e 404 amigável', async () => {
    api({ itens: [P1, P2, { ...P1, id: 'p3', slug: 'outra', name: 'De outra empresa', supplierId: 'F2', supplier: { ...F, id: 'F2' } }] });
    const { unmount } = rota('/fornecedoras/F1', '/fornecedoras/:id', <Fornecedora />);
    expect(await screen.findByRole('heading', { name: 'Válvula 4"' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'De outra empresa' })).not.toBeInTheDocument();
    unmount();
    rota('/fornecedoras/XX', '/fornecedoras/:id', <Fornecedora />);
    expect(await screen.findByText('Esta fornecedora não está publicada.')).toBeInTheDocument();
  });
});

describe('Comparação', () => {
  test('vazia: explica como começar', async () => {
    api();
    rota('/comparar', '/comparar', <Comparar />);
    expect(await screen.findByText('Ainda não escolheu nada para comparar.')).toBeInTheDocument();
  });
  test('quadro com a união das linhas reais, «—» onde falta, e retirar um item', async () => {
    api();
    window.localStorage.setItem('kixima.comparar', JSON.stringify(['valvula', 'inspecao']));
    rota('/comparar', '/comparar', <Comparar />);
    const quadro = await screen.findByRole('table');
    await within(quadro).findByRole('columnheader', { name: /Inspeção UT/ });
    expect(within(quadro).getByRole('row', { name: /Material\s+Aço inox\s+—/ })).toBeInTheDocument();
    expect(within(quadro).getByRole('row', { name: /Prazo de entrega\s+—\s+5 dias/ })).toBeInTheDocument();
    fireEvent.click(within(quadro).getAllByRole('button', { name: 'Remover' })[0]);
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('kixima.comparar'))).toEqual(['inspecao']));
  });
  test('item entretanto retirado do catálogo sai da comparação com aviso', async () => {
    api();
    window.localStorage.setItem('kixima.comparar', JSON.stringify(['valvula', 'desapareceu']));
    rota('/comparar', '/comparar', <Comparar />);
    expect(await screen.findByText(/já não está no catálogo/)).toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('kixima.comparar'))).toEqual(['valvula']));
  });
});
