// src/pages/mercado/PublicLayout.jsx
// Moldura das páginas públicas do marketplace: cabeçalho comercial (marca, pesquisa, categorias, conta e cotação), o
// conteúdo da rota e o rodapé institucional completo. Quem tem sessão também pode navegar aqui (vê «O meu painel»).
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { homeDe } from '../../domain';
import { useI18n } from '../../i18n';
import { SeletorDeFundo } from '../../tema/TemaContext';
import { Brand, CorporateFooter, LanguageDropdown } from '../corporate/CorporateChrome';
import '../corporate/bancada-front.css';
import './mercado.css';
import { BarraComparacao } from './componentes';
import { MercadoProvider, useMercado } from './MercadoContexto';
import { destinoCotacao, urlCategoria } from './mercadoDados';

const ESCOPOS = [['tudo', 'Tudo'], ['PRODUTO', 'Produtos'], ['SERVICO', 'Serviços'], ['fornecedoras', 'Fornecedoras']];

function Pesquisa() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(search).get('q') || '');
  const [escopo, setEscopo] = useState('tudo');

  function enviar(e) {
    e.preventDefault();
    const termo = q.trim();
    const sp = new URLSearchParams();
    if (termo) sp.set('q', termo);
    if (escopo === 'fornecedoras') navigate(`/fornecedoras${sp.size ? `?${sp}` : ''}`);
    else {
      if (escopo !== 'tudo') sp.set('kind', escopo);
      navigate(`/produtos${sp.size ? `?${sp}` : ''}`);
    }
  }

  return (
    <form className="pm-pesquisa" role="search" onSubmit={enviar}>
      <label className="pm-sr" htmlFor="pm-escopo">{t('Onde pesquisar')}</label>
      <select id="pm-escopo" value={escopo} onChange={(e) => setEscopo(e.target.value)}>
        {ESCOPOS.map(([v, rotulo]) => <option key={v} value={v}>{t(rotulo)}</option>)}
      </select>
      <label className="pm-sr" htmlFor="pm-q">{t('Pesquisar produtos, serviços ou fornecedores…')}</label>
      <input id="pm-q" type="search" value={q} maxLength={120} onChange={(e) => setQ(e.target.value)}
        placeholder={t('Pesquisar válvulas, inspeção, tubos, EPI, fornecedoras…')} />
      <button type="submit" className="pm-pesquisa-ir">{t('Pesquisar')}</button>
    </form>
  );
}

function MenuCategorias() {
  const { t } = useI18n();
  const { estado, globais } = useMercado();
  const ref = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => { if (ref.current) ref.current.open = false; }, [pathname]);
  const categorias = globais?.categories || [];
  return (
    <details className="pm-cats" ref={ref}>
      <summary>{t('Todas as categorias')}</summary>
      <div className="pm-cats-painel">
        {categorias.length
          ? categorias.map((c) => <Link key={c.name} to={urlCategoria(c.name)}>{c.name} <small>{c.count}</small></Link>)
          : <p className="pm-nota">{estado === 'carregando' ? t('A carregar…') : t('Sem categorias publicadas de momento.')}</p>}
      </div>
    </details>
  );
}

function Cabecalho() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const cotacao = destinoCotacao(user);
  return (
    <header className="pm-topo">
      <div className="pm-topo-faixa"><div className="pm-in"><span>{t('E-MARKETPLACE B2B · SOURCE-TO-PAY')}</span></div></div>
      <div className="pm-in pm-topo-linha">
        <Brand inverse compact />
        <Pesquisa />
        <div className="pm-acoes">
          <div className="pm-conta">
            {cotacao ? <Link className="pm-acao-link" to={cotacao}>{t('Pedir cotação')}</Link> : null}
            {loading ? null : user
              ? <Link className="btn pequeno" to={homeDe(user)}>{t('O meu painel')}</Link>
              : (<><Link className="pm-acao-link" to="/login">{t('Entrar')}</Link><Link className="btn pequeno" to="/cadastro">{t('Registar empresa')}</Link></>)}
          </div>
          <div className="pm-pref"><SeletorDeFundo compacto /><LanguageDropdown /></div>
        </div>
      </div>
      <nav className="pm-in pm-nav" aria-label={t('Navegação principal')}>
        <MenuCategorias />
        <Link to="/produtos">{t('Produtos e serviços')}</Link>
        <Link to="/produtos?kind=SERVICO">{t('Serviços')}</Link>
        <Link to="/fornecedoras">{t('Fornecedoras')}</Link>
        <Link to="/planos">{t('Planos')}</Link>
        <Link to="/sobre">{t('Sobre a KIXIMA')}</Link>
      </nav>
      <div className="fio" aria-hidden="true" />
    </header>
  );
}

export default function PublicLayout() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <MercadoProvider>
      <div className="kx pm">
        <a className="pm-saltar" href="#pm-conteudo">{t('Saltar para o conteúdo')}</a>
        <Cabecalho />
        <main id="pm-conteudo" tabIndex={-1}><Outlet /></main>
        <BarraComparacao />
        <CorporateFooter />
      </div>
    </MercadoProvider>
  );
}
