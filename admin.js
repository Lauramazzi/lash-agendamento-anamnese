/**
 * admin.js - Lógica do Painel Administrativo Lashroom
 * Controla agenda (dia/semana), cadastro de serviços, busca de fichas de clientes,
 * controle de estoque (produtos) e financeiro (caixa diário e faturamento).
 */
(function() {
  const db = window.LashDB;

  const WEEKDAYS = [
    "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
    "Quinta-feira", "Sexta-feira", "Sábado"
  ];

  const ANAMNESE_LABELS = {
    jafez: "Já fez extensão de cílios antes?",
    jafez_det: "Teve alguma reação?",
    alergia: "Tem alergia a cosmético/cola/látex?",
    alergia_det: "A quê?",
    lentes: "Usa lentes de contato?",
    ocular: "Tem alguma condição nos olhos?",
    ocular_det: "Qual?",
    cirurgia: "Fez cirurgia nos olhos nos últimos 6 meses?",
    gestante: "Está gestante ou amamentando?",
    roacutan: "Usa ou usou Roacutan nos últimos 6 meses?",
    medicamento: "Usa medicamento contínuo?",
    medicamento_det: "Qual?",
    quimio: "Fez/faz quimioterapia ou radioterapia?",
    autoimune: "Tem doença autoimune/tireoide/alopecia?",
    autoimune_det: "Qual?",
    trico: "Arranca ou coça muito os cílios?",
    diabetes: "Tem diabetes?",
    bruco: "Dorme de bruços ou de lado?",
    esfrega: "Costuma esfregar os olhos?",
    maquiagem: "Usa rímel à prova d'água/maquiagem nos olhos?",
    agua: "Frequenta piscina ou sauna com frequência?",
    usoImagem: "Autorização de fotos",
    consentimentoLgpd: "Consentimento LGPD",
    assinatura: "Assinatura digital"
  };

  const state = {
    config: {},
    services: [],
    bookings: [],
    products: [],
    transactions: [],
    closings: [],
    blockedDates: [],
    workingHours: {},
    selectedDate: new Date(), // Data ativa no painel
    selectedBooking: null, // Reserva aberta no detalhe da ficha
    agendaView: "day", // "day" ou "week"
    financeSubTab: "caixa" // "caixa" ou "closings"
  };

  // Elementos do DOM
  const dom = {
    gate: document.getElementById("gate"),
    panel: document.getElementById("panel"),
    passInput: document.getElementById("pass"),
    gateErr: document.getElementById("gateErr"),
    logoutBtn: document.getElementById("admin-logout-btn"),
    demoBanner: document.getElementById("demoBanner"),
    
    // Sidebar
    sidebar: document.getElementById("admin-sidebar"),
    sidebarMenuItems: document.querySelectorAll(".menu-item"),
    panels: document.querySelectorAll(".admin-panel"),
    topbarDate: document.getElementById("topbar-current-date"),
    rightSidebar: document.getElementById("agenda-right-sidebar"),
    sidebarDateInput: document.getElementById("admin-sidebar-date"),

    // Stats
    statTotal: document.getElementById("stat-total"),
    statConfirmed: document.getElementById("stat-confirmed"),
    statPending: document.getElementById("stat-pending"),
    statCancelled: document.getElementById("stat-cancelled"),

    // Agenda
    bookingsTableBody: document.getElementById("bookings-table-body"),
    scheduleDateInput: document.getElementById("admin-schedule-date"),
    btnDatePrev: document.getElementById("btn-date-prev"),
    btnDateNext: document.getElementById("btn-date-next"),
    btnDateToday: document.getElementById("btn-date-today"),
    listBookingsView: document.getElementById("list-bookings-view"),
    detailBookingView: document.getElementById("detail-booking-view"),

    // Detalhe da Reserva
    dClientName: document.getElementById("d-clientName"),
    dClientMeta: document.getElementById("d-clientMeta"),
    dStatusSelect: document.getElementById("d-status-select"),
    dAttentionChips: document.getElementById("d-attention-chips"),
    dAnamneseSections: document.getElementById("d-anamnese-sections"),

    // Serviços
    servicesTableBody: document.getElementById("services-table-body"),
    serviceFormSection: document.getElementById("service-form-section"),
    serviceFormTitle: document.getElementById("service-form-title"),
    serviceEditorForm: document.getElementById("service-editor-form"),
    editServiceId: document.getElementById("edit-service-id"),
    editServiceName: document.getElementById("edit-service-name"),
    editServicePrice: document.getElementById("edit-service-price"),
    editServiceDuration: document.getElementById("edit-service-duration"),
    editServiceDescription: document.getElementById("edit-service-description"),

    // Configurações
    configTabs: document.querySelectorAll(".config-tab-btn"),
    subPanels: document.querySelectorAll(".sub-panel"),
    generalConfigForm: document.getElementById("general-config-form"),
    salonNameInput: document.getElementById("config-salon-name"),
    whatsappPhoneInput: document.getElementById("config-whatsapp-phone"),
    passwordChangeForm: document.getElementById("password-change-form"),
    newPasswordInput: document.getElementById("new-password"),
    confirmNewPasswordInput: document.getElementById("confirm-new-password"),
    workingHoursForm: document.getElementById("working-hours-form"),
    lunchActiveInput: document.getElementById("config-lunch-active"),
    lunchStartInput: document.getElementById("config-lunch-start"),
    lunchEndInput: document.getElementById("config-lunch-end"),
    workingHoursContainer: document.getElementById("working-hours-container"),
    blockCreatorForm: document.getElementById("block-creator-form"),
    blockDateInput: document.getElementById("block-date"),
    blockDescriptionInput: document.getElementById("block-description"),
    blockAllDayInput: document.getElementById("block-allday"),
    blockTimeStartGroup: document.getElementById("block-time-start-group"),
    blockTimeEndGroup: document.getElementById("block-time-end-group"),
    blockTimeStartInput: document.getElementById("block-time-start"),
    blockTimeEndInput: document.getElementById("block-time-end"),
    blocksTableBody: document.getElementById("blocks-table-body"),

    // Estoque
    productsListContainer: document.getElementById("products-list-container"),
    productFormSection: document.getElementById("product-form-section"),
    productFormTitle: document.getElementById("product-form-title"),
    productEditorForm: document.getElementById("product-editor-form"),
    editProductId: document.getElementById("edit-product-id"),
    editProductName: document.getElementById("edit-product-name"),
    editProductCost: document.getElementById("edit-product-cost"),
    editProductSell: document.getElementById("edit-product-sell"),
    editProductQty: document.getElementById("edit-product-qty"),

    // Financeiro
    fStatReceitas: document.getElementById("f-stat-receitas"),
    fStatDespesas: document.getElementById("f-stat-despesas"),
    fStatSaldo: document.getElementById("f-stat-saldo"),
    cashTransactionForm: document.getElementById("cash-transaction-form"),
    tDescriptionInput: document.getElementById("t-description"),
    tTypeSelect: document.getElementById("t-type"),
    tValueInput: document.getElementById("t-value"),
    transactionsListContainer: document.getElementById("transactions-list-container"),
    closingsTableBody: document.getElementById("closings-table-body")
  };

  // Inicialização
  async function init() {
    try {
      await db.init();
      state.config = await db.getConfig();

      // Monitora o estado de login no Firebase se estiver no modo nuvem
      if (db.isCloudMode()) {
        firebase.auth().onAuthStateChanged((user) => {
          if (user) {
            sessionStorage.setItem("lash_admin_logged", "true");
            showDashboard();
          } else {
            sessionStorage.removeItem("lash_admin_logged");
            dom.gate.style.display = "grid";
            dom.passInput.value = "";
            dom.passInput.focus();
          }
        });
      } else {
        // Fallback modo local
        if (sessionStorage.getItem("lash_admin_logged") === "true") {
          showDashboard();
        } else {
          dom.gate.style.display = "grid";
          dom.passInput.focus();
        }
      }
    } catch(e) {
      console.error(e);
    }
  }

  // --- AUTENTICAÇÃO ---

  async function sha256(txt) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  window.tryLogin = async function() {
    const email = document.getElementById("admin-email").value.trim();
    const val = dom.passInput.value;
    if (!email || !val) {
      dom.gateErr.textContent = "Digite o e-mail e a senha.";
      return;
    }
    dom.gateErr.textContent = "Autenticando...";
    
    try {
      await db.login(email, val);
      dom.gateErr.textContent = "";
      
      // Se for modo local, precisa inicializar manualmente
      if (!db.isCloudMode()) {
        sessionStorage.setItem("lash_admin_logged", "true");
        showDashboard();
      }
    } catch(err) {
      console.error("LashDB Login Error:", err);
      dom.gateErr.textContent = "E-mail ou senha incorretos.";
      dom.passInput.value = "";
    }
  };

  async function logout() {
    sessionStorage.removeItem("lash_admin_logged");
    try {
      await db.logout();
    } catch(e) {
      console.error(e);
    }
    location.reload();
  }

  async function showDashboard() {
    dom.gate.style.display = "none";
    dom.panel.style.display = "grid"; // layout grid estilo AppBarber

    // Customiza a barra lateral com os dados do usuário autenticado no Firebase Auth
    if (db.isCloudMode()) {
      dom.demoBanner.style.display = "none";
      const user = firebase.auth().currentUser;
      if (user) {
        const email = user.email || "admin@lashroom.com";
        const cleanName = email.split("@")[0];
        const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        
        const avatarEl = document.querySelector(".profile-avatar");
        const nameEl = document.querySelector(".profile-info h3");
        const emailEl = document.querySelector(".profile-info p");
        
        if (avatarEl) avatarEl.textContent = formattedName.charAt(0);
        if (nameEl) nameEl.textContent = formattedName;
        if (emailEl) emailEl.textContent = email;
      }
    } else {
      dom.demoBanner.style.display = "block";
    }

    await loadAllData();

    // Sincroniza as datas nos navegadores
    const dateStr = formatDateISO(state.selectedDate);
    dom.scheduleDateInput.value = dateStr;
    dom.sidebarDateInput.value = dateStr;
    updateTopbarDate();

    setupEventListeners();
    renderAgenda();
    renderServicesTable();
    renderClientsList();
    renderProducts();
    renderFinanceDashboard();
    initSettingsTab();

    // Sincroniza o status da agenda (aberta/fechada) no cabeçalho
    const isAberta = state.config.agendaAberta !== false;
    const btnOpen = document.getElementById("btn-agenda-aberta");
    const btnClose = document.getElementById("btn-agenda-fechada");
    if (btnOpen && btnClose) {
      if (isAberta) {
        btnOpen.classList.add("active");
        btnClose.classList.remove("active");
      } else {
        btnOpen.classList.remove("active");
        btnClose.classList.add("active");
      }
    }
  }

  async function loadAllData() {
    state.bookings = await db.getBookings();
    state.services = await db.getServices();
    state.workingHours = await db.getWorkingHours();
    state.blockedDates = await db.getBlockedDates();
    state.products = await db.getProducts();
    state.transactions = await db.getTransactions();
    state.closings = await db.getClosings();
  }

  function updateTopbarDate() {
    const options = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
    let formatted = state.selectedDate.toLocaleDateString("pt-BR", options);
    // Capitaliza primeira letra
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    dom.topbarDate.textContent = formatted;
  }

  // --- EVENT LISTENERS ---

  function setupEventListeners() {
    dom.logoutBtn.addEventListener("click", logout);

    // Sidebar de Navegação Esquerda
    dom.sidebarMenuItems.forEach(item => {
      item.addEventListener("click", () => {
        dom.sidebarMenuItems.forEach(i => i.classList.remove("active"));
        dom.panels.forEach(p => p.classList.remove("active"));
        
        item.classList.add("active");
        const panelId = "panel-" + item.dataset.tab;
        document.getElementById(panelId).classList.add("active");
        closeBookingDetail();

        // Controla visualização da barra direita de calendário (apenas na agenda)
        if (item.dataset.tab === "atendimentos") {
          dom.rightSidebar.style.display = "block";
          refreshAgendaView();
        } else {
          dom.rightSidebar.style.display = "none";
        }

        // Hamburguer menu - fecha no celular ao clicar em aba
        if (window.innerWidth <= 900) {
          dom.sidebar.classList.remove("show");
        }

        if (item.dataset.tab === "clientes") renderClientsList();
        if (item.dataset.tab === "estoque") renderProducts();
        if (item.dataset.tab === "financeiro") renderFinanceDashboard();
      });
    });

    // Abas de configurações
    dom.configTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        dom.configTabs.forEach(t => t.classList.remove("active"));
        dom.subPanels.forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        const subId = "subpanel-" + tab.dataset.subtab;
        document.getElementById(subId).classList.add("active");
      });
    });

    // Sincronização dos Calendários da Agenda (Topbar, Sidebar e Botoes hoje/proximo/anterior)
    const onDateChange = (newDate) => {
      state.selectedDate = newDate;
      const iso = formatDateISO(newDate);
      dom.scheduleDateInput.value = iso;
      dom.sidebarDateInput.value = iso;
      updateTopbarDate();
      refreshAgendaView();
      renderFinanceDashboard(); // atualiza fluxo de caixa da data selecionada
    };

    dom.scheduleDateInput.addEventListener("change", (e) => {
      if (e.target.value) onDateChange(new Date(e.target.value + "T00:00:00"));
    });

    dom.sidebarDateInput.addEventListener("change", (e) => {
      if (e.target.value) onDateChange(new Date(e.target.value + "T00:00:00"));
    });

    dom.btnDatePrev.addEventListener("click", () => {
      const d = new Date(state.selectedDate);
      d.setDate(d.getDate() - 1);
      onDateChange(d);
    });

    dom.btnDateNext.addEventListener("click", () => {
      const d = new Date(state.selectedDate);
      d.setDate(d.getDate() + 1);
      onDateChange(d);
    });

    dom.btnDateToday.addEventListener("click", () => {
      onDateChange(new Date());
    });

    // Status da Ficha
    dom.dStatusSelect.addEventListener("change", async (e) => {
      if (state.selectedBooking) {
        const statusValue = e.target.value;
        const success = await db.updateBookingStatus(state.selectedBooking.id, statusValue);
        if (success) {
          state.selectedBooking.status = statusValue;
          
          if (statusValue === "Confirmado") {
            showToast(`Agendamento de ${state.selectedBooking.clientName} confirmado!`, 'success');
          } else if (statusValue === "Concluído") {
            // Se concluído, gera lançamento automático de Receita no caixa!
            await db.addTransaction({
              description: `Atendimento: ${state.selectedBooking.clientName} (${state.selectedBooking.serviceName})`,
              type: "Receita",
              value: parseFloat(state.selectedBooking.servicePrice),
              date: state.selectedBooking.bookingDate
            });
            showToast(`Atendimento de ${state.selectedBooking.clientName} concluído e lançado no financeiro!`, 'success');
          } else if (statusValue === "Cancelado") {
            showToast(`Agendamento de ${state.selectedBooking.clientName} cancelado.`, 'warning');
          } else {
            showToast(`Status atualizado para "${statusValue}".`, 'success');
          }

          await loadAllData();
          refreshAgendaView();
          renderFinanceDashboard();
        }
      }
    });

    // Formulários
    dom.serviceEditorForm.addEventListener("submit", handleSaveService);
    dom.generalConfigForm.addEventListener("submit", handleSaveGeneralConfig);
    dom.passwordChangeForm.addEventListener("submit", handleSavePassword);
    dom.workingHoursForm.addEventListener("submit", handleSaveWorkingHours);

    dom.blockAllDayInput.addEventListener("change", (e) => {
      const showTimes = !e.target.checked;
      dom.blockTimeStartGroup.style.display = showTimes ? "block" : "none";
      dom.blockTimeEndGroup.style.display = showTimes ? "block" : "none";
      dom.blockTimeStartInput.required = showTimes;
      dom.blockTimeEndInput.required = showTimes;
    });

    dom.blockCreatorForm.addEventListener("submit", handleAddBlock);
  }

  // --- MENU HAMBURGUER (CELULAR) ---
  window.toggleSidebarMenu = function() {
    dom.sidebar.classList.toggle("show");
  };

  // --- POPUPS DE NOTIFICAÇÃO (TOASTS) ---
  function showToast(message, type = 'success') {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `<span class="toast-text">${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  // --- VISÕES DE AGENDA ---
  window.setAgendaView = function(view) {
    state.agendaView = view;
    
    const btnDay = document.getElementById("btn-view-day");
    const btnWeek = document.getElementById("btn-view-week");
    const dayView = document.getElementById("agenda-day-view");
    const weekView = document.getElementById("agenda-week-view");
    const sectionTitle = document.getElementById("agenda-section-title");
    
    if (view === 'day') {
      btnDay.classList.add("active");
      btnWeek.classList.remove("active");
      dayView.style.display = "block";
      weekView.style.display = "none";
      sectionTitle.textContent = "Atendimentos Diários";
      renderAgenda();
    } else {
      btnDay.classList.remove("active");
      btnWeek.classList.add("active");
      dayView.style.display = "none";
      weekView.style.display = "block";
      sectionTitle.textContent = "Agenda Semanal";
      renderWeeklyAgenda();
    }
  };

  function refreshAgendaView() {
    if (state.agendaView === "day") {
      renderAgenda();
    } else {
      renderWeeklyAgenda();
    }
  }

  // --- AGENDA DIÁRIA E DETALHES DA FICHA ---

  function renderAgenda() {
    const filterDate = formatDateISO(state.selectedDate);
    const dayBookings = state.bookings.filter(b => b.bookingDate === filterDate);

    // Estatísticas
    dom.statTotal.textContent = dayBookings.length;
    dom.statConfirmed.textContent = dayBookings.filter(b => b.status === "Confirmado").length + dayBookings.filter(b => b.status === "Concluído").length;
    dom.statPending.textContent = dayBookings.filter(b => b.status === "Pendente").length;
    dom.statCancelled.textContent = dayBookings.filter(b => b.status === "Cancelado").length;

    if (dayBookings.length === 0) {
      dom.bookingsTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 30px;">Nenhum agendamento para este dia.</td></tr>';
      return;
    }

    dayBookings.sort((a, b) => String(a.bookingTime).localeCompare(String(b.bookingTime)));

    dom.bookingsTableBody.innerHTML = dayBookings.map(b => {
      const hasFlags = b.pontosAtencao && b.pontosAtencao !== "Nenhum";
      const statusClass = b.status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return `
        <tr class="${hasFlags ? 'hasalert' : ''}" onclick="openBookingDetail('${b.id}')" style="cursor: pointer;">
          <td><strong>${b.bookingTime}h</strong></td>
          <td>${esc(b.clientName)}</td>
          <td>${esc(b.serviceName)}</td>
          <td>R$ ${parseFloat(b.servicePrice).toFixed(2).replace('.', ',')}</td>
          <td><span class="badge ${statusClass}">${b.status}</span></td>
          <td style="text-align: center;"><button class="btn btn-secondary" style="font-size: 11px; padding: 6px 12px;">Visualizar Ficha</button></td>
        </tr>
      `;
    }).join("");
  }

  // --- AGENDA SEMANAL ---

  function renderWeeklyAgenda() {
    const selected = new Date(state.selectedDate);
    const dayOfWeek = selected.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(selected);
    monday.setDate(selected.getDate() + diffToMonday);
    
    let html = "";
    
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      const dateStr = formatDateISO(dayDate);
      const wDay = dayDate.getDay();
      
      const isToday = formatDateISO(new Date()) === dateStr;
      const dayBookings = state.bookings.filter(b => b.bookingDate === dateStr);
      
      dayBookings.sort((a, b) => String(a.bookingTime).localeCompare(String(b.bookingTime)));
      
      const dayLabel = dayDate.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
      const dayName = WEEKDAYS[wDay].split("-")[0];
      
      let cardsHtml = "";
      if (dayBookings.length === 0) {
        cardsHtml = '<div style="font-size: 11px; color: var(--muted); text-align: center; margin-top: 15px;">Sem atendimentos</div>';
      } else {
        cardsHtml = dayBookings.map(b => {
          const statusClass = b.status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return `
            <div class="weekly-card ${statusClass}" onclick="openBookingDetail('${b.id}')">
              <span class="weekly-time">${b.bookingTime}h</span>
              <span class="weekly-client">${esc(b.clientName)}</span>
              <span class="weekly-service">${esc(b.serviceName)}</span>
            </div>
          `;
        }).join("");
      }
      
      html += `
        <div class="weekly-col ${isToday ? 'is-today' : ''}">
          <div class="weekly-col-header">
            <span>${dayName}</span>
            <span class="weekly-col-day">${dayLabel}</span>
          </div>
          <div class="weekly-col-body">
            ${cardsHtml}
          </div>
        </div>
      `;
    }
    
    document.getElementById("weekly-agenda-grid").innerHTML = html;
  }

  window.openBookingDetail = function(bookingId) {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;

    state.selectedBooking = booking;
    dom.dClientName.textContent = esc(booking.clientName);
    
    const dataNascBr = booking.clientBirth ? new Date(booking.clientBirth + "T00:00:00").toLocaleDateString("pt-BR") : "Não informada";
    dom.dClientMeta.textContent = `WhatsApp: ${booking.clientPhone} · Nascimento: ${dataNascBr} · Enviada em: ${booking.preenchido_em}`;
    dom.dStatusSelect.value = booking.status;

    if (booking.pontosAtencao && booking.pontosAtencao !== "Nenhum") {
      dom.dAttentionChips.innerHTML = booking.pontosAtencao.split(" | ").map(chip => {
        const isAlert = chip.includes("⚠");
        return `<span class="chip ${isAlert ? 'alert' : 'aten'}">${esc(chip)}</span>`;
      }).join("");
    } else {
      dom.dAttentionChips.innerHTML = '<span class="chip ok">Sem contraindicações ou alertas de saúde</span>';
    }

    let sectionsHtml = "";
    const dataAgendamentoBr = new Date(booking.bookingDate + "T00:00:00").toLocaleDateString("pt-BR");
    
    sectionsHtml += `
      <div class="d-sec">
        <h4>Detalhes do Agendamento</h4>
        <div class="d-row"><span class="k">Serviço Escolhido</span><span class="v">${esc(booking.serviceName)}</span></div>
        <div class="d-row"><span class="k">Valor cobrado</span><span class="v">R$ ${parseFloat(booking.servicePrice).toFixed(2).replace('.', ',')}</span></div>
        <div class="d-row"><span class="k">Duração Estimada</span><span class="v">${booking.serviceDuration} minutos</span></div>
        <div class="d-row"><span class="k">Data Agendada</span><span class="v">${dataAgendamentoBr} (${getWeekdayName(booking.bookingDate)})</span></div>
        <div class="d-row"><span class="k">Horário</span><span class="v"><strong>${booking.bookingTime}h</strong></span></div>
        <div class="d-row"><span class="k">Como conheceu o estúdio</span><span class="v">${esc(booking.clientOrigem || "Não informado")}</span></div>
        <div class="d-row"><span class="k">Instagram</span><span class="v">${booking.clientInstagram ? esc(booking.clientInstagram) : "Não informado"}</span></div>
      </div>
    `;

    const anamnese = booking.anamnese || {};
    if (Object.keys(anamnese).length > 0) {
      let saudeRows = "";
      const healthFields = [
        { id: "jafez", label: "Já fez extensão antes?", det: "jafez_det" },
        { id: "alergia", label: "Alergia a cosmético/cola/látex?", det: "alergia_det" },
        { id: "lentes", label: "Usa lentes de contato?" },
        { id: "ocular", label: "Alguma condição nos olhos?", det: "ocular_det" },
        { id: "cirurgia", label: "Fez cirurgia ocular < 6 meses?" },
        { id: "gestante", label: "Gestante ou amamentando?" },
        { id: "roacutan", label: "Roacutan nos últimos 6 meses?" },
        { id: "medicamento", label: "Usa medicamento contínuo?", det: "medicamento_det" },
        { id: "quimio", label: "Quimioterapia ou radioterapia?" },
        { id: "autoimune", label: "Autoimune/tireoide/alopecia?", det: "autoimune_det" },
        { id: "trico", label: "Arranca ou coça cílios?" },
        { id: "diabetes", label: "Tem diabetes?" }
      ];

      healthFields.forEach(f => {
        const val = anamnese[f.id] || "não";
        let displayVal = val.toUpperCase();
        let isHighlight = val === "sim";
        if (f.det && val === "sim" && anamnese[f.det]) {
          displayVal += ` — ${anamnese[f.det]}`;
        }
        saudeRows += `<div class="d-row"><span class="k">${f.label}</span><span class="v ${isHighlight ? 'hl' : ''}">${esc(displayVal)}</span></div>`;
      });

      sectionsHtml += `
        <div class="d-sec">
          <h4>Respostas de Saúde</h4>
          ${saudeRows}
        </div>
      `;

      let rotinaRows = "";
      const routineFields = [
        { id: "bruco", label: "Dorme de bruços ou lado?" },
        { id: "esfrega", label: "Esfrega os olhos?" },
        { id: "maquiagem", label: "Usa rímel/maquiagem nos cílios?" },
        { id: "agua", label: "Piscina ou sauna com frequência?" }
      ];

      routineFields.forEach(f => {
        const val = anamnese[f.id] || "não";
        rotinaRows += `<div class="d-row"><span class="k">${f.label}</span><span class="v">${esc(val.toUpperCase())}</span></div>`;
      });

      sectionsHtml += `
        <div class="d-sec">
          <h4>Hábitos e Rotina</h4>
          ${rotinaRows}
        </div>
      `;

      sectionsHtml += `
        <div class="d-sec">
          <h4>Autorizações e Termos</h4>
          <div class="d-row"><span class="k">Uso de Imagem (Divulgação)</span><span class="v">${booking.usoImagem || "Não informado"}</span></div>
          <div class="d-row"><span class="k">Consentimento de Dados (LGPD)</span><span class="v">AUTORIZADO</span></div>
          <div class="d-row" style="background-color: var(--cream); padding: 12px; margin-top: 10px; border-radius: 8px;">
            <span class="k" style="font-weight: 600;">Assinatura do Cliente</span>
            <span class="v" style="font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 600; text-decoration: underline;">${esc(booking.assinatura)}</span>
          </div>
        </div>
      `;
    } else {
      sectionsHtml += `
        <div class="d-sec" style="text-align: center; padding: 25px; color: var(--muted);">
          <h4>Ficha de Anamnese</h4>
          Este atendimento foi cadastrado manualmente e não possui respostas da ficha de anamnese.
        </div>
      `;
    }

    dom.dAnamneseSections.innerHTML = sectionsHtml;
    dom.listBookingsView.style.display = "none";
    dom.detailBookingView.style.display = "block";
    window.scrollTo(0, 0);
  };

  window.closeBookingDetail = function() {
    dom.detailBookingView.style.display = "none";
    dom.listBookingsView.style.display = "block";
    state.selectedBooking = null;
  };

  // --- AGENDAMENTO MANUAL ---

  function populateManualBookingServices() {
    const select = document.getElementById("m-service-select");
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione o serviço...</option>' + state.services.map(s => {
      return `<option value="${s.id}">${esc(s.name)} - R$ ${parseFloat(s.price).toFixed(2).replace('.', ',')} (${s.duration} min)</option>`;
    }).join("");
  }

  window.openManualBookingModal = function() {
    populateManualBookingServices();
    document.getElementById("m-booking-date").value = formatDateISO(state.selectedDate);
    document.getElementById("manual-booking-modal").classList.add("show");
  };

  window.closeManualBookingModal = function() {
    document.getElementById("manual-booking-modal").classList.remove("show");
    document.getElementById("manual-booking-form").reset();
  };

  window.handleManualBooking = async function(e) {
    e.preventDefault();
    const name = document.getElementById("m-client-name").value.trim();
    const phone = document.getElementById("m-client-phone").value.trim();
    const birth = document.getElementById("m-client-birth").value;
    const serviceId = document.getElementById("m-service-select").value;
    const date = document.getElementById("m-booking-date").value;
    const time = document.getElementById("m-booking-time").value;

    if (!name || !phone || !serviceId || !date || !time) return;

    const service = state.services.find(s => s.id === serviceId);
    if (!service) return;

    const payload = {
      marca: state.config.salonName || "Lashroom",
      clientName: name,
      clientBirth: birth || "",
      clientPhone: phone,
      clientInstagram: "",
      clientOrigem: "Painel Profissional",
      serviceId: service.id,
      serviceName: service.name,
      servicePrice: service.price,
      serviceDuration: service.duration,
      bookingDate: date,
      bookingTime: time,
      assinatura: "Agendamento Manual",
      usoImagem: "Não autorizado",
      consentimentoLgpd: "Sim",
      pontosAtencao: "Nenhum",
      anamnese: {}
    };

    try {
      await db.addBooking(payload);
      closeManualBookingModal();
      showToast(`Agendamento de ${name} cadastrado!`, 'success');
      
      await loadAllData();
      refreshAgendaView();
    } catch(err) {
      console.error(err);
      showToast("Erro ao criar agendamento manual.", 'error');
    }
  };

  // --- EDIÇÃO E EXCLUSÃO DE AGENDAMENTO ---

  function populateEditBookingServices() {
    const select = document.getElementById("e-service-select");
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione o serviço...</option>' + state.services.map(s => {
      return `<option value="${s.id}">${esc(s.name)} - R$ ${parseFloat(s.price).toFixed(2).replace('.', ',')} (${s.duration} min)</option>`;
    }).join("");
  }

  window.openEditBookingModal = function() {
    if (!state.selectedBooking) return;
    
    populateEditBookingServices();
    
    const b = state.selectedBooking;
    document.getElementById("e-booking-id").value = b.id;
    document.getElementById("e-client-name").value = b.clientName || "";
    document.getElementById("e-client-phone").value = b.clientPhone || "";
    document.getElementById("e-client-birth").value = b.clientBirth || "";
    document.getElementById("e-client-instagram").value = b.clientInstagram || "";
    document.getElementById("e-client-origem").value = b.clientOrigem || "";
    document.getElementById("e-service-select").value = b.serviceId || "";
    document.getElementById("e-service-price").value = b.servicePrice || "";
    document.getElementById("e-booking-date").value = b.bookingDate || "";
    document.getElementById("e-booking-time").value = b.bookingTime || "";
    
    document.getElementById("edit-booking-modal").classList.add("show");
  };

  window.closeEditBookingModal = function() {
    document.getElementById("edit-booking-modal").classList.remove("show");
    document.getElementById("edit-booking-form").reset();
  };

  window.handleEditServiceChange = function() {
    const serviceId = document.getElementById("e-service-select").value;
    const service = state.services.find(s => s.id === serviceId);
    if (service) {
      document.getElementById("e-service-price").value = service.price;
    }
  };

  window.handleEditBooking = async function(e) {
    e.preventDefault();
    if (!state.selectedBooking) return;

    const id = document.getElementById("e-booking-id").value;
    const name = document.getElementById("e-client-name").value.trim();
    const phone = document.getElementById("e-client-phone").value.trim();
    const birth = document.getElementById("e-client-birth").value;
    const instagram = document.getElementById("e-client-instagram").value.trim();
    const origem = document.getElementById("e-client-origem").value.trim();
    const serviceId = document.getElementById("e-service-select").value;
    const price = document.getElementById("e-service-price").value;
    const date = document.getElementById("e-booking-date").value;
    const time = document.getElementById("e-booking-time").value;

    if (!name || !phone || !serviceId || !price || !date || !time) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    const service = state.services.find(s => s.id === serviceId);
    if (!service) return;

    const b = state.selectedBooking;
    b.clientName = name;
    b.clientPhone = phone;
    b.clientBirth = birth;
    b.clientInstagram = instagram;
    b.clientOrigem = origem;
    b.serviceId = service.id;
    b.serviceName = service.name;
    b.servicePrice = parseFloat(price);
    b.serviceDuration = service.duration;
    b.bookingDate = date;
    b.bookingTime = time;

    try {
      await db.updateBooking(b);
      closeEditBookingModal();
      showToast("Agendamento atualizado com sucesso!", 'success');
      
      await loadAllData();
      refreshAgendaView();
      
      openBookingDetail(b.id);
    } catch(err) {
      console.error(err);
      showToast("Erro ao salvar alterações no agendamento.", 'error');
    }
  };

  window.deleteBookingConfirm = async function() {
    if (!state.selectedBooking) return;
    
    const clientName = state.selectedBooking.clientName;
    if (confirm(`Tem certeza que deseja excluir permanentemente o agendamento de "${clientName}"? Esta ação não pode ser desfeita.`)) {
      try {
        await db.deleteBooking(state.selectedBooking.id);
        showToast("Agendamento excluído com sucesso!", 'warning');
        closeBookingDetail();
        
        await loadAllData();
        refreshAgendaView();
      } catch(err) {
        console.error(err);
        showToast("Erro ao excluir agendamento.", 'error');
      }
    }
  };

  // --- ABERTURA / FECHAMENTO DA AGENDA ---

  window.setAgendaStatus = async function(isOpen) {
    state.config.agendaAberta = isOpen;
    
    const btnOpen = document.getElementById("btn-agenda-aberta");
    const btnClose = document.getElementById("btn-agenda-fechada");
    
    if (btnOpen && btnClose) {
      if (isOpen) {
        btnOpen.classList.add("active");
        btnClose.classList.remove("active");
      } else {
        btnOpen.classList.remove("active");
        btnClose.classList.add("active");
      }
    }
    
    try {
      await db.saveConfig(state.config);
      if (isOpen) {
        showToast("Agenda online aberta para novos agendamentos!", 'success');
      } else {
        showToast("Agenda online fechada! Clientes não conseguirão agendar.", 'warning');
      }
    } catch(err) {
      console.error(err);
      showToast("Erro ao atualizar status da agenda.", 'error');
    }
  };

  // --- BLOQUEIO RÁPIDO DE HORÁRIO ---

  window.openQuickBlockModal = function() {
    document.getElementById("qb-date").value = formatDateISO(state.selectedDate);
    document.getElementById("qb-allday").checked = true;
    toggleQuickBlockAllDay(true);
    document.getElementById("quick-block-modal").classList.add("show");
  };

  window.closeQuickBlockModal = function() {
    document.getElementById("quick-block-modal").classList.remove("show");
    document.getElementById("quick-block-form").reset();
  };

  window.toggleQuickBlockAllDay = function(isChecked) {
    const showTimes = !isChecked;
    document.getElementById("qb-time-start-group").style.display = showTimes ? "block" : "none";
    document.getElementById("qb-time-end-group").style.display = showTimes ? "block" : "none";
    document.getElementById("qb-time-start").required = showTimes;
    document.getElementById("qb-time-end").required = showTimes;
  };

  window.handleQuickBlock = async function(e) {
    e.preventDefault();
    const date = document.getElementById("qb-date").value;
    const description = document.getElementById("qb-description").value.trim() || "Bloqueio de Agenda";
    const allDay = document.getElementById("qb-allday").checked;
    const start = document.getElementById("qb-time-start").value;
    const end = document.getElementById("qb-time-end").value;

    if (!date) return;

    const blockItem = {
      date: date,
      description: description,
      allDay: allDay,
      startTime: allDay ? "" : start,
      endTime: allDay ? "" : end
    };

    try {
      await db.addBlockedDate(blockItem);
      closeQuickBlockModal();
      showToast("Horário bloqueado com sucesso!", 'success');
      
      await loadAllData();
      refreshAgendaView();
      if (typeof renderBlocksTable === "function") renderBlocksTable(); // Atualiza a tabela na aba de configurações se ela existir
    } catch(err) {
      console.error(err);
      showToast("Erro ao bloquear horário.", 'error');
    }
  };

  // --- CLIENTES & BUSCA ---

  window.renderClientsList = function() {
    const query = (document.getElementById("client-search").value || "").toLowerCase().trim();
    const clientsMap = {};

    state.bookings.forEach(b => {
      const key = b.clientPhone || b.clientName;
      if (!clientsMap[key] || String(b.timestamp).localeCompare(String(clientsMap[key].timestamp)) > 0) {
        clientsMap[key] = b;
      }
    });

    const clientsList = Object.values(clientsMap).filter(c => {
      return !query || c.clientName.toLowerCase().includes(query) || c.clientPhone.includes(query);
    });

    clientsList.sort((a, b) => String(a.clientName).localeCompare(String(b.clientName)));

    const countLabel = document.getElementById("clients-count");
    countLabel.textContent = `${clientsList.length} cliente${clientsList.length !== 1 ? 's encontradas' : ' encontrada'}`;

    const container = document.getElementById("clients-list-container");
    if (clientsList.length === 0) {
      container.innerHTML = '<div style="grid-column: span 2; text-align: center; color: var(--muted); padding: 30px;">Nenhuma cliente encontrada.</div>';
      return;
    }

    container.innerHTML = clientsList.map(c => {
      const hasAnamnese = c.anamnese && Object.keys(c.anamnese).length > 0;
      return `
        <div class="client-card-item" onclick="openClientAnamnese('${c.id}')" style="cursor: pointer;">
          <div class="client-info-block">
            <h3>${esc(c.clientName)}</h3>
            <p>WhatsApp: ${esc(c.clientPhone)}</p>
            <p>${hasAnamnese ? '✅ Prontuário preenchido' : '⚠️ Sem Anamnese (Agendamento Manual)'}</p>
          </div>
          <button class="btn btn-secondary" style="font-size: 11px; padding: 6px 12px;">Visualizar Ficha</button>
        </div>
      `;
    }).join("");
  };

  window.openClientAnamnese = function(bookingId) {
    dom.sidebarMenuItems.forEach(i => i.classList.remove("active"));
    dom.panels.forEach(p => p.classList.remove("active"));
    
    const agendaTab = document.querySelector('[data-tab="atendimentos"]');
    agendaTab.classList.add("active");
    document.getElementById("panel-atendimentos").classList.add("active");
    dom.rightSidebar.style.display = "block";

    openBookingDetail(bookingId);
  };

  // --- GESTÃO DE ESTOQUE (PRODUTOS) ---

  function renderProducts() {
    const container = dom.productsListContainer;
    if (!container) return;

    if (state.products.length === 0) {
      container.innerHTML = '<div style="grid-column: span 3; text-align: center; color: var(--muted); padding: 30px;">Nenhum produto cadastrado no estoque.</div>';
      return;
    }

    container.innerHTML = state.products.map(p => {
      return `
        <div class="product-card">
          <div class="product-info">
            <h3>${esc(p.name)}</h3>
            <div class="product-meta-row">
              <span>Custo: R$ ${parseFloat(p.costPrice).toFixed(2).replace('.', ',')}</span>
              <span>Venda: <strong>R$ ${parseFloat(p.sellPrice).toFixed(2).replace('.', ',')}</strong></span>
            </div>
            <div class="product-quantity">
              <span>Qtd:</span>
              <button class="qty-adjust-btn" onclick="adjustProductQty('${p.id}', -1)">-</button>
              <strong style="font-size: 15px;">${p.quantity}</strong>
              <button class="qty-adjust-btn" onclick="adjustProductQty('${p.id}', 1)">+</button>
            </div>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 15px; border-top: 1px solid var(--line); padding-top: 10px;">
            <button class="btn btn-secondary" onclick="sellProductQuick('${p.id}')" style="font-size: 11px; padding: 6px 12px; flex: 1; border-color: var(--bronze); color: var(--bronze-deep);">Vender 1un</button>
            <button class="btn btn-secondary" onclick="editProduct('${p.id}')" style="font-size: 11px; padding: 6px 10px;">Editar</button>
            <button class="btn btn-secondary" onclick="deleteProduct('${p.id}')" style="font-size: 11px; padding: 6px 10px; color: var(--alert); border-color: var(--alert-bd);">Excluir</button>
          </div>
        </div>
      `;
    }).join("");
  }

  window.showAddProductForm = function() {
    dom.editProductId.value = "";
    dom.productEditorForm.reset();
    dom.productFormTitle.textContent = "Cadastrar Novo Produto";
    dom.productFormSection.style.display = "block";
  };

  window.hideProductForm = function() {
    dom.productFormSection.style.display = "none";
  };

  window.editProduct = function(productId) {
    const prod = state.products.find(p => p.id === productId);
    if (!prod) return;

    dom.editProductId.value = prod.id;
    dom.editProductName.value = prod.name;
    dom.editProductCost.value = prod.costPrice;
    dom.editProductSell.value = prod.sellPrice;
    dom.editProductQty.value = prod.quantity;

    dom.productFormTitle.textContent = "Editar Produto";
    dom.productFormSection.style.display = "block";
    window.scrollTo({ top: dom.productFormSection.offsetTop - 80, behavior: 'smooth' });
  };

  window.handleSaveProduct = async function(e) {
    e.preventDefault();
    const id = dom.editProductId.value || "p_" + Date.now();
    const name = dom.editProductName.value.trim();
    const cost = parseFloat(dom.editProductCost.value);
    const sell = parseFloat(dom.editProductSell.value);
    const qty = parseInt(dom.editProductQty.value);

    if (!name || isNaN(cost) || isNaN(sell) || isNaN(qty)) return;

    const list = state.products.slice();
    const idx = list.findIndex(p => p.id === id);
    const isNew = idx === -1;

    const productObj = { id, name, costPrice: cost, sellPrice: sell, quantity: qty };

    if (!isNew) {
      list[idx] = productObj;
    } else {
      list.push(productObj);
    }

    try {
      await db.saveProducts(list);
      state.products = list;
      renderProducts();
      hideProductForm();
      showToast(isNew ? `Produto "${name}" cadastrado!` : `Produto "${name}" atualizado!`, 'success');
    } catch(err) {
      console.error(err);
      showToast("Erro ao salvar produto.", 'error');
    }
  };

  window.adjustProductQty = async function(productId, delta) {
    const list = state.products.slice();
    const idx = list.findIndex(p => p.id === productId);
    if (idx === -1) return;

    list[idx].quantity = Math.max(0, list[idx].quantity + delta);

    try {
      await db.saveProducts(list);
      state.products = list;
      renderProducts();
      showToast(`Estoque de "${list[idx].name}" atualizado para ${list[idx].quantity}un.`, 'success');
    } catch(err) {
      console.error(err);
    }
  };

  window.sellProductQuick = async function(productId) {
    const list = state.products.slice();
    const idx = list.findIndex(p => p.id === productId);
    if (idx === -1) return;

    if (list[idx].quantity <= 0) {
      showToast(`Produto "${list[idx].name}" esgotado no estoque!`, 'warning');
      return;
    }

    // Retira 1un e lança transação de Receita
    list[idx].quantity -= 1;

    try {
      await db.saveProducts(list);
      state.products = list;

      await db.addTransaction({
        description: `Venda rápida: ${list[idx].name}`,
        type: "Receita",
        value: parseFloat(list[idx].sellPrice)
      });

      showToast(`Venda de 1un de "${list[idx].name}" lançada no financeiro!`, 'success');
      
      await loadAllData();
      renderProducts();
      renderFinanceDashboard();
    } catch(err) {
      console.error(err);
    }
  };

  window.deleteProduct = async function(productId) {
    const prod = state.products.find(p => p.id === productId);
    if (!prod) return;

    if (!confirm(`Deseja remover "${prod.name}" do estoque permanentemente?`)) return;

    const list = state.products.filter(p => p.id !== productId);
    try {
      await db.saveProducts(list);
      state.products = list;
      renderProducts();
      showToast("Produto removido do estoque.", 'warning');
    } catch(e) {
      console.error(e);
    }
  };

  // --- FINANCEIRO & FLUXO DE CAIXA ---

  window.setFinanceSubTab = function(subtab) {
    state.financeSubTab = subtab;
    const btnCaixa = document.getElementById("f-tab-caixa");
    const btnClosings = document.getElementById("f-tab-closings");
    const subCaixa = document.getElementById("subpanel-finance-caixa");
    const subClosings = document.getElementById("subpanel-finance-closings");

    if (subtab === "caixa") {
      btnCaixa.classList.add("active");
      btnClosings.classList.remove("active");
      subCaixa.style.display = "block";
      subClosings.style.display = "none";
      renderFinanceDashboard();
    } else {
      btnCaixa.classList.remove("active");
      btnClosings.classList.add("active");
      subCaixa.style.display = "none";
      subClosings.style.display = "block";
      renderClosingsTable();
    }
  };

  function renderFinanceDashboard() {
    const dateStr = formatDateISO(state.selectedDate);
    
    // Filtra transações da data selecionada
    const dayTransactions = state.transactions.filter(t => t.date === dateStr);

    let receitasTotal = 0;
    let despesasTotal = 0;

    dayTransactions.forEach(t => {
      if (t.type === "Receita") {
        receitasTotal += parseFloat(t.value);
      } else {
        despesasTotal += parseFloat(t.value);
      }
    });

    const saldo = receitasTotal - despesasTotal;

    dom.fStatReceitas.textContent = `R$ ${receitasTotal.toFixed(2).replace('.', ',')}`;
    dom.fStatDespesas.textContent = `R$ ${despesasTotal.toFixed(2).replace('.', ',')}`;
    
    dom.fStatSaldo.textContent = `R$ ${saldo.toFixed(2).replace('.', ',')}`;
    if (saldo > 0) {
      dom.fStatSaldo.style.color = "var(--ok)";
    } else if (saldo < 0) {
      dom.fStatSaldo.style.color = "var(--alert)";
    } else {
      dom.fStatSaldo.style.color = "var(--espresso)";
    }

    // Lista de movimentações
    const container = dom.transactionsListContainer;
    if (dayTransactions.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: var(--muted); padding: 15px;">Nenhuma movimentação financeira lançada nesta data.</div>';
      return;
    }

    container.innerHTML = dayTransactions.map(t => {
      const isReceita = t.type === "Receita";
      const timeStr = t.timestamp ? new Date(t.timestamp).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' }) : "";
      return `
        <div class="transaction-item">
          <div class="transaction-details">
            <h4>${esc(t.description)}</h4>
            <span>${timeStr} · ${t.type}</span>
          </div>
          <div class="transaction-value ${isReceita ? 'receita' : 'despesa'}">
            ${isReceita ? '+' : '-'} R$ ${parseFloat(t.value).toFixed(2).replace('.', ',')}
          </div>
        </div>
      `;
    }).join("");
  }

  window.handleNewTransaction = async function(e) {
    e.preventDefault();
    const desc = dom.tDescriptionInput.value.trim();
    const type = dom.tTypeSelect.value;
    const value = parseFloat(dom.tValueInput.value);
    const dateStr = formatDateISO(state.selectedDate);

    if (!desc || isNaN(value)) return;

    try {
      await db.addTransaction({
        description: desc,
        type: type,
        value: value,
        date: dateStr
      });

      dom.cashTransactionForm.reset();
      showToast("Lançamento financeiro registrado!", 'success');
      
      await loadAllData();
      renderFinanceDashboard();
    } catch(err) {
      console.error(err);
    }
  };

  window.handleCloseCaixa = async function() {
    const dateStr = formatDateISO(state.selectedDate);
    const dayTransactions = state.transactions.filter(t => t.date === dateStr);

    if (dayTransactions.length === 0) {
      alert("Não é possível realizar o fechamento pois não há movimentações de caixa nesta data.");
      return;
    }

    let totalReceitas = 0;
    let totalDespesas = 0;

    dayTransactions.forEach(t => {
      if (t.type === "Receita") totalReceitas += parseFloat(t.value);
      else totalDespesas += parseFloat(t.value);
    });

    const saldoFinal = totalReceitas - totalDespesas;
    const dateBr = state.selectedDate.toLocaleDateString("pt-BR");

    if (!confirm(`Deseja encerrar o expediente e fechar o caixa da data ${dateBr}?\n\nReceitas: R$ ${totalReceitas.toFixed(2).replace('.', ',')}\nDespesas: R$ ${totalDespesas.toFixed(2).replace('.', ',')}\nSaldo Consolidado: R$ ${saldoFinal.toFixed(2).replace('.', ',')}`)) return;

    try {
      await db.addClosing({
        date: dateStr,
        dateFormatted: dateBr,
        openedBalance: 0, // Caixa inicial simplificado
        recipesTotal: totalReceitas,
        expensesTotal: totalDespesas,
        closingBalance: saldoFinal,
        closedBy: "Profissional"
      });

      showToast("Fechamento de Caixa consolidado com sucesso!", 'success');
      await loadAllData();
      setFinanceSubTab("closings");
    } catch(err) {
      console.error(err);
    }
  };

  function renderClosingsTable() {
    const tbody = dom.closingsTableBody;
    if (!tbody) return;

    if (state.closings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--muted); padding: 20px;">Nenhum fechamento registrado no histórico.</td></tr>';
      return;
    }

    tbody.innerHTML = state.closings.map(c => {
      const movStr = `+R$ ${parseFloat(c.recipesTotal).toFixed(2).replace('.', ',')} / -R$ ${parseFloat(c.expensesTotal).toFixed(2).replace('.', ',')}`;
      return `
        <tr>
          <td><strong>${c.dateFormatted}</strong></td>
          <td>R$ ${parseFloat(c.openedBalance || 0).toFixed(2).replace('.', ',')}</td>
          <td style="color: var(--muted); font-size: 12px;">${movStr}</td>
          <td><strong>R$ ${parseFloat(c.closingBalance).toFixed(2).replace('.', ',')}</strong></td>
          <td>${esc(c.closedBy)}</td>
        </tr>
      `;
    }).join("");
  }

  // --- GERENCIAMENTO DE SERVIÇOS ---

  function renderServicesTable() {
    dom.servicesTableBody.innerHTML = state.services.map(s => {
      return `
        <tr>
          <td><strong>${esc(s.name)}</strong></td>
          <td>R$ ${parseFloat(s.price).toFixed(2).replace('.', ',')}</td>
          <td>${s.duration} minutos</td>
          <td style="font-size: 12px; color: var(--muted);">${esc(s.description || 'Sem descrição')}</td>
          <td style="text-align: center; white-space: nowrap;">
            <button class="btn btn-secondary" onclick="editService('${s.id}')" style="font-size: 11px; padding: 6px 12px; margin-right: 4px;">Editar</button>
            <button class="btn btn-secondary" onclick="deleteService('${s.id}')" style="font-size: 11px; padding: 6px 12px; color: var(--alert); border-color: var(--alert-bd);">Excluir</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  window.showAddServiceForm = function() {
    dom.editServiceId.value = "";
    dom.serviceEditorForm.reset();
    dom.serviceFormTitle.textContent = "Cadastrar Novo Serviço";
    dom.serviceFormSection.style.display = "block";
    window.scrollTo({ top: dom.serviceFormSection.offsetTop - 80, behavior: 'smooth' });
  };

  window.hideServiceForm = function() {
    dom.serviceFormSection.style.display = "none";
  };

  window.editService = function(serviceId) {
    const service = state.services.find(s => s.id === serviceId);
    if (!service) return;

    dom.editServiceId.value = service.id;
    dom.editServiceName.value = service.name;
    dom.editServicePrice.value = service.price;
    dom.editServiceDuration.value = service.duration;
    dom.editServiceDescription.value = service.description || "";

    dom.serviceFormTitle.textContent = "Editar Serviço existente";
    dom.serviceFormSection.style.display = "block";
    window.scrollTo({ top: dom.serviceFormSection.offsetTop - 80, behavior: 'smooth' });
  };

  async function handleSaveService(e) {
    e.preventDefault();
    const id = dom.editServiceId.value || "s_" + Date.now();
    const name = dom.editServiceName.value.trim();
    const price = parseFloat(dom.editServicePrice.value);
    const duration = parseInt(dom.editServiceDuration.value);
    const description = dom.editServiceDescription.value.trim();

    if (!name || isNaN(price) || isNaN(duration)) return;

    const list = state.services.slice();
    const idx = list.findIndex(s => s.id === id);
    const isNew = idx === -1;

    const serviceObj = { id, name, price, duration, description };

    if (!isNew) {
      list[idx] = serviceObj;
    } else {
      list.push(serviceObj);
    }

    try {
      await db.saveServices(list);
      state.services = list;
      renderServicesTable();
      hideServiceForm();
      showToast(isNew ? `Serviço "${name}" cadastrado!` : `Serviço "${name}" atualizado!`, 'success');
    } catch(err) {
      console.error(err);
    }
  }

  window.deleteService = async function(serviceId) {
    const service = state.services.find(s => s.id === serviceId);
    const sName = service ? service.name : "";

    if (!confirm(`Remover o serviço "${sName}" permanentemente?`)) return;

    const list = state.services.filter(s => s.id !== serviceId);
    try {
      await db.saveServices(list);
      state.services = list;
      renderServicesTable();
      showToast(`Serviço "${sName}" removido.`, 'warning');
    } catch(e) {
      console.error(e);
    }
  };

  // --- CONFIGURAÇÕES DO ESTÚDIO ---

  function initSettingsTab() {
    dom.salonNameInput.value = state.config.salonName || "";
    dom.whatsappPhoneInput.value = state.config.whatsappPhone || "";

    const lunch = state.config.lunchBreak || { active: false, start: "12:00", end: "13:00" };
    dom.lunchActiveInput.checked = lunch.active;
    dom.lunchStartInput.value = lunch.start || "12:00";
    dom.lunchEndInput.value = lunch.end || "13:00";

    renderWorkingHours();
    renderBlocksTable();
  }

  async function handleSaveGeneralConfig(e) {
    e.preventDefault();
    const name = dom.salonNameInput.value.trim();
    const phone = dom.whatsappPhoneInput.value.trim().replace(/\D/g, "");

    if (!name || !phone) return;

    state.config.salonName = name;
    state.config.whatsappPhone = phone;

    try {
      await db.saveConfig(state.config);
      showToast("Configurações salvas!", 'success');
    } catch(err) {
      console.error(err);
    }
  }

  async function handleSavePassword(e) {
    e.preventDefault();
    const newPass = dom.newPasswordInput.value;
    const confirmPass = dom.confirmNewPasswordInput.value;

    if (newPass.length < 6) {
      alert("A senha precisa ter pelo menos 6 caracteres para segurança na nuvem.");
      return;
    }

    if (newPass !== confirmPass) {
      alert("As senhas não coincidem.");
      return;
    }

    const hash = await sha256(newPass);
    state.config.adminPasswordHash = hash;

    try {
      // Atualiza a senha no Firebase Auth
      await db.updatePassword(newPass);
      // Salva no banco de dados
      await db.saveConfig(state.config);
      
      dom.passwordChangeForm.reset();
      showToast("Senha alterada com sucesso!", 'success');
    } catch(err) {
      console.error(err);
      if (err && err.code === "auth/requires-recent-login") {
        alert("Por motivos de segurança, o Firebase exige que você tenha feito login muito recentemente para alterar a senha. Por favor, clique no botão 'Sair' no final do menu esquerdo, faça login novamente com a senha antiga e tente alterar a senha em seguida.");
      } else {
        showToast("Erro ao alterar a senha. Verifique se tem mais de 6 caracteres e tente novamente.", 'error');
      }
    }
  }

  function renderWorkingHours() {
    let html = "";
    for (let day = 0; day < 7; day++) {
      const config = state.workingHours[day] || { active: false, start: "09:00", end: "19:00" };
      html += `
        <div class="working-day-row">
          <div class="day-status">
            <label class="switch">
              <input type="checkbox" name="active_${day}" ${config.active ? 'checked' : ''} onchange="toggleDayRow(${day}, this.checked)">
              <span class="slider"></span>
            </label>
            <span>${WEEKDAYS[day]}</span>
          </div>
          <div class="field" style="margin-bottom: 0;">
            <input type="time" name="start_${day}" id="start_${day}" value="${config.start || '09:00'}" ${config.active ? '' : 'disabled'}>
          </div>
          <div class="field" style="margin-bottom: 0;">
            <input type="time" name="end_${day}" id="end_${day}" value="${config.end || '19:00'}" ${config.active ? '' : 'disabled'}>
          </div>
        </div>
      `;
    }
    dom.workingHoursContainer.innerHTML = html;
  }

  window.toggleDayRow = function(day, checked) {
    const startInput = document.getElementById(`start_${day}`);
    const endInput = document.getElementById(`end_${day}`);
    if (checked) {
      startInput.removeAttribute("disabled");
      endInput.removeAttribute("disabled");
    } else {
      startInput.setAttribute("disabled", "true");
      endInput.setAttribute("disabled", "true");
    }
  };

  async function handleSaveWorkingHours(e) {
    e.preventDefault();
    const hours = {};

    for (let day = 0; day < 7; day++) {
      const active = document.querySelector(`input[name="active_${day}"]`).checked;
      const start = document.querySelector(`input[name="start_${day}"]`).value;
      const end = document.querySelector(`input[name="end_${day}"]`).value;
      hours[day] = { active, start, end };
    }

    state.config.lunchBreak = {
      active: dom.lunchActiveInput.checked,
      start: dom.lunchStartInput.value,
      end: dom.lunchEndInput.value
    };

    try {
      await db.saveWorkingHours(hours);
      await db.saveConfig(state.config);
      state.workingHours = hours;
      showToast("Expediente semanal atualizado!", 'success');
    } catch(err) {
      console.error(err);
    }
  }

  // --- BLOQUEIOS DE AGENDA ---

  function renderBlocksTable() {
    if (state.blockedDates.length === 0) {
      dom.blocksTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--muted); padding: 15px;">Nenhum bloqueio configurado.</td></tr>';
      return;
    }

    state.blockedDates.sort((a,b) => String(a.date).localeCompare(String(b.date)));

    dom.blocksTableBody.innerHTML = state.blockedDates.map(b => {
      const dateBr = new Date(b.date + "T00:00:00").toLocaleDateString("pt-BR");
      const tipo = b.allDay ? "Dia Inteiro" : "Horário Parcial";
      const horários = b.allDay ? "—" : `${b.timeStart} às ${b.timeEnd}`;
      return `
        <tr>
          <td><strong>${dateBr}</strong></td>
          <td>${tipo}</td>
          <td>${horários}</td>
          <td>${esc(b.description || "Sem motivo")}</td>
          <td style="text-align: center;">
            <button type="button" class="btn btn-secondary" onclick="deleteBlock('${b.id}')" style="font-size: 11px; padding: 6px 12px; color: var(--alert); border-color: var(--alert-bd);">Excluir</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  async function handleAddBlock(e) {
    e.preventDefault();
    const dateStr = dom.blockDateInput.value;
    const desc = dom.blockDescriptionInput.value.trim();
    const allDay = dom.blockAllDayInput.checked;

    if (!dateStr) return;

    const blockObj = {
      date: dateStr,
      description: desc || "Bloqueio",
      allDay: allDay,
      timeStart: allDay ? "" : dom.blockTimeStartInput.value,
      timeEnd: allDay ? "" : dom.blockTimeEndInput.value
    };

    try {
      const added = await db.addBlockedDate(blockObj);
      state.blockedDates.push(added);
      renderBlocksTable();
      dom.blockCreatorForm.reset();
      
      dom.blockTimeStartGroup.style.display = "none";
      dom.blockTimeEndGroup.style.display = "none";
      dom.blockTimeStartInput.required = false;
      dom.blockTimeEndInput.required = false;
      dom.blockAllDayInput.checked = true;
      
      showToast("Bloqueio de agenda criado!", 'success');
    } catch(err) {
      console.error(err);
    }
  }

  window.deleteBlock = async function(blockId) {
    const block = state.blockedDates.find(b => b.id === blockId);
    const dateBr = block ? new Date(block.date + "T00:00:00").toLocaleDateString("pt-BR") : "";

    if (!confirm(`Remover bloqueio do dia ${dateBr}?`)) return;

    try {
      const success = await db.deleteBlockedDate(blockId);
      if (success) {
        state.blockedDates = state.blockedDates.filter(b => b.id !== blockId);
        renderBlocksTable();
        showToast("Bloqueio removido.", 'warning');
      }
    } catch(err) {
      console.error(err);
    }
  };

  // --- HELPERS ---

  function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function getWeekdayName(dateStr) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("pt-BR", { weekday: 'long' }).split("-")[0];
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // Inicializa o painel
  init();
})();
