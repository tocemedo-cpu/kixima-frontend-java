// src/pages/mercado/MercadoHome.jsx
// Homepage do marketplace (rota «/» para quem não tem sessão). Tudo o que é catálogo vem da API pública: categorias com
// contagens, produtos mais vistos, adicionados recentemente, serviços e fornecedoras verificadas. Uma secção sem dados
// reais NÃO aparece (sem enchimento); se a API estiver em baixo, aparece o aviso honesto em vez de produtos inventados.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fornecedoras as lerFornecedoras, pesquisar } from '../../api/publicCatalog';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Icon, categoryVisual } from '../../components/icons';
import { formatNumber, homeDe } from '../../domain';
import { useI18n } from '../../i18n';
import imagemEnergia from '../../assets/corporate/kixima-energy-mining.webp';
import { CartaoProduto, EstadoErro, Esqueletos, useTitulo } from './componentes';
import { useMercado } from './MercadoContexto';
import { destinoCotacao, urlCategoria, urlFornecedora } from './mercadoDados';

const SETORES = ['Oil & Gas', 'Energia', 'Mineração', 'Construção', 'Logística'];

function Seccao({ titulo, ligacao, rotuloLigacao, children, id }) {
  return (
    <section className="pm-sec pm-in" aria-labelledby={id}>
      <div className="pm-sec-cab"><h2 id={id}>{titulo}</h2>{ligacao ? <Link to={ligacao}>{rotuloLigacao} →</Link> : null}</div>
      {children}
    </section>
  );
}

/** Secções de produtos: lê da API e entrega `items` (vazio = a secção não aparece). */
function usePesquisa(params) {
  const [estado, setEstado] = useState({ carregando: true, items: [], erro: false });
  useEffect(() => {
    let vivo = true;
    pesquisar(params)
      .then((r) => { if (vivo) setEstado({ carregando: false, items: r.items, erro: false }); })
      .catch(() => { if (vivo) setEstado({ carregando: false, items: [], erro: true }); });
    return () => { vivo = false; };
  }, [JSON.stringify(params)]); // eslint-disable-line react-hooks/exhaustive-deps
  return estado;
}

