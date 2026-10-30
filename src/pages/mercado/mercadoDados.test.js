// src/pages/mercado/mercadoDados.test.js
// As regras de apresentação do catálogo público: só se mostra o que a API devolveu, e os filtros vivem no endereço.
import { describe, expect, test } from 'vitest';
import { contarFiltros, destinoCotacao, escreverFiltros, especificacoes, FILTROS_VAZIOS, lerFiltros, localizacaoDe, paraApi, precoDe } from './mercadoDados';

describe('precoDe', () => {
  test('preço normal', () => expect(precoDe({ unitPrice: '950000', currency: 'AOA' })).toEqual({ tipo: 'preco', valor: 950000, antigo: null, moeda: 'AOA' }));
  test('promoção só conta se for MENOR que o preço', () => {
    expect(precoDe({ unitPrice: '100', promoPrice: '80' })).toMatchObject({ tipo: 'promo', valor: 80, antigo: 100 });
    expect(precoDe({ unitPrice: '100', promoPrice: '120' })).toMatchObject({ tipo: 'preco', valor: 100 });
  });
  test.each([[{}], [{ unitPrice: null }], [{ unitPrice: '0' }], [{ unitPrice: 'abc' }], [{ unitPrice: '' }]])('sem preço público (%j) é «sob cotação», nunca um valor inventado', (p) => {
    expect(precoDe(p)).toMatchObject({ tipo: 'cotacao', valor: null });
  });
});

describe('especificacoes e localização', () => {
  test('até 3, sem repetidas nem vazias, só as que existem', () => {
    expect(especificacoes({ keySpec: 'PN16', standard: 'API 6D', material: ' ', brand: 'X', model: 'Y', certifications: ['ISO 9001'] })).toEqual(['PN16', 'API 6D', 'X Y']);
    expect(especificacoes({})).toEqual([]);
    expect(especificacoes({ certifications: ['A', 'A', 'B'] }, 5)).toEqual(['A', 'B']);
  });
  test('localização só com o que existe', () => {
    expect(localizacaoDe({ city: 'Luanda', country: 'Angola' })).toBe('Luanda, Angola');
    expect(localizacaoDe({ country: 'Angola' })).toBe('Angola');
    expect(localizacaoDe({})).toBe('');
  });
});

describe('filtros <-> endereço', () => {
  test('endereço vazio = filtros vazios (a ausência de preço NÃO é «0»)', () => {
    const f = lerFiltros(new URLSearchParams(''));
    expect(f).toEqual(FILTROS_VAZIOS);
    expect(f.minPrice).toBe('');
    expect(contarFiltros(f)).toBe(0);
  });
  test('ida e volta sem perder nada', () => {
    const f = { ...FILTROS_VAZIOS, q: 'válvula', category: 'Válvulas', kind: 'PRODUTO', country: 'Angola', certs: ['ISO 9001', 'API Q1 / Q2'], minPrice: '100', maxPrice: '900', minRating: '4', promo: true, sort: 'preco_asc', page: 3, vista: 'lista' };
    expect(lerFiltros(escreverFiltros(f))).toEqual(f);
    expect(contarFiltros(f)).toBe(9);
  });
  test('valores inválidos no endereço são ignorados', () => {
    const f = lerFiltros(new URLSearchParams('kind=OUTRO&sort=xpto&page=-2&minPrice=abc&minRating=9&vista=x'));
    expect(f).toMatchObject({ kind: '', sort: 'relevantes', page: 1, minPrice: '', minRating: '', vista: 'grelha' });
  });
  test('filtros fixados pela rota (categoria) prevalecem e não vão para o endereço', () => {
    const f = lerFiltros(new URLSearchParams('category=Outra'), { category: 'Válvulas' });
    expect(f.category).toBe('Válvulas');
    expect(escreverFiltros(f, ['category']).has('category')).toBe(false);
  });
  test('parâmetros da API só levam o que está preenchido e respeitam o limite de 48', () => {
    expect(paraApi({ ...FILTROS_VAZIOS, q: 'x', certs: ['A', 'B'], sort: 'recentes', page: 2 }, 100)).toMatchObject({ q: 'x', certifications: ['A', 'B'], sort: 'recentes', page: 2, limit: 48 });
    expect(paraApi(FILTROS_VAZIOS)).toMatchObject({ sort: '', page: '', promo: '' });
  });
});

describe('destinoCotacao', () => {
  test('sem sessão vai à entrada; só COMPRADOR pede; as outras contas não veem a ação', () => {
    expect(destinoCotacao(null)).toBe('/login');
    expect(destinoCotacao({ role: 'COMPRADOR' })).toBe('/comprador/cotacoes');
    for (const role of ['FORNECEDOR', 'FINANCEIRO', 'COMPANY_ADMIN', 'ADMIN_SISTEMA']) expect(destinoCotacao({ role })).toBeNull();
  });
});
