// src/pages/shared/Onboarding.jsx
// Painel inicial e cadastro progressivo da empresa. A conta já existe (e o email está confirmado); aqui o administrador
// preenche, em etapas e ao seu ritmo, os MESMOS dados e documentos que o cadastro sempre exigiu: empresa e NIF,
// contactos e endereço, documentos de credenciamento (certidão comercial, alvará, licença ANPG nas Prestadoras),
// apólice de seguro (Prestadoras) e logótipo. Cada etapa guarda no servidor — sair e voltar retoma onde ficou, e o que
// já foi enviado não se pede outra vez. Só a submissão aplica as regras de negócio completas; a aprovação é da KIXIMA.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { cadastroPendente, homeDe, formatDateTime } from '../../domain';
import Logo from '../../components/Logo';
import { Field } from '../../components/Common';
import { useI18n } from '../../i18n';
import { SeletorDeFundo } from '../../tema/TemaContext';
import {
  DOC_APOLICE, DOC_LOGOTIPO, enviarDocumento, guardarCadastro, obterCadastro, submeterCadastro, validarFicheiro,
} from '../../api/onboarding';
import './onboarding.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REFRESCO_MS = 30000;

const ROTULOS_PASSO = {
  empresa: 'Empresa',
  contactos: 'Contactos e endereço',
  documentos: 'Documentos',
  apolice: 'Apólice de seguro',
  revisao: 'Revisão e submissão',
};

/** Estado do servidor -> campos de texto do formulário (sempre strings, para os inputs controlados). */
function formDe(d) {
  const s = (v) => (v === null || v === undefined ? '' : String(v));
  const e = d.empresa || {};
  const a = d.apolice || {};
  return {
    name: s(e.name), taxId: s(e.taxId), employees: s(e.employees), annualRevenueUsd: s(e.annualRevenueUsd),
    contactEmail: s(e.contactEmail), contactPhone: s(e.contactPhone), address: s(e.address), city: s(e.city), province: s(e.province),
    insurer: s(a.insurer), policyNumber: s(a.policyNumber), coverageAmount: s(a.coverageAmount), policyCurrency: s(a.currency) || 'AOA',
    policyValidFrom: s(a.validFrom), policyValidUntil: s(a.validUntil),
  };
}

const CAMPOS_DO_PASSO = {
  empresa: ['name', 'taxId', 'employees', 'annualRevenueUsd'],
  contactos: ['contactEmail', 'contactPhone', 'address', 'city', 'province'],
  apolice: ['insurer', 'policyNumber', 'coverageAmount', 'policyCurrency', 'policyValidFrom', 'policyValidUntil'],
};

/** Validação por etapa (as mesmas regras do servidor, para avisar antes de enviar). Devolve { campo: mensagem }. */
function validarPasso(chave, f, d, t) {
  const e = {};
  if (chave === 'empresa') {
    if (f.name.trim().length < 2) e.name = t('Indique o nome legal da empresa.');
    if (f.taxId.trim().length < 3) e.taxId = t('Indique o NIF da empresa.');
    if (f.employees.trim() !== '' && !(Number.isInteger(Number(f.employees)) && Number(f.employees) >= 0)) e.employees = t('Use um número inteiro igual ou superior a 0.');
    if (f.annualRevenueUsd.trim() !== '' && !(Number(f.annualRevenueUsd) >= 0)) e.annualRevenueUsd = t('Use um valor igual ou superior a 0.');
  }
  if (chave === 'contactos') {
    if (!EMAIL.test(f.contactEmail.trim())) e.contactEmail = t('Indique um email de contacto válido.');
  }
  if (chave === 'documentos') {
    (d.documentos || []).filter((x) => x.required && !x.uploaded).forEach((x) => { e[x.type] = t('Anexe o documento: {doc}.', { doc: t(x.label) }); });
  }
  if (chave === 'apolice') {
    if (!f.insurer.trim()) e.insurer = t('Indique a seguradora.');
    if (!f.policyNumber.trim()) e.policyNumber = t('Indique o número da apólice.');
    if (!(Number(f.coverageAmount) > 0)) e.coverageAmount = t('Indique a cobertura (valor positivo).');
    if (!f.policyValidFrom) e.policyValidFrom = t('Indique a data de início da validade.');
    if (!f.policyValidUntil) e.policyValidUntil = t('Indique a data de fim da validade.');
    if (!d.apolice?.documentUrl) e[DOC_APOLICE] = t('Anexe o documento da apólice de seguro (Fornecedor→KIXIMA).');
  }
  return e;
}

