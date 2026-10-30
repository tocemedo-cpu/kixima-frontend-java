// src/pages/mercado/Catalogo.jsx
// Catálogo público (/produtos e /categorias/:nome): pesquisa, filtros com contagens reais, ordenação, grelha ou lista,
// paginação e comparação. Todo o estado vive no endereço — partilha-se, recarrega-se e o «voltar» funciona.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { facetas, pesquisar } from '../../api/publicCatalog';
import { formatMoney, formatNumber } from '../../domain';
import { useI18n } from '../../i18n';
import { CartaoProduto, EstadoErro, EstadoVazio, Esqueletos, Paginacao, useTitulo } from './componentes';
import { contarFiltros, escreverFiltros, FILTROS_VAZIOS, lerFiltros, paraApi } from './mercadoDados';

const POR_PAGINA = 24;
const ORDENS = [
  ['relevantes', 'Mais relevantes'], ['recentes', 'Mais recentes'], ['avaliacao', 'Melhor avaliação'],
  ['preco_asc', 'Menor preço'], ['preco_desc', 'Maior preço'], ['solicitados', 'Mais vistos'],
];
const AVALIACOES = [['', 'Qualquer'], ['4', '4 estrelas ou mais'], ['3', '3 estrelas ou mais']];

function Opcoes({ legenda, nome, valor, opcoes, onChange, todas }) {
  const { t } = useI18n();
  if (!opcoes.length) return null;
  return (
    <fieldset>
      <legend>{legenda}</legend>
      <label className="pm-opcao"><input type="radio" name={nome} checked={valor === ''} onChange={() => onChange('')} />{todas}</label>
      {opcoes.map((o) => (
        <label className="pm-opcao" key={o.valor}>
          <input type="radio" name={nome} checked={valor === o.valor} onChange={() => onChange(o.valor)} />
          {o.rotulo}<small aria-label={t('{n} resultados', { n: o.count })}>{formatNumber(o.count)}</small>
        </label>
      ))}
    </fieldset>
  );
}

