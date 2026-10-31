// src/pages/shared/Cadastro.test.jsx
// Registo em dois passos, confirmação do email e cadastro empresarial por etapas.
// A API está simulada ao nível do módulo src/api/onboarding.js: o que se testa é o comportamento do ecrã
// (etapas, validação, guardar/recuperar, estados), não o servidor — esse tem os seus testes no backend.
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../../i18n';
import { TemaProvider } from '../../tema/TemaContext';

const m = vi.hoisted(() => ({
  registar: vi.fn(), confirmarEmail: vi.fn(), reenviarConfirmacao: vi.fn(), obterCadastro: vi.fn(), guardarCadastro: vi.fn(),
  enviarDocumento: vi.fn(), submeterCadastro: vi.fn(),
}));
vi.mock('../../api/onboarding', async (original) => ({ ...(await original()), ...m }));

let sessao;
vi.mock('../../auth/AuthContext', () => ({ useAuth: () => sessao }));

/* eslint-disable import/first */
import Register from './Register';
import VerifyEmail from './VerifyEmail';
import Onboarding from './Onboarding';
/* eslint-enable import/first */

const DOCS_OPERADORA = [
  { type: 'CERTIDAO_COMERCIAL', label: 'Certidão Comercial', required: true, uploaded: false, originalName: null, fileUrl: null, uploadedAt: null },
  { type: 'ALVARA_COMERCIAL', label: 'Alvará Comercial', required: true, uploaded: false, originalName: null, fileUrl: null, uploadedAt: null },
];

function cadastro(extra = {}) {
  return {
    status: 'RASCUNHO', type: 'CLIENTE', editable: true, submittedAt: null, approvedAt: null, rejectedAt: null, rejectionReason: null,
    empresa: { name: null, taxId: null, contactEmail: 'ana@empresa.co.ao', contactPhone: null, address: null, city: null, province: null, country: 'Angola', employees: null, annualRevenueUsd: null, logoUrl: null, termsAccepted: true },
    apolice: null,
    documentos: DOCS_OPERADORA,
    etapas: [
      { key: 'empresa', complete: false, missing: ['Nome da empresa', 'NIF'] },
      { key: 'contactos', complete: true, missing: [] },
      { key: 'documentos', complete: false, missing: ['Certidão Comercial', 'Alvará Comercial'] },
    ],
    pendencias: ['Nome da empresa', 'NIF', 'Certidão Comercial', 'Alvará Comercial'],
    podeSubmeter: false,
    ...extra,
  };
}

const completo = () => cadastro({
  empresa: { ...cadastro().empresa, name: 'Petrolífera do Sul', taxId: 'AO-123' },
  documentos: DOCS_OPERADORA.map((d) => ({ ...d, uploaded: true, originalName: `${d.type}.pdf`, uploadedAt: '2026-10-31T10:00:00Z' })),
  etapas: [{ key: 'empresa', complete: true, missing: [] }, { key: 'contactos', complete: true, missing: [] }, { key: 'documentos', complete: true, missing: [] }],
  pendencias: [], podeSubmeter: true,
});

function montar(caminho, padrao, el) {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <I18nProvider><TemaProvider>
        <Routes>
          <Route path={padrao} element={el} />
          <Route path="/login" element={<p>página de login</p>} />
        </Routes>
      </TemaProvider></I18nProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  window.localStorage.clear();
  sessao = {
    user: { id: 'u1', name: 'Ana', role: 'COMPANY_ADMIN', companyStatus: 'RASCUNHO', companyType: 'CLIENTE' },
    logout: vi.fn(), refreshUser: vi.fn(),
  };
});

