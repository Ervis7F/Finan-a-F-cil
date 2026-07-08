// ============================================================
// dashboard.js — Lógica do Dashboard Principal
// Finança Fácil | src/dashboard/dashboard.js
// ============================================================

import { auth, db } from "../firebase/firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Utilitários ────────────────────────────────────────────────
const $ = id => document.getElementById(id);

/** Formata valor em BRL */
function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

/** Retorna saudação baseada no horário local do dispositivo */
function getSaudacao(primeiroNome) {
  const hora = new Date().getHours();
  let saudacao;
  if      (hora >= 5  && hora < 12) saudacao = "Bom dia";
  else if (hora >= 12 && hora < 18) saudacao = "Boa tarde";
  else                               saudacao = "Boa noite";
  return `${saudacao}, ${primeiroNome}!`;
}

/** Formata a data por extenso em português */
function getDataExtenso() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
    year:    "numeric"
  });
}

/** Retorna o nome do mês + ano atual formatado (ex: "Julho 2026") */
function getMesAno() {
  return new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Retorna apenas o ano atual */
function getAno() {
  return new Date().getFullYear().toString();
}

// ── Oculta o loading overlay ───────────────────────────────────
function hideLoading() {
  const overlay = $("loadingOverlay");
  overlay.classList.add("hidden");
  setTimeout(() => overlay.remove(), 400);
}

// ── Preenche os dados do usuário na sidebar ────────────────────
function preencherUsuarioSidebar(user, nomeCompleto) {
  const primeiroNome = nomeCompleto
    ? nomeCompleto.split(" ")[0]
    : (user.displayName ? user.displayName.split(" ")[0] : "Usuário");

  // Saudação
  $("greetingText").textContent = getSaudacao(primeiroNome);
  $("greetingDate").textContent  = getDataExtenso();

  // Sidebar footer
  $("userName").textContent  = nomeCompleto || user.displayName || "Usuário";
  $("userEmail").textContent = user.email || "";
  $("userAvatar").textContent = (nomeCompleto || user.displayName || "U")[0].toUpperCase();
}

// ── Preenche os dados do mês (dados de exemplo) ────────────────
function preencherResumoMes() {
  /*
   * DADOS DE EXEMPLO — substituir por consultas reais ao Firestore:
   *
   * Contas a pagar:
   *   coleção: users/{uid}/contas
   *   filtro:  mes == mesAtual && ano == anoAtual
   *   soma:    campo "valor" de todos os documentos filtrados
   *
   * Renda:
   *   coleção: users/{uid}/renda
   *   filtro:  mes == mesAtual && ano == anoAtual
   *   soma:    campo "valor" de todos os documentos filtrados
   *
   * Saldo previsto: renda - contas
   */
  const dadosExemplo = {
    contas: 0,   // R$ 0,00 — nenhuma conta cadastrada ainda
    renda:  0,   // R$ 0,00 — nenhuma renda cadastrada ainda
  };
  const saldo = dadosExemplo.renda - dadosExemplo.contas;

  $("totalContas").textContent   = formatBRL(dadosExemplo.contas);
  $("totalRenda").textContent    = formatBRL(dadosExemplo.renda);
  $("saldoPrevisto").textContent = formatBRL(saldo);

  // Cor do saldo
  $("saldoPrevisto").className = saldo >= 0
    ? "summary-value positive"
    : "summary-value negative";

  // Badge do mês
  $("mesAtualBadge").textContent = getMesAno();
}

// ── Preenche a visão geral do ano (dados de exemplo) ───────────
function preencherVisaoAno() {
  /*
   * DADOS DE EXEMPLO — substituir por consultas reais ao Firestore:
   *
   * Visão do ano:
   *   coleção: users/{uid}/contas
   *   filtro:  ano == anoAtual
   *   agrupamento: por campo "mes"
   *   cálculo: somar campo "valor" por mês e encontrar mínimo/máximo
   */
  $("mesLeve").textContent    = "Nenhum dado";
  $("mesLeveValor").textContent = "Cadastre suas contas para ver";
  $("mesPesado").textContent  = "Nenhum dado";
  $("mesPesadoValor").textContent = "";

  $("anoBadge").textContent = getAno();
}

// ── Toggle sidebar (mobile) ────────────────────────────────────
function initSidebarMobile() {
  const sidebar  = $("sidebar");
  const overlay  = $("sidebarOverlay");
  const btnOpen  = $("btnMenuMobile");

  function openSidebar() {
    sidebar.classList.add("open");
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden", "true");
  }

  btnOpen.addEventListener("click", openSidebar);
  overlay.addEventListener("click", closeSidebar);

  // Fecha ao clicar em qualquer link da sidebar no mobile
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
}

// ── Botão Sair ─────────────────────────────────────────────────
async function initBtnSair() {
  $("btnSair").addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "../auth/login.html";
    } catch (error) {
      console.error("Erro ao sair:", error);
      alert("Erro ao sair. Tente novamente.");
    }
  });
}

// ── Guard de autenticação + carregamento do dashboard ──────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Usuário não autenticado → redireciona para login
    window.location.replace("../auth/login.html");
    return;
  }

  try {
    // Busca o nome no Firestore (coleção "users", documento com UID do usuário)
    let nomeCompleto = user.displayName || "";
    const userDocRef = doc(db, "users", user.uid);
    const userSnap   = await getDoc(userDocRef);

    if (userSnap.exists()) {
      nomeCompleto = userSnap.data().nome || nomeCompleto;
    }

    // Popula a UI
    preencherUsuarioSidebar(user, nomeCompleto);
    preencherResumoMes();
    preencherVisaoAno();

  } catch (error) {
    console.error("Erro ao carregar dados do usuário:", error);
    // Ainda exibe o dashboard com dados de fallback
    preencherUsuarioSidebar(user, user.displayName || "");
    preencherResumoMes();
    preencherVisaoAno();
  } finally {
    hideLoading();
  }
});

// ── Inicializações ─────────────────────────────────────────────
initSidebarMobile();
initBtnSair();

// Botão de ajuda (placeholder — futuramente abrirá tutorial de onboarding)
$("btnHelp").addEventListener("click", () => {
  // FUTURO: abrir modal/tour guiado (ex: Shepherd.js ou tutorial próprio em src/onboarding/)
  alert("Tutorial passo a passo em breve! 🚀");
});
