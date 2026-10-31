// src/api/onboarding.js
// Registo em dois passos e cadastro empresarial por etapas. Só chama o backend: nada é inventado aqui.
//   POST /api/auth/register            conta + tipo de empresa (a empresa nasce em rascunho)
//   POST /api/auth/verify-email        confirma o email a partir do link recebido
//   POST /api/auth/resend-verification novo email de confirmação
//   GET/PUT /api/onboarding            ler / guardar o cadastro (guardar é parcial)
//   POST /api/onboarding/documents/:t  enviar ou substituir um documento (multipart, campo «file»)
//   POST /api/onboarding/submit        submeter para análise da KIXIMA
import { api } from './client';

// Documentos que o utilizador pode enviar além dos exigidos por tipo de empresa.
export const DOC_APOLICE = 'APOLICE_SEGURO';
export const DOC_LOGOTIPO = 'LOGOTIPO';
export const TAMANHO_MAXIMO_MB = 10;

export const registar = ({ type, name, email, password, termsAccepted }) =>
  api.post('/api/auth/register', { type, name, email, password, termsAccepted });

export const confirmarEmail = (token) => api.post('/api/auth/verify-email', { token });

export const reenviarConfirmacao = (email) => api.post('/api/auth/resend-verification', { email });

export const obterCadastro = () => api.get('/api/onboarding');

export const guardarCadastro = (campos) => api.put('/api/onboarding', campos);

export function enviarDocumento(tipo, ficheiro) {
  const fd = new FormData();
  fd.append('file', ficheiro);
  return api.postForm(`/api/onboarding/documents/${encodeURIComponent(tipo)}`, fd);
}

export const submeterCadastro = () => api.post('/api/onboarding/submit');

/** Ficheiro aceite pelo servidor: PDF ou imagem, até 10 MB. Devolve a mensagem de erro, ou '' se estiver bem. */
export function validarFicheiro(f, { soImagem = false } = {}) {
  if (!f) return 'Escolha o ficheiro a enviar.';
  const tipo = f.type || '';
  const ok = soImagem ? /^image\/(png|jpe?g|webp|gif)$/.test(tipo) : /^image\/(png|jpe?g|webp|gif)$/.test(tipo) || tipo === 'application/pdf';
  if (!ok) return soImagem ? 'O logótipo tem de ser uma imagem (PNG/JPG).' : 'Documento inválido — use PDF ou imagem (PNG/JPG).';
  if (f.size > TAMANHO_MAXIMO_MB * 1024 * 1024) return 'O documento é demasiado grande (máximo 10 MB).';
  return '';
}
