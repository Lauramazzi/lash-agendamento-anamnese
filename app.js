/**
 * app.js - Lógica do Fluxo de Agendamento e Anamnese para a Cliente
 */
(function() {
  const db = window.LashDB;

  // Estado do Agendamento
  const state = {
    currentStep: 1,
    services: [],
    selectedService: null,
    selectedDate: null, // Objeto Date
    selectedTime: null, // String "HH:MM"
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(), // 0-indexed
    workingHours: {},
    blockedDates: [],
    availability: [],
    config: {},
    anamneseAnswers: {}
  };

  const MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const SCHEMA = [
    { title: "Sua saúde", sectionId: "health", fields: [
      { id: "jafez", label: "Você já fez extensão de cílios antes?", type: "yesno_detail", detailLabel: "Teve alguma reação? Qual?" },
      { id: "alergia", label: "Tem alergia a cosmético, cola/adesivo, esparadrapo ou látex?", type: "yesno_detail", flag: "sim", level: "alerta", detailLabel: "A quê?" },
      { id: "lentes", label: "Usa lentes de contato?", type: "yesno" },
      { id: "ocular", label: "Tem alguma condição nos olhos? (conjuntivite, olho seco, blefarite, terçol frequente, glaucoma)", type: "yesno_detail", flag: "sim", level: "atenção", detailLabel: "Qual?" },
      { id: "cirurgia", label: "Fez cirurgia nos olhos nos últimos 6 meses?", type: "yesno", flag: "sim", level: "atenção" },
      { id: "gestante", label: "Está gestante ou amamentando?", type: "yesno", flag: "sim", level: "atenção" },
      { id: "roacutan", label: "Usa isotretinoína (Roacutan) ou usou nos últimos 6 meses?", type: "yesno", flag: "sim", level: "alerta" },
      { id: "medicamento", label: "Faz uso de algum medicamento contínuo?", type: "yesno_detail", detailLabel: "Qual?" },
      { id: "quimio", label: "Faz ou fez quimioterapia / radioterapia?", type: "yesno", flag: "sim", level: "atenção" },
      { id: "autoimune", label: "Tem doença autoimune, de tireoide ou alopecia?", type: "yesno_detail", flag: "sim", level: "atenção", detailLabel: "Qual?" },
      { id: "trico", label: "Costuma arrancar ou coçar muito os cílios?", type: "yesno", flag: "sim", level: "atenção" },
      { id: "diabetes", label: "Tem diabetes?", type: "yesno", flag: "sim", level: "atenção" },
    ]},
    { title: "Sua rotina", sectionId: "routine", fields: [
      { id: "bruco", label: "Dorme de bruços ou de lado?", type: "yesno" },
      { id: "esfrega", label: "Costuma esfregar os olhos?", type: "yesno" },
      { id: "maquiagem", label: "Usa maquiagem nos olhos / rímel à prova d'água com frequência?", type: "yesno" },
      { id: "agua", label: "Frequenta sauna ou piscina com frequência?", type: "yesno" },
    ]}
  ];

  // Elementos do DOM
  const dom = {
    steps: {
      1: document.getElementById("step-1"),
      2: document.getElementById("step-2"),
      3: document.getElementById("step-3"),
      4: document.getElementById("step-4")
    },
    progressBar: document.getElementById("progress-bar"),
    servicesContainer: document.getElementById("services-container"),
    calendarMonthYear: document.getElementById("calendar-month-year"),
    calendarGrid: document.getElementById("calendar-grid"),
    prevMonthBtn: document.getElementById("prev-month"),
    nextMonthBtn: document.getElementById("next-month"),
    timeSlotsContainer: document.getElementById("time-slots-container"),
    slotsHeader: document.getElementById("slots-header"),
    btnBack: document.getElementById("btn-back"),
    btnNext: document.getElementById("btn-next"),
    savebar: document.getElementById("savebar"),
    hint: document.getElementById("hint"),
    anamneseForm: document.getElementById("anamnese-form"),
    healthContainer: document.getElementById("health-fields-container"),
    routineContainer: document.getElementById("routine-fields-container"),
    successSummary: document.getElementById("success-summary"),
    whatsappConfirmBtn: document.getElementById("whatsapp-confirm-btn"),
    salonTitle: document.getElementById("salon-title"),
    salonSubtitle: document.getElementById("salon-subtitle"),
    introArea: document.getElementById("intro-area")
  };

  // Inicialização
  async function init() {
    try {
      // Aguarda DB carregar
      await db.init();
      
      // Carrega Configurações
      state.config = await db.getConfig();

      // Verifica se a agenda está fechada
      if (state.config.agendaAberta === false) {
        renderClosedAgenda();
        return; // Interrompe a inicialização do formulário
      }

      if (state.config.salonName) {
        if (dom.salonTitle) dom.salonTitle.textContent = state.config.salonName;
        document.title = "Agendamento & Anamnese — " + state.config.salonName;
        const navTitle = document.querySelector(".navbar-brand");
        if (navTitle) navTitle.textContent = state.config.salonName;
      }

      // Configura links de contato do WhatsApp antes de agendar
      const contactPhone = state.config.whatsappPhone || "5511999999999";
      const contactMsg = encodeURIComponent("Olá! Estou no site de agendamentos e gostaria de tirar uma dúvida antes de reservar.");
      const contactUrl = `https://api.whatsapp.com/send?phone=${contactPhone}&text=${contactMsg}`;
      for (let i = 1; i <= 3; i++) {
        const btn = document.getElementById(`lp-whatsapp-contact-${i}`);
        if (btn) btn.href = contactUrl;
      }
      
      // Carrega Serviços
      state.services = await db.getServices();
      renderServices();
      renderLpCatalog();
      
      // Carrega Expediente, Bloqueios e Agendamentos
      state.workingHours = await db.getWorkingHours();
      state.blockedDates = await db.getBlockedDates();
      state.availability = await db.getAvailability();

      // Renderiza Formulário de Anamnese
      renderAnamneseForm();

      setupEventListeners();
      updateNavigation();
    } catch(e) {
      console.error("Erro na inicialização da página:", e);
      alert("Houve um erro ao carregar os dados. Recarregue a página.");
    }
  }

  // --- RENDERIZADORES ---

  function renderServices() {
    if (state.services.length === 0) {
      dom.servicesContainer.innerHTML = '<div style="text-align: center; color: var(--muted); padding: 20px;">Nenhum serviço disponível no momento.</div>';
      return;
    }

    dom.servicesContainer.innerHTML = state.services.map(s => {
      const isSelected = state.selectedService && state.selectedService.id === s.id;
      return `
        <div class="service-item ${isSelected ? 'selected' : ''}" data-id="${s.id}" style="display: flex; align-items: center; gap: 15px; padding: 12px; border-radius: var(--radius-md);">
          <div class="service-thumbnail" style="width: 55px; height: 55px; border-radius: 6px; overflow: hidden; flex-shrink: 0; border: 1px solid var(--line); background: var(--cream-lite);">
            <img src="${s.image || 'images/cilios_classico.jpg'}" alt="${esc(s.name)}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
          <div class="service-info" style="flex: 1; text-align: left;">
            <h3 class="service-name" style="margin: 0 0 4px; font-size: 14.5px;">${esc(s.name)}</h3>
            <p class="service-desc" style="margin: 0 0 4px; font-size: 12px; color: var(--muted);">${esc(s.description || '')}</p>
            <div class="service-meta" style="font-size: 11px; color: var(--bronze-deep); font-weight: 500;">
              <span>⏱ ${s.duration} min</span>
            </div>
          </div>
          <div class="service-price" style="font-size: 15px; font-weight: bold; color: var(--espresso); flex-shrink: 0;">R$ ${parseFloat(s.price).toFixed(2).replace('.', ',')}</div>
          <div class="select-indicator"></div>
        </div>
      `;
    }).join("");

    // Adiciona cliques
    dom.servicesContainer.querySelectorAll(".service-item").forEach(el => {
      el.addEventListener("click", () => {
        const id = el.dataset.id;
        state.selectedService = state.services.find(s => s.id === id);
        renderServices();
        hideHint();
      });
    });
  }

  function renderLpCatalog() {
    const catalogContainer = document.getElementById("lp-catalog-container");
    if (!catalogContainer) return;
    
    if (state.services.length === 0) {
      catalogContainer.innerHTML = '<div style="text-align: center; color: var(--muted); padding: 20px;">Nenhuma técnica cadastrada no momento.</div>';
      return;
    }
    
    catalogContainer.innerHTML = state.services.map(s => {
      return `
        <div class="catalog-item">
          <div class="catalog-photo">
            <img src="${s.image || 'images/cilios_classico.jpg'}" alt="${esc(s.name)}">
          </div>
          <div class="catalog-info">
            <h3 class="catalog-name">${esc(s.name)}</h3>
            <p class="catalog-desc">${esc(s.description || '')}</p>
            <div class="catalog-meta" style="display: flex; align-items: center; gap: 6px; margin-top: 5px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color: var(--bronze);"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Duração: ${s.duration} minutos</div>
          </div>
          <div class="catalog-price-action">
            <div class="catalog-price">R$ ${parseFloat(s.price).toFixed(2).replace('.', ',')}</div>
            <button class="btn btn-primary catalog-btn" onclick="selectServiceFromLp('${s.id}')">Reservar Técnica</button>
          </div>
        </div>
      `;
    }).join("");
  }

  window.selectServiceFromLp = function(serviceId) {
    state.selectedService = state.services.find(s => s.id === serviceId);
    renderServices();
    goToStep(2);
    const bookingSection = document.getElementById("booking-section");
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  function renderAnamneseForm() {
    // Renderiza campos de saúde
    const healthSchema = SCHEMA.find(s => s.sectionId === "health");
    dom.healthContainer.innerHTML = healthSchema.fields.map(fieldHTML).join("");

    // Renderiza campos de rotina
    const routineSchema = SCHEMA.find(s => s.sectionId === "routine");
    dom.routineContainer.innerHTML = routineSchema.fields.map(fieldHTML).join("");
  }

  function fieldHTML(f) {
    let inner = "";
    if (f.type === "yesno" || f.type === "yesno_detail") {
      inner = `
        <div class="seg" id="seg_${f.id}">
          <button type="button" class="btn-yn" data-id="${f.id}" data-val="sim">Sim</button>
          <button type="button" class="btn-yn" data-id="${f.id}" data-val="não">Não</button>
        </div>
        <input type="hidden" id="f_${f.id}" name="${f.id}" value="">
      `;
      if (f.type === "yesno_detail") {
        inner += `
          <div class="detail-wrap" id="det_${f.id}">
            <input type="text" id="f_${f.id}_det" name="${f.id}_det" placeholder="${f.detailLabel || 'Descreva'}">
          </div>
        `;
      }
    }
    return `
      <div class="field">
        <label class="lb">${f.label}${f.req ? ' <span class="req">*</span>' : ''}</label>
        ${inner}
      </div>
    `;
  }

  // Define Sim/Não da Anamnese
  window.setYN = function(id, value) {
    const input = document.getElementById("f_" + id);
    if (!input) return;
    input.value = value;
    state.anamneseAnswers[id] = value;

    const seg = document.getElementById("seg_" + id);
    const btnSim = seg.querySelector('[data-val="sim"]');
    const btnNao = seg.querySelector('[data-val="não"]');

    if (value === "sim") {
      btnSim.className = "btn-yn on-sim";
      btnNao.className = "btn-yn";
    } else {
      btnSim.className = "btn-yn";
      btnNao.className = "btn-yn on-nao";
    }

    const detailWrap = document.getElementById("det_" + id);
    if (detailWrap) {
      if (value === "sim") {
        detailWrap.classList.add("show");
      } else {
        detailWrap.classList.remove("show");
        const detInput = document.getElementById(`f_${id}_det`);
        if (detInput) detInput.value = "";
        delete state.anamneseAnswers[id + "_det"];
      }
    }
    hideHint();
  };

  // --- SISTEMA DE CALENDÁRIO E HORÁRIOS ---

  function initCalendar() {
    dom.calendarMonthYear.textContent = `${MONTH_NAMES[state.currentMonth]} ${state.currentYear}`;
    
    // Grid Header
    let html = ["D", "S", "T", "Q", "Q", "S", "S"].map(d => `<div class="calendar-day-header">${d}</div>`).join("");

    const firstDay = new Date(state.currentYear, state.currentMonth, 1).getDay();
    const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();

    // Dias vazios no início
    for (let i = 0; i < firstDay; i++) {
      html += '<div class="calendar-cell empty"></div>';
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(state.currentYear, state.currentMonth, day);
      const dateStr = formatDateISO(date);
      const weekday = date.getDay();

      let isPast = date < today;
      let isBlocked = state.blockedDates.some(b => b.date === dateStr && b.allDay);
      let isClosed = !state.workingHours[weekday] || !state.workingHours[weekday].active;

      let isAvailable = !isPast && !isBlocked && !isClosed;
      let isSelected = state.selectedDate && formatDateISO(state.selectedDate) === dateStr;

      let className = "calendar-cell";
      if (isPast) className += " past";
      else if (isBlocked || isClosed) className += " disabled";
      else {
        className += " available";
        if (isSelected) className += " selected";
      }

      html += `<div class="${className}" data-date="${dateStr}">${day}</div>`;
    }

    dom.calendarGrid.innerHTML = html;

    // Adiciona cliques nos dias livres
    dom.calendarGrid.querySelectorAll(".calendar-cell.available").forEach(el => {
      el.addEventListener("click", () => {
        dom.calendarGrid.querySelectorAll(".calendar-cell.selected").forEach(sel => sel.classList.remove("selected"));
        el.classList.add("selected");
        state.selectedDate = new Date(el.dataset.date + "T00:00:00");
        state.selectedTime = null;
        renderTimeSlots();
        hideHint();
      });
    });
  }

  async function renderTimeSlots() {
    if (!state.selectedDate) {
      dom.timeSlotsContainer.innerHTML = '<div style="grid-column: span 2; text-align: center; color: var(--muted); padding: 10px;">Selecione um dia no calendário.</div>';
      return;
    }

    const dateStr = formatDateISO(state.selectedDate);
    const formattedDateBr = state.selectedDate.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit' });
    dom.slotsHeader.textContent = `Horários para ${formattedDateBr}`;

    const weekday = state.selectedDate.getDay();
    const dayConfig = state.workingHours[weekday];

    if (!dayConfig || !dayConfig.active) {
      dom.timeSlotsContainer.innerHTML = '<div style="grid-column: span 2; text-align: center; color: var(--muted); padding: 10px;">Estúdio fechado neste dia.</div>';
      return;
    }

    // Carrega bloqueios de horário parcial
    const dayBlocks = state.blockedDates.filter(b => b.date === dateStr && !b.allDay);
    // Carrega agendamentos existentes na mesma data
    const dayBookings = state.availability.filter(b => b.bookingDate === dateStr && b.status !== "Cancelado");

    const serviceDuration = state.selectedService ? state.selectedService.duration : 60;

    // Intervalo de Almoço
    const lunch = state.config.lunchBreak;

    // Gera slots a cada 30 minutos
    const slots = [];
    let currentMin = timeToMinutes(dayConfig.start);
    const endMin = timeToMinutes(dayConfig.end);

    const now = new Date();
    const isToday = dateStr === formatDateISO(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();

    while (currentMin + serviceDuration <= endMin) {
      const slotTimeStr = minutesToTime(currentMin);
      const slotStart = currentMin;
      const slotEnd = currentMin + serviceDuration;

      let isAvail = true;

      // 1. Horário passado (se hoje)
      if (isToday && slotStart <= nowMin + 30) {
        isAvail = false;
      }

      // 2. Sobreposição com intervalo de almoço
      if (isAvail && lunch && lunch.active) {
        const lunchStart = timeToMinutes(lunch.start);
        const lunchEnd = timeToMinutes(lunch.end);
        // Se o atendimento colidir com o almoço
        if (slotStart < lunchEnd && slotEnd > lunchStart) {
          isAvail = false;
        }
      }

      // 3. Sobreposição com bloqueios parciais
      if (isAvail) {
        for (const block of dayBlocks) {
          const bStart = timeToMinutes(block.timeStart);
          const bEnd = timeToMinutes(block.timeEnd);
          if (slotStart < bEnd && slotEnd > bStart) {
            isAvail = false;
            break;
          }
        }
      }

      // 4. Sobreposição com agendamentos existentes
      if (isAvail) {
        for (const booking of dayBookings) {
          const bookStart = timeToMinutes(booking.bookingTime);
          const bookDuration = parseInt(booking.serviceDuration || 60);
          const bookEnd = bookStart + bookDuration;
          if (slotStart < bookEnd && slotEnd > bookStart) {
            isAvail = false;
            break;
          }
        }
      }

      slots.push({
        time: slotTimeStr,
        available: isAvail
      });

      currentMin += 30; // Incrementa de 30 em 30 min
    }

    if (slots.length === 0) {
      dom.timeSlotsContainer.innerHTML = '<div style="grid-column: span 2; text-align: center; color: var(--muted); padding: 10px;">Sem horários livres.</div>';
      return;
    }

    dom.timeSlotsContainer.innerHTML = slots.map(slot => {
      const isSelected = state.selectedTime === slot.time;
      return `
        <div class="time-slot ${slot.available ? '' : 'disabled'} ${isSelected ? 'selected' : ''}" 
             data-time="${slot.time}" 
             ${slot.available ? '' : 'style="pointer-events: none;"'}>
          ${slot.time}
        </div>
      `;
    }).join("");

    // Adiciona cliques nos slots de horário
    dom.timeSlotsContainer.querySelectorAll(".time-slot:not(.disabled)").forEach(el => {
      el.addEventListener("click", () => {
        dom.timeSlotsContainer.querySelectorAll(".time-slot.selected").forEach(sel => sel.classList.remove("selected"));
        el.classList.add("selected");
        state.selectedTime = el.dataset.time;
        hideHint();
      });
    });
  }

  // --- AUTO-PREENCHIMENTO DE RETORNO (UX) ---

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  async function handleWhatsappAutofill() {
    const phoneVal = (document.getElementById("f_whatsapp").value || "").trim().replace(/\D/g, "");
    if (phoneVal.length < 10) {
      const banner = document.getElementById("anamnese-auto-load-banner");
      if (banner) banner.remove();
      return;
    }
    
    const latest = await db.getClientProfile(phoneVal);

    if (!latest) {
      const banner = document.getElementById("anamnese-auto-load-banner");
      if (banner) banner.remove();
      return;
    }

    // Auto-preenche campos cadastrais
    document.getElementById("f_nome").value = latest.clientName || "";
    if (latest.clientBirth) document.getElementById("f_nascimento").value = latest.clientBirth;
    if (latest.clientInstagram) document.getElementById("f_instagram").value = latest.clientInstagram;
    if (latest.clientOrigem) document.getElementById("f_origem").value = latest.clientOrigem;
    
    // Auto-preenche ficha de saúde e rotina
    const anamnese = latest.anamnese || {};
    Object.keys(anamnese).forEach(key => {
      if (key.endsWith("_det")) return;
      const val = anamnese[key];
      setYN(key, val);
      
      const detInput = document.getElementById(`f_${key}_det`);
      if (detInput && anamnese[key + "_det"]) {
        detInput.value = anamnese[key + "_det"];
      }
    });
    
    // Exibe banner informativo
    let banner = document.getElementById("anamnese-auto-load-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "anamnese-auto-load-banner";
      banner.className = "demo-banner";
      banner.style.backgroundColor = "var(--ok-bg)";
      banner.style.borderColor = "var(--ok)";
      banner.style.color = "var(--espresso)";
      banner.style.marginBottom = "20px";
      banner.style.textAlign = "left";
      banner.style.padding = "12px 16px";
      
      const form = dom.anamneseForm;
      form.insertBefore(banner, form.firstChild);
    }
    
    banner.innerHTML = `
      ✨ <strong>Ficha de Anamnese Reutilizada!</strong> Encontramos seu cadastro pelo número do WhatsApp. Suas respostas anteriores foram carregadas automaticamente. Revise caso algo tenha mudado.
    `;
  }

  // --- NAVEGAÇÃO E WIZARD ---

  function setupEventListeners() {
    dom.btnNext.addEventListener("click", handleNext);
    dom.btnBack.addEventListener("click", handleBack);

    dom.prevMonthBtn.addEventListener("click", () => {
      state.currentMonth--;
      if (state.currentMonth < 0) {
        state.currentMonth = 11;
        state.currentYear--;
      }
      initCalendar();
    });

    dom.nextMonthBtn.addEventListener("click", () => {
      state.currentMonth++;
      if (state.currentMonth > 11) {
        state.currentMonth = 0;
        state.currentYear++;
      }
      initCalendar();
    });

    // Cliques nos botões Sim/Não gerados dinamicamente
    document.addEventListener("click", function(e) {
      if (e.target && e.target.classList.contains("btn-yn")) {
        const id = e.target.dataset.id;
        const val = e.target.dataset.val;
        setYN(id, val);
      }
    });

    // Detecção de WhatsApp para auto-carregar anamnese anterior
    const whatsappInput = document.getElementById("f_whatsapp");
    if (whatsappInput) {
      whatsappInput.addEventListener("input", debounce(handleWhatsappAutofill, 600));
    }

    // Impedir submit do form
    dom.anamneseForm.addEventListener("submit", (e) => e.preventDefault());
  }

  function handleNext() {
    if (state.currentStep === 1) {
      if (!state.selectedService) {
        showHint("Por favor, selecione um serviço para avançar.");
        return;
      }
      goToStep(2);
    } else if (state.currentStep === 2) {
      if (!state.selectedDate || !state.selectedTime) {
        showHint("Por favor, escolha uma data e horário livres.");
        return;
      }
      goToStep(3);
    } else if (state.currentStep === 3) {
      submitBookingAndAnamnese();
    }
  }

  function handleBack() {
    if (state.currentStep > 1 && state.currentStep < 4) {
      goToStep(state.currentStep - 1);
    }
  }

  function goToStep(step) {
    Object.keys(dom.steps).forEach(s => {
      dom.steps[s].classList.remove("active");
    });
    dom.steps[step].classList.add("active");

    const stepsProgress = dom.progressBar.querySelectorAll(".progress-step");
    stepsProgress.forEach(el => {
      const sNum = parseInt(el.dataset.step);
      el.classList.remove("active", "completed");
      if (sNum === step) el.classList.add("active");
      else if (sNum < step) el.classList.add("completed");
    });

    state.currentStep = step;
    updateNavigation();
    
    // Rola a tela suavemente para o início do agendamento, não para o topo do site
    const bookingSection = document.getElementById("booking-section");
    if (bookingSection) {
      bookingSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function updateNavigation() {
    hideHint();
    if (state.currentStep === 1) {
      dom.btnBack.style.visibility = "hidden";
      dom.btnNext.textContent = "Avançar para Horários";
      dom.btnNext.style.display = "inline-flex";
      dom.savebar.style.display = "block";
      dom.introArea.style.display = "block";
    } else if (state.currentStep === 2) {
      dom.btnBack.style.visibility = "visible";
      dom.btnNext.textContent = "Avançar para Ficha";
      dom.btnNext.style.display = "inline-flex";
      dom.savebar.style.display = "block";
      dom.introArea.style.display = "block";
      initCalendar();
      renderTimeSlots();
    } else if (state.currentStep === 3) {
      dom.btnBack.style.visibility = "visible";
      dom.btnNext.textContent = "Confirmar Agendamento";
      dom.btnNext.style.display = "inline-flex";
      dom.savebar.style.display = "block";
      dom.introArea.style.display = "block";

      const modelContainer = document.getElementById("model-banner-container");
      const imgCheckbox = document.getElementById("t_imagem");
      if (modelContainer && imgCheckbox) {
        const isModelo = state.selectedService && state.selectedService.id === "s8";
        const labelSpan = imgCheckbox.nextElementSibling;
        if (isModelo) {
          modelContainer.innerHTML = `
            <div style="background: #FDF3E7; border: 1px solid #E8C1A0; color: #8F5B30; margin-bottom: 20px; font-size: 13px; text-align: left; padding: 14px; border-radius: 8px; line-height: 1.5;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 6px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              <b>Termo de Modelo:</b> Ao prosseguir, você declara estar ciente de que o serviço de Modelo possui valor reduzido para fins de criação de conteúdo. É obrigatório autorizar o uso de imagens/vídeos e assumir a responsabilidade de reportar qualquer ocorrência relacionada à experiência.
            </div>
          `;
          imgCheckbox.required = true;
          if (labelSpan) {
            labelSpan.innerHTML = `Compreendo e aceito a responsabilidade de reportar qualquer situação relacionada à experiência e autorizo o uso irrestrito de fotos/vídeos dos meus olhos e procedimento para criação de conteúdo. <span class="req">*</span>`;
          }
        } else {
          modelContainer.innerHTML = "";
          imgCheckbox.required = false;
          if (labelSpan) {
            labelSpan.innerHTML = `Autorizo o uso de fotos do procedimento para divulgação. <span class="opt">(opcional)</span>`;
          }
        }
      }
    } else if (state.currentStep === 4) {
      // Oculta rodapé de ações no sucesso
      dom.savebar.style.display = "none";
      dom.introArea.style.display = "none";
    }
  }

  // --- SUBMIT E GERAÇÃO DE PONTOS DE ATENÇÃO ---

  function computeFlags(data) {
    const out = [];
    SCHEMA.forEach(s => s.fields.forEach(f => {
      if (f.flag && data[f.id] === f.flag) {
        let t = f.label.replace(/\?$/, "").replace(/\(.*?\)/, "").trim();
        if (f.type === "yesno_detail" && data[f.id + "_det"]) {
          t += " (" + data[f.id + "_det"] + ")";
        }
        out.push((f.level === "alerta" ? "⚠ " : "") + t);
      }
    }));
    return out;
  }

  async function submitBookingAndAnamnese() {
    const nome = (document.getElementById("f_nome").value || "").trim();
    const nascimento = document.getElementById("f_nascimento").value;
    const whatsapp = (document.getElementById("f_whatsapp").value || "").trim();
    const instagram = (document.getElementById("f_instagram").value || "").trim();
    const origem = document.getElementById("f_origem").value;
    const ass = (document.getElementById("f_assinatura").value || "").trim();

    if (!nome || !whatsapp) {
      showHint("Por favor, preencha seu Nome completo e WhatsApp.");
      return;
    }

    if (!document.getElementById("t_veraz").checked || !document.getElementById("t_lgpd").checked) {
      showHint("É necessário aceitar os termos obrigatórios (veracidade e LGPD).");
      return;
    }

    const imgCheck = document.getElementById("t_imagem");
    if (imgCheck && imgCheck.required && !imgCheck.checked) {
      showHint("Como modelo, é obrigatório autorizar o uso de imagens para prosseguir.");
      return;
    }

    if (!ass) {
      showHint("Por favor, assine digitando seu nome completo no final.");
      return;
    }

    // Compila respostas de Sim/Não
    const answers = {};
    SCHEMA.forEach(s => s.fields.forEach(f => {
      const val = document.getElementById("f_" + f.id).value;
      answers[f.id] = val || "não"; // default para não se não selecionado
      if (f.type === "yesno_detail") {
        const detVal = document.getElementById("f_" + f.id + "_det").value || "";
        answers[f.id + "_det"] = detVal;
      }
    }));

    const flags = computeFlags(answers);
    
    // Payload Unificado
    const payload = {
      marca: state.config.salonName || "Lashroom",
      clientName: nome,
      clientBirth: nascimento || "",
      clientPhone: whatsapp,
      clientInstagram: instagram || "",
      clientOrigem: origem || "",
      serviceId: state.selectedService.id,
      serviceName: state.selectedService.name,
      servicePrice: state.selectedService.price,
      serviceDuration: state.selectedService.duration,
      bookingDate: formatDateISO(state.selectedDate),
      bookingTime: state.selectedTime,
      assinatura: ass,
      usoImagem: document.getElementById("t_imagem").checked ? "Autorizado" : "Não autorizado",
      consentimentoLgpd: "Sim",
      pontosAtencao: flags.length ? flags.join(" | ") : "Nenhum",
      // Respostas da Anamnese salvas no mesmo documento
      anamnese: answers
    };

    dom.btnNext.disabled = true;
    dom.btnNext.textContent = "Processando...";

    try {
      // Salva no Banco (Local ou Firestore)
      const booking = await db.addBooking(payload);
      
      // Renderiza resumo de sucesso
      renderSuccess(booking);
      
      // Avança para passo 4
      goToStep(4);
    } catch(e) {
      console.error(e);
      showHint("Erro ao processar agendamento. Verifique sua conexão e tente novamente.");
      dom.btnNext.disabled = false;
      dom.btnNext.textContent = "Confirmar Agendamento";
    }
  }

  function renderSuccess(booking) {
    const dataBr = new Date(booking.bookingDate + "T00:00:00").toLocaleDateString("pt-BR");
    
    dom.successSummary.innerHTML = `
      <h3>Resumo do seu Horário:</h3>
      <div class="success-row">
        <span>Serviço:</span>
        <span>${esc(booking.serviceName)}</span>
      </div>
      <div class="success-row">
        <span>Duração:</span>
        <span>${booking.serviceDuration} minutos</span>
      </div>
      <div class="success-row">
        <span>Preço:</span>
        <span>R$ ${parseFloat(booking.servicePrice).toFixed(2).replace('.', ',')}</span>
      </div>
      <div class="success-row">
        <span>Data:</span>
        <span>${dataBr} (${getWeekdayName(booking.bookingDate)})</span>
      </div>
      <div class="success-row">
        <span>Horário:</span>
        <span>${booking.bookingTime}h</span>
      </div>
      <div class="success-row" style="border-top: 1px dashed var(--line); margin-top: 8px; padding-top: 8px;">
        <span>Cliente:</span>
        <span>${esc(booking.clientName)}</span>
      </div>
      <div class="success-row" style="border-top: 1px dashed var(--line); margin-top: 8px; padding-top: 8px;">
        <span>Localização:</span>
        <span style="text-align: right; font-size: 12px; font-weight: 500;">R. Ambrósio dos Santos, 749<br>Planalto Paraíso - São Carlos/SP</span>
      </div>
    `;

    // Configura Botão de WhatsApp
    const phone = state.config.whatsappPhone || "5511999999999";
    const textMsg = `Olá! Acabei de realizar meu agendamento e preencher a ficha de anamnese online.
*Serviço:* ${booking.serviceName}
*Data:* ${dataBr} às ${booking.bookingTime}h
*Nome:* ${booking.clientName}
*Local:* R. Ambrósio dos Santos, 749 - Planalto Paraíso, São Carlos - SP

Por favor, confirme se deu tudo certo no sistema. Obrigada!`;

    dom.whatsappConfirmBtn.href = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(textMsg)}`;
  }

  // --- HELPERS ---

  function showHint(msg) {
    dom.hint.textContent = msg;
    dom.hint.classList.add("show");
  }

  function hideHint() {
    dom.hint.classList.remove("show");
  }

  function formatDateISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function timeToMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  function minutesToTime(m) {
    const h = String(Math.floor(m / 60)).padStart(2, "0");
    const min = String(m % 60).padStart(2, "0");
    return `${h}:${min}`;
  }

  function getWeekdayName(dateStr) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("pt-BR", { weekday: 'long' }).split("-")[0];
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function renderClosedAgenda() {
    const bookingSection = document.getElementById("booking-section");
    if (!bookingSection) return;
    
    const savebar = document.getElementById("savebar");
    if (savebar) savebar.style.display = "none";
    
    const contactPhone = state.config.whatsappPhone || "5511999999999";
    const textMsg = encodeURIComponent("Olá! Vi que a agenda online está fechada e gostaria de verificar os horários disponíveis por aqui.");
    const url = `https://api.whatsapp.com/send?phone=${contactPhone}&text=${textMsg}`;
    
    bookingSection.innerHTML = `
      <div class="section-card" style="text-align: center; padding: 50px 20px; max-width: 540px; margin: 0 auto; border: 1px solid var(--line); box-shadow: var(--shadow); border-radius: var(--radius); background: var(--card);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 48px; height: 48px; color: var(--bronze); margin: 0 auto 18px; display: block;">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <h3 style="font-family: 'Playfair Display', serif; font-size: 20px; color: var(--espresso); margin-bottom: 12px;">Agenda Online Fechada</h3>
        <p style="font-size: 13.5px; color: var(--muted); line-height: 1.6; margin-bottom: 25px;">Nossos agendamentos online estão temporariamente suspensos. Entre em contato diretamente no WhatsApp para consultar vagas remanescentes ou lista de espera.</p>
        <a href="${url}" target="_blank" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none; justify-content: center; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-family: 'Montserrat', sans-serif;">
          <svg style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.59 2.022 14.12 1 11.503 1c-5.442 0-9.866 4.372-9.87 9.802 0 1.96.516 3.868 1.5 5.58L2.082 20.91l4.565-1.756zM17.47 15.385c-.32-.16-1.89-.933-2.185-1.043-.294-.11-.508-.163-.722.163-.214.32-.83.1.043-1.018-.11-.183-.32-.236-.64-.396-1.862-.935-3.061-2.905-3.153-3.03-.092-.124-.008-.19.083-.281.082-.082.183-.214.275-.32.09-.107.12-.182.18-.305.06-.122.03-.23-.015-.32-.045-.09-.41-1.002-.56-1.368-.146-.358-.293-.31-.41-.315-.1-.004-.213-.005-.32-.005-.107 0-.28.04-.427.198-.145.16-.557.545-.557 1.328 0 .783.57 1.538.65 1.644.08.106 1.12 1.707 2.715 2.397.379.164.674.263.905.337.382.122.73.105 1.005.064.307-.046 1.89-.773 2.158-1.48.267-.706.267-1.312.187-1.438-.08-.126-.293-.207-.61-.368z"/>
          </svg>
          Falar no WhatsApp
        </a>
      </div>
    `;
  }

  // Inicializa a aplicação
  init();
})();
