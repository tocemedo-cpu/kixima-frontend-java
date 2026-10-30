// src/pages/mercado/MercadoContexto.jsx
// Estado partilhado pelas páginas públicas do marketplace:
//   - as facetas GLOBAIS (categorias, tipos, países… sem filtro) lidas uma vez: alimentam o menu de categorias do
//     cabeçalho e as secções da homepage. Se a API não responder, `estado` fica 'indisponivel' e quem desenha mostra
//     o aviso honesto — nunca categorias escritas à mão;
//   - a lista de comparação (até 4 produtos), guardada no browser, que sobrevive à navegação e a recarregar.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { facetas } from '../../api/publicCatalog';

export const MAX_COMPARAR = 4;
const CHAVE_COMPARAR = 'kixima.comparar';

function lerComparacao() {
  try {
    const v = JSON.parse(window.localStorage.getItem(CHAVE_COMPARAR) || '[]');
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s).slice(0, MAX_COMPARAR) : [];
  } catch {
    return [];
  }
}

const MercadoCtx = createContext(null);

export function MercadoProvider({ children }) {
  const [estado, setEstado] = useState('carregando'); // carregando | ok | indisponivel
  const [globais, setGlobais] = useState(null);
  const [comparar, setComparar] = useState(lerComparacao);

  const carregar = useCallback(() => {
    setEstado('carregando');
    facetas({}).then((f) => { setGlobais(f); setEstado('ok'); }).catch(() => setEstado('indisponivel'));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    try { window.localStorage.setItem(CHAVE_COMPARAR, JSON.stringify(comparar)); } catch { /* modo privado */ }
  }, [comparar]);

  const alternar = useCallback((slug) => {
    setComparar((atual) => {
      if (atual.includes(slug)) return atual.filter((s) => s !== slug);
      return atual.length >= MAX_COMPARAR ? atual : [...atual, slug];
    });
  }, []);
  const limpar = useCallback(() => setComparar([]), []);

  const value = useMemo(() => ({
    estado, globais, recarregar: carregar,
    comparar, alternar, limpar, cheio: comparar.length >= MAX_COMPARAR,
  }), [estado, globais, carregar, comparar, alternar, limpar]);

  return <MercadoCtx.Provider value={value}>{children}</MercadoCtx.Provider>;
}

export function useMercado() {
  const ctx = useContext(MercadoCtx);
  if (!ctx) throw new Error('useMercado deve ser usado dentro de <MercadoProvider>.');
  return ctx;
}
