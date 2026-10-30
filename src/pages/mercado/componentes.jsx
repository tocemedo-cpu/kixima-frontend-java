// src/pages/mercado/componentes.jsx
// Peças partilhadas pelas páginas públicas: fotografia, preço, cartão comercial (grelha e lista), estados e paginação.
// Regra de ouro: só se mostra o que a API devolveu. Sem fotografia há um marcador claro; sem preço, «sob cotação».
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon, Stars, categoryVisual } from '../../components/icons';
import { formatMoney, formatNumber } from '../../domain';
import { useI18n } from '../../i18n';
import { useMercado } from './MercadoContexto';
import { especificacoes, localizacaoDe, precoDe, urlFornecedora, urlProduto } from './mercadoDados';

export function Foto({ p, alt = '' }) {
  const { t } = useI18n();
  if (p.imageUrl) return <img className="pm-foto" src={p.imageUrl} alt={alt} loading="lazy" />;
  return (
    <div className="pm-foto pm-semfoto">
      <Icon name={categoryVisual(p.category).icon} size={34} />
      <span>{t('Sem fotografia')}</span>
    </div>
  );
}

export function Preco({ p, grande = false }) {
  const { t } = useI18n();
  const x = precoDe(p);
  if (x.tipo === 'cotacao') return <span className={`pm-preco pm-cotacao${grande ? ' pm-preco-grande' : ''}`}>{t('Preço sob cotação')}</span>;
  const unidade = typeof p.measurementUnit === 'string' && p.measurementUnit.trim() ? p.measurementUnit.trim() : '';
  return (
    <span className={`pm-preco${grande ? ' pm-preco-grande' : ''}`}>
      <strong>{formatMoney(x.valor, x.moeda)}</strong>
      {unidade ? <small> / {unidade}</small> : null}
      {x.antigo ? <s aria-label={t('Preço anterior')}>{formatMoney(x.antigo, x.moeda)}</s> : null}
    </span>
  );
}

export function Verificada({ f }) {
  const { t } = useI18n();
  return f?.verified ? <span className="pm-verif" title={t('Fornecedora com due diligence aprovada pela KIXIMA')}>✔ {t('Verificada')}</span> : null;
}

export function Avaliacao({ p }) {
  const rating = Number(p.rating);
  const n = Number(p.reviewCount);
  if (!(n > 0) || !(rating > 0)) return null;
  return <span className="pm-aval"><Stars value={rating} size={13} /> <b>{rating.toFixed(1).replace('.', ',')}</b> <span>({formatNumber(n)})</span></span>;
}

/** Cartão comercial. `vista` = 'grelha' | 'lista'. A caixa «Comparar» e a ligação à fornecedora ficam por cima da ligação do cartão. */
export function CartaoProduto({ p, vista = 'grelha', comparavel = true }) {
  const { t } = useI18n();
  const { comparar, alternar, cheio } = useMercado();
  const marcado = comparar.includes(p.slug);
  const specs = especificacoes(p);
  const local = localizacaoDe(p);
  const promo = precoDe(p).tipo === 'promo';
  const minimo = Number(p.minQuantity) > 0 ? Number(p.minQuantity) : null;
  const prazo = Number(p.leadTimeDays) > 0 ? Number(p.leadTimeDays) : null;

  return (
    <article className={`pm-cartao pm-${vista}`}>
      <div className="pm-cartao-foto">
        <Foto p={p} />
        <span className="pm-etiqueta">{p.kind === 'SERVICO' ? t('Serviço') : t('Produto')}</span>
        {promo ? <span className="pm-etiqueta pm-etiqueta-promo">{t('Promoção')}</span> : null}
      </div>
      {comparavel ? (
        <label className="pm-comparar">
          <input type="checkbox" checked={marcado} disabled={!marcado && cheio} onChange={() => alternar(p.slug)} />
          <span>{t('Comparar')}</span>
          <span className="pm-sr"> — {p.name}</span>
        </label>
      ) : null}
      <div className="pm-cartao-corpo">
        <h3 className="pm-cartao-nome"><Link to={urlProduto(p)}>{p.name}</Link></h3>
        <p className="pm-cartao-cat">{[p.category, p.subcategory].filter(Boolean).join(' · ')}</p>
        {specs.length ? <ul className="pm-specs">{specs.map((s) => <li key={s}>{s}</li>)}</ul> : null}
        {vista === 'lista' && p.description ? <p className="pm-cartao-desc">{p.description}</p> : null}
        <p className="pm-cartao-forn">
          {p.supplier?.id ? <Link to={urlFornecedora(p.supplier.id)}>{p.supplier.name}</Link> : null}
          {' '}<Verificada f={p.supplier} />
          {local ? <span className="pm-local"> · {local}</span> : null}
        </p>
        <Avaliacao p={p} />
        <Preco p={p} />
        {minimo || prazo ? (
          <p className="pm-cartao-meta">
            {minimo ? <span>{t('Mín. {n}', { n: formatNumber(minimo) })}</span> : null}
            {prazo ? <span>{t('Prazo: {n} dias', { n: formatNumber(prazo) })}</span> : null}
          </p>
        ) : null}
        <span className="pm-cartao-ver" aria-hidden="true">{t('Ver detalhes')} →</span>
      </div>
    </article>
  );
}

