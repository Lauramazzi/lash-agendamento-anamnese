/**
 * lash-agent.js — Agente Deliberativo de Cílios (BDI)
 * ====================================================
 * Arquitetura BDI (Beliefs-Desires-Intentions):
 *   Beliefs  → Dados dos olhos analisados (formato, distância, inclinação)
 *   Desires  → Encontrar o melhor formato de cílios para a cliente
 *   Intentions → Sugestão ranqueada + simulação visual + armazenamento
 *
 * Integração: Gemini 2.0 Flash (Vision) para análise de olhos
 * Dependências: lash-simulator.js, lash-portfolio.js
 */

(function () {
  'use strict';

  const GEMINI_MODEL = 'gemini-2.0-flash';

  // ─────────────────────────────────────────────
  // BASE DE CONHECIMENTO — formatos de cílios
  // ─────────────────────────────────────────────
  const LASH_STYLES = {
    fox_eye: {
      id: 'fox_eye',
      nome: 'Fox Eye',
      descricao: 'Mapeamento que alonga o canto externo, criando olhar de raposa elevado e marcante.',
      indicadoPara: ['amendoado', 'redondo', 'caido_nas_pontas'],
      contraindicado: ['muito_pequeno'],
      emoji: '🦊',
      imagemOverlay: 'images/overlay_fox_eye.svg'
    },
    cat_eye: {
      id: 'cat_eye',
      nome: 'Cat Eye',
      descricao: 'Extensão concentrada no canto externo para efeito de gato, alongando e definindo.',
      indicadoPara: ['pequeno', 'redondo', 'distante'],
      contraindicado: [],
      emoji: '🐱',
      imagemOverlay: 'images/overlay_cat_eye.svg'
    },
    volume_brasileiro: {
      id: 'volume_brasileiro',
      nome: 'Volume Brasileiro',
      descricao: 'Fios em Y que proporcionam volume natural e maciez. Efeito preenchimento.',
      indicadoPara: ['grande', 'amendoado', 'equilibrado'],
      contraindicado: [],
      emoji: '✨',
      imagemOverlay: 'images/overlay_brasileiro.svg'
    },
    boneca: {
      id: 'boneca',
      nome: 'Boneca / Doll',
      descricao: 'Concentrado no centro do olho, abrindo o olhar e dando efeito de inocência.',
      indicadoPara: ['pequeno', 'fundos', 'palpebrasPesadas'],
      contraindicado: ['muito_grande'],
      emoji: '👁️',
      imagemOverlay: 'images/overlay_boneca.svg'
    },
    squirrel: {
      id: 'squirrel',
      nome: 'Esquilo (Squirrel)',
      descricao: 'Levanta a pálpebra e o canto externo, com pico no terço médio-externo.',
      indicadoPara: ['caido_nas_pontas', 'oriental', 'monopalpebrais'],
      contraindicado: [],
      emoji: '🐿️',
      imagemOverlay: 'images/overlay_squirrel.svg'
    },
    natural: {
      id: 'natural',
      nome: 'Natural',
      descricao: 'Realça os cílios naturais com comprimento uniforme. Efeito sutil e elegante.',
      indicadoPara: ['qualquer'],
      contraindicado: [],
      emoji: '🌿',
      imagemOverlay: 'images/overlay_natural.svg'
    },
    open_eye: {
      id: 'open_eye',
      nome: 'Open Eye',
      descricao: 'Abre o olhar com curvatura máxima no centro. Ideal para olhos fundos e caídos.',
      indicadoPara: ['fundos', 'caido_nas_pontas', 'palpebrasPesadas'],
      contraindicado: [],
      emoji: '👀',
      imagemOverlay: 'images/overlay_open_eye.svg'
    },
    wispy: {
      id: 'wispy',
      nome: 'Wispy',
      descricao: 'Mix de comprimentos que cria efeito despenteado, leve e romântico.',
      indicadoPara: ['amendoado', 'grande', 'equilibrado'],
      contraindicado: [],
      emoji: '🌸',
      imagemOverlay: 'images/overlay_wispy.svg'
    }
  };

  // ─────────────────────────────────────────────
  // CLASSE PRINCIPAL — AGENTE DELIBERATIVO
  // ─────────────────────────────────────────────
  class LashAgent {
    constructor() {
      // BELIEFS — base de crenças sobre o mundo atual
      this.beliefs = {
        imagemBase64: null,
        clienteId: null,
        clienteNome: null,
        analiseOlhos: null,
        sugestoes: [],
        formatoEscolhido: null,
        imagemSimulada: null,
        estadoAtual: 'ocioso'
      };

      // DESIRES — objetivos ordenados por prioridade
      this.desires = [
        { id: 'analisar_olhos',  prioridade: 1, condicao: () => !!this.beliefs.imagemBase64 && !this.beliefs.analiseOlhos },
        { id: 'gerar_sugestoes', prioridade: 2, condicao: () => !!this.beliefs.analiseOlhos && this.beliefs.sugestoes.length === 0 },
        { id: 'aguardar_escolha',prioridade: 3, condicao: () => this.beliefs.sugestoes.length > 0 && !this.beliefs.formatoEscolhido },
        { id: 'simular_formato', prioridade: 4, condicao: () => !!this.beliefs.formatoEscolhido && !this.beliefs.imagemSimulada },
        { id: 'salvar_resultado',prioridade: 5, condicao: () => !!this.beliefs.imagemSimulada }
      ];

      this.intentions = null;
      this.geminiApiKey = window.GEMINI_API_KEY || '';
      this._callbacks = {};
    }

    // ─────────────────────────────────────────
    // API PÚBLICA
    // ─────────────────────────────────────────

    on(evento, cb) { this._callbacks[evento] = cb; return this; }
    setApiKey(key) { this.geminiApiKey = key; return this; }

    async iniciar(imagemBase64, clienteId, clienteNome) {
      Object.assign(this.beliefs, {
        imagemBase64, clienteId, clienteNome,
        analiseOlhos: null, sugestoes: [], formatoEscolhido: null, imagemSimulada: null
      });
      await this._ciclo();
    }

    async escolherFormato(formatoId) {
      if (!LASH_STYLES[formatoId]) return;
      this.beliefs.formatoEscolhido = formatoId;
      this._emit('estadoChange', { estado: 'simulando', mensagem: 'Gerando simulação visual...' });
      await this._ciclo();
    }

    getTodosFormatos() { return Object.values(LASH_STYLES); }

    // ─────────────────────────────────────────
    // CICLO DELIBERATIVO (BDI)
    // ─────────────────────────────────────────

    async _ciclo() {
      const obj = this._deliberar();
      if (!obj) return;
      this.intentions = obj;
      await this._executar(obj);
      const prox = this._deliberar();
      if (prox && prox.id !== 'aguardar_escolha' && prox.id !== obj.id) await this._ciclo();
    }

    _deliberar() {
      return this.desires.filter(d => d.condicao()).sort((a, b) => a.prioridade - b.prioridade)[0] || null;
    }

    async _executar(obj) {
      switch (obj.id) {
        case 'analisar_olhos':  await this._analisarOlhos(); break;
        case 'gerar_sugestoes': this._gerarSugestoes(); break;
        case 'simular_formato': await this._simularFormato(); break;
        case 'salvar_resultado':await this._salvarResultado(); break;
      }
    }

    // ─────────────────────────────────────────
    // AÇÃO 1: ANÁLISE (Gemini Vision)
    // ─────────────────────────────────────────

    async _analisarOlhos() {
      this._emit('estadoChange', { estado: 'analisando', mensagem: 'Analisando seus olhos com IA...' });

      const prompt = `Você é especialista em extensão de cílios. Analise os olhos na imagem.
Retorne APENAS este JSON (sem markdown):
{
  "formatoOlho": "<amendoado|redondo|pequeno|grande|monopalpebral|caido_nas_pontas|fundos|oriental|equilibrado>",
  "distanciaOlhos": "<proximos|media|distante>",
  "inclinacaoPalpebra": "<muito_caida|levemente_caida|neutra|levemente_levantada|muito_levantada>",
  "espessuraPalpebra": "<fina|media|grossa>",
  "visibilidadeCiliosNaturais": "<poucos|media|muitos>",
  "observacoesEspeciais": "<texto ou null>",
  "confiancaAnalise": <0-100>
}`;

      try {
        if (!this.geminiApiKey) {
          this.beliefs.analiseOlhos = this._analiseDemo();
          return;
        }

        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${this.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: 'image/jpeg', data: this.beliefs.imagemBase64.replace(/^data:image\/\w+;base64,/, '') } }
                ]
              }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
            })
          }
        );

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const jsonMatch = texto.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('JSON não encontrado na resposta');
        this.beliefs.analiseOlhos = JSON.parse(jsonMatch[0]);
        console.log('[LashAgent] Análise:', this.beliefs.analiseOlhos);

      } catch (err) {
        console.error('[LashAgent] Gemini Vision error:', err);
        this.beliefs.analiseOlhos = this._analiseDemo();
        this._emit('estadoChange', { estado: 'aviso', mensagem: 'Sem acesso à IA — usando análise padrão.' });
      }
    }

    _analiseDemo() {
      return {
        formatoOlho: 'amendoado', distanciaOlhos: 'media',
        inclinacaoPalpebra: 'neutra', espessuraPalpebra: 'media',
        visibilidadeCiliosNaturais: 'media',
        observacoesEspeciais: 'Modo demonstração — configure GEMINI_API_KEY',
        confiancaAnalise: 50, modoDemo: true
      };
    }

    // ─────────────────────────────────────────
    // AÇÃO 2: GERAR SUGESTÕES
    // ─────────────────────────────────────────

    _gerarSugestoes() {
      const { formatoOlho, inclinacaoPalpebra } = this.beliefs.analiseOlhos;

      const scored = Object.values(LASH_STYLES).map(estilo => {
        let score = 0;
        const justificativa = [];

        if (estilo.indicadoPara.includes(formatoOlho))  { score += 40; justificativa.push(`ideal para olhos ${formatoOlho}`); }
        if (estilo.indicadoPara.includes('qualquer'))    { score += 20; justificativa.push('versátil para qualquer olho'); }
        if (estilo.contraindicado.includes(formatoOlho)){ score -= 50; justificativa.push('⚠️ não recomendado'); }
        if (inclinacaoPalpebra?.includes('caida') && ['squirrel','fox_eye','open_eye'].includes(estilo.id)) {
          score += 25; justificativa.push('levanta o olhar caído');
        }
        if (inclinacaoPalpebra?.includes('levantada') && ['cat_eye','fox_eye'].includes(estilo.id)) {
          score += 15; justificativa.push('potencializa o olhar levantado');
        }

        return { ...estilo, score, justificativa: justificativa.join(' · ') || 'compatível com seu olho' };
      });

      this.beliefs.sugestoes = scored.filter(s => s.score >= 0).sort((a, b) => b.score - a.score).slice(0, 3);
      this._emit('estadoChange', { estado: 'sugerindo' });
      this._emit('sugestoes', {
        sugestoes: this.beliefs.sugestoes,
        analise: this.beliefs.analiseOlhos,
        todosFormatos: this.getTodosFormatos()
      });
    }

    // ─────────────────────────────────────────
    // AÇÃO 3: SIMULAR FORMATO
    // ─────────────────────────────────────────

    async _simularFormato() {
      const estilo = LASH_STYLES[this.beliefs.formatoEscolhido];

      // Tenta Gemini Imagen (inpainting)
      if (this.geminiApiKey) {
        const gerada = await this._geminiImagen(estilo);
        if (gerada) {
          this.beliefs.imagemSimulada = gerada;
          this._emit('simulacao', { imagemSimulada: gerada, estilo, tipo: 'ia' });
          return;
        }
      }

      // Fallback: overlay via LashSimulator
      if (window.LashSimulator) {
        const overlay = await window.LashSimulator.aplicarOverlay(this.beliefs.imagemBase64, estilo);
        this.beliefs.imagemSimulada = overlay;
        this._emit('simulacao', { imagemSimulada: overlay, estilo, tipo: 'overlay' });
      } else {
        this.beliefs.imagemSimulada = this.beliefs.imagemBase64;
        this._emit('simulacao', { imagemSimulada: this.beliefs.imagemBase64, estilo, tipo: 'original' });
      }
    }

    async _geminiImagen(estilo) {
      try {
        const prompt = `Adicione de forma REALISTA o estilo de cílios postiços "${estilo.nome}" (${estilo.descricao}) sobre os cílios superiores da pessoa na imagem. Mantenha o restante da foto idêntico. Resultado deve parecer foto real após aplicação profissional.`;

        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${this.geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [
                { text: prompt },
                { inlineData: { mimeType: 'image/jpeg', data: this.beliefs.imagemBase64.replace(/^data:image\/\w+;base64,/, '') } }
              ]}],
              generationConfig: { temperature: 0.3, maxOutputTokens: 4096, responseModalities: ['IMAGE', 'TEXT'] }
            })
          }
        );

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const img = (data.candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.mimeType?.startsWith('image/'));
        return img ? `data:${img.inlineData.mimeType};base64,${img.inlineData.data}` : null;
      } catch (e) {
        console.error('[LashAgent] Gemini Imagen error:', e);
        return null;
      }
    }

    // ─────────────────────────────────────────
    // AÇÃO 4: SALVAR RESULTADO
    // ─────────────────────────────────────────

    async _salvarResultado() {
      this._emit('estadoChange', { estado: 'salvando', mensagem: 'Salvando no perfil da cliente...' });
      try {
        if (window.LashPortfolio) {
          const resultado = await window.LashPortfolio.salvar({
            clienteId:        this.beliefs.clienteId,
            clienteNome:      this.beliefs.clienteNome,
            imagemOriginal:   this.beliefs.imagemBase64,
            imagemSimulada:   this.beliefs.imagemSimulada,
            analiseOlhos:     this.beliefs.analiseOlhos,
            sugestoes:        this.beliefs.sugestoes.map(s => s.id),
            formatoEscolhido: this.beliefs.formatoEscolhido,
            estiloDetalhes:   LASH_STYLES[this.beliefs.formatoEscolhido]
          });
          this._emit('finalizado', resultado);
        } else {
          this._emit('finalizado', { clienteId: this.beliefs.clienteId, formatoEscolhido: this.beliefs.formatoEscolhido });
        }
        this._emit('estadoChange', { estado: 'finalizado', mensagem: 'Salvo com sucesso! ✓' });
      } catch (err) {
        console.error('[LashAgent] Erro ao salvar:', err);
        this._emit('estadoChange', { estado: 'erro', mensagem: 'Erro ao salvar. Tente novamente.' });
      }
    }

    // ─────────────────────────────────────────
    _emit(evento, dados) {
      if (typeof this._callbacks[evento] === 'function') this._callbacks[evento](dados);
    }
  }

  window.LashAgent = LashAgent;
  window.LASH_STYLES = LASH_STYLES;
  console.log('[LashAgent] ✓ Módulo carregado');
})();
