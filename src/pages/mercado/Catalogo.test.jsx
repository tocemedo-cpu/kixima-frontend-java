// src/pages/mercado/Catalogo.test.jsx
// O catálogo público só mostra o que a API devolve — e diz-o com honestidade quando a API falha ou não tem nada.
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../../i18n';

const apiGet = vi.fn();
vi.mock('../../api/client', () => ({ api: { get: (...a) => apiGet(...a) } }));

// eslint-disable-next-line import/first
import Catalogo from './Catalogo';
// eslint-disable-next-line import/first
import { BarraComparacao } from './componentes';
// eslint-disable-next-line import/first
import { MercadoProvider } from './MercadoContexto';

const FORNECEDORA = { id: 'F1', name: 'Fornecedora Teste, Lda', verified: true, logoUrl: null };
const PRODUTOS = [
  { id: 'p1', slug: 'valvula', name: 'Válvula 4"', kind: 'PRODUTO', category: 'Válvulas', unitPrice: '850000', currency: 'AOA', imageUrl: '/catalog/x.jpg', supplier: FORNECEDORA, supplierId: 'F1', city: 'Luanda', country: 'Angola', rating: 4.8, reviewCount: 28, leadTimeDays: 15 },
  { id: 'p2', slug: 'inspecao', name: 'Inspeção UT', kind: 'SERVICO', category: 'Inspeção & Ensaios', unitPrice: null, currency: 'AOA', imageUrl: null, supplier: FORNECEDORA, supplierId: 'F1', rating: 0, reviewCount: 0 },
];
const FACETAS = { categories: [{ name: 'Válvulas', count: 1 }, { name: 'Inspeção & Ensaios', count: 1 }], kinds: [{ name: 'PRODUTO', count: 1 }, { name: 'SERVICO', count: 1 }], countries: [{ name: 'Angola', count: 2 }], certifications: [], priceBounds: { min: 1, max: 2 } };

function responder(items = PRODUTOS) {
  apiGet.mockImplementation((url) => {
    if (url.endsWith('/search')) return Promise.resolve({ items, total: items.length, page: 1, pages: 1, limit: 24 });
    if (url.endsWith('/facets')) return Promise.resolve(FACETAS);
    return Promise.reject(new Error('inesperado ' + url));
  });
}

function montar(inicial = '/produtos') {
  return render(
    <MemoryRouter initialEntries={[inicial]}>
      <I18nProvider>
        <MercadoProvider>
          <Routes><Route path="/produtos" element={<><Catalogo /><BarraComparacao /></>} /></Routes>
        </MercadoProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => { apiGet.mockReset(); window.localStorage.clear(); });

describe('Catálogo público', () => {
  test('mostra os produtos reais, o preço quando existe e «sob cotação» quando não; sem foto há marcador, nunca imagem inventada', async () => {
    responder();
    montar();
    const valvula = (await screen.findByRole('heading', { name: 'Válvula 4"' })).closest('article');
    expect(within(valvula).getByText(/850\s?000,00 Kz/)).toBeInTheDocument();
    expect(within(valvula).getByText(/Verificada/)).toBeInTheDocument();
    const inspecao = screen.getByRole('heading', { name: 'Inspeção UT' }).closest('article');
    expect(within(inspecao).getByText('Preço sob cotação')).toBeInTheDocument();
    expect(within(inspecao).getByText('Sem fotografia')).toBeInTheDocument();
    expect(within(inspecao).queryByText(/Kz/)).not.toBeInTheDocument();
    expect(valvula.querySelector('img')).toHaveAttribute('src', '/catalog/x.jpg');
  });

  test('só usa os endpoints PÚBLICOS (nunca os que exigem sessão)', async () => {
    responder();
    montar();
    await screen.findByRole('heading', { name: 'Válvula 4"' });
    for (const [url] of apiGet.mock.calls) expect(url).toMatch(/^\/api\/public\/catalog\//);
  });

  test('API em baixo: aviso honesto e nenhum cartão', async () => {
    apiGet.mockRejectedValue(new Error('rede'));
    montar();
    expect(await screen.findByText('O catálogo está indisponível neste momento.')).toBeInTheDocument();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  test('sem resultados: diz-o e oferece limpar', async () => {
    responder([]);
    montar('/produtos?q=nada');
    expect(await screen.findByText('Nenhum resultado para esta pesquisa.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Limpar filtros' }).length).toBeGreaterThan(0);
  });

  test('escolher uma categoria refaz o pedido com esse filtro', async () => {
    responder();
    montar();
    await screen.findByRole('heading', { name: 'Válvula 4"' });
    fireEvent.click(await screen.findByRole('radio', { name: /Válvulas/ }));
    await waitFor(() => expect(apiGet.mock.calls.some(([u, p]) => u.endsWith('/search') && p.category === 'Válvulas')).toBe(true));
  });

  test('comparar: a barra aparece, limita a 4 e a escolha fica guardada no browser', async () => {
    responder();
    montar();
    await screen.findByRole('heading', { name: 'Válvula 4"' });
    expect(screen.queryByRole('region', { name: 'Comparação de produtos' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /Comparar.*Válvula 4"/ }));
    expect(await screen.findByText(/1 selecionados/)).toBeInTheDocument();
    expect(screen.getByText('Escolha pelo menos 2 para comparar.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /Comparar.*Inspeção UT/ }));
    expect(await screen.findByRole('link', { name: 'Comparar' })).toHaveAttribute('href', '/comparar');
    expect(JSON.parse(window.localStorage.getItem('kixima.comparar'))).toEqual(['valvula', 'inspecao']);
  });
});