export function Esqueletos({ n = 8, vista = 'grelha' }) {
  const { t } = useI18n();
  return (
    <div className={`pm-grade pm-grade-${vista}`} role="status" aria-label={t('A carregar…')}>
      {Array.from({ length: n }, (_, i) => <div className="pm-esqueleto" key={i} aria-hidden="true" />)}
    </div>
  );
}

export function EstadoVazio({ titulo, texto, children }) {
  return (
    <div className="pm-estado" role="status">
      <h3>{titulo}</h3>
      {texto ? <p>{texto}</p> : null}
      {children}
    </div>
  );
}

export function EstadoErro({ onRetry }) {
  const { t } = useI18n();
  return (
    <div className="pm-estado pm-estado-erro" role="alert">
      <h3>{t('O catálogo está indisponível neste momento.')}</h3>
      <p>{t('Não conseguimos obter os produtos. Não mostramos dados que não sejam reais — tente de novo dentro de instantes.')}</p>
      {onRetry ? <button type="button" className="btn pequeno" onClick={onRetry}>{t('Tentar de novo')}</button> : null}
    </div>
  );
}

/** Números de página com reticências: 1 … 4 5 [6] 7 8 … 20. */
function paginasVisiveis(atual, total) {
  const set = new Set([1, total, atual - 1, atual, atual + 1]);
  const lista = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  lista.forEach((n, i) => { if (i && n - lista[i - 1] > 1) out.push(`…${n}`); out.push(n); });
  return out;
}

export function Paginacao({ page, pages, onPage }) {
  const { t } = useI18n();
  if (pages <= 1) return null;
  return (
    <nav className="pm-paginacao" aria-label={t('Paginação')}>
      <button type="button" className="btn pequeno alt" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ {t('Anterior')}</button>
      {paginasVisiveis(page, pages).map((n) => (typeof n === 'string'
        ? <span key={n} className="pm-reticencias" aria-hidden="true">…</span>
        : <button key={n} type="button" className={`btn pequeno ${n === page ? '' : 'alt'}`} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}>{n}</button>))}
      <button type="button" className="btn pequeno alt" disabled={page >= pages} onClick={() => onPage(page + 1)}>{t('Seguinte')} ›</button>
    </nav>
  );
}

/** Barra fixa com a escolha de comparação (aparece só quando há alguma). */
export function BarraComparacao() {
  const { t } = useI18n();
  const { comparar, limpar } = useMercado();
  if (!comparar.length) return null;
  return (
    <div className="pm-barra-cmp" role="region" aria-label={t('Comparação de produtos')}>
      <span>{t('{n} selecionados (máx. 4)', { n: comparar.length })}</span>
      {comparar.length >= 2
        ? <Link className="btn pequeno" to="/comparar">{t('Comparar')}</Link>
        : <span className="pm-nota">{t('Escolha pelo menos 2 para comparar.')}</span>}
      <button type="button" className="btn pequeno alt" onClick={limpar}>{t('Limpar')}</button>
    </div>
  );
}

/** Título do separador do browser para as páginas públicas. */
export function useTitulo(titulo) {
  useEffect(() => {
    if (!titulo) return undefined;
    const anterior = document.title;
    document.title = `${titulo} · KIXIMA.NET`;
    return () => { document.title = anterior; };
  }, [titulo]);
}