export default function Catalogo({ porCategoria = false }) {
  const { t } = useI18n();
  const { nome } = useParams();
  const [sp, setSp] = useSearchParams();
  const fixos = porCategoria ? { category: nome } : {};
  const f = useMemo(() => lerFiltros(sp, fixos), [sp, porCategoria, nome]); // eslint-disable-line react-hooks/exhaustive-deps
  const omitir = porCategoria ? ['category'] : [];

  const [res, setRes] = useState({ estado: 'carregando', dados: null });
  const [fac, setFac] = useState(null);
  const [termo, setTermo] = useState(f.q);
  const [precos, setPrecos] = useState({ min: f.minPrice, max: f.maxPrice });
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const pedido = useRef(0);

  useEffect(() => { setTermo(f.q); }, [f.q]);
  useEffect(() => { setPrecos({ min: f.minPrice, max: f.maxPrice }); }, [f.minPrice, f.maxPrice]);

  const atualizar = useCallback((patch) => {
    const seguinte = { ...f, ...patch };
    if (!('page' in patch)) seguinte.page = 1;
    setSp(escreverFiltros(seguinte, omitir), { replace: true });
  }, [f, setSp]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregar = useCallback(() => {
    const id = ++pedido.current;
    setRes((r) => ({ estado: 'carregando', dados: r.dados }));
    const params = paraApi(f, POR_PAGINA);
    pesquisar(params)
      .then((dados) => { if (id === pedido.current) setRes({ estado: 'ok', dados }); })
      .catch(() => { if (id === pedido.current) setRes({ estado: 'erro', dados: null }); });
    facetas({ ...params, sort: '', page: '', limit: '' })
      .then((x) => { if (id === pedido.current) setFac(x); })
      .catch(() => {});
  }, [f]);
  useEffect(() => { carregar(); }, [carregar]);

  const titulo = porCategoria ? nome : f.q ? t('Resultados para «{q}»', { q: f.q }) : t('Produtos e serviços');
  useTitulo(titulo);

  const dados = res.dados;
  const nFiltros = contarFiltros(f) - (porCategoria ? 1 : 0);
  const tipoRotulo = (k) => (k === 'SERVICO' ? t('Serviços') : t('Produtos'));

  const chips = [];
  if (f.q) chips.push([t('Pesquisa: {q}', { q: f.q }), () => atualizar({ q: '' })]);
  if (f.category && !porCategoria) chips.push([f.category, () => atualizar({ category: '' })]);
  if (f.kind) chips.push([tipoRotulo(f.kind), () => atualizar({ kind: '' })]);
  if (f.country) chips.push([f.country, () => atualizar({ country: '' })]);
  f.certs.forEach((c) => chips.push([c, () => atualizar({ certs: f.certs.filter((x) => x !== c) })]));
  if (f.minPrice || f.maxPrice) chips.push([t('Preço: {de} – {ate}', { de: f.minPrice ? formatMoney(f.minPrice) : '…', ate: f.maxPrice ? formatMoney(f.maxPrice) : '…' }), () => atualizar({ minPrice: '', maxPrice: '' })]);
  if (f.minRating) chips.push([t('{n}★ ou mais', { n: f.minRating }), () => atualizar({ minRating: '' })]);
  if (f.promo) chips.push([t('Em promoção'), () => atualizar({ promo: false })]);

  const limpar = () => setSp(escreverFiltros({ ...FILTROS_VAZIOS, vista: f.vista, sort: f.sort, ...fixos }, omitir), { replace: true });
  const aplicarPrecos = (e) => { e.preventDefault(); atualizar({ minPrice: precos.min, maxPrice: precos.max }); };
  const limites = fac?.priceBounds;

  return (
    <div className="pm-in pm-pagina">
      <nav className="pm-migalhas" aria-label={t('Localização')}>
        <Link to="/">{t('Início')}</Link><span aria-hidden="true">›</span>
        {porCategoria ? <><Link to="/produtos">{t('Produtos e serviços')}</Link><span aria-hidden="true">›</span><span>{nome}</span></> : <span>{t('Produtos e serviços')}</span>}
      </nav>
      <h1>{titulo}</h1>
      <div className="pm-separadores" style={{ marginTop: 12 }}>
        <Link to="/produtos" aria-current="page">{t('Produtos e serviços')}</Link>
        <Link to="/fornecedoras">{t('Fornecedoras')}</Link>
      </div>

      <div className="pm-catalogo">
        <aside className={`pm-filtros${filtrosAbertos ? ' pm-aberto' : ''}`} aria-label={t('Filtros')}>
          <button type="button" className="btn pequeno alt pm-filtros-fechar" onClick={() => setFiltrosAbertos(false)}>{t('Fechar filtros')}</button>
          <h2>{t('Filtros')}</h2>
          {nFiltros > 0 ? <button type="button" className="btn pequeno alt" onClick={limpar}>{t('Limpar filtros')}</button> : null}
          <Opcoes legenda={t('Tipo')} nome="pm-tipo" valor={f.kind} todas={t('Todos')} onChange={(v) => atualizar({ kind: v })}
            opcoes={(fac?.kinds || []).map((k) => ({ valor: k.name, rotulo: k.name === 'SERVICO' ? t('Serviços') : t('Produtos'), count: k.count }))} />
          {!porCategoria ? (
            <Opcoes legenda={t('Categoria')} nome="pm-categoria" valor={f.category} todas={t('Todas')} onChange={(v) => atualizar({ category: v })}
              opcoes={(fac?.categories || []).map((c) => ({ valor: c.name, rotulo: c.name, count: c.count }))} />
          ) : null}
          <Opcoes legenda={t('País')} nome="pm-pais" valor={f.country} todas={t('Todos')} onChange={(v) => atualizar({ country: v })}
            opcoes={(fac?.countries || []).map((c) => ({ valor: c.name, rotulo: c.name, count: c.count }))} />
          {fac?.certifications?.length ? (
            <fieldset>
              <legend>{t('Certificações')}</legend>
              {fac.certifications.map((c) => (
                <label className="pm-opcao" key={c.name}>
                  <input type="checkbox" checked={f.certs.includes(c.name)} onChange={() => atualizar({ certs: f.certs.includes(c.name) ? f.certs.filter((x) => x !== c.name) : [...f.certs, c.name] })} />
                  {c.name}<small>{formatNumber(c.count)}</small>
                </label>
              ))}
            </fieldset>
          ) : null}
          {limites ? (
            <fieldset>
              <legend>{t('Preço (Kz)')}</legend>
              <form className="pm-preco-campos" onSubmit={aplicarPrecos}>
                <label className="pm-campo">{t('Mínimo')}<input type="number" inputMode="decimal" min="0" value={precos.min} placeholder={String(Math.floor(limites.min))} onChange={(e) => setPrecos((p) => ({ ...p, min: e.target.value }))} /></label>
                <label className="pm-campo">{t('Máximo')}<input type="number" inputMode="decimal" min="0" value={precos.max} placeholder={String(Math.ceil(limites.max))} onChange={(e) => setPrecos((p) => ({ ...p, max: e.target.value }))} /></label>
                <button type="submit" className="btn pequeno" style={{ gridColumn: '1 / -1' }}>{t('Aplicar preço')}</button>
              </form>
            </fieldset>
          ) : null}
          <fieldset>
            <legend>{t('Avaliação mínima')}</legend>
            {AVALIACOES.map(([v, rotulo]) => (
              <label className="pm-opcao" key={v || 'todas'}><input type="radio" name="pm-aval" checked={f.minRating === v} onChange={() => atualizar({ minRating: v })} />{t(rotulo)}</label>
            ))}
          </fieldset>
          <fieldset>
            <legend>{t('Oferta')}</legend>
            <label className="pm-opcao"><input type="checkbox" checked={f.promo} onChange={() => atualizar({ promo: !f.promo })} />{t('Só em promoção')}</label>
          </fieldset>
          <button type="button" className="btn pequeno pm-filtros-fechar" onClick={() => setFiltrosAbertos(false)}>{t('Ver {n} resultados', { n: dados ? formatNumber(dados.total) : '' })}</button>
        </aside>

        <section aria-label={t('Resultados')}>
          <form className="pm-barra" onSubmit={(e) => { e.preventDefault(); atualizar({ q: termo.trim() }); }} role="search">
            <label className="pm-campo" style={{ flex: '1 1 260px' }}>
              <span className="pm-sr">{t('Pesquisar neste catálogo')}</span>
              <input type="search" value={termo} maxLength={120} placeholder={t('Pesquisar neste catálogo')} onChange={(e) => setTermo(e.target.value)} />
            </label>
            <button type="submit" className="btn pequeno">{t('Pesquisar')}</button>
          </form>
          <div className="pm-barra">
            <p role="status" aria-live="polite">
              {res.estado === 'ok' && dados ? <><b>{formatNumber(dados.total)}</b> {dados.total === 1 ? t('resultado') : t('resultados')}</> : <span className="pm-nota">{res.estado === 'erro' ? '' : t('A carregar…')}</span>}
            </p>
            <div className="pm-barra-ctl">
              <button type="button" className="btn pequeno alt pm-abrir-filtros" onClick={() => setFiltrosAbertos(true)}>{t('Filtros')}{nFiltros ? ` (${nFiltros})` : ''}</button>
              <label className="pm-campo" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {t('Ordenar')}
                <select value={f.sort} onChange={(e) => atualizar({ sort: e.target.value })}>{ORDENS.map(([v, r]) => <option key={v} value={v}>{t(r)}</option>)}</select>
              </label>
              <div className="pm-vista" role="group" aria-label={t('Vista')}>
                <button type="button" aria-pressed={f.vista === 'grelha'} onClick={() => atualizar({ vista: 'grelha' }, true)}>{t('Grelha')}</button>
                <button type="button" aria-pressed={f.vista === 'lista'} onClick={() => atualizar({ vista: 'lista' }, true)}>{t('Lista')}</button>
              </div>
            </div>
          </div>
          {chips.length ? (
            <ul className="pm-chips" aria-label={t('Filtros ativos')} style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
              {chips.map(([rotulo, remover]) => (
                <li className="pm-chip" key={rotulo}>{rotulo}<button type="button" onClick={remover} aria-label={t('Remover filtro: {f}', { f: rotulo })}>×</button></li>
              ))}
            </ul>
          ) : null}

          {res.estado === 'erro' ? <EstadoErro onRetry={carregar} /> : null}
          {res.estado === 'carregando' && !dados ? <Esqueletos vista={f.vista} /> : null}
          {dados && res.estado !== 'erro' ? (
            dados.items.length ? (
              <div className={`pm-grade pm-grade-${f.vista}`} style={{ opacity: res.estado === 'carregando' ? 0.55 : 1 }}>
                {dados.items.map((p) => <CartaoProduto key={p.id} p={p} vista={f.vista} />)}
              </div>
            ) : (
              <EstadoVazio titulo={t('Nenhum resultado para esta pesquisa.')} texto={t('Experimente outras palavras ou retire alguns filtros.')}>
                {nFiltros > 0 || f.q ? <button type="button" className="btn pequeno" onClick={limpar}>{t('Limpar filtros')}</button> : null}
              </EstadoVazio>
            )
          ) : null}
          {dados ? <Paginacao page={dados.page} pages={dados.pages} onPage={(n) => { atualizar({ page: n }); window.scrollTo(0, 0); }} /> : null}
        </section>
      </div>
    </div>
  );
}
