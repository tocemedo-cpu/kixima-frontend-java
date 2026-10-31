// src/pages/shared/VerifyEmail.jsx
// Destino do link do email de confirmação (/verificar-email/:token). Confirma a conta e manda entrar; se o link já não
// serve, deixa pedir outro.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AuthHero from '../../components/AuthHero';
import { Field } from '../../components/Common';
import { confirmarEmail, reenviarConfirmacao } from '../../api/onboarding';
import { useI18n } from '../../i18n';
import './onboarding.css';

export default function VerifyEmail() {
  const { t } = useI18n();
  const { token } = useParams();
  const [estado, setEstado] = useState('a-confirmar'); // a-confirmar | ok | erro
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [pedido, setPedido] = useState('');

  useEffect(() => {
    let ativo = true;
    confirmarEmail(token)
      .then((r) => { if (ativo) { setEmail(r.email || ''); setEstado('ok'); } })
      .catch((err) => { if (ativo) { setErro(err.message); setEstado('erro'); } });
    return () => { ativo = false; };
  }, [token]);

  async function pedirNovo(ev) {
    ev.preventDefault();
    setPedido('');
    try {
      await reenviarConfirmacao(email.trim());
      setPedido(t('Se existir uma conta por confirmar com este email, enviámos um novo link de confirmação.'));
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <div className="login-screen">
      <AuthHero />
      <div className="login-panel">
        <div className="login-card ob-reg">
          {estado === 'a-confirmar' ? (
            <>
              <h2>{t('A confirmar o email…')}</h2>
              <p role="status">{t('Um momento.')}</p>
            </>
          ) : null}
          {estado === 'ok' ? (
            <>
              <h2>{t('Email confirmado')}</h2>
              <p>{t('A conta está ativa. Entre para completar o perfil da empresa.')}</p>
              <Link className="btn btn-accent btn-lg" to="/login" style={{ width: '100%', justifyContent: 'center' }}>{t('Entrar')}</Link>
            </>
          ) : null}
          {estado === 'erro' ? (
            <>
              <h2>{t('Não foi possível confirmar')}</h2>
              <p className="error-text" role="alert">{erro}</p>
              <form onSubmit={pedirNovo}>
                <Field label={t('Email da conta')}>
                  {(id) => <input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
                </Field>
                {pedido ? <p className="helptext" role="status" style={{ margin: '10px 0' }}>{pedido}</p> : null}
                <button className="btn btn-accent" type="submit" style={{ width: '100%', marginTop: 8 }}>{t('Pedir novo email de confirmação')}</button>
              </form>
              <p className="helptext" style={{ marginTop: 16 }}><Link to="/login" className="ob-lnk">{t('Ir para o login')}</Link></p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