describe('Registo em dois passos', () => {
  test('escolhe o tipo, cria a conta só com nome, email e senha e pede para verificar o email', async () => {
    m.registar.mockResolvedValue({ ok: true });
    const u = userEvent.setup();
    montar('/cadastro', '/cadastro', <Register />);

    expect(screen.getByText('Passo 1 de 3')).toBeInTheDocument();
    const continuar = screen.getByRole('button', { name: 'Continuar' });
    expect(continuar).toBeDisabled(); // sem tipo escolhido não avança
    await u.click(screen.getByRole('radio', { name: /Prestadora/ }));
    await u.click(continuar);

    expect(screen.getByText('Passo 2 de 3')).toBeInTheDocument();
    // Só três campos de dados (+ termos): nada de NIF, documentos ou morada nesta fase.
    expect(screen.queryByLabelText(/NIF/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Morada/)).not.toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(m.registar).not.toHaveBeenCalled(); // validação antes de chamar o servidor

    await u.type(screen.getByLabelText(/O seu nome/), 'Ana Administradora');
    await u.type(screen.getByLabelText(/Email profissional/), 'ana@empresa.co.ao');
    await u.type(screen.getByLabelText(/Senha/), 'SenhaForte@2026xyz');
    await u.click(screen.getByRole('checkbox'));
    await u.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => expect(m.registar).toHaveBeenCalledWith({
      type: 'FORNECEDOR', name: 'Ana Administradora', email: 'ana@empresa.co.ao', password: 'SenhaForte@2026xyz', termsAccepted: true,
    }));
    expect(await screen.findByRole('heading', { name: 'Verifique o seu email' })).toBeInTheDocument();
    expect(screen.getByText('ana@empresa.co.ao')).toBeInTheDocument();
    expect(screen.getByText('Passo 3 de 3')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Reenviar email de confirmação' }));
    expect(m.reenviarConfirmacao).toHaveBeenCalledWith('ana@empresa.co.ao');
  });

  test('o tipo vindo da ligação (?tipo=) salta a escolha e a senha curta é recusada com mensagem clara', async () => {
    const u = userEvent.setup();
    montar('/cadastro?tipo=CLIENTE', '/cadastro', <Register />);
    expect(screen.getByRole('heading', { name: 'Crie a sua conta' })).toBeInTheDocument();
    expect(screen.getByText('Operadora')).toBeInTheDocument();
    await u.type(screen.getByLabelText(/Senha/), 'curta');
    await u.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText('A senha tem de ter pelo menos 12 caracteres.')).toBeInTheDocument();
  });

  test('o erro do servidor (ex.: email já registado) aparece junto ao formulário', async () => {
    m.registar.mockRejectedValue(new Error('Já existe uma conta com este email.'));
    const u = userEvent.setup();
    montar('/cadastro?tipo=CLIENTE', '/cadastro', <Register />);
    await u.type(screen.getByLabelText(/O seu nome/), 'Ana');
    await u.type(screen.getByLabelText(/Email profissional/), 'ana@empresa.co.ao');
    await u.type(screen.getByLabelText(/Senha/), 'SenhaForte@2026xyz');
    await u.click(screen.getByRole('checkbox'));
    await u.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText('Já existe uma conta com este email.')).toBeInTheDocument();
  });
});

describe('Confirmação do email', () => {
  test('link válido confirma e leva a entrar', async () => {
    m.confirmarEmail.mockResolvedValue({ ok: true, email: 'ana@empresa.co.ao' });
    montar('/verificar-email/tok123', '/verificar-email/:token', <VerifyEmail />);
    expect(await screen.findByRole('heading', { name: 'Email confirmado' })).toBeInTheDocument();
    expect(m.confirmarEmail).toHaveBeenCalledWith('tok123');
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
  });

  test('link inválido explica o problema e deixa pedir outro email', async () => {
    m.confirmarEmail.mockRejectedValue(new Error('Link de confirmação inválido ou expirado. Peça um novo email de confirmação.'));
    m.reenviarConfirmacao.mockResolvedValue({ ok: true });
    const u = userEvent.setup();
    montar('/verificar-email/velho', '/verificar-email/:token', <VerifyEmail />);
    expect(await screen.findByRole('alert')).toHaveTextContent('inválido ou expirado');
    await u.type(screen.getByLabelText('Email da conta'), 'ana@empresa.co.ao');
    await u.click(screen.getByRole('button', { name: 'Pedir novo email de confirmação' }));
    expect(m.reenviarConfirmacao).toHaveBeenCalledWith('ana@empresa.co.ao');
  });
});

