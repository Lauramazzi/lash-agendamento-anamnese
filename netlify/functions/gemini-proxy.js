/**
 * netlify/functions/gemini-proxy.js
 * Proxy seguro para a Gemini API.
 * A chave fica no servidor Netlify -- nunca exposta no frontend.
 */

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
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

  const MODELOS_PERMITIDOS = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-preview-image-generation'
  ];

  if (!MODELOS_PERMITIDOS.includes(model)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Modelo nao permitido.' }) };
  }

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const resposta = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const dados = await resposta.json();

    return {
      statusCode: resposta.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(dados)
    };

  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Erro ao conectar com Gemini: ' + err.message })
    };
  }
};