export default function MercadoHome() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { estado, globais, recarregar } = useMercado();
  const [stats, setStats] = useState(null);
  const [forn, setForn] = useState([]);
  useTitulo(t('Marketplace B2B industrial'));

  const produtos = usePesquisa({ kind: 'PRODUTO', sort: 'solicitados', limit: 10 });
  const servicos = usePesquisa({ kind: 'SERVICO', sort: 'avaliacao', limit: 5 });
  const recentes = usePesquisa({ sort: 'recentes', limit: 14 });

  useEffect(() => {
    api.get('/api/public/stats').then(setStats).catch(() => {});
    lerFornecedoras(4).then(setForn).catch(() => {});
  }, []);

  // Um item aparece numa só prateleira.
  const jaMostrados = new Set([...produtos.items, ...servicos.items].map((p) => p.id));
  const novos = recentes.items.filter((p) => !jaMostrados.has(p.id)).slice(0, 10);

  const categorias = globais?.categories || [];
  const cotacao = destinoCotacao(user);
  const semCatalogo = estado === 'indisponivel' || (produtos.erro && servicos.erro && recentes.erro);
  const numeros = stats ? [
    [stats.empresasVerificadas, t('empresas compradoras verificadas')],
    [stats.fornecedoresQualificados, t('fornecedoras qualificadas')],
    [stats.ordensProcessadas, t('ordens de compra processadas')],
  ].filter(([n]) => Number(n) > 0) : [];

  return (
    <>
      <div className="pm-in pm-heroi">
        <nav className="pm-trilho" aria-label={t('Categorias')}>
          <h2>{t('Categorias')}</h2>
          {categorias.slice(0, 9).map((c) => <Link key={c.name} to={urlCategoria(c.name)}>{c.name} <small>{c.count}</small></Link>)}
          {estado === 'carregando' ? <p className="pm-nota" style={{ padding: '8px 10px' }}>{t('A carregar…')}</p> : null}
          <Link className="pm-ver-todas" to="/produtos">{t('Ver todo o catálogo')} →</Link>
        </nav>

        <div className="pm-banner" style={{ '--pm-banner-img': `url(${imagemEnergia})` }}>
          <p className="pm-eyebrow">{t('E-MARKETPLACE B2B · SOURCE-TO-PAY')}</p>
          <h1>{t('Procurement industrial para Oil & Gas, energia e mineração em Angola')}</h1>
          <p>{t('Equipamentos, materiais e serviços técnicos de fornecedoras verificadas, com cotação, aprovação e pagamento rastreáveis.')}</p>
          <ul className="pm-fichas" aria-label={t('Setores')}>{SETORES.map((s) => <li key={s}>{t(s)}</li>)}</ul>
          <div className="pm-banner-acoes">
            <Link className="btn escuro" to="/produtos">{t('Explorar o catálogo')}</Link>
            <Link className="btn escuro-alt" to="/fornecedoras">{t('Ver fornecedoras')}</Link>
          </div>
        </div>

        <aside className="pm-rfq" aria-labelledby="pm-rfq-t">
          <h2 id="pm-rfq-t">{t('Peça cotações')}</h2>
          <p>{t('Diga o que precisa e receba propostas com preço e prazo de várias fornecedoras.')}</p>
          <ol><li>{t('Descreva o que precisa')}</li><li>{t('Compare as propostas')}</li><li>{t('Emita a ordem de compra')}</li></ol>
          {cotacao ? <Link className="btn" to={cotacao}>{user ? t('Pedir cotação') : t('Entrar para pedir cotação')}</Link>
            : <Link className="btn" to={homeDe(user)}>{t('O meu painel')}</Link>}
          {!user ? <Link className="btn alt" to="/cadastro">{t('Registar a minha empresa')}</Link> : null}
          {!user ? <p className="pm-nota">{t('Para enviar um pedido precisa de uma conta empresarial.')}</p> : null}
        </aside>
      </div>

      {semCatalogo ? <div className="pm-in pm-sec"><EstadoErro onRetry={recarregar} /></div> : null}

      {categorias.length ? (
        <Seccao id="pm-cat" titulo={t('Categorias industriais')} ligacao="/produtos" rotuloLigacao={t('Ver todas')}>
          <div className="pm-categorias">
            {categorias.slice(0, 12).map((c) => {
              const v = categoryVisual(c.name);
              return (
                <Link key={c.name} className="pm-categoria" to={urlCategoria(c.name)} style={{ '--cat-de': v.from, '--cat-para': v.to }}>
                  <span className="pm-categoria-ic"><Icon name={v.icon} size={24} /></span>
                  <span><strong>{c.name}</strong><span>{t('{n} itens', { n: formatNumber(c.count) })}</span></span>
                </Link>
              );
            })}
          </div>
        </Seccao>
      ) : null}

      {produtos.carregando ? <div className="pm-sec pm-in"><Esqueletos n={5} /></div> : null}
      {produtos.items.length ? (
        <Seccao id="pm-mais-vistos" titulo={t('Produtos mais vistos')} ligacao="/produtos?kind=PRODUTO&sort=solicitados" rotuloLigacao={t('Ver todos')}>
          <div className="pm-prateleira">{produtos.items.map((p) => <CartaoProduto key={p.id} p={p} />)}</div>
        </Seccao>
      ) : null}

      {novos.length ? (
        <Seccao id="pm-recentes" titulo={t('Adicionados recentemente')} ligacao="/produtos?sort=recentes" rotuloLigacao={t('Ver todos')}>
          <div className="pm-prateleira">{novos.map((p) => <CartaoProduto key={p.id} p={p} />)}</div>
        </Seccao>
      ) : null}

      {forn.length ? (
        <Seccao id="pm-forn" titulo={t('Fornecedoras e prestadoras de serviços verificadas')} ligacao="/fornecedoras" rotuloLigacao={t('Ver todas')}>
          <div className="pm-fornecedoras">
            {forn.map((f) => (
              <article className="pm-fornecedora" key={f.id}>
                <h3><span className="pm-logo" aria-hidden="true">{f.name.trim().charAt(0).toUpperCase()}</span><Link to={urlFornecedora(f.id)}>{f.name}</Link></h3>
                <p><span className="pm-verif">✔ {t('Verificada')}</span>{[f.city, f.country].filter(Boolean).length ? ` · ${[f.city, f.country].filter(Boolean).join(', ')}` : ''}</p>
                <p>{t('{n} produtos e serviços ativos', { n: formatNumber(f.productCount || 0) })}</p>
              </article>
            ))}
          </div>
        </Seccao>
      ) : null}

      {servicos.items.length ? (
        <Seccao id="pm-servicos" titulo={t('Serviços técnicos')} ligacao="/produtos?kind=SERVICO" rotuloLigacao={t('Ver todos')}>
          <div className="pm-prateleira">{servicos.items.map((p) => <CartaoProduto key={p.id} p={p} />)}</div>
        </Seccao>
      ) : null}

      <div className="pm-faixa-cotacao">
        <div className="pm-in">
          <div>
            <h2>{t('Não encontrou? Peça cotações a várias fornecedoras')}</h2>
            <ul className="pm-passos"><li>{t('Descreva o que precisa')}</li><li>{t('Receba propostas com preço e prazo')}</li><li>{t('Compare e emita a ordem de compra')}</li></ul>
          </div>
          {cotacao ? <Link className="btn escuro" to={cotacao}>{user ? t('Pedir cotação') : t('Entrar para pedir cotação')}</Link> : null}
        </div>
      </div>

      <Seccao id="pm-confianca" titulo={t('Porquê a KIXIMA')}>
        <div className="pm-confianca">
          <div><strong>{t('Fornecedoras verificadas')}</strong><p>{t('A due diligence é feita uma vez; o selo ✔ só existe para fornecedoras aprovadas.')}</p></div>
          <div><strong>{t('Aprovação e controlo')}</strong><p>{t('Cada ordem de compra passa pela aprovação do administrador da sua empresa.')}</p></div>
          <div><strong>{t('Pagamento rastreável')}</strong><p>{stats?.pagamentoSlaDias ? t('Faturação com pagamento e comprovativo registados; prazo de pagamento de {n} dias.', { n: stats.pagamentoSlaDias }) : t('Faturação com pagamento e comprovativo registados.')}</p></div>
          {numeros.map(([n, rotulo]) => <div key={rotulo}><span className="pm-num">{formatNumber(n)}</span><p>{rotulo}</p></div>)}
          <div><strong>{t('Conheça a KIXIMA')}</strong><p><Link to="/sobre">{t('Sobre a KIXIMA')}</Link> · <Link to="/sobre#avaliacoes">{t('Avaliações verificadas')}</Link> · <Link to="/faq">{t('Perguntas frequentes')}</Link></p></div>
        </div>
      </Seccao>
    </>
  );
}
