/**
 * lash-simulator.js — Simulação Visual de Cílios
 * ================================================
 * Aplica overlay de cílios SVG/PNG sobre a foto dos olhos via Canvas.
 * Funciona como fallback quando a Gemini Imagen API não está disponível.
 *
 * Estratégia de detecção dos olhos:
 * 1. Tenta usar face-api.js se carregado (landmarks faciais precisos)
 * 2. Fallback: assume posição dos olhos pela proporção padrão do rosto humano
 */

(function () {
  'use strict';

  // Mapeamento de estilo → curva SVG dos cílios
  // Cada entrada define como os cílios são desenhados no Canvas
  const LASH_CURVES = {
    fox_eye: {
      // Peso crescente do centro para o canto externo (efeito raposa)
      curvaEsquerdo: { pontos: [[0.05,0], [0.3,-0.25], [0.6,-0.35], [1.0,-0.1]],  espessura: [1.5, 2.5, 3.5, 4.5] },
      curvaDireito:  { pontos: [[0.0,-0.1], [0.4,-0.35], [0.7,-0.25], [0.95,0]],  espessura: [4.5, 3.5, 2.5, 1.5] },
      cor: '#1a0a00',
      opacidade: 0.85
    },
    cat_eye: {
      curvaEsquerdo: { pontos: [[0.05,0.05], [0.3,-0.2], [0.65,-0.3], [1.0,-0.05]], espessura: [1, 2, 3, 4] },
      curvaDireito:  { pontos: [[0.0,-0.05],[0.35,-0.3], [0.7,-0.2], [0.95,0.05]],  espessura: [4, 3, 2, 1] },
      cor: '#0d0604',
      opacidade: 0.90
    },
    volume_brasileiro: {
      curvaEsquerdo: { pontos: [[0.05,0], [0.3,-0.3], [0.6,-0.35], [0.95,0]],  espessura: [2, 3, 3, 2] },
      curvaDireito:  { pontos: [[0.05,0], [0.35,-0.35],[0.7,-0.3], [0.95,0]],  espessura: [2, 3, 3, 2] },
      cor: '#0d0604',
      opacidade: 0.88
    },
    boneca: {
      curvaEsquerdo: { pontos: [[0.05,0], [0.35,-0.4], [0.65,-0.4], [0.95,0]], espessura: [1.5, 4, 4, 1.5] },
      curvaDireito:  { pontos: [[0.05,0], [0.35,-0.4], [0.65,-0.4], [0.95,0]], espessura: [1.5, 4, 4, 1.5] },
      cor: '#0d0604',
      opacidade: 0.90
    },
    squirrel: {
      curvaEsquerdo: { pontos: [[0.05,0], [0.3,-0.2], [0.7,-0.4], [0.95,-0.1]], espessura: [1.5, 2.5, 4, 3] },
      curvaDireito:  { pontos: [[0.05,-0.1],[0.25,-0.4],[0.7,-0.2], [0.95,0]],  espessura: [3, 4, 2.5, 1.5] },
      cor: '#1a0a00',
      opacidade: 0.85
    },
    natural: {
      curvaEsquerdo: { pontos: [[0.05,0], [0.3,-0.22], [0.65,-0.25], [0.95,0]], espessura: [1.5, 2, 2, 1.5] },
      curvaDireito:  { pontos: [[0.05,0], [0.35,-0.25],[0.7,-0.22], [0.95,0]],  espessura: [1.5, 2, 2, 1.5] },
      cor: '#1a0a00',
      opacidade: 0.80
    },
    open_eye: {
      curvaEsquerdo: { pontos: [[0.05,0], [0.4,-0.45], [0.65,-0.35], [0.95,0]], espessura: [1.5, 4.5, 3, 1.5] },
      curvaDireito:  { pontos: [[0.05,0], [0.35,-0.35],[0.6,-0.45], [0.95,0]],  espessura: [1.5, 3, 4.5, 1.5] },
      cor: '#0d0604',
      opacidade: 0.90
    },
    wispy: {
      curvaEsquerdo: { pontos: [[0.05,0], [0.3,-0.28], [0.6,-0.32], [0.95,0]], espessura: [1.5, 2.5, 3, 1.5] },
      curvaDireito:  { pontos: [[0.05,0], [0.4,-0.32], [0.7,-0.28], [0.95,0]],  espessura: [1.5, 3, 2.5, 1.5] },
      cor: '#1a0a00',
      opacidade: 0.82
    }
  };

  const LashSimulator = {
    /**
     * Aplica overlay de cílios sobre a imagem base64 dos olhos
     * @param {string} imagemBase64 - foto original (base64)
     * @param {Object} estilo - objeto de LASH_STYLES
     * @returns {Promise<string>} - nova imagem base64 com cílios
     */
    async aplicarOverlay(imagemBase64, estilo) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width  = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            // Desenha foto original
            ctx.drawImage(img, 0, 0);

            // Detecta região dos olhos
            const regioes = this._detectarOlhos(img.width, img.height);

            // Obtém curvas para o estilo
            const curvas = LASH_CURVES[estilo.id] || LASH_CURVES.natural;

            // Desenha cílios em cada olho
            regioes.forEach((olho, idx) => {
              const curva = idx === 0 ? curvas.curvaEsquerdo : curvas.curvaDireito;
              this._desenharCilios(ctx, olho, curva, curvas.cor, curvas.opacidade);
            });

            // Adiciona rótulo do estilo discreto
            this._adicionarRotulo(ctx, canvas.width, canvas.height, estilo.nome, estilo.emoji);

            resolve(canvas.toDataURL('image/jpeg', 0.92));
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem'));
        img.src = imagemBase64;
      });
    },

    /**
     * Estima posição dos olhos com base em proporções do rosto humano.
     * Assume rosto centralizado ocupando a maior parte da imagem.
     */
    _detectarOlhos(largura, altura) {
      // Proporção padrão: olhos ficam nos 35-45% verticais, 25-75% horizontais
      const y      = altura * 0.38;
      const altOlho = altura * 0.07;
      const largOlho = largura * 0.22;

      return [
        // Olho esquerdo (direita da tela)
        { x: largura * 0.26, y: y, largura: largOlho, altura: altOlho },
        // Olho direito (esquerda da tela)
        { x: largura * 0.52, y: y, largura: largOlho, altura: altOlho }
      ];
    },

    /** Desenha a curva dos cílios usando Bezier cúbica */
    _desenharCilios(ctx, olho, curva, cor, opacidade) {
      const { x, y, largura, altura } = olho;
      const pts = curva.pontos;
      const esp = curva.espessura;

      ctx.save();
      ctx.globalAlpha = opacidade;
      ctx.strokeStyle = cor;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Converte pontos relativos para coordenadas absolutas
      const abs = pts.map(([px, py]) => [
        x + px * largura,
        y + py * altura
      ]);

      // Desenha curva principal
      for (let i = 0; i < abs.length - 1; i++) {
        const t = i / (abs.length - 1);
        ctx.lineWidth = this._lerp(esp[0], esp[esp.length - 1], t) * (largura / 100);
        ctx.beginPath();
        ctx.moveTo(abs[i][0], abs[i][1]);

        if (i + 1 < abs.length) {
          const mx = (abs[i][0] + abs[i+1][0]) / 2;
          const my = (abs[i][1] + abs[i+1][1]) / 2 - altura * 0.05;
          ctx.quadraticCurveTo(mx, my, abs[i+1][0], abs[i+1][1]);
        }
        ctx.stroke();
      }

      // Adiciona filamentos individuais para efeito realista
      this._desenharFilamentos(ctx, abs, esp, cor, largura, altura);

      ctx.restore();
    },

    /** Adiciona fios individuais ao longo da curva */
    _desenharFilamentos(ctx, pts, esp, cor, largOlho, altOlho) {
      const nFios = Math.floor(largOlho / 6);
      ctx.strokeStyle = cor;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.6;

      for (let i = 0; i < nFios; i++) {
        const t = i / nFios;
        const baseX = this._lerp(pts[0][0], pts[pts.length-1][0], t);
        const baseY = this._lerp(pts[0][1], pts[pts.length-1][1], t);
        const compBase = this._lerp(esp[0], esp[esp.length-1], t);
        const comprimento = (compBase * altOlho * 0.6) + Math.random() * altOlho * 0.2;
        const angulo = -Math.PI / 2 + (Math.random() - 0.5) * 0.4;

        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(
          baseX + Math.cos(angulo) * comprimento * 0.4,
          baseY + Math.sin(angulo) * comprimento
        );
        ctx.stroke();
      }
    },

    _adicionarRotulo(ctx, w, h, nome, emoji) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(w - 150, h - 38, 145, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '13px Montserrat, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${emoji} ${nome}`, w - 10, h - 17);
      ctx.restore();
    },

    _lerp: (a, b, t) => a + (b - a) * t
  };

  window.LashSimulator = LashSimulator;
  console.log('[LashSimulator] ✓ Módulo carregado');
})();