describe('Cadastro por etapas', () => {
  test('mostra o estado, o progresso e retoma com o que já foi guardado', async () => {
    m.obterCadastro.mockResolvedValue(cadastro({
      empresa: { ...cadastro().empresa, name: 'Petrolífera do Sul', taxId: 'AO-123' },
      etapas: [{ key: 'empresa', complete: true, missing: [] }, { key: 'contactos', complete: true, missing: [] }, { key: 'documentos', complete: false, missing: ['Certidão Comercial'] }],
      documentos: [{ ...DOCS_OPERADORA[0] }, { ...DOCS_OPERADORA[1], uploaded: true, originalName: 'alvara.pdf', uploadedAt: '2026-10-31T10:00:00Z' }],
    }));
    montar('/onboarding', '/onboarding', <Onboarding />);

    expect(await screen.findByRole('heading', { name: 'Petrolífera do Sul' })).toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByText(/Falta completar o perfil da empresa/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progresso do cadastro' })).toHaveAttribute('aria-valuenow', '50'); // 2 de 4 etapas
    expect(screen.getByText(/Etapa 1 de 4/)).toBeInTheDocument();
    // O que já foi preenchido volta preenchido — não se pede outra vez.
    expect(screen.getByLabelText(/Nome legal da empresa/)).toHaveValue('Petrolífera do Sul');
    expect(screen.getByLabelText(/NIF/)).toHaveValue('AO-123');

    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /Documentos/ }));
    expect(screen.getByText(/alvara\.pdf/)).toBeInTheDocument();
    expect(screen.getAllByText('Ainda não enviado.')).toHaveLength(1);
  });

  test('não avança com campos obrigatórios por preencher e guarda a etapa ao continuar', async () => {
    m.obterCadastro.mockResolvedValue(cadastro());
    m.guardarCadastro.mockImplementation(async (campos) => cadastro({ empresa: { ...cadastro().empresa, name: campos.name, taxId: campos.taxId } }));
    const u = userEvent.setup();
    montar('/onboarding', '/onboarding', <Onboarding />);
    await screen.findByLabelText(/Nome legal da empresa/);

    await u.click(screen.getByRole('button', { name: 'Guardar e continuar' }));
    expect(await screen.findByText('Indique o nome legal da empresa.')).toBeInTheDocument();
    expect(screen.getByText('Indique o NIF da empresa.')).toBeInTheDocument();
    expect(m.guardarCadastro).not.toHaveBeenCalled();
    expect(screen.getByText(/Etapa 1 de 4/)).toBeInTheDocument();

    await u.type(screen.getByLabelText(/Nome legal da empresa/), 'Petrolífera do Sul');
    await u.type(screen.getByLabelText(/NIF/), 'AO-123');
    await u.click(screen.getByRole('button', { name: 'Guardar e continuar' }));

    await waitFor(() => expect(m.guardarCadastro).toHaveBeenCalledWith(expect.objectContaining({ name: 'Petrolífera do Sul', taxId: 'AO-123' })));
    expect(await screen.findByText(/Etapa 2 de 4/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email de contacto da empresa/)).toHaveValue('ana@empresa.co.ao');
  });

  test('«guardar e continuar mais tarde» guarda sem exigir o resto e confirma', async () => {
    m.obterCadastro.mockResolvedValue(cadastro());
    m.guardarCadastro.mockResolvedValue(cadastro({ empresa: { ...cadastro().empresa, name: 'Petrolífera do Sul' } }));
    const u = userEvent.setup();
    montar('/onboarding', '/onboarding', <Onboarding />);
    await u.type(await screen.findByLabelText(/Nome legal da empresa/), 'Petrolífera do Sul');
    await u.click(screen.getByRole('button', { name: 'Guardar e continuar mais tarde' }));

    expect(await screen.findByRole('heading', { name: 'Cadastro guardado' })).toBeInTheDocument();
    expect(m.guardarCadastro).toHaveBeenCalledWith(expect.objectContaining({ name: 'Petrolífera do Sul', taxId: '' }));
    await u.click(screen.getByRole('button', { name: 'Sair da conta' }));
    expect(sessao.logout).toHaveBeenCalled();
  });

  test('envia documentos de imediato, recusa formatos inválidos e mostra o que foi enviado', async () => {
    m.obterCadastro.mockResolvedValue(cadastro());
    m.enviarDocumento.mockResolvedValue(cadastro({
      documentos: [{ ...DOCS_OPERADORA[0], uploaded: true, originalName: 'certidao.pdf', uploadedAt: '2026-10-31T10:00:00Z' }, DOCS_OPERADORA[1]],
    }));
    const u = userEvent.setup();
    montar('/onboarding', '/onboarding', <Onboarding />);
    await screen.findByLabelText(/Nome legal da empresa/);
    await u.click(screen.getByRole('button', { name: /Documentos/ }));

    const campoCertidao = screen.getByLabelText(/Escolher ficheiro — Certidão Comercial/);
    fireEvent.change(campoCertidao, { target: { files: [new File(['x'], 'notas.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('Documento inválido — use PDF ou imagem (PNG/JPG).')).toBeInTheDocument();
    expect(m.enviarDocumento).not.toHaveBeenCalled();

    fireEvent.change(campoCertidao, { target: { files: [new File(['%PDF'], 'certidao.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(m.enviarDocumento).toHaveBeenCalledWith('CERTIDAO_COMERCIAL', expect.any(File)));
    expect(await screen.findByText(/certidao\.pdf/)).toBeInTheDocument();

    // Continuar sem o alvará: avisa qual falta.
    await u.click(screen.getByRole('button', { name: 'Guardar e continuar' }));
    expect(await screen.findByText('Anexe o documento: Alvará Comercial.')).toBeInTheDocument();
  });

  test('prestadora: aparece a etapa da apólice e a licença ANPG; operadora não as tem', async () => {
    const docs = [...DOCS_OPERADORA, { type: 'LICENCA_ANPG', label: 'Licença da ANPG', required: true, uploaded: false, originalName: null, fileUrl: null, uploadedAt: null }];
    m.obterCadastro.mockResolvedValue(cadastro({
      type: 'FORNECEDOR', documentos: docs,
      apolice: { insurer: 'Ensa', policyNumber: 'AP-1', coverageAmount: '5000000', currency: 'USD', validFrom: '2026-01-01', validUntil: '2027-01-01', documentUrl: '/api/uploads/apolice.pdf', documentName: 'apolice.pdf' },
      etapas: [
        { key: 'empresa', complete: true, missing: [] }, { key: 'contactos', complete: true, missing: [] },
        { key: 'documentos', complete: false, missing: ['Licença da ANPG'] }, { key: 'apolice', complete: true, missing: [] },
      ],
    }));
    const u = userEvent.setup();
    montar('/onboarding', '/onboarding', <Onboarding />);
    await screen.findByRole('heading', { name: 'Cadastro da empresa' });
    expect(screen.getByText('Prestadora')).toBeInTheDocument();
    expect(screen.getByText(/Etapa 1 de 5/)).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: /Documentos/ }));
    expect(screen.getByText('Licença da ANPG', { selector: 'strong' })).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: /Apólice de seguro/ }));
    expect(screen.getByLabelText(/Seguradora/)).toHaveValue('Ensa'); // recuperado do rascunho
    expect(screen.getByLabelText(/Nº da apólice/)).toHaveValue('AP-1');
    expect(screen.getByText(/apolice\.pdf/)).toBeInTheDocument();
  });

  test('só submete quando está completo; ao submeter passa a «pendente de aprovação» sem formulário', async () => {
    m.obterCadastro.mockResolvedValue(completo());
    m.submeterCadastro.mockResolvedValue({ ...completo(), status: 'PENDENTE', editable: false, submittedAt: '2026-10-31T11:00:00Z', podeSubmeter: false });
    const u = userEvent.setup();
    montar('/onboarding', '/onboarding', <Onboarding />);
    await screen.findByRole('heading', { name: 'Petrolífera do Sul' });
    await u.click(screen.getByRole('button', { name: /Revisão e submissão/ }));

    const resumo = screen.getByText('NIF', { selector: 'dt' }).closest('dl');
    expect(within(resumo).getByText('AO-123')).toBeInTheDocument();
    expect(screen.getByText(/aceites no registo da conta/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Submeter para aprovação' }));

    await waitFor(() => expect(m.submeterCadastro).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Pendente de aprovação')).toBeInTheDocument();
    expect(screen.getByText(/Cadastro em análise/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nome legal da empresa/)).not.toBeInTheDocument(); // já não é editável
    expect(sessao.refreshUser).toHaveBeenCalled();
  });

  test('incompleto: o botão de submeter está desativado e a revisão diz o que falta, com ligação à etapa', async () => {
    m.obterCadastro.mockResolvedValue(cadastro());
    const u = userEvent.setup();
    montar('/onboarding', '/onboarding', <Onboarding />);
    await screen.findByLabelText(/Nome legal da empresa/);
    await u.click(screen.getByRole('button', { name: /Revisão e submissão/ }));
    expect(screen.getByRole('button', { name: 'Submeter para aprovação' })).toBeDisabled();
    const aviso = screen.getByText('Ainda falta:').closest('div');
    expect(within(aviso).getByText(/Nome da empresa, NIF/)).toBeInTheDocument();
    await u.click(within(aviso).getByRole('button', { name: 'Documentos' }));
    expect(screen.getByRole('heading', { name: 'Documentos' })).toBeInTheDocument();
  });

  test('rejeitado: mostra o motivo da KIXIMA e permite corrigir e voltar a submeter', async () => {
    m.obterCadastro.mockResolvedValue({ ...completo(), status: 'REJEITADA', rejectionReason: 'NIF não confere com a certidão' });
    montar('/onboarding', '/onboarding', <Onboarding />);
    expect(await screen.findByText('Rejeitado')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('NIF não confere com a certidão');
    expect(screen.getByLabelText(/Nome legal da empresa/)).toBeInTheDocument(); // editável outra vez
  });

  test('quem não é o administrador, ou já está aprovado, não vê o cadastro', async () => {
    sessao = { ...sessao, user: { id: 'u2', name: 'Rui', role: 'COMPRADOR', companyStatus: 'APROVADA' } };
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <I18nProvider><TemaProvider><Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/comprador" element={<p>painel do comprador</p>} />
        </Routes></TemaProvider></I18nProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('painel do comprador')).toBeInTheDocument();
    expect(m.obterCadastro).not.toHaveBeenCalled();
  });
});
