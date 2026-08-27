/**
 * lash-portfolio.js — Armazenamento no Firebase e Geração de Portfólio
 * =====================================================================
 * Salva resultados da IA no Firestore (ficha da cliente)
 * e imagens no Firebase Storage.
 *
 * Coleção Firestore: clientes/{clienteId}/resultados_ia/{autoId}
 * Storage paths:
 *   /lash-ai/{clienteId}/{timestamp}_original.jpg
 *   /lash-ai/{clienteId}/{timestamp}_simulado.jpg
 *   /portfolio/{clienteId}/{timestamp}_portfolio.jpg
 */

(function () {
  'use strict';

  const LashPortfolio = {

    /**
     * Salva todo o resultado do agente
     * @param {Object} dados - {clienteId, clienteNome, imagemOriginal, imagemSimulada, analiseOlhos, sugestoes, formatoEscolhido, estiloDetalhes}
     * @returns {Promise<Object>} - documento salvo com URLs
     */
    async salvar(dados) {
      const { clienteId, clienteNome, imagemOriginal, imagemSimulada, analiseOlhos, sugestoes, formatoEscolhido, estiloDetalhes } = dados;
      const ts = Date.now();

      // Gera foto de portfólio (antes/depois)
      const imagemPortfolio = await this._gerarFotoPortfolio(imagemOriginal, imagemSimulada, estiloDetalhes, clienteNome);

      // Faz upload das imagens no Firebase Storage
      const [urlOriginal, urlSimulada, urlPortfolio] = await Promise.all([
        this._uploadImagem(imagemOriginal, `lash-ai/${clienteId}/${ts}_original.jpg`),
        this._uploadImagem(imagemSimulada, `lash-ai/${clienteId}/${ts}_simulado.jpg`),
        this._uploadImagem(imagemPortfolio, `portfolio/${clienteId}/${ts}_portfolio.jpg`)
      ]);

      // Monta documento para Firestore
      const documento = {
        criadoEm:        new Date(),
        clienteId,
        clienteNome,
        fotoOriginalUrl:  urlOriginal,
        fotoSimuladaUrl:  urlSimulada,
        fotoPortfolioUrl: urlPortfolio,
        analiseOlhos,
        agenteSugestoes:  sugestoes,
        formatoEscolhido,
        estiloNome:       estiloDetalhes?.nome || formatoEscolhido,
        versaoAgente:     '1.0.0'
      };

      // Salva no Firestore
      const ref = await this._salvarFirestore(clienteId, documento);
      documento.id = ref;

      console.log('[LashPortfolio] Resultado salvo ✓', documento.id);
      return documento;
    },

    // ─────────────────────────────────────────
    // GERAÇÃO DA FOTO DE PORTFÓLIO (antes/depois)
    // ─────────────────────────────────────────

    async _gerarFotoPortfolio(imagemOriginal, imagemSimulada, estilo, clienteNome) {
      return new Promise((resolve) => {
        const carregarImagem = (src) => new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = src;
        });

        Promise.all([
          carregarImagem(imagemOriginal),
          carregarImagem(imagemSimulada || imagemOriginal)
        ]).then(([imgOrig, imgSim]) => {
          const canvas = document.createElement('canvas');
          const margem = 20;
          const largImg = Math.min(imgOrig.width, 600);
          const altImg = Math.round(largImg * imgOrig.height / imgOrig.width);
          const altTotal = altImg + 140; // espaço para cabeçalho e rodapé

          canvas.width  = largImg * 2 + margem * 3;
          canvas.height = altTotal + margem * 2;

          const ctx = canvas.getContext('2d');

          // Fundo degradê escuro elegante
          const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
          grad.addColorStop(0,   '#1a0a1a');
          grad.addColorStop(0.5, '#2d1b2d');
          grad.addColorStop(1,   '#1a0a1a');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Borda dourada fina
          ctx.strokeStyle = '#c9a96e';
          ctx.lineWidth = 2;
          ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

          // Cabeçalho — logo e nome do estúdio
          ctx.fillStyle = '#c9a96e';
          ctx.font = 'bold 22px Georgia, serif';
          ctx.textAlign = 'center';
          ctx.fillText('✨ Lashroom', canvas.width / 2, 38);

          ctx.fillStyle = 'rgba(201, 169, 110, 0.7)';
          ctx.font = '13px Montserrat, sans-serif';
          ctx.fillText('Simulação de Extensão de Cílios', canvas.width / 2, 58);

          // Imagem ANTES
          const x1 = margem;
          const y1 = 80;
          ctx.drawImage(imgOrig, x1, y1, largImg, altImg);

          // Rótulo ANTES
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(x1, y1 + altImg - 32, largImg, 32);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 14px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('ANTES', x1 + largImg / 2, y1 + altImg - 10);

          // Imagem DEPOIS
          const x2 = largImg + margem * 2;
          ctx.drawImage(imgSim, x2, y1, largImg, altImg);

          // Rótulo DEPOIS com nome do estilo
          ctx.fillStyle = 'rgba(201, 169, 110, 0.85)';
          ctx.fillRect(x2, y1 + altImg - 32, largImg, 32);
          ctx.fillStyle = '#1a0a1a';
          ctx.font = 'bold 14px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${estilo?.emoji || '✨'} ${estilo?.nome || 'DEPOIS'}`, x2 + largImg / 2, y1 + altImg - 10);

          // Rodapé
          const yRodape = canvas.height - 35;
          ctx.fillStyle = 'rgba(201, 169, 110, 0.6)';
          ctx.font = '11px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            `${clienteNome ? clienteNome + ' · ' : ''}${new Date().toLocaleDateString('pt-BR')} · lash-studio.netlify.app`,
            canvas.width / 2,
            yRodape
          );

          resolve(canvas.toDataURL('image/jpeg', 0.90));
        }).catch(() => {
          // Se falhar, retorna imagem simulada como portfólio
          resolve(imagemSimulada || imagemOriginal);
        });
      });
    },

    // ─────────────────────────────────────────
    // FIREBASE STORAGE
    // ─────────────────────────────────────────

    async _uploadImagem(base64, path) {
      if (!base64) return null;

      try {
        // Verifica se Firebase Storage está disponível
        if (!window.firebase?.storage) {
          console.warn('[LashPortfolio] Firebase Storage não disponível — URL não gerada');
          return null;
        }

        const storage = firebase.storage();
        const ref = storage.ref(path);

        // Converte base64 para blob
        const blob = this._base64ToBlob(base64, 'image/jpeg');
        const snapshot = await ref.put(blob, { contentType: 'image/jpeg' });
        const url = await snapshot.ref.getDownloadURL();

        console.log('[LashPortfolio] Upload OK:', path);
        return url;
      } catch (err) {
        console.error('[LashPortfolio] Erro no upload:', path, err);
        return null;
      }
    },

    _base64ToBlob(base64, tipo) {
      const byteString = atob(base64.replace(/^data:[^;]+;base64,/, ''));
      const buffer = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) buffer[i] = byteString.charCodeAt(i);
      return new Blob([buffer], { type: tipo });
    },

    // ─────────────────────────────────────────
    // FIRESTORE
    // ─────────────────────────────────────────

    async _salvarFirestore(clienteId, documento) {
      try {
        if (!window.firebase?.firestore) {
          // Fallback: salva no localStorage
          const key = `lash_ai_${clienteId}_${Date.now()}`;
          localStorage.setItem(key, JSON.stringify(documento));
          console.warn('[LashPortfolio] Firebase indisponível — salvo em localStorage');
          return key;
        }

        const db  = firebase.firestore();
        const ref = await db
          .collection('clientes').doc(clienteId)
          .collection('resultados_ia')
          .add(documento);

        return ref.id;
      } catch (err) {
        console.error('[LashPortfolio] Erro no Firestore:', err);
        throw err;
      }
    },

    // ─────────────────────────────────────────
    // CONSULTAS
    // ─────────────────────────────────────────

    /**
     * Busca histórico de resultados de uma cliente
     * @param {string} clienteId
     * @returns {Promise<Array>}
     */
    async buscarHistorico(clienteId) {
      try {
        if (!window.firebase?.firestore) {
          // Recupera do localStorage
          return Object.entries(localStorage)
            .filter(([k]) => k.startsWith(`lash_ai_${clienteId}`))
            .map(([, v]) => { try { return JSON.parse(v); } catch { return null; } })
            .filter(Boolean)
            .sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
        }

        const db = firebase.firestore();
        const snap = await db
          .collection('clientes').doc(clienteId)
          .collection('resultados_ia')
          .orderBy('criadoEm', 'desc')
          .limit(20)
          .get();

        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.error('[LashPortfolio] Erro ao buscar histórico:', err);
        return [];
      }
    },

    /**
     * Busca todos os resultados (para página de portfólio da lashista)
     * @returns {Promise<Array>}
     */
    async buscarPortfolioCompleto() {
      try {
        if (!window.firebase?.firestore) return [];
        const db = firebase.firestore();
        const snap = await db
          .collectionGroup('resultados_ia')
          .orderBy('criadoEm', 'desc')
          .limit(50)
          .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.error('[LashPortfolio] Erro ao buscar portfólio:', err);
        return [];
      }
    }
  };

  window.LashPortfolio = LashPortfolio;
  console.log('[LashPortfolio] ✓ Módulo carregado');
})();
