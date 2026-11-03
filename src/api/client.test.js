// src/api/client.test.js
// A base da URL da API é recalculada a CADA pedido (apiBaseUrl()), não uma
// vez só à carga do módulo — window.Capacitor é injetado pelo runtime nativo
// de forma assíncrona, e um cálculo único corria o risco de acontecer antes
// disso, decidindo (incorretamente, e para sempre) que a app não era nativa.
// Por isso cada cenário (Web vs. Capacitor nativo) importa o módulo de fresco
// — para simular window.Capacitor já definido OU só a aparecer depois — em
// vez de reconfigurar um módulo já carregado.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

async function carregarClienteComo({ nativo }) {
  vi.resetModules();
  if (nativo) {
    window.Capacitor = { isNativePlatform: () => true };
  } else {
    delete window.Capacitor;
  }
  return import('./client');
}

beforeEach(() => {
  localStorage.clear();
  delete window.Capacitor;
});

afterEach(() => {
  delete window.Capacitor;
  vi.unstubAllGlobals();
});

function mockFetchOk(body, { contentType = 'application/json' } = {}) {
  const headers = new Headers(contentType ? { 'content-type': contentType } : {});
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Web (sem Capacitor)', () => {
  test('pedidos usam a origem da própria página, sem Authorization', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    const fetchMock = mockFetchOk({ ok: true });
    await api.get('/api/auth/me');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${window.location.origin}/api/auth/me`);
    expect(options.headers.Authorization).toBeUndefined();
    expect(options.credentials).toBe('include');
  });

  test('definirBearerNativo não tem efeito nenhum fora do Capacitor', async () => {
    const { api, definirBearerNativo } = await carregarClienteComo({ nativo: false });
    definirBearerNativo('um-token-qualquer');
    const fetchMock = mockFetchOk({ ok: true });
    await api.get('/api/auth/me');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});

describe('Capacitor nativo (Android/iOS)', () => {
  test('pedidos vão para https://kixima.net, nunca para a origem da WebView', async () => {
    const { api } = await carregarClienteComo({ nativo: true });
    const fetchMock = mockFetchOk({ ok: true });
    await api.get('/api/auth/login');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://kixima.net/api/auth/login');
  });

  test('não duplica /api (kixima.net/api/api/...)', async () => {
    const { api } = await carregarClienteComo({ nativo: true });
    const fetchMock = mockFetchOk({ ok: true });
    await api.get('/api/auth/me');

    expect(fetchMock.mock.calls[0][0]).not.toMatch(/\/api\/api\//);
  });

  test('depois do login, definirBearerNativo faz os pedidos seguintes levarem Authorization: Bearer', async () => {
    const { api, definirBearerNativo } = await carregarClienteComo({ nativo: true });
    definirBearerNativo('jwt-de-teste');
    const fetchMock = mockFetchOk({ user: { id: 'u1' } });
    await api.get('/api/auth/me');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-de-teste');
    // credentials: 'include' continua presente — o cookie ainda é tentado.
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  test('logout (definirBearerNativo(null)) deixa de enviar Authorization', async () => {
    const { api, definirBearerNativo } = await carregarClienteComo({ nativo: true });
    definirBearerNativo('jwt-de-teste');
    definirBearerNativo(null);
    const fetchMock = mockFetchOk({ ok: true });
    await api.get('/api/auth/me');

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  // Regressão: window.Capacitor só fica pronto DEPOIS deste módulo já ter
  // carregado — não é hipotético, foi exatamente a causa de um "Failed to
  // fetch" real (a app decidia, uma vez e para sempre, que não era nativa).
  test('window.Capacitor a aparecer só DEPOIS do módulo carregado — o pedido ainda vai para kixima.net', async () => {
    delete window.Capacitor; // ainda não existe quando o módulo carrega
    const { api } = await carregarClienteComo({ nativo: false });

    // Só agora, depois do import, é que o runtime nativo "chega".
    window.Capacitor = { isNativePlatform: () => true };

    const fetchMock = mockFetchOk({ ok: true });
    await api.get('/api/auth/login');

    expect(fetchMock.mock.calls[0][0]).toBe('https://kixima.net/api/auth/login');
  });
});

describe('Robustez contra respostas vazias/não-JSON', () => {
  test('sucesso HTTP sem corpo JSON válido lança um erro claro, não devolve null', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    mockFetchOk(null, { contentType: 'text/html' });

    await expect(api.post('/api/auth/login', { email: 'a@b.co', password: 'x' }))
      .rejects.toThrow(/dados válidos/);
  });

  test('uma resposta JSON válida continua a devolver os dados normalmente', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    mockFetchOk({ requires2fa: false, user: { id: 'u1' }, token: 't' });

    const result = await api.post('/api/auth/login', { email: 'a@b.co', password: 'x' });
    expect(result.user.id).toBe('u1');
  });

  test('respostas de erro (não-ok) continuam a lançar com a mensagem do servidor', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: { message: 'Credenciais inválidas.', code: 'UNAUTHORIZED' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.post('/api/auth/login', { email: 'a@b.co', password: 'x' }))
      .rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });
});

// Quando quem responde NÃO é a API (servidor parado, proxy do Vite sem destino, gateway), a mensagem diz a causa real em
// vez de «Erro 500». Um erro que a API devolve, com o seu envelope JSON, nunca é substituído.
describe('Falhas em que a API não respondeu', () => {
  const SEM_SERVIDOR = 'Não foi possível contactar o servidor da KIXIMA. Verifique a ligação ou tente mais tarde.';
  const respostaErro = (status, { contentType = 'text/plain', json = null } = {}) => vi.fn().mockResolvedValue({
    ok: false, status, headers: new Headers(contentType ? { 'content-type': contentType } : {}), json: async () => json,
  });

  test('500 com corpo vazio e text/plain (proxy do Vite sem destino) → mensagem honesta, não «Erro 500»', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    vi.stubGlobal('fetch', respostaErro(500));
    await expect(api.get('/api/public/stats')).rejects.toMatchObject({ message: SEM_SERVIDOR, status: 500, code: 'SERVIDOR_INDISPONIVEL' });
  });

  test('502/503/504 sem JSON da API também', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    for (const estado of [502, 503, 504]) {
      vi.stubGlobal('fetch', respostaErro(estado, { contentType: 'text/html' }));
      // eslint-disable-next-line no-await-in-loop
      await expect(api.post('/api/auth/register', { email: 'a@b.co' })).rejects.toMatchObject({ message: SEM_SERVIDOR, status: estado });
    }
  });

  test('o 500 do próprio backend (envelope JSON) mantém a mensagem e o código da API', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    vi.stubGlobal('fetch', respostaErro(500, {
      contentType: 'application/json', json: { error: { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno. Tente novamente mais tarde.' } },
    }));
    await expect(api.get('/api/public/stats')).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500, message: 'Ocorreu um erro interno. Tente novamente mais tarde.' });
  });

  test('o 503 do backend (base indisponível) também mantém a mensagem da API', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    vi.stubGlobal('fetch', respostaErro(503, {
      contentType: 'application/json', json: { error: { code: 'SERVICO_INDISPONIVEL', message: 'A base de dados está temporariamente indisponível. Tente novamente dentro de instantes.' } },
    }));
    await expect(api.get('/api/public/stats')).rejects.toMatchObject({ code: 'SERVICO_INDISPONIVEL', message: expect.stringContaining('base de dados') });
  });

  test('erros 4xx sem corpo continuam a dizer o estado (só os 5xx foram reclassificados)', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    vi.stubGlobal('fetch', respostaErro(404));
    await expect(api.get('/api/nao-existe')).rejects.toMatchObject({ status: 404, message: expect.stringContaining('404') });
  });

  test('falha de rede (fetch rejeita com TypeError) → mensagem honesta, status 0', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.get('/api/public/catalog/facets')).rejects.toMatchObject({ message: SEM_SERVIDOR, status: 0, code: 'SEM_LIGACAO' });
  });

  test('o mesmo vale nos envios com ficheiro e formulário', async () => {
    const { api } = await carregarClienteComo({ nativo: false });
    vi.stubGlobal('fetch', respostaErro(500));
    await expect(api.upload('/api/x', new Blob(['a']))).rejects.toMatchObject({ message: SEM_SERVIDOR });
    await expect(api.postForm('/api/x', new FormData())).rejects.toMatchObject({ message: SEM_SERVIDOR });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api.postForm('/api/x', new FormData())).rejects.toMatchObject({ message: SEM_SERVIDOR, status: 0 });
  });
});
