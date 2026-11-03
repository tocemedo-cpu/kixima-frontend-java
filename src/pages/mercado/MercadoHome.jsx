// src/pages/mercado/MercadoHome.jsx
// Homepage do marketplace (rota «/» para quem não tem sessão). O catálogo é o protagonista. Abertura em três colunas —
// categorias à esquerda, banner industrial ao centro, pedido de cotação + fornecedoras em destaque à direita — e logo a
// seguir produtos populares (grelha), serviços técnicos, fornecedoras verificadas e categorias industriais. Tudo vem da
// API pública. Uma secção sem dados reais NÃO aparece (sem enchimento), cada pedido tem o seu estado de carregamento, e
// se a API estiver em baixo aparece o aviso honesto em vez de produtos inventados. A coluna de categorias só existe
// quando há categorias (ou enquanto carregam), e o painel de fornecedoras só quando há fornecedoras: nada fica vazio.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fornecedoras as lerFornecedoras, pesquisar } from '../../api/publicCatalog';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Icon, Stars, categoryVisual } from '../../components/icons';
import { formatNumber, homeDe } from '../../domain';
import { useI18n } from '../../i18n';
import imagemEnergia from '../../assets/corporate/kixima-energy-mining.webp';
import { CartaoProduto, EstadoErro, EstadoVazio, Esqueletos, useTitulo } from './componentes';
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

/** Logótipo da fornecedora quando a API o devolve; senão, a inicial do nome (nunca uma imagem inventada). */
function LogoFornecedora({ f }) {
  return f.logoUrl
    ? <img className="pm-logo" src={f.logoUrl} alt="" loading="lazy" />
    : <span className="pm-logo" aria-hidden="true">{f.name.trim().charAt(0).toUpperCase()}</span>;
}

const Grelha = ({ itens }) => <div className="pm-grade pm-grade-grelha">{itens.map((p) => <CartaoProduto key={p.id} p={p} />)}</div>;

