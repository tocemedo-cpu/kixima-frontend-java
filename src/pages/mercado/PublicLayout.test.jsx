// src/pages/mercado/PublicLayout.test.jsx
// Cabeçalho do marketplace público: um só botão de preferências (idioma + fundo) e nada de faixa decorativa.
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../../i18n';
import { TemaProvider } from '../../tema/TemaContext';

const apiGet = vi.fn();
vi.mock('../../api/client', () => ({ api: { get: (...a) => apiGet(...a) } }));
let sessao = { user: null, loading: false };
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => sessao }));

/* eslint-disable import/first */
import PublicLayout from './PublicLayout';
/* eslint-enable import/first */

const FACETAS = { categories: [{ name: 'Válvulas', count: 3 }], kinds: [], countries: [], certifications: [], priceBounds: null };

function desenhar() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <I18nProvider><TemaProvider>
        <Routes><Route element={<PublicLayout />}><Route path="/" element={<p>conteúdo</p>} /></Route></Routes>
      </TemaProvider></I18nProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockImplementation((url) => (url.endsWith('/facets') ? Promise.resolve(FACETAS) : Promise.resolve({})));
  window.localStorage.clear();
  sessao = { user: null, loading: false };
});

describe('Cabeçalho público', () => {
  test('idioma e fundo vivem num único botão; o painel só abre a pedido', async () => {
    desenhar();
    const botao = await screen.findByRole('button', { name: /Idioma e aparência/ });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: 'Idioma e aparência' })).not.toBeInTheDocument();
    // Nenhum seletor de fundo nem de idioma solto no cabeçalho.
    expect(screen.queryByRole('group', { name: 'Fundo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(botao);
    const painel = screen.getByRole('dialog', { name: 'Idioma e aparência' });
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(within(painel).getAllByRole('button', { pressed: undefined }).length).toBeGreaterThanOrEqual(6); // 3 idiomas + 3 fundos
    expect(within(painel).getByRole('group', { name: 'Fundo' })).toBeInTheDocument();
  });

  test('escolher outro idioma muda o texto e marca a opção; Esc fecha o painel', async () => {
    desenhar();
    fireEvent.click(await screen.findByRole('button', { name: /Idioma e aparência/ }));
    const painel = screen.getByRole('dialog', { name: 'Idioma e aparência' });
    expect(within(painel).getByRole('button', { name: /Português/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(painel).getByRole('button', { name: /English/ }));
    expect(await screen.findByRole('link', { name: 'Suppliers' })).toBeInTheDocument(); // navegação principal em inglês
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /English/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('clicar fora fecha o painel', async () => {
    desenhar();
    fireEvent.click(await screen.findByRole('button', { name: /Idioma e aparência/ }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('sem sessão: Entrar e Registar empresa; a faixa decorativa do topo já não existe', async () => {
    const { container } = desenhar();
    const cabecalho = await screen.findByRole('banner');
    expect(within(cabecalho).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
    expect(within(cabecalho).getByRole('link', { name: 'Registar empresa' })).toHaveAttribute('href', '/cadastro');
    expect(container.querySelector('.pm-topo-faixa')).toBeNull();
  });
});
