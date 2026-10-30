// src/pages/mercado/Comparar.jsx
// Comparação lado a lado (2 a 4 itens) com os campos reais da ficha pública. As linhas em que nenhum item tem valor não
// aparecem; um item retirado entretanto do catálogo sai da comparação com um aviso.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { produto as lerProduto } from '../../api/publicCatalog';
import { formatNumber } from '../../domain';
import { useI18n } from '../../i18n';
import { EstadoVazio, Foto, Preco, Verificada, Avaliacao, useTitulo } from './componentes';
import { useMercado } from './MercadoContexto';
import { urlFornecedora, urlProduto } from './mercadoDados';
import { linhasTecnicas } from './Produto';

export default function Comparar() {
  const { t } = useI18n();
  const { comparar, alternar, limpar } = useMercado();
  const [itens, setItens] = useState({}); // slug -> produto | null (retirado)
  const [avisoRetirado, setAvisoRetirado] = useState(false);
  useTitulo(t('Comparar'));

  useEffect(() => {
    let vivo = true;
    comparar.filter((s) => !(s in itens)).forEach((s) => {
      lerProduto(s).then((p) => { if (vivo) setItens((m) => ({ ...m, [s]: p })); }).catch(() => { if (vivo) setItens((m) => ({ ...m, [s]: null })); });
    });
    return () => { vivo = false; };
  }, [comparar]); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = comparar.map((s) => itens[s]);
  const prontos = lista.filter(Boolean);
  const aCarregar = comparar.some((s) => !(s in itens));
  const retirados = comparar.filter((s) => s in itens && itens[s] === null);

  // Um item que já não existe sai da lista guardada, mas o aviso fica (senão desaparecia no mesmo instante).
  useEffect(() => {
    if (!retirados.length) return;
    setAvisoRetirado(true);
    retirados.forEach((s) => alternar(s));
  }, [retirados.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!comparar.length) {
    return (
      <div className="pm-in pm-pagina">
        <h1>{t('Comparar')}</h1>
        <EstadoVazio titulo={t('Ainda não escolheu nada para comparar.')} texto={t('No catálogo, marque «Comparar» em 2 a 4 produtos ou serviços.')}>
          <Link className="btn pequeno" to="/produtos">{t('Ver o catálogo')}</Link>
        </EstadoVazio>
      </div>
    );
  }

  // Cada item -> mapa rótulo->valor; a lista de rótulos é a união, pela ordem em que aparecem.
  const mapas = prontos.map((p) => new Map(linhasTecnicas(p, t)));
  const rotulos = [...new Set(mapas.flatMap((m) => [...m.keys()]))];

  return (
    <div className="pm-in pm-pagina">
      <nav className="pm-migalhas" aria-label={t('Localização')}><Link to="/">{t('Início')}</Link><span aria-hidden="true">›</span><span>{t('Comparar')}</span></nav>
      <div className="pm-sec-cab"><h1>{t('Comparar')}</h1><button type="button" className="btn pequeno alt" onClick={limpar}>{t('Limpar comparação')}</button></div>
      {avisoRetirado ? <p className="pm-nota" role="status">{t('Um dos itens já não está no catálogo e foi retirado da comparação.')}</p> : null}
      {aCarregar && !prontos.length ? <p className="pm-nota" role="status">{t('A carregar…')}</p> : null}
      {prontos.length ? (
        <div className="pm-quadro-wrap">
          <table className="pm-quadro">
            <caption className="pm-sr">{t('Comparação de produtos e serviços')}</caption>
            <thead>
              <tr>
                <td />
                {prontos.map((p) => (
                  <th scope="col" key={p.slug}>
                    <div className="pm-cab-foto"><Foto p={p} /></div>
                    <div className="pm-cab-nome"><Link to={urlProduto(p)}>{p.name}</Link></div>
                    <button type="button" className="pm-remover" onClick={() => alternar(p.slug)}>{t('Remover')}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row">{t('Preço')}</th>{prontos.map((p) => <td key={p.slug}><Preco p={p} /></td>)}</tr>
              <tr><th scope="row">{t('Fornecedora')}</th>{prontos.map((p) => <td key={p.slug}>{p.supplier?.id ? <Link to={urlFornecedora(p.supplier.id)}>{p.supplier.name}</Link> : '—'} <Verificada f={p.supplier} /></td>)}</tr>
              {prontos.some((p) => Number(p.reviewCount) > 0) ? <tr><th scope="row">{t('Avaliação')}</th>{prontos.map((p) => <td key={p.slug}><Avaliacao p={p} />{Number(p.reviewCount) > 0 ? null : '—'}</td>)}</tr> : null}
              {rotulos.map((r) => <tr key={r}><th scope="row">{r}</th>{mapas.map((m, i) => <td key={prontos[i].slug}>{m.get(r) ?? '—'}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="pm-nota" style={{ marginTop: 10 }}>{t('{n} de 4 itens', { n: formatNumber(comparar.length) })}</p>
    </div>
  );
}