/** Coluna de categorias do topo: carrega com esqueletos e só mostra as categorias que a API devolveu. */
function TrilhoCategorias({ categorias, carregando }) {
  const { t } = useI18n();
  return (
    <nav className="pm-trilho" aria-label={t('Categorias')} aria-busy={carregando}>
      <h2>{t('Categorias')}</h2>
      {carregando
        ? Array.from({ length: 8 }, (_, i) => <span key={i} className="pm-trilho-esq" aria-hidden="true" />)
        : categorias.slice(0, 9).map((c) => {
          const v = categoryVisual(c.name);
          return (
            <Link key={c.name} to={urlCategoria(c.name)}>
              <span className="pm-trilho-ic" style={{ '--cat-de': v.from, '--cat-para': v.to }}><Icon name={v.icon} size={14} /></span>
              <span className="pm-trilho-nome">{c.name}</span>
              <small>{c.count}</small>
            </Link>
          );
        })}
      <Link className="pm-ver-todas" to="/produtos">{t('Ver todo o catálogo')} →</Link>
    </nav>
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
  const [forn, setForn] = useState({ carregando: true, items: [] });
  useTitulo(t('Marketplace B2B industrial'));

  const produtos = usePesquisa({ kind: 'PRODUTO', sort: 'solicitados', limit: 12 });
  const servicos = usePesquisa({ kind: 'SERVICO', sort: 'avaliacao', limit: 6 });
  const recentes = usePesquisa({ sort: 'recentes', limit: 14 });

  useEffect(() => {
    api.get('/api/public/stats').then(setStats).catch(() => {});
    lerFornecedoras(8)
      .then((items) => setForn({ carregando: false, items }))
      .catch(() => setForn({ carregando: false, items: [] }));
  }, []);

  // Um item aparece numa só prateleira.
  const jaMostrados = new Set([...produtos.items, ...servicos.items].map((p) => p.id));
  const novos = recentes.items.filter((p) => !jaMostrados.has(p.id)).slice(0, 6);

  const categorias = globais?.categories || [];
  const cotacao = destinoCotacao(user);
  const carregandoCategorias = estado === 'carregando';
  // A coluna de categorias só existe se há o que mostrar (ou enquanto carrega): nunca fica vazia nem deixa um buraco.
  const temTrilho = carregandoCategorias || categorias.length > 0;
  const semCatalogo = estado === 'indisponivel' || (produtos.erro && servicos.erro && recentes.erro);
  const tudoCarregado = !carregandoCategorias && !produtos.carregando && !servicos.carregando && !recentes.carregando && !forn.carregando;
  const catalogoVazio = tudoCarregado && !semCatalogo && !categorias.length && !produtos.items.length
    && !servicos.items.length && !novos.length && !forn.items.length;
  const numeros = stats ? [
    [stats.empresasVerificadas, t('empresas compradoras verificadas')],
    [stats.fornecedoresQualificados, t('fornecedoras qualificadas')],
    [stats.ordensProcessadas, t('ordens de compra processadas')],
  ].filter(([n]) => Number(n) > 0) : [];

  return (
    <>
      <div className={`pm-in pm-heroi${temTrilho ? '' : ' pm-heroi-sem-trilho'}`}>
        {temTrilho ? <TrilhoCategorias categorias={categorias} carregando={carregandoCategorias} /> : null}

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

        <aside className="pm-direita">
          <section className="pm-rfq" aria-labelledby="pm-rfq-t">
            <h2 id="pm-rfq-t">{t('Peça cotações')}</h2>
            <p>{t('Diga o que precisa e receba propostas com preço e prazo de várias fornecedoras.')}</p>
            {cotacao ? <Link className="btn" to={cotacao}>{user ? t('Pedir cotação') : t('Entrar para pedir cotação')}</Link>
              : <Link className="btn" to={homeDe(user)}>{t('O meu painel')}</Link>}
            {!user ? <Link className="btn alt" to="/cadastro">{t('Registar a minha empresa')}</Link> : null}
            {!user ? <p className="pm-nota">{t('Para enviar um pedido precisa de uma conta empresarial.')}</p> : null}
          </section>
          {forn.items.length ? (
            <section className="pm-destaque" aria-labelledby="pm-dest-t">
              <h2 id="pm-dest-t">{t('Fornecedoras em destaque')}</h2>
              <ul>
                {forn.items.slice(0, 3).map((f) => (
                  <li key={f.id}>
                    <LogoFornecedora f={f} />
                    <span>
                      <Link to={urlFornecedora(f.id)}>{f.name}</Link>
                      <small><span className="pm-verif">✔ {t('Verificada')}</span>{[f.city, f.country].filter(Boolean).length ? ` · ${[f.city, f.country].filter(Boolean).join(', ')}` : ''}</small>
                    </span>
                  </li>
                ))}
              </ul>
              <Link className="pm-ver-todas" to="/fornecedoras">{t('Ver todas')} →</Link>
            </section>
          ) : null}
        </aside>
      </div>

      {numeros.length ? (
        <ul className="pm-in pm-numeros" aria-label={t('A KIXIMA em números')}>
          {numeros.map(([n, rotulo]) => <li key={rotulo}><strong>{formatNumber(n)}</strong><span>{rotulo}</span></li>)}
        </ul>
      ) : null}

      {semCatalogo ? <div className="pm-in pm-sec"><EstadoErro onRetry={recarregar} /></div> : null}

      {catalogoVazio ? (
        <div className="pm-in pm-sec">
          <EstadoVazio titulo={t('O catálogo ainda não tem itens publicados.')}
            texto={t('Assim que as fornecedoras verificadas publicarem produtos e serviços, aparecem aqui. Se é fornecedora, registe a sua empresa.')}>
            {!user ? <Link className="btn pequeno" to="/cadastro">{t('Registar a minha empresa')}</Link> : null}
          </EstadoVazio>
        </div>
      ) : null}

      {produtos.carregando ? <div className="pm-sec pm-in"><Esqueletos n={6} /></div> : null}
      {produtos.items.length ? (
        <Seccao id="pm-populares" titulo={t('Produtos populares')} ligacao="/produtos?kind=PRODUTO&sort=solicitados" rotuloLigacao={t('Ver todos')}>
          <Grelha itens={produtos.items} />
        </Seccao>
      ) : null}

      {servicos.items.length ? (
        <Seccao id="pm-servicos" titulo={t('Serviços técnicos')} ligacao="/produtos?kind=SERVICO" rotuloLigacao={t('Ver todos')}>
          <Grelha itens={servicos.items} />
        </Seccao>
      ) : null}

      {forn.items.length ? (
        <Seccao id="pm-forn" titulo={t('Fornecedoras e prestadoras de serviços verificadas')} ligacao="/fornecedoras" rotuloLigacao={t('Ver todas')}>
          <div className="pm-fornecedoras">
            {forn.items.map((f) => {
              const local = [f.city, f.country].filter(Boolean).join(', ');
              const nota = Number(f.rating);
              return (
                <article className="pm-fornecedora" key={f.id}>
                  <h3><LogoFornecedora f={f} /><Link to={urlFornecedora(f.id)}>{f.name}</Link></h3>
                  <p><span className="pm-verif">✔ {t('Verificada')}</span>{local ? ` · ${local}` : ''}</p>
                  <p>{t('{n} produtos e serviços ativos', { n: formatNumber(f.productCount || 0) })}</p>
                  {nota > 0 ? <p className="pm-aval"><Stars value={nota} size={12} /> <b>{nota.toFixed(1).replace('.', ',')}</b></p> : null}
                </article>
              );
            })}
          </div>
        </Seccao>
      ) : null}

      {carregandoCategorias ? (
        <div className="pm-sec pm-in"><div className="pm-categorias" role="status" aria-label={t('A carregar…')}>
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="pm-categoria pm-categoria-esq" aria-hidden="true" />)}
        </div></div>
      ) : null}
      {categorias.length ? (
        <Seccao id="pm-cat" titulo={t('Categorias industriais')} ligacao="/produtos" rotuloLigacao={t('Ver todas')}>
          <div className="pm-categorias">
            {categorias.slice(0, 12).map((c) => {
              const v = categoryVisual(c.name);
              return (
                <Link key={c.name} className="pm-categoria" to={urlCategoria(c.name)} style={{ '--cat-de': v.from, '--cat-para': v.to }}>
                  <span className="pm-categoria-ic"><Icon name={v.icon} size={22} /></span>
                  <span><strong>{c.name}</strong><span>{t('{n} itens', { n: formatNumber(c.count) })}</span></span>
                </Link>
              );
            })}
          </div>
        </Seccao>
      ) : null}

      {novos.length ? (
        <Seccao id="pm-recentes" titulo={t('Adicionados recentemente')} ligacao="/produtos?sort=recentes" rotuloLigacao={t('Ver todos')}>
          <Grelha itens={novos} />
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
          <div><strong>{t('Conheça a KIXIMA')}</strong><p><Link to="/sobre">{t('Sobre a KIXIMA')}</Link> · <Link to="/sobre#avaliacoes">{t('Avaliações verificadas')}</Link> · <Link to="/faq">{t('Perguntas frequentes')}</Link></p></div>
        </div>
      </Seccao>
    </>
  );
}
