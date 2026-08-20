/**
 * db.js - Banco de Dados Híbrido (Firebase/Firestore com Fallback para localStorage)
 * Centraliza o salvamento de agendamentos, fichas de anamnese, serviços, configurações, estoque e financeiro.
 */
(function() {
  const DEFAULT_SERVICES = [
    { id: "s1", name: "Clássico", price: 130.00, duration: 90, description: "Aplicação individual de fios sintéticos premium sobre cada cílio natural. Efeito leve, clássico e sofisticado.", image: "images/cilios_classico.jpg" },
    { id: "s2", name: "Brasileiro", price: 150.00, duration: 120, description: "Volume tecnológico com fios em formato Y. Proporciona preenchimento marcante, maciez e leveza.", image: "images/cilios_brasileiro.jpg" },
    { id: "s3", name: "Brasileiro Marrom", price: 160.00, duration: 120, description: "Volume tecnológico em formato Y com fios marrons de luxo. Efeito extremamente natural, harmônico e suave.", image: "images/cilios_brasileiro_marrom.jpg" },
    { id: "s4", name: "Egípcio", price: 160.00, duration: 120, description: "Volume tecnológico com fios em formato W. Garante textura volumosa de alta definição e durabilidade.", image: "images/cilios_egipcio.jpg" },
    { id: "s5", name: "Egípcio Marrom", price: 170.00, duration: 120, description: "Volume em formato W na tonalidade marrom café premium. Perfeito para realçar o olhar com extrema elegância e suavidade.", image: "images/cilios_egipcio_marrom.jpg" },
    { id: "s6", name: "Fox Eyes", price: 180.00, duration: 130, description: "Mapeamento estratégico que alonga o canto externo dos olhos, criando um efeito de olhar de raposa levantado e marcante.", image: "images/cilios_fox_eyes.jpg" },
    { id: "s7", name: "Sirena", price: 180.00, duration: 130, description: "Estilo sereia com fios de espessura variada e alongamento externo marcante, proporcionando um olhar wispy, fluido e sedutor.", image: "images/cilios_sirena.jpg" },
    { id: "s8", name: "Modelo", price: 50.00, duration: 150, description: "Serviço com valor promocional para criação de conteúdo. A modelo autoriza o uso de imagem/fotos para divulgação e se compromete a reportar qualquer necessidade de ajuste ou experiência.", image: "images/cilios_modelo.jpg" }
  ];

  const DEFAULT_PRODUCTS = [
    { id: "p1", name: "Shampoo de Limpeza Lash (150ml)", costPrice: 15.00, sellPrice: 35.00, quantity: 12 },
    { id: "p2", name: "Bruma Fixadora Cílios (50ml)", costPrice: 20.00, sellPrice: 45.00, quantity: 8 },
    { id: "p3", name: "Escovinhas Descartáveis (Pacote 50 un)", costPrice: 5.00, sellPrice: 15.00, quantity: 20 }
  ];

  const DEFAULT_WORKING_HOURS = {
    0: { active: false, start: "09:00", end: "13:00" }, // Domingo
    1: { active: true, start: "09:00", end: "19:00" },  // Segunda
    2: { active: true, start: "09:00", end: "19:00" },  // Terça
    3: { active: true, start: "09:00", end: "19:00" },  // Quarta
    4: { active: true, start: "09:00", end: "19:00" },  // Quinta
    5: { active: true, start: "09:00", end: "19:00" },  // Sexta
    6: { active: true, start: "09:00", end: "14:00" }   // Sábado
  };

  const DEFAULT_CONFIG = {
    adminPasswordHash: "b0857a7c7d3178e44ca0d8836786ae18ee806f7625e589b98c5bad307813eaf6", // hash de "trocar123"
    whatsappPhone: "5511999999999",
    salonName: "Lashroom",
    lunchBreak: { active: true, start: "12:00", end: "13:00" }
  };

  const STORAGE_KEYS = {
    SERVICES: "lash_anamnese_services",
    WORKING_HOURS: "lash_anamnese_working_hours",
    BLOCKED_DATES: "lash_anamnese_blocked_dates",
    BOOKINGS: "lash_anamnese_bookings",
    CONFIG: "lash_anamnese_config",
    PRODUCTS: "lash_products",
    TRANSACTIONS: "lash_transactions",
    CLOSINGS: "lash_closings"
  };

  let useFirebase = false;
  let firestoreDb = null;

  // Impoe timeout de 4 segundos nas requisições do Firebase
  function withTimeout(promise, ms = 4000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timeout de conexão com o banco de dados na nuvem (Firebase)"));
      }, ms);
      promise.then(
        (res) => {
          clearTimeout(timer);
          resolve(res);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  // Verifica se o Firebase está configurado no arquivo firebase-config.js
  if (window.FirebaseConfig && window.FirebaseConfig.apiKey && window.FirebaseConfig.apiKey !== "") {
    try {
      firebase.initializeApp(window.FirebaseConfig);
      firestoreDb = firebase.firestore();
      useFirebase = true;
      console.log("LashDB: Conectado ao Firebase Cloud Firestore.");
    } catch (e) {
      console.error("LashDB: Erro ao inicializar Firebase SDK. Usando fallback localStorage.", e);
    }
  }

  // --- MÉTODOS AUXILIARES LOCAL STORAGE ---
  function getLocal(key, defaultValue) {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultValue;
  }

  function saveLocal(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function initLocal() {
    const localServices = getLocal(STORAGE_KEYS.SERVICES, []);
    let needsReset = false;
    if (localServices.length !== DEFAULT_SERVICES.length) {
      needsReset = true;
    } else {
      const localNames = localServices.map(s => s.name);
      needsReset = !DEFAULT_SERVICES.every(s => localNames.includes(s.name));
    }
    if (needsReset) {
      saveLocal(STORAGE_KEYS.SERVICES, DEFAULT_SERVICES);
    } else {
      // Garante que os caminhos das imagens estejam atualizados se já existir o tamanho correto
      saveLocal(STORAGE_KEYS.SERVICES, DEFAULT_SERVICES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.WORKING_HOURS)) saveLocal(STORAGE_KEYS.WORKING_HOURS, DEFAULT_WORKING_HOURS);
    if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) saveLocal(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
    if (!localStorage.getItem(STORAGE_KEYS.BLOCKED_DATES)) saveLocal(STORAGE_KEYS.BLOCKED_DATES, []);
    if (!localStorage.getItem(STORAGE_KEYS.BOOKINGS)) saveLocal(STORAGE_KEYS.BOOKINGS, []);
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) saveLocal(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
    if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) saveLocal(STORAGE_KEYS.TRANSACTIONS, []);
    if (!localStorage.getItem(STORAGE_KEYS.CLOSINGS)) saveLocal(STORAGE_KEYS.CLOSINGS, []);
  }

  // Inicialização local padrão
  initLocal();

  window.LashDB = {
    init: async function() {
      if (useFirebase) {
        try {
          // 1. Seed de Serviços (Protegido contra erro de escrita de usuário não autenticado)
          const servicesSnapshot = await withTimeout(firestoreDb.collection("services").get(), 4000);
          let needsReset = false;
          if (servicesSnapshot.empty || servicesSnapshot.size !== DEFAULT_SERVICES.length) {
            needsReset = true;
          } else {
            const existingNames = [];
            servicesSnapshot.forEach(doc => existingNames.push(doc.data().name));
            needsReset = !DEFAULT_SERVICES.every(s => existingNames.includes(s.name));
          }

          if (needsReset) {
            try {
              const batch = firestoreDb.batch();
              servicesSnapshot.forEach(doc => batch.delete(doc.ref));
              DEFAULT_SERVICES.forEach(s => batch.set(firestoreDb.collection("services").doc(s.id), s));
              await batch.commit();
              console.log("LashDB: Serviços sincronizados com sucesso no Firestore.");
            } catch (writeErr) {
              console.warn("LashDB: Permissão de escrita negada para atualizar serviços (esperado para clientes não logados).");
            }
          }

          // 2. Seed de Configurações (Protegido contra erro de escrita)
          const configDoc = await withTimeout(firestoreDb.collection("settings").doc("general").get(), 4000);
          if (!configDoc.exists) {
            try {
              await firestoreDb.collection("settings").doc("general").set(DEFAULT_CONFIG);
            } catch (writeErr) {
              console.warn("LashDB: Permissão de escrita negada para configurações (esperado para clientes não logados).");
            }
          }

          // 3. Seed de Horários (Protegido contra erro de escrita)
          const hoursDoc = await withTimeout(firestoreDb.collection("settings").doc("workingHours").get(), 4000);
          if (!hoursDoc.exists) {
            try {
              await firestoreDb.collection("settings").doc("workingHours").set(DEFAULT_WORKING_HOURS);
            } catch (writeErr) {
              console.warn("LashDB: Permissão de escrita negada para expediente (esperado para clientes não logados).");
            }
          }

          // 4. Seed de Produtos (Protegido contra erros de leitura ou escrita)
          try {
            const productsSnapshot = await withTimeout(firestoreDb.collection("products").get(), 4000);
            if (productsSnapshot.empty) {
              for (const prod of DEFAULT_PRODUCTS) {
                await firestoreDb.collection("products").doc(prod.id).set(prod);
              }
            }
          } catch (prodErr) {
            console.log("LashDB: Seed de produtos ignorado ou permissão negada.");
          }
        } catch (e) {
          console.warn("LashDB: Erro fatal de conexão ou leitura no Firebase. Usando modo de segurança local.", e);
          useFirebase = false;
          initLocal();
        }
      } else {
        initLocal();
      }
    },

    isCloudMode: function() {
      return useFirebase;
    },

    login: async function(email, password) {
      if (useFirebase) {
        try {
          await firebase.auth().signInWithEmailAndPassword(email, password);
          return true;
        } catch (e) {
          throw e;
        }
      } else {
        // Fallback local se Firebase estiver inativo
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
        const hash = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
        const config = await this.getConfig();
        const expected = config.adminPasswordHash || "b0857a7c7d3178e44ca0d8836786ae18ee806f7625e589b98c5bad307813eaf6";
        if (hash === expected) {
          return true;
        } else {
          throw new Error("Senha incorreta localmente");
        }
      }
    },

    logout: async function() {
      if (useFirebase) {
        await firebase.auth().signOut();
      }
    },

    updatePassword: async function(newPass) {
      if (useFirebase) {
        const user = firebase.auth().currentUser;
        if (user) {
          await user.updatePassword(newPass);
        }
      }
    },

    // Serviços
    getServices: async function() {
      if (useFirebase) {
        try {
          const snapshot = await withTimeout(firestoreDb.collection("services").get(), 4000);
          const list = [];
          snapshot.forEach(doc => list.push(doc.data()));
          return list;
        } catch (e) {
          console.warn("LashDB: Fallback local para obter serviços.", e);
          useFirebase = false;
          return getLocal(STORAGE_KEYS.SERVICES, DEFAULT_SERVICES);
        }
      } else {
        return getLocal(STORAGE_KEYS.SERVICES, DEFAULT_SERVICES);
      }
    },
    saveServices: async function(services) {
      if (useFirebase) {
        try {
          const snapshot = await withTimeout(firestoreDb.collection("services").get(), 4000);
          const batch = firestoreDb.batch();
          snapshot.forEach(doc => batch.delete(doc.ref));
          services.forEach(s => batch.set(firestoreDb.collection("services").doc(s.id), s));
          await batch.commit();
        } catch (e) {
          console.warn("LashDB: Fallback local para salvar serviços.", e);
          useFirebase = false;
          saveLocal(STORAGE_KEYS.SERVICES, services);
        }
      } else {
        saveLocal(STORAGE_KEYS.SERVICES, services);
      }
    },

    // Configurações
    getConfig: async function() {
      if (useFirebase) {
        try {
          const doc = await withTimeout(firestoreDb.collection("settings").doc("general").get(), 4000);
          return doc.exists ? doc.data() : DEFAULT_CONFIG;
        } catch (e) {
          console.warn("LashDB: Fallback local para configurações.", e);
          useFirebase = false;
          return getLocal(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
        }
      } else {
        return getLocal(STORAGE_KEYS.CONFIG, DEFAULT_CONFIG);
      }
    },
    saveConfig: async function(config) {
      if (useFirebase) {
        try {
          await firestoreDb.collection("settings").doc("general").set(config, { merge: true });
        } catch (e) {
          console.warn("LashDB: Fallback local para salvar configurações.", e);
          useFirebase = false;
          saveLocal(STORAGE_KEYS.CONFIG, config);
        }
      } else {
        saveLocal(STORAGE_KEYS.CONFIG, config);
      }
    },

    // Expediente Semanal
    getWorkingHours: async function() {
      if (useFirebase) {
        try {
          const doc = await withTimeout(firestoreDb.collection("settings").doc("workingHours").get(), 4000);
          return doc.exists ? doc.data() : DEFAULT_WORKING_HOURS;
        } catch (e) {
          console.warn("LashDB: Fallback local para expediente.", e);
          useFirebase = false;
          return getLocal(STORAGE_KEYS.WORKING_HOURS, DEFAULT_WORKING_HOURS);
        }
      } else {
        return getLocal(STORAGE_KEYS.WORKING_HOURS, DEFAULT_WORKING_HOURS);
      }
    },
    saveWorkingHours: async function(hours) {
      if (useFirebase) {
        try {
          await firestoreDb.collection("settings").doc("workingHours").set(hours);
        } catch (e) {
          console.warn("LashDB: Fallback local para salvar expediente.", e);
          useFirebase = false;
          saveLocal(STORAGE_KEYS.WORKING_HOURS, hours);
        }
      } else {
        saveLocal(STORAGE_KEYS.WORKING_HOURS, hours);
      }
    },

    // Bloqueios
    getBlockedDates: async function() {
      if (useFirebase) {
        try {
          const snapshot = await withTimeout(firestoreDb.collection("blocked_dates").get(), 4000);
          const list = [];
          snapshot.forEach(doc => list.push(doc.data()));
          return list;
        } catch (e) {
          console.warn("LashDB: Fallback local para bloqueios.", e);
          useFirebase = false;
          return getLocal(STORAGE_KEYS.BLOCKED_DATES, []);
        }
      } else {
        return getLocal(STORAGE_KEYS.BLOCKED_DATES, []);
      }
    },
    addBlockedDate: async function(blockedItem) {
      blockedItem.id = "block_" + Date.now();
      if (useFirebase) {
        try {
          await firestoreDb.collection("blocked_dates").doc(blockedItem.id).set(blockedItem);
        } catch (e) {
          console.warn("LashDB: Fallback local para adicionar bloqueio.", e);
          useFirebase = false;
          const list = getLocal(STORAGE_KEYS.BLOCKED_DATES, []);
          list.push(blockedItem);
          saveLocal(STORAGE_KEYS.BLOCKED_DATES, list);
        }
      } else {
        const list = getLocal(STORAGE_KEYS.BLOCKED_DATES, []);
        list.push(blockedItem);
        saveLocal(STORAGE_KEYS.BLOCKED_DATES, list);
      }
      return blockedItem;
    },
    deleteBlockedDate: async function(id) {
      if (useFirebase) {
        try {
          await firestoreDb.collection("blocked_dates").doc(id).delete();
          return true;
        } catch (e) {
          console.warn("LashDB: Fallback local para excluir bloqueio.", e);
          useFirebase = false;
          const list = getLocal(STORAGE_KEYS.BLOCKED_DATES, []);
          const filtered = list.filter(b => b.id !== id);
          saveLocal(STORAGE_KEYS.BLOCKED_DATES, filtered);
          return true;
        }
      } else {
        const list = getLocal(STORAGE_KEYS.BLOCKED_DATES, []);
        const filtered = list.filter(b => b.id !== id);
        saveLocal(STORAGE_KEYS.BLOCKED_DATES, filtered);
        return true;
      }
    },

    // Agendamentos
    getBookings: async function() {
      if (useFirebase) {
        try {
          const snapshot = await withTimeout(firestoreDb.collection("bookings").get(), 4000);
          const list = [];
          snapshot.forEach(doc => list.push(doc.data()));
          return list.sort((a,b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
        } catch (e) {
          console.warn("LashDB: Fallback local para obter agendamentos.", e);
          useFirebase = false;
          return getLocal(STORAGE_KEYS.BOOKINGS, []).sort((a,b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
        }
      } else {
        return getLocal(STORAGE_KEYS.BOOKINGS, []).sort((a,b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
      }
    },
    addBooking: async function(booking) {
      booking.id = "b_" + Date.now();
      booking.status = "Pendente";
      booking.timestamp = new Date().toISOString();
      booking.preenchido_em = new Date().toLocaleString("pt-BR");

      if (useFirebase) {
        try {
          await firestoreDb.collection("bookings").doc(booking.id).set(booking);
        } catch (e) {
          console.warn("LashDB: Fallback local para adicionar agendamento.", e);
          useFirebase = false;
          const list = getLocal(STORAGE_KEYS.BOOKINGS, []);
          list.push(booking);
          saveLocal(STORAGE_KEYS.BOOKINGS, list);
        }
      } else {
        const list = getLocal(STORAGE_KEYS.BOOKINGS, []);
        list.push(booking);
        saveLocal(STORAGE_KEYS.BOOKINGS, list);
      }
      return booking;
    },
    updateBookingStatus: async function(id, status) {
      if (useFirebase) {
        try {
          await firestoreDb.collection("bookings").doc(id).update({ status: status });
          return true;
        } catch (e) {
          console.warn("LashDB: Fallback local para atualizar agendamento.", e);
          useFirebase = false;
          const list = getLocal(STORAGE_KEYS.BOOKINGS, []);
          const idx = list.findIndex(b => b.id === id);
          if (idx !== -1) {
            list[idx].status = status;
            saveLocal(STORAGE_KEYS.BOOKINGS, list);
            return true;
          }
          return false;
        }
      } else {
        const list = getLocal(STORAGE_KEYS.BOOKINGS, []);
        const idx = list.findIndex(b => b.id === id);
        if (idx !== -1) {
          list[idx].status = status;
          saveLocal(STORAGE_KEYS.BOOKINGS, list);
          return true;
        }
        return false;
      }
    },
    deleteBooking: async function(id) {
      if (useFirebase) {
        try {
          await firestoreDb.collection("bookings").doc(id).delete();
          return true;
        } catch (e) {
          console.warn("LashDB: Fallback local para deletar agendamento.", e);
          useFirebase = false;
          const list = getLocal(STORAGE_KEYS.BOOKINGS, []);
          const filtered = list.filter(b => b.id !== id);
          saveLocal(STORAGE_KEYS.BOOKINGS, filtered);
          return true;
        }
      } else {
        const list = getLocal(STORAGE_KEYS.BOOKINGS, []);
        const filtered = list.filter(b => b.id !== id);
        saveLocal(STORAGE_KEYS.BOOKINGS, filtered);
        return true;
      }
    },

    updateBooking: async function(booking) {
      if (useFirebase) {
        try {
          await firestoreDb.collection("bookings").doc(booking.id).set(booking);
          return true;
        } catch (e) {
          console.warn("LashDB: Fallback local para atualizar agendamento completo.", e);
          useFirebase = false;
          const list = getLocal(STORAGE_KEYS.BOOKINGS, []);
          const idx = list.findIndex(b => b.id === booking.id);
          if (idx !== -1) {
            list[idx] = booking;
            saveLocal(STORAGE_KEYS.BOOKINGS, list);
            return true;
          }
          return false;
        }
      } else {
        const list = getLocal(STORAGE_KEYS.BOOKINGS, []);
        const idx = list.findIndex(b => b.id === booking.id);
        if (idx !== -1) {
          list[idx] = booking;
          saveLocal(STORAGE_KEYS.BOOKINGS, list);
          return true;
        }
        return false;
      }
    },

    // --- ESTOQUE (PRODUTOS) ---
    getProducts: async function() {
      if (useFirebase) {
        try {
          const snapshot = await withTimeout(firestoreDb.collection("products").get(), 4000);
          const list = [];
          snapshot.forEach(doc => list.push(doc.data()));
          return list;
        } catch (e) {
          console.warn("LashDB: Fallback local para produtos.", e);
          return getLocal(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
        }
      } else {
        return getLocal(STORAGE_KEYS.PRODUCTS, DEFAULT_PRODUCTS);
      }
    },
    saveProducts: async function(products) {
      if (useFirebase) {
        try {
          const snapshot = await withTimeout(firestoreDb.collection("products").get(), 4000);
          const batch = firestoreDb.batch();
          snapshot.forEach(doc => batch.delete(doc.ref));
          products.forEach(p => batch.set(firestoreDb.collection("products").doc(p.id), p));
          await batch.commit();
        } catch (e) {
          console.warn("LashDB: Fallback local para salvar produtos.", e);
          saveLocal(STORAGE_KEYS.PRODUCTS, products);
        }
      } else {
        saveLocal(STORAGE_KEYS.PRODUCTS, products);
      }
    },

    // --- FINANCEIRO (FLUXO DE CAIXA) ---
    getTransactions: async function() {
      if (useFirebase) {
        try {
          const snapshot = await withTimeout(firestoreDb.collection("transactions").get(), 4000);
          const list = [];
          snapshot.forEach(doc => list.push(doc.data()));
          return list.sort((a,b) => String(b.timestamp).localeCompare(String(a.timestamp)));
        } catch (e) {
          console.warn("LashDB: Fallback local para transações.", e);
          return getLocal(STORAGE_KEYS.TRANSACTIONS, []);
        }
      } else {
        return getLocal(STORAGE_KEYS.TRANSACTIONS, []);
      }
    },
    addTransaction: async function(t) {
      t.id = "t_" + Date.now();
      t.timestamp = new Date().toISOString();
      t.date = t.date || new Date().toISOString().split("T")[0];
      
      if (useFirebase) {
        try {
          await firestoreDb.collection("transactions").doc(t.id).set(t);
        } catch (e) {
          console.warn("LashDB: Fallback local para salvar transação.", e);
          const list = getLocal(STORAGE_KEYS.TRANSACTIONS, []);
          list.push(t);
          saveLocal(STORAGE_KEYS.TRANSACTIONS, list);
        }
      } else {
        const list = getLocal(STORAGE_KEYS.TRANSACTIONS, []);
        list.push(t);
        saveLocal(STORAGE_KEYS.TRANSACTIONS, list);
      }
      return t;
    },

    // --- HISTÓRICO DE FECHAMENTO DE CAIXA ---
    getClosings: async function() {
      if (useFirebase) {
        try {
          const snapshot = await withTimeout(firestoreDb.collection("closings").get(), 4000);
          const list = [];
          snapshot.forEach(doc => list.push(doc.data()));
          return list.sort((a,b) => String(b.timestamp).localeCompare(String(a.timestamp)));
        } catch (e) {
          console.warn("LashDB: Fallback local para fechamentos.", e);
          return getLocal(STORAGE_KEYS.CLOSINGS, []);
        }
      } else {
        return getLocal(STORAGE_KEYS.CLOSINGS, []);
      }
    },
    addClosing: async function(c) {
      c.id = "c_" + Date.now();
      c.timestamp = new Date().toISOString();
      
      if (useFirebase) {
        try {
          await firestoreDb.collection("closings").doc(c.id).set(c);
        } catch (e) {
          console.warn("LashDB: Fallback local para salvar fechamento.", e);
          const list = getLocal(STORAGE_KEYS.CLOSINGS, []);
          list.push(c);
          saveLocal(STORAGE_KEYS.CLOSINGS, list);
        }
      } else {
        const list = getLocal(STORAGE_KEYS.CLOSINGS, []);
        list.push(c);
        saveLocal(STORAGE_KEYS.CLOSINGS, list);
      }
      return c;
    }
  };

  // Inicializa o banco de dados
  window.LashDB.init();
})();
