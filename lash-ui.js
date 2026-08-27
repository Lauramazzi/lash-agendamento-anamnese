/**
 * lash-ui.js — Controlador da Interface do Agente IA de Cílios
 * ============================================================
 * Orquestra a interação entre:
 *   - LashAgent (cérebro deliberativo)
 *   - LashCamera (captura)
 *   - LashSimulator (overlay)
 *   - LashPortfolio (armazenamento)
 *   - Interface do usuário no painel
 *
 * Adicionar ao final do admin.js ou incluir como <script> separado.
 *
 * CONFIGURAÇÃO:
 *   Defina window.GEMINI_API_KEY antes de carregar este script.
 *   Exemplo: <script>window.GEMINI_API_KEY = 'SUA_CHAVE_AQUI';</script>
 */

(function () {
  'use strict';

  // ─── Estado global do módulo ───
  let _agente   = null;
  let _camera   = null;
  let _clienteAtivo = null; // { id, nome }
  let _resultadoFinal = null;
  let _imagemCapturada = null;

  // ─────────────────────────────────────────
  // FUNÇÕES PÚBLICAS (chamadas pelo HTML)
  // ─────────────────────────────────────────

  /**
   * Abre o modal do agente para uma cliente específica
   * @param {string} clienteId
   * @param {string} clienteNome
   */
  window.abrirAgenteIA = async function(clienteId, clienteNome) {
    _clienteAtivo = { id: clienteId, nome: clienteNome };
    _resultadoFinal = null;
    _imagemCapturada = null;

    // Inicializa agente
    _agente = new window.LashAgent();
    _agente
      .on('estadoChange', _onEstadoChange)
      .on('sugestoes',    _onSugestoes)
      .on('simulacao',    _onSimulacao)
      .on('finalizado',   _onFinalizado);

    // Inicializa câmera
    _camera = new window.LashCamera();

    // Mostra modal
    const modal = document.getElementById('modal-lash-ia');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Vai para tela de câmera
    _irParaTela('camera', 1);

    // Inicia câmera
    try {
      const video = document.getElementById('lash-video');
      await _camera.iniciar(video, 'environment');
    } catch (err) {
      _mostrarAviso(err.message);
    }
  };

  window.fecharAgenteIA = function() {
    _camera?.parar();
    const modal = document.getElementById('modal-lash-ia');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  window.alternarCamera = async function() {
    try {
      await _camera.alternarCamera();
    } catch (err) {
      _mostrarAviso('Não foi possível alternar a câmera.');
    }
  };

  window.toggleBotaoCaptura = function() {
    const check = document.getElementById('lash-consentimento-check');
    const btn   = document.getElementById('btn-capturar');
    if (btn) btn.disabled = !check?.checked;
  };

  window.capturarFoto = async function() {
    const btn = document.getElementById('btn-capturar');
    if (btn) btn.disabled = true;

    const countdown = document.getElementById('lash-countdown');
    if (countdown) countdown.style.display = 'flex';

    try {
      _imagemCapturada = await _camera.capturarComContagem(3, (n) => {
        if (countdown) {
          countdown.style.display = n > 0 ? 'flex' : 'none';
          countdown.textContent = n || '';
        }
      });

      if (countdown) countdown.style.display = 'none';
      _camera.parar();

      // Define a foto no preview
      const imgEl = document.getElementById('lash-foto-capturada');
      if (imgEl) imgEl.src = _imagemCapturada;

      // Vai para tela de análise
      _irParaTela('sugestoes', 2);
      _mostrarLoading('lash-loading', 'Analisando seus olhos com IA...');

      // Dispara o agente!
      await _agente.iniciar(_imagemCapturada, _clienteAtivo.id, _clienteAtivo.nome);

    } catch (err) {
      if (countdown) countdown.style.display = 'none';
      if (btn) btn.disabled = false;
      _mostrarAviso(err.message || 'Erro ao capturar foto.');
    }
  };

  window.carregarFotoUpload = function(input) {
    const arquivo = input.files?.[0];
    if (!arquivo) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      _imagemCapturada = e.target.result;
      _camera?.parar();

      const imgEl = document.getElementById('lash-foto-capturada');
      if (imgEl) imgEl.src = _imagemCapturada;

      _irParaTela('sugestoes', 2);
      _mostrarLoading('lash-loading', 'Analisando seus olhos com IA...');
      await _agente.iniciar(_imagemCapturada, _clienteAtivo.id, _clienteAtivo.nome);
    };
    reader.readAsDataURL(arquivo);
  };

  window.escolherFormato = async function(formatoId) {
    // Marca card selecionado
    document.querySelectorAll('.lash-estilo-card').forEach(c => {
      c.classList.toggle('selecionado', c.dataset.formatoId === formatoId);
    });

    // Vai para tela de simulação
    _irParaTela('simulacao', 3);
    _mostrarLoading('lash-loading-sim', 'Gerando simulação visual...');
    document.getElementById('lash-antes-depois').style.display = 'none';
    document.getElementById('lash-sim-controles').style.display = 'none';

    await _agente.escolherFormato(formatoId);
  };

  window.voltarParaSugestoes = function() {
    _agente.beliefs.formatoEscolhido = null;
    _agente.beliefs.imagemSimulada   = null;
    _irParaTela('sugestoes', 2);
  };

  window.confirmarEsalvar = async function() {
    _mostrarLoading('lash-loading-sim', 'Salvando resultado...');
    document.getElementById('lash-antes-depois').style.display = 'none';
    document.getElementById('lash-sim-controles').style.display = 'none';

    // O agente já tem imagem simulada, mas precisa re-disparar o ciclo para salvar
    // como beliefs.imagemSimulada já está preenchido, o ciclo vai direto para _salvarResultado
    const pseudoAcao = _agente._deliberar();
    if (pseudoAcao?.id === 'salvar_resultado') {
      await _agente._executar(pseudoAcao);
    }
  };

  window.baixarPortfolio = function() {
    if (!_resultadoFinal?.fotoPortfolioUrl) {
      // Tenta baixar da imagem local
      const img = document.getElementById('lash-portfolio-preview');
      if (!img?.src || img.src === window.location.href) return;
      const link = document.createElement('a');
      link.href = img.src;
      link.download = `portfolio_${_clienteAtivo?.nome?.replace(/\s+/g,'_') || 'cliente'}_${Date.now()}.jpg`;
      link.click();
      return;
    }
    window.open(_resultadoFinal.fotoPortfolioUrl, '_blank');
  };

  window.verHistorico = async function() {
    if (!_clienteAtivo?.id) return;
    const lista = document.getElementById('lash-historico-lista');
    if (lista) lista.innerHTML = '<p style="color:rgba(255,255,255,0.5);padding:20px;">Carregando...</p>';

    document.getElementById('modal-historico-ia').style.display = 'flex';

    const resultados = await window.LashPortfolio.buscarHistorico(_clienteAtivo.id);
    if (!lista) return;

    if (!resultados.length) {
      lista.innerHTML = '<p style="color:rgba(255,255,255,0.5);padding:20px;text-align:center;">Nenhum resultado encontrado.</p>';
      return;
    }

    lista.innerHTML = resultados.map(r => `
      <div class="lash-historico-card">
        ${r.fotoPortfolioUrl
          ? `<img class="lash-historico-img" src="${r.fotoPortfolioUrl}" alt="Portfólio" loading="lazy">`
          : r.fotoSimuladaUrl
            ? `<img class="lash-historico-img" src="${r.fotoSimuladaUrl}" alt="Simulado" loading="lazy">`
            : ''
        }
        <div class="lash-historico-info">
          <div class="lash-historico-estilo">
            ${window.LASH_STYLES?.[r.formatoEscolhido]?.emoji || '✨'} ${r.estiloNome || r.formatoEscolhido}
          </div>
          <div class="lash-historico-data">${_formatarData(r.criadoEm)}</div>
        </div>
      </div>
    `).join('');
  };

  window.fecharHistoricoIA = function() {
    const m = document.getElementById('modal-historico-ia');
    if (m) m.style.display = 'none';
  };

  // ─────────────────────────────────────────
  // CALLBACKS DO AGENTE
  // ─────────────────────────────────────────

  function _onEstadoChange(dados) {
    console.log('[UI] Estado:', dados.estado, dados.mensagem || '');

    if (dados.estado === 'aviso' && dados.mensagem) {
      _mostrarAviso(dados.mensagem, 4000);
    }
  }

  function _onSugestoes(dados) {
    const { sugestoes, analise, todosFormatos } = dados;

    // Esconde loading, mostra resultado
    _esconderLoading('lash-loading');
    const resultadoEl = document.getElementById('lash-resultado-analise');
    if (resultadoEl) resultadoEl.style.display = 'block';

    // Renderiza análise
    _renderizarAnalise(analise);

    // Renderiza top 3 sugestões
    const gridTop = document.getElementById('lash-sugestoes-top');
    if (gridTop) gridTop.innerHTML = sugestoes.map((s, i) => _cardEstilo(s, i === 0)).join('');

    // Renderiza todos os formatos
    const gridTodos = document.getElementById('lash-todos-formatos');
    if (gridTodos) {
      const idsSugestoes = new Set(sugestoes.map(s => s.id));
      gridTodos.innerHTML = todosFormatos
        .filter(s => !idsSugestoes.has(s.id))
        .map(s => _cardEstilo(s, false))
        .join('');
    }
  }

  function _onSimulacao(dados) {
    const { imagemSimulada, estilo, tipo } = dados;

    _esconderLoading('lash-loading-sim');

    // Preenche imagens antes/depois
    const imgAntes  = document.getElementById('lash-img-antes');
    const imgDepois = document.getElementById('lash-img-depois');
    const labelDepois = document.getElementById('lash-label-estilo');

    if (imgAntes)  imgAntes.src  = _imagemCapturada;
    if (imgDepois) imgDepois.src = imagemSimulada;
    if (labelDepois) labelDepois.textContent = `${estilo.emoji} ${estilo.nome}`;

    document.getElementById('lash-antes-depois').style.display = 'grid';
    document.getElementById('lash-sim-controles').style.display = 'flex';

    if (tipo === 'original') {
      _mostrarAviso('Simulação visual não disponível — exibindo foto original.', 5000);
    }
  }

  function _onFinalizado(resultado) {
    _resultadoFinal = resultado;

    _irParaTela('resultado', 4);

    const descEl = document.getElementById('lash-resultado-desc');
    if (descEl) {
      const estilo = window.LASH_STYLES?.[resultado.formatoEscolhido];
      descEl.textContent = `Formato: ${estilo?.emoji || ''} ${estilo?.nome || resultado.formatoEscolhido} · ${_clienteAtivo?.nome || ''}`;
    }

    // Mostra foto de portfólio
    if (resultado.fotoPortfolioUrl) {
      const imgPortfolio = document.getElementById('lash-portfolio-preview');
      if (imgPortfolio) {
        imgPortfolio.src = resultado.fotoPortfolioUrl;
        imgPortfolio.style.display = 'block';
      }
    } else if (_agente?.beliefs?.imagemSimulada) {
      // Gera portfólio localmente como fallback
      if (window.LashPortfolio) {
        const estilo = window.LASH_STYLES?.[resultado.formatoEscolhido];
        window.LashPortfolio._gerarFotoPortfolio(
          _imagemCapturada,
          _agente.beliefs.imagemSimulada,
          estilo,
          _clienteAtivo?.nome
        ).then(portfolioBase64 => {
          const imgPortfolio = document.getElementById('lash-portfolio-preview');
          if (imgPortfolio) {
            imgPortfolio.src = portfolioBase64;
            imgPortfolio.style.display = 'block';
          }
        });
      }
    }
  }

  // ─────────────────────────────────────────
  // HELPERS DE RENDERIZAÇÃO
  // ─────────────────────────────────────────

  function _cardEstilo(estilo, isTop) {
    return `
      <div class="lash-estilo-card ${isTop ? 'top-1' : ''}"
           data-formato-id="${estilo.id}"
           onclick="escolherFormato('${estilo.id}')"
           role="button"
           tabindex="0"
           onkeydown="if(event.key==='Enter')escolherFormato('${estilo.id}')">
        ${isTop ? '<span class="lash-badge-top">⭐ Recomendado</span>' : ''}
        <span class="lash-card-emoji">${estilo.emoji}</span>
        <div class="lash-card-nome">${estilo.nome}</div>
        <div class="lash-card-desc">${estilo.descricao}</div>
        ${estilo.justificativa ? `<div class="lash-card-just">${estilo.justificativa}</div>` : ''}
      </div>`;
  }

  function _renderizarAnalise(analise) {
    const card = document.getElementById('lash-analise-card');
    if (!card) return;

    const LABELS = {
      formatoOlho:              'Formato do olho',
      distanciaOlhos:           'Distância dos olhos',
      inclinacaoPalpebra:       'Inclinação da pálpebra',
      espessuraPalpebra:        'Espessura da pálpebra',
      visibilidadeCiliosNaturais: 'Cílios naturais',
    };

    const TRADUTOR = {
      amendoado: 'Amendoado', redondo: 'Redondo', pequeno: 'Pequeno',
      grande: 'Grande', monopalpebral: 'Monopalpebral', caido_nas_pontas: 'Caído nas pontas',
      fundos: 'Fundos', oriental: 'Oriental', equilibrado: 'Equilibrado',
      proximos: 'Próximos', media: 'Médio', distante: 'Distante',
      muito_caida: 'Muito caída', levemente_caida: 'Levemente caída',
      neutra: 'Neutra', levemente_levantada: 'Levemente levantada',
      muito_levantada: 'Muito levantada',
      fina: 'Fina', grossa: 'Grossa',
      poucos: 'Poucos', muitos: 'Muitos'
    };

    let html = Object.entries(LABELS).map(([chave, label]) => {
      const val = analise[chave];
      if (!val) return '';
      return `<div class="lash-analise-item">
        <strong>${label}</strong>
        ${TRADUTOR[val] || val}
      </div>`;
    }).join('');

    if (analise.confiancaAnalise) {
      html += `<div class="lash-analise-item" style="grid-column:1/-1;">
        <strong>Confiança da análise</strong>
        ${analise.modoDemo ? '⚠️ Modo demo' : analise.confiancaAnalise + '%'}
      </div>`;
    }

    card.innerHTML = html;
  }

  // ─────────────────────────────────────────
  // NAVEGAÇÃO ENTRE TELAS
  // ─────────────────────────────────────────

  function _irParaTela(telaId, passo) {
    const telas = ['camera', 'sugestoes', 'simulacao', 'resultado'];
    telas.forEach(id => {
      const el = document.getElementById(`tela-${id}`);
      if (el) el.style.display = id === telaId ? 'block' : 'none';
    });

    // Atualiza status bar
    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById(`passo-${i}`);
      if (!el) continue;
      el.classList.remove('ativo', 'concluido');
      if (i < passo) el.classList.add('concluido');
      if (i === passo) el.classList.add('ativo');
    }
  }

  function _mostrarLoading(id, mensagem) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'flex';
    const msg = el.querySelector('p');
    if (msg) msg.textContent = mensagem;
  }

  function _esconderLoading(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  // ─────────────────────────────────────────
  // TOAST DE AVISO
  // ─────────────────────────────────────────

  function _mostrarAviso(mensagem, duracao = 5000) {
    let toast = document.getElementById('lash-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lash-toast';
      toast.style.cssText = `
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        background: #2d1b2d; border: 1px solid rgba(201,169,110,0.4);
        color: rgba(255,255,255,0.9); padding: 12px 20px; border-radius: 10px;
        font-size: 13px; z-index: 9999; max-width: 400px; text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5); transition: opacity 0.3s;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = mensagem;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, duracao);
  }

  function _formatarData(ts) {
    if (!ts) return '';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ─────────────────────────────────────────
  // INTEGRAÇÃO COM PAINEL — adiciona botão IA nas fichas
  // ─────────────────────────────────────────

  /**
   * Chamada externamente para injetar botão "Análise IA" em cards de cliente.
   * Chamar esta função ao renderizar a lista de clientes no painel.
   *
   * Exemplo:
   *   LashIAUI.injetarBotaoEmFicha('CLIENTE_ID', 'NOME', containerEl);
   */
  window.LashIAUI = {
    injetarBotaoEmFicha(clienteId, clienteNome, containerEl) {
      if (!containerEl || !window.LashAgent) return;
      const btn = document.createElement('button');
      btn.className = 'btn-ia';
      btn.innerHTML = '✨ Análise IA de Cílios';
      btn.onclick = () => window.abrirAgenteIA(clienteId, clienteNome);
      containerEl.appendChild(btn);
    }
  };

  console.log('[LashUI] ✓ Módulo de interface carregado');
})();