function Estado({ data }) {
  const { t } = useI18n();
  const tons = { RASCUNHO: 'neutral', PENDENTE: 'pending', REJEITADA: 'danger', APROVADA: 'success' };
  const rotulos = { RASCUNHO: 'Rascunho', PENDENTE: 'Pendente de aprovação', REJEITADA: 'Rejeitado', APROVADA: 'Aprovado' };
  return <span className={`badge badge-${tons[data.status] || 'neutral'}`}>{t(rotulos[data.status] || data.status)}</span>;
}

function Faixa({ data }) {
  const { t } = useI18n();
  if (data.status === 'PENDENTE') {
    return (
      <div className="banner banner-warn" role="status">
        <strong>{t('Cadastro em análise.')}</strong>{' '}
        {data.submittedAt ? t('Submetido em {data}.', { data: formatDateTime(data.submittedAt) }) : ''}{' '}
        {t('A equipa KIXIMA vai rever os dados e os documentos. Avisamos por email quando houver decisão; até lá as funcionalidades da plataforma ficam bloqueadas.')}
      </div>
    );
  }
  if (data.status === 'REJEITADA') {
    return (
      <div className="banner banner-error" role="alert">
        <strong>{t('O cadastro foi rejeitado.')}</strong>{' '}
        {data.rejectionReason ? <>{t('Motivo:')} {data.rejectionReason}. </> : null}
        {t('Corrija o que for preciso e volte a submeter — os dados que já preencheu estão guardados.')}
      </div>
    );
  }
  return (
    <div className="banner banner-warn" role="status">
      <strong>{t('Falta completar o perfil da empresa.')}</strong>{' '}
      {t('Preencha as etapas abaixo e submeta o cadastro para análise. Pode guardar e continuar mais tarde; até à aprovação as funcionalidades da plataforma ficam bloqueadas.')}
    </div>
  );
}

function Linha({ rotulo, valor }) {
  const { t } = useI18n();
  return (
    <div className="ob-linha">
      <dt>{t(rotulo)}</dt>
      <dd>{valor || <span className="ob-vazio">{t('Por preencher')}</span>}</dd>
    </div>
  );
}

