/**
 * netlify/functions/gemini-proxy.js
 * Proxy seguro para a Gemini API.
 * A chave fica no servidor Netlify -- nunca exposta no frontend.
 *
 * Camadas de proteção:
 *  1. Só aceita chamadas cuja origem (Origin) seja o próprio site (evita uso do
 *     endpoint por outros sites/scripts como relay gratuito da sua chave).
 *  2. generationConfig é fixo no servidor por modelo -- o que o cliente manda é
 *     ignorado, para impedir abuso de custo (maxOutputTokens/temperature arbitrários).
 *  3. Limite de tamanho de payload (imagem em base64) antes de repassar à Gemini.
 *  4. Rate limit simples por IP (best-effort, válido enquanto a instância da função
 *     estiver "quente" -- não substitui um limitador distribuído, mas já corta
 *     abuso automatizado casual).
 */

// Domínios autorizados a chamar este proxy. Ajuste/adicione via env ALLOWED_ORIGINS
// (separado por vírgula) se o site for servido em mais de um domínio.
const DEFAULT_ALLOWED_ORIGINS = [
  'https://lash-studio.netlify.app'
];

// generationConfig fixo por modelo -- o valor enviado pelo cliente é descartado.
const MODEL_GENERATION_CONFIG = {
  'gemini-2.0-flash': { temperature: 0.1, maxOutputTokens: 512 },
  'gemini-2.0-flash-preview-image-generation': {
    temperature: 0.3,
    maxOutputTokens: 4096,
    responseModalities: ['IMAGE', 'TEXT']
  }
};

const MAX_BODY_BYTES = 6 * 1024 * 1024; // 6MB, cobre a imagem em base64 + prompt
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

// Mapa em memória do processo -- reseta a cada cold start, mas mitiga rajadas
// enquanto a instância da função permanece ativa.
const requestLog = new Map();

function isOriginAllowed(event) {
  const allowed = (process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS);

  const origin = event.headers.origin || event.headers.Origin;
  const referer = event.headers.referer || event.headers.Referer;

  if (origin) return allowed.some(a => origin === a);
  if (referer) return allowed.some(a => referer.startsWith(a));

  // Sem Origin nem Referer (raro em chamadas de navegador): nega por padrão.
  return false;
}

function getClientIp(event) {
  return event.headers['x-nf-client-connection-ip']
    || (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = requestLog.get(ip) || { count: 0, windowStart: now };

  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count += 1;
  requestLog.set(ip, entry);

  // Evita crescimento ilimitado do Map em instâncias de longa duração.
  if (requestLog.size > 5000) requestLog.clear();

  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!isOriginAllowed(event)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Origem não autorizada.' }) };
  }

  const ip = getClientIp(event);
  if (isRateLimited(ip)) {
    return { statusCode: 429, body: JSON.stringify({ error: 'Muitas requisições. Tente novamente em instantes.' }) };
  }

  if (event.body && Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) {
    return { statusCode: 413, body: JSON.stringify({ error: 'Payload muito grande.' }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GEMINI_API_KEY nao configurada no Netlify.' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Body invalido.' }) };
  }

  const { model, payload } = body;

  if (!MODEL_GENERATION_CONFIG[model]) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Modelo nao permitido.' }) };
  }

  if (!payload || !Array.isArray(payload.contents) || payload.contents.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Payload invalido.' }) };
  }

  // generationConfig sempre fixo no servidor -- o que vier do cliente é ignorado.
  const safePayload = {
    contents: payload.contents,
    generationConfig: MODEL_GENERATION_CONFIG[model]
  };

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const resposta = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safePayload)
    });

    const dados = await resposta.json();

    return {
      statusCode: resposta.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    };

  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Erro ao conectar com Gemini: ' + err.message })
    };
  }
};
