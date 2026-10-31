// src/pages/shared/Register.jsx
// Registo em dois passos. Aqui só se cria a CONTA: o tipo de empresa (Operadora ou Prestadora) e o administrador (nome,
// email profissional e senha). Os dados da empresa e os documentos pedem-se depois, por etapas, em /onboarding —
// com as mesmas exigências de sempre; só mudou o momento. A conta só entra depois de confirmar o email.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthHero from '../../components/AuthHero';
import { Field } from '../../components/Common';
import { registar, reenviarConfirmacao } from '../../api/onboarding';
import { useI18n } from '../../i18n';
import './onboarding.css';

// CLIENTE = Operadora (compra), FORNECEDOR = Prestadora (fornece produtos e serviços) — os valores do backend.
const TIPOS = [
  { value: 'CLIENTE', titulo: 'Operadora', texto: 'Compra produtos e serviços a fornecedoras verificadas.' },
  { value: 'FORNECEDOR', titulo: 'Prestadora', texto: 'Oferece produtos e serviços às operadoras.' },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { t } = useI18n();
  // As ligações «Registar como…» da home trazem ?tipo=CLIENTE|FORNECEDOR: nesse caso a escolha do tipo já está feita.
  const [searchParams] = useSearchParams();
  const tipoParam = searchParams.get('tipo');
  const tipoInicial = TIPOS.some((x) => x.value === tipoParam) ? tipoParam : '';

  const [tipo, setTipo] = useState(tipoInicial);
  const [passo, setPasso] = useState(tipoInicial ? 'conta' : 'tipo');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [termos, setTermos] = useState(false);
  const [erros, setErros] = useState({});
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  const mudar = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  function validar() {
    const e = {};
    if (form.name.trim().length < 2) e.name = t('Indique o seu nome (mínimo 2 caracteres).');
    if (!EMAIL.test(form.email.trim())) e.email = t('Indique um email válido.');
    if (form.password.length < 12) e.password = t('A senha tem de ter pelo menos 12 caracteres.');
    if (!termos) e.termos = t('É necessário aceitar os Termos de Uso e a Política de Privacidade.');
    return e;
  }

  async function criarConta(ev) {
    ev.preventDefault();
    setErro('');
    const e = validar();
    setErros(e);
    if (Object.keys(e).length) return;
    setAEnviar(true);
    try {
      await registar({ type: tipo, name: form.name.trim(), email: form.email.trim(), password: form.password, termsAccepted: true });
      setPasso('enviado');
    } catch (err) {
      setErro(err.message);
    } finally {
      setAEnviar(false);
    }
  }

  async function reenviar() {
    setErro(''); setAviso('');
    try {
      await reenviarConfirmacao(form.email.trim());
      setAviso(t('Se existir uma conta por confirmar com este email, enviámos um novo link de confirmação.'));
    } catch (err) {
      setErro(err.message);
    }
  }

  const escolhido = TIPOS.find((x) => x.value === tipo);
  const numero = { tipo: 1, conta: 2, enviado: 3 }[passo];

  return (
    <div className="login-screen">
      <AuthHero />

      <div className="login-panel">
        <div className="login-card ob-reg">
          <p className="ob-reg-passo" aria-live="polite">{t('Passo {n} de 3', { n: numero })}</p>

          {passo === 'tipo' ? (
            <>
              <h2>{t('Que tipo de empresa é a sua?')}</h2>
              <p>{t('Escolha como vai usar a KIXIMA. Demora poucos minutos — os dados da empresa pedimos depois, por etapas.')}</p>
              <fieldset className="ob-tipos">
                <legend className="ob-sr">{t('Tipo de empresa')}</legend>
                {TIPOS.map((x) => (
                  <label key={x.value} className={`ob-tipo${tipo === x.value ? ' on' : ''}`}>
                    <input type="radio" name="tipo" value={x.value} checked={tipo === x.value} onChange={() => setTipo(x.value)} />
                    <span className="ob-tipo-t">{t(x.titulo)}</span>
                    <span className="ob-tipo-d">{t(x.texto)}</span>
                  </label>
                ))}
              </fieldset>
              <button type="button" className="btn btn-accent btn-lg" disabled={!tipo} onClick={() => setPasso('conta')} style={{ width: '100%', marginTop: 16 }}>
                {t('Continuar')}
              </button>
              <p className="helptext" style={{ marginTop: 16 }}>
                {t('Já tem uma conta?')} <Link to="/login" className="ob-lnk">{t('Entrar')}</Link>
              </p>
            </>
          ) : null}

          {passo === 'conta' ? (
            <>
              <h2>{t('Crie a sua conta')}</h2>
              <p>
                {t('Conta de administrador de uma')} <strong>{t(escolhido?.titulo || '')}</strong>.{' '}
                {!tipoInicial ? <button type="button" className="ob-link" onClick={() => setPasso('tipo')}>{t('Alterar tipo')}</button> : null}
              </p>
              <form onSubmit={criarConta} noValidate>
                <Field label={t('O seu nome')} obrigatorio>
                  {(id) => (<>
                    <input id={id} autoComplete="name" value={form.name} onChange={(e) => mudar('name', e.target.value)} aria-invalid={Boolean(erros.name)} />
                    {erros.name ? <small className="error-text" role="alert">{erros.name}</small> : null}
                  </>)}
                </Field>
                <Field label={t('Email profissional')} obrigatorio>
                  {(id) => (<>
                    <input id={id} type="email" autoComplete="email" value={form.email} onChange={(e) => mudar('email', e.target.value)} aria-invalid={Boolean(erros.email)} />
                    {erros.email ? <small className="error-text" role="alert">{erros.email}</small> : null}
                  </>)}
                </Field>
                <Field label={t('Senha (mín. 12)')} obrigatorio>
                  {(id) => (<>
                    <input id={id} type="password" autoComplete="new-password" value={form.password} onChange={(e) => mudar('password', e.target.value)} aria-invalid={Boolean(erros.password)} />
                    {erros.password ? <small className="error-text" role="alert">{erros.password}</small> : null}
                  </>)}
                </Field>
                <label className="ob-termos">
                  <input type="checkbox" checked={termos} onChange={(e) => setTermos(e.target.checked)} aria-invalid={Boolean(erros.termos)} />
                  <span>
                    {t('Li e aceito, em nome da empresa, os')}{' '}
                    <a href="/termos" target="_blank" rel="noreferrer" className="ob-lnk">{t('Termos de Uso')}</a>{' '}
                    {t('e a')}{' '}
                    <a href="/privacidade" target="_blank" rel="noreferrer" className="ob-lnk">{t('Política de Privacidade')}</a>.
                  </span>
                </label>
                {erros.termos ? <small className="error-text" role="alert">{erros.termos}</small> : null}
                {erro ? <p className="error-text" role="alert" style={{ margin: '12px 0' }}>{erro}</p> : null}
                <button className="btn btn-accent btn-lg" type="submit" disabled={aEnviar} style={{ width: '100%', marginTop: 14 }}>
                  {aEnviar ? t('A criar…') : t('Criar conta')}
                </button>
              </form>
              <p className="helptext" style={{ marginTop: 16 }}>
                {t('Já tem uma conta?')} <Link to="/login" className="ob-lnk">{t('Entrar')}</Link>
              </p>
            </>
          ) : null}

          {passo === 'enviado' ? (
            <>
              <h2>{t('Verifique o seu email')}</h2>
              <p>
                {t('Enviámos um link de confirmação para')} <strong>{form.email.trim()}</strong>.{' '}
                {t('Abra-o para ativar a conta; depois entra e completa o perfil da empresa.')}
              </p>
              <p className="helptext">{t('Não o encontra? Veja a pasta de spam ou peça um novo.')}</p>
              {aviso ? <p className="helptext" role="status" style={{ margin: '10px 0' }}>{aviso}</p> : null}
              {erro ? <p className="error-text" role="alert" style={{ margin: '10px 0' }}>{erro}</p> : null}
              <div className="ob-acoes">
                <button type="button" className="btn btn-ghost" onClick={reenviar}>{t('Reenviar email de confirmação')}</button>
                <Link className="btn btn-ghost" to="/login">{t('Ir para o login')}</Link>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
