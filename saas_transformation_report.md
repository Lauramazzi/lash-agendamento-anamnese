# Plano de Transformação para SaaS (Software as a Service)

Transformar o sistema atual de agendamento e anamnese em um SaaS (onde outras profissionais assinam e criam suas próprias páginas de agendamento) exige mudar a arquitetura de **Single-Tenant** (um cliente por sistema) para **Multi-Tenant** (múltiplos clientes compartilhando o mesmo banco de dados de forma isolada).

Abaixo estão os pilares de desenvolvimento e negócios necessários para essa transição:

---

## 1. Arquitetura Multi-Tenant (Isolamento de Dados)

Atualmente, o banco de dados armazena dados de forma global (ex: uma única coleção de agendamentos). No SaaS, cada profissional precisa ter seus dados estritamente separados.

### Mudança Estrutural no Banco de Dados (Firestore)
Devemos introduzir o conceito de `tenantId` (ID do Assinante). O banco de dados do Firestore passará a ser estruturado assim:
*   `/tenants/{tenantId}` (Dados gerais do estúdio, logo, contatos)
    *   `/tenants/{tenantId}/services/{serviceId}` (Catálogo de cílios daquela profissional)
    *   `/tenants/{tenantId}/bookings/{bookingId}` (Agendamentos dela)
    *   `/tenants/{tenantId}/settings/workingHours` (Expediente dela)
    *   `/tenants/{tenantId}/products/{productId}` (Estoque dela)

---

## 2. Rotas Dinâmicas (Links Personalizados)

Cada profissional precisa de um link exclusivo para enviar para suas clientes.
*   **Formato do Link:** `www.agendei.com/estudiosara` ou `www.agendei.com/lashroom`
*   **Como o Frontend funciona:** O sistema lê a última parte da URL (`estudiosara`), busca no banco de dados qual é o `tenantId` correspondente e carrega dinamicamente as fotos dos cílios, preços e horários daquela profissional específica.

---

## 3. Tela de Cadastro de Profissionais (Onboarding)

Precisamos criar uma área voltada para as profissionais (a página de vendas do SaaS).
*   **Landing Page de Vendas:** Apresenta os benefícios do sistema (anamnese digital, controle financeiro, agenda semanal).
*   **Fluxo de Registro:** Onde a nova profissional insere seu E-mail, Senha e Nome do Estúdio.
*   **Configuração Inicial Automática:** No momento em que ela cria a conta, o sistema cria seu `tenantId` na nuvem e popula automaticamente seu cadastro com dados padrões (os horários padrões e as 8 técnicas de cílios padrão que criamos), para que ela já possa usar o sistema no mesmo minuto.

---

## 4. Integração de Pagamentos (Pix e Assinatura Recorrente)

Para cobrar mensalidades de forma automatizada:
*   **Plataforma de Pagamento:** Integrar com gateways como **Asaas**, **Stripe** ou **Mercado Pago**.
*   **Fluxo de Assinatura:**
    *   A profissional se cadastra e ganha 7 dias grátis (Free Trial).
    *   Após o prazo, o painel exibe uma tela de bloqueio com um QR Code Pix ou campo de cartão para ativar a assinatura mensal (ex: R$ 49,90/mês).
    *   **Validação:** O site da cliente só carrega os horários se o status de pagamento da profissional no banco de dados constar como "Ativo".

---

## 5. WhatsApp com Disparos Automáticos (API de Envio)

Atualmente, o cliente clica para abrir o WhatsApp manualmente. Para um SaaS de alto valor, o envio deve ser **100% automático em segundo plano**:
*   **Integração:** Conectar uma API não-oficial de WhatsApp (como *Evolution API* ou *Z-API*) ou a API Oficial (*WhatsApp Cloud API*).
*   **Automações:**
    1.  **Confirmação Imediata:** Assim que o cliente agenda, a API envia uma mensagem silenciosa no celular dele confirmando data, hora e link da localização.
    2.  **Lembrete de Anamnese:** Se a cliente não preencheu, envia o link direto.
    3.  **Lembrete de Véspera:** Um lembrete automático 24 horas antes do atendimento para reduzir faltas (no-show).

---

## 6. Mudança de Tecnologia (Recomendado)

Embora seja possível fazer em JavaScript Puro (Vanilla), para manter a segurança do SaaS e facilitar o crescimento:
*   **Recomendação de Framework:** Migrar o frontend para **React (Next.js)** ou **Vue.js**.
*   **Backend:** Utilizar **Firebase Cloud Functions** ou um servidor próprio em **Node.js** para lidar com webhooks de pagamento (saber quando o Pix foi pago) e segurança lógica sem expor dados no navegador de terceiros.
