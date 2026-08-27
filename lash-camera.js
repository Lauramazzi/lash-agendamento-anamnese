/**
 * lash-camera.js — Módulo de Câmera para Captura dos Olhos
 * =========================================================
 * Gerencia acesso à câmera, preview ao vivo e captura de foto.
 * Compatível com celular (câmera traseira) e desktop (webcam).
 */

(function () {
  'use strict';

  class LashCamera {
    constructor() {
      this.stream = null;
      this.videoEl = null;
      this.canvasEl = document.createElement('canvas');
      this._onCaptura = null;
    }

    on(evento, cb) {
      if (evento === 'captura') this._onCaptura = cb;
      return this;
    }

    /**
     * Inicia a câmera e renderiza o preview no elemento <video> especificado
     * @param {HTMLVideoElement} videoEl
     * @param {'user'|'environment'} facingMode - 'environment' = câmera traseira
     */
    async iniciar(videoEl, facingMode = 'environment') {
      this.videoEl = videoEl;

      // Para câmera anterior se estava ativa
      this.parar();

      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width:  { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        this.videoEl.srcObject = this.stream;
        await this.videoEl.play();
        console.log('[LashCamera] Câmera iniciada ✓');
        return true;
      } catch (err) {
        console.error('[LashCamera] Erro ao acessar câmera:', err);
        throw new Error(this._mensagemErro(err));
      }
    }

    /** Alterna entre câmera frontal e traseira */
    async alternarCamera() {
      if (!this.videoEl) return;
      const track = this.stream?.getVideoTracks?.()?.[0];
      const settings = track?.getSettings?.() || {};
      const novoFacing = settings.facingMode === 'environment' ? 'user' : 'environment';
      await this.iniciar(this.videoEl, novoFacing);
    }

    /**
     * Captura o frame atual do vídeo como base64
     * @param {number} qualidade - 0 a 1 (padrão 0.92)
     * @returns {string} base64 data URL
     */
    capturar(qualidade = 0.92) {
      if (!this.videoEl || !this.videoEl.srcObject) {
        throw new Error('Câmera não está ativa');
      }

      const w = this.videoEl.videoWidth  || 1280;
      const h = this.videoEl.videoHeight || 720;

      this.canvasEl.width  = w;
      this.canvasEl.height = h;

      const ctx = this.canvasEl.getContext('2d');
      ctx.drawImage(this.videoEl, 0, 0, w, h);

      const base64 = this.canvasEl.toDataURL('image/jpeg', qualidade);

      if (typeof this._onCaptura === 'function') {
        this._onCaptura(base64);
      }

      console.log('[LashCamera] Foto capturada ✓', `${w}x${h}`);
      return base64;
    }

    /**
     * Captura com contagem regressiva visual
     * @param {number} segundos
     * @param {Function} onContagem - chamada a cada segundo com o número restante
     */
    capturarComContagem(segundos = 3, onContagem = null) {
      return new Promise((resolve) => {
        let restante = segundos;

        const tick = () => {
          if (typeof onContagem === 'function') onContagem(restante);
          if (restante <= 0) {
            resolve(this.capturar());
            return;
          }
          restante--;
          setTimeout(tick, 1000);
        };

        tick();
      });
    }

    /** Para a câmera e libera recursos */
    parar() {
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      if (this.videoEl) {
        this.videoEl.srcObject = null;
      }
    }

    /** Verifica se o dispositivo tem câmera */
    static async temCamera() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(d => d.kind === 'videoinput');
      } catch {
        return false;
      }
    }

    _mensagemErro(err) {
      if (err.name === 'NotAllowedError')  return 'Permissão de câmera negada. Permita o acesso nas configurações do navegador.';
      if (err.name === 'NotFoundError')    return 'Nenhuma câmera encontrada no dispositivo.';
      if (err.name === 'NotReadableError') return 'Câmera em uso por outro aplicativo.';
      return 'Erro ao acessar câmera: ' + err.message;
    }
  }

  window.LashCamera = LashCamera;
  console.log('[LashCamera] ✓ Módulo carregado');
})();
