// src/pages/mercado/Produto.jsx
// Ficha pública de um produto ou serviço (/produtos/:slug). Mostra só o que a API devolve: as linhas de especificação
// sem valor não aparecem e as avaliações só existem se houver avaliações.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { avaliacoes as lerAvaliacoes, produto as lerProduto } from '../../api/publicCatalog';
import { useAuth } from '../../auth/AuthContext';
import { Stars } from '../../components/icons';
import { formatDate, formatNumber } from '../../domain';
import { useI18n } from '../../i18n';
import { Avaliacao, EstadoErro, EstadoVazio, Foto, Preco, Verificada, useTitulo } from './componentes';
import { useMercado } from './MercadoContexto';
import { destinoCotacao, localizacaoDe, precoDe, urlCategoria, urlFornecedora } from './mercadoDados';

const vazio = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);
const comoTexto = (v) => (Array.isArray(v) ? v.join('\n') : String(v));

/** Linhas [rótulo, valor] da tabela técnica — só as que têm valor. `t` traduz os rótulos. */
export function linhasTecnicas(p, t) {
  const medidas = [p.length && `${p.length}`, p.width && `${p.width}`, p.height && `${p.height}`].filter(Boolean);
  const pares = [
    [t('Marca'), p.brand], [t('Fabricante'), p.manufacturer], [t('Modelo'), p.model], [t('País de origem'), p.countryOfOrigin],
    [t('Especificação principal'), p.keySpec], [t('Norma'), p.standard], [t('Material'), p.material],
    [t('Pressão'), p.pressure], [t('Temperatura'), p.temperature], [t('Potência'), p.power], [t('Tensão'), p.voltage],
    [t('Peso'), p.weight], [t('Dimensões (C × L × A)'), medidas.length === 3 ? medidas.join(' × ') : null],
    [t('Unidade de medida'), p.measurementUnit], [t('Garantia'), p.warranty], [t('Incoterm'), p.incoterm],
    [t('Quantidade mínima'), Number(p.minQuantity) > 0 ? formatNumber(p.minQuantity) : null],
    [t('Quantidade máxima'), Number(p.maxQuantity) > 0 ? formatNumber(p.maxQuantity) : null],
    [t('Prazo de entrega'), Number(p.leadTimeDays) > 0 ? t('{n} dias', { n: formatNumber(p.leadTimeDays) }) : null],
    [t('Disponibilidade'), p.availability], [t('Especialidade'), p.specialty],
    [t('Certificações'), Array.isArray(p.certifications) && p.certifications.length ? p.certifications.join(', ') : null],
    [t('Localização'), localizacaoDe(p) || null],
  ];
  return pares.filter(([, v]) => !vazio(v)).map(([r, v]) => [r, comoTexto(v)]);
}

function imagensDe(p) {
  const extra = Array.isArray(p.images) ? p.images.map((i) => (typeof i === 'string' ? i : i?.url || i?.imageUrl)).filter(Boolean) : [];
  return [...new Set([p.imageUrl, ...extra].filter(Boolean))];
}

