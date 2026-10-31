// src/auth/CadastroRota.test.jsx
// Até a KIXIMA aprovar a empresa, a conta só tem o cadastro: o resto das rotas manda para /onboarding.
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../i18n';
import { cadastroPendente, homeDe } from '../domain';

let sessao;
vi.mock('./AuthContext', () => ({ useAuth: () => sessao }));
/* eslint-disable import/first */
import { RequireAuth, RequireRole } from './RequireAuth';
/* eslint-enable import/first */

const painel = (user, caminho) => {
  sessao = { user, loading: false, sessaoIndeterminada: false, refreshUser: vi.fn() };
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <I18nProvider>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/onboarding" element={<p>cadastro</p>} />
            <Route path="/seguranca" element={<p>segurança</p>} />
            <Route element={<RequireRole role="COMPRADOR" />}>
              <Route path="/comprador" element={<p>painel do comprador</p>} />
            </Route>
            <Route path="/empresa" element={<p>painel da empresa</p>} />
          </Route>
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
};

describe('estado do cadastro', () => {
  test('cadastroPendente / homeDe', () => {
    expect(cadastroPendente(null)).toBe(false);
    expect(cadastroPendente({ role: 'ADMIN_SISTEMA', companyStatus: null })).toBe(false);
    expect(cadastroPendente({ role: 'COMPANY_ADMIN', companyStatus: 'APROVADA' })).toBe(false);
    for (const s of ['RASCUNHO', 'PENDENTE', 'REJEITADA']) expect(cadastroPendente({ role: 'COMPANY_ADMIN', companyStatus: s })).toBe(true);
    expect(homeDe({ role: 'COMPANY_ADMIN', companyStatus: 'PENDENTE' })).toBe('/onboarding');
    expect(homeDe({ role: 'COMPANY_ADMIN', companyStatus: 'APROVADA' })).toBe('/empresa');
    expect(homeDe({ role: 'FORNECEDOR' })).toBe('/fornecedor');
  });
});

describe('RequireAuth com a empresa por aprovar', () => {
  test.each(['RASCUNHO', 'PENDENTE', 'REJEITADA'])('%s: qualquer rota de negócio volta ao cadastro', (companyStatus) => {
    painel({ role: 'COMPANY_ADMIN', companyStatus }, '/empresa');
    expect(screen.getByText('cadastro')).toBeInTheDocument();
    expect(screen.queryByText('painel da empresa')).not.toBeInTheDocument();
  });

  test('o cadastro e a segurança da conta continuam acessíveis', () => {
    painel({ role: 'COMPANY_ADMIN', companyStatus: 'RASCUNHO' }, '/seguranca');
    expect(screen.getByText('segurança')).toBeInTheDocument();
  });

  test('aprovada: o painel do papel abre normalmente', () => {
    painel({ role: 'COMPANY_ADMIN', companyStatus: 'APROVADA' }, '/empresa');
    expect(screen.getByText('painel da empresa')).toBeInTheDocument();
  });

  test('sem empresa (Admin do Sistema) nada muda', () => {
    painel({ role: 'ADMIN_SISTEMA', companyStatus: null }, '/empresa');
    expect(screen.getByText('painel da empresa')).toBeInTheDocument();
  });
});