export default function Onboarding() {
  const { user, logout, refreshUser } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [passo, setPasso] = useState(0);
  const [erros, setErros] = useState({});
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [aGuardar, setAGuardar] = useState(false);
  const [aSubmeter, setASubmeter] = useState(false);
  const [aEnviar, setAEnviar] = useState([]); // tipos de documento a enviar neste momento
  // Envios em fila, pela ordem escolhida: cada resposta traz o estado completo do cadastro, e se duas chegassem fora de
  // ordem a mais antiga apagava o documento enviado pela outra.
  const fila = useRef(Promise.resolve());
  const [guardadoParaDepois, setGuardadoParaDepois] = useState(false);
  const [carregou, setCarregou] = useState(false);
  const titulo = useRef(null);

  const ehAdmin = user?.role === 'COMPANY_ADMIN';

  const carregar = useCallback(async () => {
    try {
      const d = await obterCadastro();
      setData(d);
      setForm((atual) => atual || formDe(d));
      setErro('');
      return d;
    } catch (err) {
      setErro(err.message);
      return null;
    } finally {
      setCarregou(true);
    }
  }, []);

  useEffect(() => { if (ehAdmin) carregar(); }, [ehAdmin, carregar]);

  // Em análise: vai-se vendo se a KIXIMA já decidiu. Aprovada, a sessão passa a ter o painel completo.
  useEffect(() => {
    if (!data || data.status !== 'PENDENTE') return undefined;
    const id = setInterval(async () => {
      const d = await carregar();
      if (d && d.status !== 'PENDENTE') {
        setForm(formDe(d));
        refreshUser();
      }
    }, REFRESCO_MS);
    return () => clearInterval(id);
  }, [data, carregar, refreshUser]);

  const passos = useMemo(() => {
    const chaves = (data?.etapas || []).map((e) => e.key);
    return [...(chaves.length ? chaves : ['empresa', 'contactos', 'documentos']), 'revisao'];
  }, [data]);

  // Foco no título do passo ao mudar (leitores de ecrã e teclado seguem o fluxo).
  useEffect(() => { titulo.current?.focus(); }, [passo]);

  if (!user) return <Navigate to="/login" replace />;
  // Quem não é o administrador, ou já tem a empresa aprovada, não tem cadastro para fazer.
  if (!ehAdmin || !cadastroPendente(user)) return <Navigate to={homeDe(user)} replace />;

  const mudar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
    setAviso('');
  };

  const chave = passos[passo];
  const editavel = Boolean(data?.editable);
  const concluidas = (data?.etapas || []).filter((e) => e.complete).length + (data?.podeSubmeter ? 1 : 0);
  const percentagem = Math.round((concluidas / passos.length) * 100);

  async function guardarPasso(c) {
    const campos = CAMPOS_DO_PASSO[c];
    if (!campos) return true;
    setAGuardar(true);
    setErro('');
    try {
      const payload = {};
      campos.forEach((k) => { payload[k] = form[k]; });
      const d = await guardarCadastro(payload);
      setData(d);
      return true;
    } catch (err) {
      setErro(err.message);
      return false;
    } finally {
      setAGuardar(false);
    }
  }

  async function continuar() {
    const e = validarPasso(chave, form, data, t);
    setErros(e);
    if (Object.keys(e).length) { setErro(t('Corrija os campos assinalados para continuar.')); return; }
    setErro('');
    if (await guardarPasso(chave)) setPasso((p) => Math.min(p + 1, passos.length - 1));
  }

  async function guardarEContinuarDepois() {
    setAviso('');
    if (await guardarPasso(chave)) setGuardadoParaDepois(true);
  }

  async function enviar(tipo, ficheiro, soImagem = false) {
    if (!ficheiro) return;
    const msg = validarFicheiro(ficheiro, { soImagem });
    if (msg) { setErros((e) => ({ ...e, [tipo]: t(msg) })); return; }
    setAEnviar((l) => [...l, tipo]);
    setErro('');
    setErros((e) => ({ ...e, [tipo]: undefined }));
    const tarefa = fila.current.then(() => enviarDocumento(tipo, ficheiro));
    fila.current = tarefa.catch(() => {});
    try {
      setData(await tarefa);
    } catch (err) {
      setErros((e) => ({ ...e, [tipo]: err.message }));
    } finally {
      setAEnviar((l) => { const i = l.indexOf(tipo); return i < 0 ? l : [...l.slice(0, i), ...l.slice(i + 1)]; });
    }
  }

  async function submeter() {
    setASubmeter(true);
    setErro('');
    try {
      const d = await submeterCadastro();
      setData(d);
      setForm(formDe(d));
      refreshUser();
    } catch (err) {
      setErro(err.message);
    } finally {
      setASubmeter(false);
    }
  }

  const cabecalho = (
    <header className="ob-topo">
      <Logo size={20} mark={40} light />
      <div className="ob-topo-dir">
        <SeletorDeFundo compacto />
        <span className="ob-conta">{user.name}</span>
        <button type="button" className="btn btn-ghost pequeno" onClick={logout}>{t('Sair')}</button>
      </div>
    </header>
  );

  if (!carregou || !data || !form) {
    return (
      <div className="ob">
        {cabecalho}
        <main className="ob-main"><p className="loading-text" role="status">{erro || t('A carregar o cadastro…')}</p></main>
      </div>
    );
  }

  if (guardadoParaDepois) {
    return (
      <div className="ob">
        {cabecalho}
        <main className="ob-main ob-estreito">
          <section className="ob-card" aria-labelledby="ob-guardado">
            <h1 id="ob-guardado" ref={titulo} tabIndex={-1}>{t('Cadastro guardado')}</h1>
            <p>{t('Os dados e os documentos ficam guardados. Quando voltar a entrar, retoma exatamente onde ficou.')}</p>
            <div className="ob-acoes">
              <button type="button" className="btn btn-accent" onClick={() => setGuardadoParaDepois(false)}>{t('Continuar agora')}</button>
              <button type="button" className="btn btn-ghost" onClick={logout}>{t('Sair da conta')}</button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const ehPrestadora = data.type === 'FORNECEDOR';
  const empresaNome = data.empresa?.name;

  return (
    <div className="ob">
      {cabecalho}
      <main className="ob-main">
        <div className="ob-titulo">
          <div>
            <p className="ob-sup">{ehPrestadora ? t('Prestadora') : t('Operadora')}</p>
            <h1 ref={titulo} tabIndex={-1}>{empresaNome || t('Cadastro da empresa')}</h1>
          </div>
          <Estado data={data} />
        </div>

        <Faixa data={data} />

        {!editavel ? (
          <section className="ob-card" aria-labelledby="ob-resumo">
            <h2 id="ob-resumo">{t('Resumo do cadastro submetido')}</h2>
            <Resumo data={data} />
            <div className="ob-acoes">
              <button type="button" className="btn btn-ghost" onClick={async () => { const d = await carregar(); if (d && d.status !== 'PENDENTE') { setForm(formDe(d)); refreshUser(); } }}>
                {t('Atualizar estado')}
              </button>
            </div>
          </section>
        ) : (
          <>
            <div className="ob-progresso" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentagem} aria-label={t('Progresso do cadastro')}>
              <div className="ob-progresso-barra" style={{ width: `${percentagem}%` }} />
            </div>
            <p className="ob-progresso-txt" aria-live="polite">
              {t('Etapa {n} de {total}', { n: passo + 1, total: passos.length })} · {percentagem}% {t('concluído')}
            </p>

            <div className="ob-corpo">
              <nav className="ob-passos" aria-label={t('Etapas do cadastro')}>
                <ol>
                  {passos.map((c, i) => {
                    const feita = c === 'revisao' ? data.podeSubmeter : data.etapas.find((e) => e.key === c)?.complete;
                    return (
                      <li key={c}>
                        <button type="button" className={`ob-passo${i === passo ? ' on' : ''}${feita ? ' feito' : ''}`} aria-current={i === passo ? 'step' : undefined}
                          onClick={() => { setErro(''); setPasso(i); }}>
                          <span className="ob-passo-n" aria-hidden="true">{feita ? '✓' : i + 1}</span>
                          <span>{t(ROTULOS_PASSO[c])}</span>
                          {feita ? <span className="ob-sr"> — {t('concluída')}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              <section className="ob-card" aria-labelledby="ob-passo-titulo">
                <h2 id="ob-passo-titulo">{t(ROTULOS_PASSO[chave])}</h2>

                {chave === 'empresa' ? (
                  <>
                    <p className="ob-ajuda">{t('A identificação legal da empresa, tal como consta na certidão comercial.')}</p>
                    <Campo id="name" rotulo="Nome legal da empresa" obrigatorio valor={form.name} erro={erros.name} onChange={mudar} autoComplete="organization" />
                    <Campo id="taxId" rotulo="NIF" obrigatorio valor={form.taxId} erro={erros.taxId} onChange={mudar} />
                    <div className="grid-cols grid-2">
                      <Campo id="employees" rotulo="Nº de trabalhadores" tipo="number" min="0" valor={form.employees} erro={erros.employees} onChange={mudar} />
                      <Campo id="annualRevenueUsd" rotulo="Volume de negócios anual (USD)" tipo="number" min="0" step="1000" valor={form.annualRevenueUsd} erro={erros.annualRevenueUsd} onChange={mudar} />
                    </div>
                    <p className="ob-ajuda">
                      {t('Serve para classificar a dimensão da empresa e o plano aplicável. Empresas de grande dimensão subscrevem o plano PRO.')}{' '}
                      <a href="/planos" target="_blank" rel="noreferrer" className="ob-lnk">{t('Ver planos')}</a>
                    </p>
                  </>
                ) : null}

                {chave === 'contactos' ? (
                  <>
                    <p className="ob-ajuda">{t('Como a KIXIMA e as outras empresas contactam a sua.')}</p>
                    <Campo id="contactEmail" rotulo="Email de contacto da empresa" obrigatorio tipo="email" valor={form.contactEmail} erro={erros.contactEmail} onChange={mudar} />
                    <div className="grid-cols grid-2">
                      <Campo id="contactPhone" rotulo="Telefone (opcional)" tipo="tel" valor={form.contactPhone} onChange={mudar} />
                      <Campo id="address" rotulo="Morada (opcional)" valor={form.address} onChange={mudar} autoComplete="street-address" />
                    </div>
                    <div className="grid-cols grid-2">
                      <Campo id="city" rotulo="Cidade (opcional)" valor={form.city} onChange={mudar} />
                      <Campo id="province" rotulo="Província (opcional)" valor={form.province} onChange={mudar} />
                    </div>
                    <div className="ob-doc">
                      <div>
                        <strong>{t('Logótipo (opcional)')}</strong>
                        <p className="ob-ajuda">{t('PNG ou JPG, até 10 MB.')}</p>
                        {erros[DOC_LOGOTIPO] ? <small className="error-text" role="alert">{erros[DOC_LOGOTIPO]}</small> : null}
                      </div>
                      {data.empresa?.logoUrl ? <img className="ob-logo" src={data.empresa.logoUrl} alt={t('Logótipo da empresa')} /> : null}
                      <Anexar id={DOC_LOGOTIPO} etiqueta={data.empresa?.logoUrl ? 'Substituir' : 'Escolher imagem'} aceita="image/*" ocupado={aEnviar.includes(DOC_LOGOTIPO)} onFicheiro={(f) => enviar(DOC_LOGOTIPO, f, true)} />
                    </div>
                  </>
                ) : null}

                {chave === 'documentos' ? (
                  <>
                    <p className="ob-ajuda">{t('Documentos de credenciamento exigidos à sua empresa. PDF ou imagem, até 10 MB cada. O que já enviou fica guardado.')}</p>
                    {data.documentos.map((d) => (
                      <div className="ob-doc" key={d.type}>
                        <div>
                          <strong>{t(d.label)} <span className="ob-obrig" aria-hidden="true">*</span></strong>
                          {d.uploaded
                            ? <p className="ob-ok">✓ <a href={d.fileUrl} target="_blank" rel="noreferrer">{d.originalName}</a>{d.uploadedAt ? ` · ${formatDateTime(d.uploadedAt)}` : ''}</p>
                            : <p className="ob-ajuda">{t('Ainda não enviado.')}</p>}
                          {erros[d.type] ? <small className="error-text" role="alert">{erros[d.type]}</small> : null}
                        </div>
                        <Anexar id={d.type} etiqueta={d.uploaded ? 'Substituir' : 'Escolher ficheiro'} aceita="application/pdf,image/*" ocupado={aEnviar.includes(d.type)} onFicheiro={(f) => enviar(d.type, f)} rotuloAcessivel={t(d.label)} />
                      </div>
                    ))}
                  </>
                ) : null}

                {chave === 'apolice' ? (
                  <>
                    <p className="ob-ajuda">{t('Obrigatória no credenciamento de prestadoras — garante a cobertura das transações realizadas na plataforma.')}</p>
                    <div className="grid-cols grid-2">
                      <Campo id="insurer" rotulo="Seguradora" obrigatorio valor={form.insurer} erro={erros.insurer} onChange={mudar} />
                      <Campo id="policyNumber" rotulo="Nº da apólice" obrigatorio valor={form.policyNumber} erro={erros.policyNumber} onChange={mudar} />
                    </div>
                    <div className="grid-cols grid-2">
                      <Campo id="coverageAmount" rotulo="Cobertura" obrigatorio tipo="number" min="0" step="any" valor={form.coverageAmount} erro={erros.coverageAmount} onChange={mudar} />
                      <Field label={t('Moeda')}>
                        {(id) => (
                          <select id={id} value={form.policyCurrency} onChange={(e) => mudar('policyCurrency', e.target.value)}>
                            <option value="AOA">AOA</option><option value="USD">USD</option><option value="EUR">EUR</option>
                          </select>
                        )}
                      </Field>
                    </div>
                    <div className="grid-cols grid-2">
                      <Campo id="policyValidFrom" rotulo="Válida de" obrigatorio tipo="date" valor={form.policyValidFrom} erro={erros.policyValidFrom} onChange={mudar} />
                      <Campo id="policyValidUntil" rotulo="Válida até" obrigatorio tipo="date" valor={form.policyValidUntil} erro={erros.policyValidUntil} onChange={mudar} />
                    </div>
                    <div className="ob-doc">
                      <div>
                        <strong>{t('Documento da apólice')} <span className="ob-obrig" aria-hidden="true">*</span></strong>
                        {data.apolice?.documentUrl
                          ? <p className="ob-ok">✓ <a href={data.apolice.documentUrl} target="_blank" rel="noreferrer">{data.apolice.documentName || t('Documento enviado')}</a></p>
                          : <p className="ob-ajuda">{t('Ainda não enviado.')}</p>}
                        {erros[DOC_APOLICE] ? <small className="error-text" role="alert">{erros[DOC_APOLICE]}</small> : null}
                      </div>
                      <Anexar id={DOC_APOLICE} etiqueta={data.apolice?.documentUrl ? 'Substituir' : 'Escolher ficheiro'} aceita="application/pdf,image/*" ocupado={aEnviar.includes(DOC_APOLICE)} onFicheiro={(f) => enviar(DOC_APOLICE, f)} rotuloAcessivel={t('Documento da apólice')} />
                    </div>
                  </>
                ) : null}

                {chave === 'revisao' ? (
                  <>
                    <p className="ob-ajuda">{t('Reveja os dados. Depois de submeter, a equipa KIXIMA analisa o cadastro e não poderá alterá-lo até haver decisão.')}</p>
                    <Resumo data={data} />
                    {data.pendencias.length ? (
                      <div className="banner banner-warn" role="alert">
                        <strong>{t('Ainda falta:')}</strong>
                        <ul className="ob-pend">
                          {data.etapas.filter((e) => e.missing.length).map((e) => (
                            <li key={e.key}>
                              <button type="button" className="ob-link" onClick={() => setPasso(passos.indexOf(e.key))}>{t(ROTULOS_PASSO[e.key])}</button>: {e.missing.map((m) => t(m)).join(', ')}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <p className="ob-ajuda">{data.empresa.termsAccepted ? t('Termos de Uso e Política de Privacidade aceites no registo da conta.') : t('Os Termos de Uso ainda não foram aceites.')}</p>
                  </>
                ) : null}

                {erro ? <p className="error-text" role="alert" style={{ marginTop: 12 }}>{erro}</p> : null}
                {aviso ? <p className="helptext" role="status" style={{ marginTop: 12 }}>{aviso}</p> : null}

                <div className="ob-acoes ob-rodape">
                  <button type="button" className="btn btn-ghost" disabled={passo === 0 || aGuardar} onClick={() => { setErro(''); setPasso((p) => Math.max(0, p - 1)); }}>{t('Voltar')}</button>
                  {chave !== 'documentos' && chave !== 'revisao' ? (
                    <button type="button" className="btn btn-ghost" disabled={aGuardar} onClick={guardarEContinuarDepois}>{t('Guardar e continuar mais tarde')}</button>
                  ) : (
                    <button type="button" className="btn btn-ghost" onClick={() => setGuardadoParaDepois(true)}>{t('Continuar mais tarde')}</button>
                  )}
                  {chave === 'revisao' ? (
                    <button type="button" className="btn btn-accent" disabled={!data.podeSubmeter || aSubmeter} onClick={submeter}>
                      {aSubmeter ? t('A submeter…') : t('Submeter para aprovação')}
                    </button>
                  ) : (
                    <button type="button" className="btn btn-accent" disabled={aGuardar} onClick={continuar}>
                      {aGuardar ? t('A guardar…') : t('Guardar e continuar')}
                    </button>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Campo({ id, rotulo, valor, onChange, erro, obrigatorio = false, tipo = 'text', ...rest }) {
  const { t } = useI18n();
  return (
    <Field label={t(rotulo)} obrigatorio={obrigatorio}>
      {(fid) => (
        <>
          <input id={fid} type={tipo} value={valor} onChange={(e) => onChange(id, e.target.value)} aria-invalid={Boolean(erro)} aria-describedby={erro ? `${fid}-erro` : undefined} {...rest} />
          {erro ? <small id={`${fid}-erro`} className="error-text" role="alert">{erro}</small> : null}
        </>
      )}
    </Field>
  );
}

function Anexar({ id, etiqueta, aceita, ocupado, onFicheiro, rotuloAcessivel }) {
  const { t } = useI18n();
  return (
    <label className={`btn btn-ghost pequeno ob-anexar${ocupado ? ' ocupado' : ''}`}>
      <input type="file" accept={aceita} disabled={ocupado} aria-label={`${t(etiqueta)}${rotuloAcessivel ? ` — ${rotuloAcessivel}` : ''}`} data-doc={id}
        onChange={(e) => { onFicheiro(e.target.files[0]); e.target.value = ''; }} />
      <span aria-hidden="true">{ocupado ? t('A enviar…') : t(etiqueta)}</span>
    </label>
  );
}

/** Dados do cadastro tal como estão guardados (só leitura), reaproveitado na revisão e no estado «em análise». */
function Resumo({ data }) {
  const { t } = useI18n();
  const e = data.empresa;
  const a = data.apolice;
  return (
    <dl className="ob-resumo">
      <Linha rotulo="Nome legal da empresa" valor={e.name} />
      <Linha rotulo="NIF" valor={e.taxId} />
      <Linha rotulo="Email de contacto da empresa" valor={e.contactEmail} />
      <Linha rotulo="Telefone" valor={e.contactPhone} />
      <Linha rotulo="Morada" valor={[e.address, e.city, e.province].filter(Boolean).join(', ')} />
      <Linha rotulo="Nº de trabalhadores" valor={e.employees !== null && e.employees !== undefined ? String(e.employees) : ''} />
      <div className="ob-linha">
        <dt>{t('Documentos')}</dt>
        <dd>
          <ul className="ob-docs">
            {data.documentos.map((d) => (
              <li key={d.type} className={d.uploaded ? 'ok' : 'falta'}>{d.uploaded ? '✓' : '✗'} {t(d.label)}{d.uploaded ? ` — ${d.originalName}` : ` — ${t('em falta')}`}</li>
            ))}
            {a ? <li className={a.documentUrl ? 'ok' : 'falta'}>{a.documentUrl ? '✓' : '✗'} {t('Documento da apólice')}{a.documentUrl ? (a.documentName ? ` — ${a.documentName}` : '') : ` — ${t('em falta')}`}</li> : null}
          </ul>
        </dd>
      </div>
      {a ? <Linha rotulo="Apólice de seguro" valor={[a.insurer, a.policyNumber && `n.º ${a.policyNumber}`, a.coverageAmount && `${a.coverageAmount} ${a.currency || ''}`.trim()].filter(Boolean).join(' · ')} /> : null}
    </dl>
  );
}