export default function Produto() {
  const { t } = useI18n();
  const { slug } = useParams();
  const { user } = useAuth();
  const { comparar, alternar, cheio } = useMercado();
  const [estado, setEstado] = useState('carregando');
  const [p, setP] = useState(null);
  const [opinioes, setOpinioes] = useState([]);
  const [ativa, setAtiva] = useState(0);

  useEffect(() => {
    let vivo = true;
    setEstado('carregando'); setP(null); setOpinioes([]); setAtiva(0);
    lerProduto(slug)
      .then((x) => { if (vivo) { setP(x); setEstado('ok'); } })
      .catch((e) => { if (vivo) setEstado(e.status === 404 ? 'nao-existe' : 'erro'); });
    lerAvaliacoes(slug).then((x) => { if (vivo) setOpinioes(x); }).catch(() => {});
    return () => { vivo = false; };
  }, [slug]);

  useTitulo(p?.name);
  const imagens = useMemo(() => (p ? imagensDe(p) : []), [p]);
  const linhas = useMemo(() => (p ? linhasTecnicas(p, t) : []), [p, t]);

  if (estado === 'carregando') return <div className="pm-in pm-pagina"><div className="pm-esqueleto" style={{ aspectRatio: '16 / 7' }} role="status" aria-label={t('A carregar…')} /></div>;
  if (estado === 'erro') return <div className="pm-in pm-pagina"><EstadoErro onRetry={() => window.location.reload()} /></div>;
  if (estado === 'nao-existe') {
    return (
      <div className="pm-in pm-pagina">
        <EstadoVazio titulo={t('Este produto já não está disponível.')} texto={t('Pode ter sido retirado pela fornecedora. Veja o resto do catálogo.')}>
          <Link className="btn pequeno" to="/produtos">{t('Ver o catálogo')}</Link>
        </EstadoVazio>
      </div>
    );
  }

  const cotacao = destinoCotacao(user);
  const comprador = user?.role === 'COMPRADOR';
  const marcado = comparar.includes(p.slug);
  const principal = imagens[ativa] ? { ...p, imageUrl: imagens[ativa] } : p;
  const documentos = (Array.isArray(p.documents) ? p.documents : []).filter((d) => d && d.url);
  const descricao = p.fullDescription || p.description;

  return (
    <div className="pm-in pm-pagina">
      <nav className="pm-migalhas" aria-label={t('Localização')}>
        <Link to="/">{t('Início')}</Link><span aria-hidden="true">›</span>
        <Link to="/produtos">{t('Produtos e serviços')}</Link><span aria-hidden="true">›</span>
        {p.category ? <><Link to={urlCategoria(p.category)}>{p.category}</Link><span aria-hidden="true">›</span></> : null}
        <span>{p.name}</span>
      </nav>

      <div className="pm-ficha">
        <div className="pm-galeria">
          <div className="pm-galeria-grande"><Foto p={principal} alt={p.name} /></div>
          {imagens.length > 1 ? (
            <div className="pm-miniaturas" role="group" aria-label={t('Fotografias')}>
              {imagens.map((u, i) => (
                <button key={u} type="button" aria-pressed={i === ativa} aria-label={t('Fotografia {n}', { n: i + 1 })} onClick={() => setAtiva(i)}><img src={u} alt="" loading="lazy" /></button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="pm-ficha-info">
          <div>
            <p className="pm-eyebrow">{p.kind === 'SERVICO' ? t('Serviço') : t('Produto')}{p.subcategory ? ` · ${p.subcategory}` : ''}</p>
            <h1>{p.name}</h1>
          </div>
          <Avaliacao p={p} />
          <div className="pm-caixa-compra">
            <Preco p={p} grande />
            {precoDe(p).tipo === 'cotacao' ? <p className="pm-nota">{t('A fornecedora responde com preço e prazo ao seu pedido de cotação.')}</p> : <p className="pm-nota">{t('Preço de referência. O valor final fica confirmado na cotação e na ordem de compra.')}</p>}
            <p>
              {p.supplier?.id ? <Link to={urlFornecedora(p.supplier.id)}><b>{p.supplier.name}</b></Link> : null} <Verificada f={p.supplier} />
              {localizacaoDe(p) ? <span className="pm-nota"> · {localizacaoDe(p)}</span> : null}
            </p>
            {cotacao ? <Link className="btn" to={cotacao}>{user ? t('Pedir cotação') : t('Entrar para pedir cotação')}</Link> : <p className="pm-nota">{t('Só contas de comprador pedem cotações.')}</p>}
            {comprador ? <Link className="btn alt" to={`/comprador/catalogo/${p.id}`}>{t('Ver no meu catálogo')}</Link> : null}
            {!user ? <Link className="btn alt" to="/cadastro">{t('Registar a minha empresa')}</Link> : null}
            <label className="pm-opcao">
              <input type="checkbox" checked={marcado} disabled={!marcado && cheio} onChange={() => alternar(p.slug)} />
              {t('Adicionar à comparação')}
            </label>
          </div>
        </div>
      </div>

      <div className="pm-colunas">
        {descricao ? <section className="pm-bloco"><h2>{t('Descrição')}</h2><p>{descricao}</p></section> : null}
        {linhas.length ? (
          <section className="pm-bloco">
            <h2>{t('Especificações')}</h2>
            <table className="pm-tabela"><tbody>{linhas.map(([r, v]) => <tr key={r}><th scope="row">{r}</th><td>{v}</td></tr>)}</tbody></table>
          </section>
        ) : null}
        {!vazio(p.applications) ? <section className="pm-bloco"><h2>{t('Aplicações')}</h2><p>{comoTexto(p.applications)}</p></section> : null}
        {!vazio(p.benefits) ? <section className="pm-bloco"><h2>{t('Benefícios')}</h2><p>{comoTexto(p.benefits)}</p></section> : null}
        {documentos.length ? (
          <section className="pm-bloco">
            <h2>{t('Documentos')}</h2>
            <ul className="pm-documentos">{documentos.map((d) => <li key={d.url}><a href={d.url} target="_blank" rel="noopener">{d.name || d.title || d.fileName || d.url}</a></li>)}</ul>
          </section>
        ) : null}
        {opinioes.length ? (
          <section className="pm-bloco">
            <h2>{t('Avaliações')}</h2>
            <ul className="pm-avaliacoes">
              {opinioes.map((o) => (
                <li key={o.id}>
                  <Stars value={Number(o.rating) || 0} /> <b>{o.authorName}</b> {o.createdAt ? <span className="pm-nota">· {formatDate(o.createdAt)}</span> : null}
                  {o.comment || o.message ? <p>{o.comment || o.message}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
