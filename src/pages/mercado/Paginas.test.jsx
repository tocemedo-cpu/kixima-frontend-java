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
    expect(await screen.findByRole('heading', { name: 'Produtos mais vistos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Serviços técnicos' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Válvula 4"' })).toHaveLength(1);
    expect(screen.queryByRole('heading', { name: 'Adicionados recentemente' })).not.toBeInTheDocument();
  });
  test('«ordens processadas: 0» não é apresentado como número (só estatísticas > 0)', async () => {
    api();
    rota('/', '/', <MercadoHome />);
    expect(await screen.findByText('empresas compradoras verificadas')).toBeInTheDocument();
    expect(screen.queryByText('ordens de compra processadas')).not.toBeInTheDocument();
  });
  test('sem produtos publicados: as prateleiras desaparecem (sem enchimento)', async () => {
    api({ itens: [] });
    rota('/', '/', <MercadoHome />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    await screen.findByText('Peça cotações');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Produtos mais vistos' })).not.toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Serviços técnicos' })).not.toBeInTheDocument();
  });
  test('API em baixo: aviso honesto e nenhum produto', async () => {
    api({ erro: true });
    rota('/', '/', <MercadoHome />);
    expect(await screen.findByText('O catálogo está indisponível neste momento.')).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
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
