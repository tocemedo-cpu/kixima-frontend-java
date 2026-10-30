// src/pages/mercado/Fornecedoras.jsx
// Diretório público de fornecedoras verificadas (/fornecedoras) e perfil de uma fornecedora (/fornecedoras/:id).
// A API só publica fornecedoras APROVADAS. O perfil mostra a identidade e os números reais e o catálogo dela,
// obtido da pesquisa pública e filtrado aqui (a API não tem filtro por fornecedora).
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fornecedoras as lerFornecedoras, produtosDeFornecedora } from '../../api/publicCatalog';
import { Stars } from '../../components/icons';
import { formatNumber } from '../../domain';
import { useI18n } from '../../i18n';
import { CartaoProduto, EstadoErro, EstadoVazio, Esqueletos, useTitulo } from './componentes';
import { urlFornecedora } from './mercadoDados';

const semAcentos = (s) => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function Logo({ f }) {
  if (f.logoUrl) return <img className="pm-logo" src={f.logoUrl} alt="" loading="lazy" />;
  return <span className="pm-logo" aria-hidden="true">{f.name.trim().charAt(0).toUpperCase()}</span>;
}

function CartaoFornecedora({ f }) {
  const { t } = useI18n();
  const local = [f.city, f.country].filter(Boolean).join(', ');
  return (
    <article className="pm-fornecedora">
      <h3><Logo f={f} /><Link to={urlFornecedora(f.id)}>{f.name}</Link></h3>
      <p><span className="pm-verif">✔ {t('Verificada')}</span>{local ? ` · ${local}` : ''}</p>
      {Number(f.rating) > 0 ? <p><Stars value={Number(f.rating)} /> <b>{Number(f.rating).toFixed(1).replace('.', ',')}</b></p> : null}
      <p>{t('{n} produtos e serviços ativos', { n: formatNumber(f.productCount || 0) })}</p>
    </article>
  );
}

export default function Fornecedoras() {
  const { t } = useI18n();
  const [sp] = useSearchParams();
  const q = sp.get('q') || '';
  const [estado, setEstado] = useState('carregando');
  const [lista, setLista] = useState([]);
  useTitulo(t('Fornecedoras'));

  const carregar = () => { setEstado('carregando'); lerFornecedoras(24).then((l) => { setLista(l); setEstado('ok'); }).catch(() => setEstado('erro')); };
  useEffect(carregar, []);

  const filtradas = useMemo(() => {
    const n = semAcentos(q);
    return [...lista].filter((f) => !n || semAcentos(`${f.name} ${f.city || ''}`).includes(n)).sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  }, [lista, q]);

  return (
    <div className="pm-in pm-pagina">
      <nav className="pm-migalhas" aria-label={t('Localização')}><Link to="/">{t('Início')}</Link><span aria-hidden="true">›</span><span>{t('Fornecedoras')}</span></nav>
      <h1>{t('Fornecedoras e prestadoras de serviços verificadas')}</h1>
      <p className="pm-nota" style={{ marginTop: 6 }}>{t('Só aparecem empresas aprovadas na due diligence da KIXIMA.')}</p>
      <div className="pm-separadores" style={{ marginTop: 14 }}>
        <Link to="/produtos">{t('Produtos e serviços')}</Link>
        <Link to="/fornecedoras" aria-current="page">{t('Fornecedoras')}</Link>
      </div>
      {estado === 'erro' ? <EstadoErro onRetry={carregar} /> : null}
      {estado === 'carregando' ? <Esqueletos n={4} /> : null}
      {estado === 'ok' ? (filtradas.length
        ? <div className="pm-fornecedoras">{filtradas.map((f) => <CartaoFornecedora key={f.id} f={f} />)}</div>
        : <EstadoVazio titulo={q ? t('Nenhuma fornecedora corresponde à pesquisa.') : t('Ainda não há fornecedoras verificadas publicadas.')} />) : null}
    </div>
  );
}

export function Fornecedora() {
  const { t } = useI18n();
  const { id } = useParams();
  const [estado, setEstado] = useState('carregando');
  const [f, setF] = useState(null);
  const [produtos, setProdutos] = useState(null);
  useTitulo(f?.name);

  useEffect(() => {
    let vivo = true;
    setEstado('carregando'); setF(null); setProdutos(null);
    lerFornecedoras(24).then((lista) => {
      if (!vivo) return;
      const achada = lista.find((x) => x.id === id);
      if (!achada) { setEstado('nao-existe'); return; }
      setF(achada); setEstado('ok');
      produtosDeFornecedora(id).then((r) => { if (vivo) setProdutos(r); }).catch(() => { if (vivo) setProdutos({ items: [], completo: true, erro: true }); });
    }).catch(() => { if (vivo) setEstado('erro'); });
    return () => { vivo = false; };
  }, [id]);

  if (estado === 'carregando') return <div className="pm-in pm-pagina"><Esqueletos n={4} /></div>;
  if (estado === 'erro') return <div className="pm-in pm-pagina"><EstadoErro onRetry={() => window.location.reload()} /></div>;
  if (estado === 'nao-existe') {
    return <div className="pm-in pm-pagina"><EstadoVazio titulo={t('Esta fornecedora não está publicada.')}><Link className="btn pequeno" to="/fornecedoras">{t('Ver fornecedoras')}</Link></EstadoVazio></div>;
  }
  const local = [f.city, f.country].filter(Boolean).join(', ');
  return (
    <div className="pm-in pm-pagina">
      <nav className="pm-migalhas" aria-label={t('Localização')}>
        <Link to="/">{t('Início')}</Link><span aria-hidden="true">›</span><Link to="/fornecedoras">{t('Fornecedoras')}</Link><span aria-hidden="true">›</span><span>{f.name}</span>
      </nav>
      <div className="pm-fornecedora" style={{ marginBottom: 20 }}>
        <h1 style={{ display: 'flex', gap: 14, alignItems: 'center' }}><Logo f={f} />{f.name}</h1>
        <p><span className="pm-verif">✔ {t('Verificada')}</span>{local ? ` · ${local}` : ''}</p>
        {Number(f.rating) > 0 ? <p><Stars value={Number(f.rating)} /> <b>{Number(f.rating).toFixed(1).replace('.', ',')}</b></p> : null}
        <p>{t('{n} produtos e serviços ativos', { n: formatNumber(f.productCount || 0) })}</p>
      </div>
      <h2>{t('Catálogo da fornecedora')}</h2>
      <div style={{ marginTop: 12 }}>
        {produtos === null ? <Esqueletos n={4} /> : null}
        {produtos?.erro ? <EstadoErro /> : null}
        {produtos && !produtos.erro ? (produtos.items.length
          ? <div className="pm-grade pm-grade-grelha">{produtos.items.map((p) => <CartaoProduto key={p.id} p={p} />)}</div>
          : <EstadoVazio titulo={t('Esta fornecedora ainda não tem produtos ou serviços publicados.')} />) : null}
        {produtos && !produtos.completo ? <p className="pm-nota" style={{ marginTop: 12 }}>{t('A mostrar os primeiros resultados. Use a pesquisa do catálogo para ver o resto.')} <Link to="/produtos">{t('Ver o catálogo')}</Link></p> : null}
      </div>
    </div>
  );
}
