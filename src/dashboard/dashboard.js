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
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { renderDashboardChecklist, injectContextHelp } from "../onboarding/onboarding.js";

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

// ── Preenche os dados do mês reais ────────────────
async function preencherResumoMes(userUid) {
  const dataAtual = new Date();
  const mesAtual = dataAtual.getMonth() + 1;
  const anoAtual = dataAtual.getFullYear();

  let somaRenda = 0;
  let somaContas = 0;

  try {
    // 1. Buscar Renda do Mês
    const qRenda = query(
      collection(db, `users/${userUid}/rendas`),
      where("mes", "==", mesAtual),
      where("ano", "==", anoAtual)
    );
    const snapRenda = await getDocs(qRenda);
    snapRenda.forEach(d => somaRenda += (Number(d.data().valor) || 0));

    // 2. Buscar Contas Avulsas (ou Fixas já mapeadas)
    const qContas = query(
      collection(db, `users/${userUid}/contas`),
      where("mes", "==", mesAtual),
      where("ano", "==", anoAtual)
    );
    const snapContas = await getDocs(qContas);
    const nomesJaDeduplicados = {};
    snapContas.forEach(d => {
       const dt = d.data();
       somaContas += (Number(dt.valor) || 0);
       if (dt.nome) nomesJaDeduplicados[dt.nome] = true;
    });

    // 3. Somar Contas Fixas Globais Ativas que ainda não foram convertidas no mês atual
    const qFixas = query(
      collection(db, `users/${userUid}/contasFixas`),
      where("ativo", "==", true)
    );
    const snapFixas = await getDocs(qFixas);
    snapFixas.forEach(d => {
       const fx = d.data();
       const nomeF = fx.nome || fx.tipo;
       if (nomeF && !nomesJaDeduplicados[nomeF]) {
         somaContas += (Number(fx.valor) || 0);
       }
    });

  } catch (error) {
    console.error("Erro ao buscar resumo do mês: ", error);
  }

  const saldo = somaRenda - somaContas;

  $("totalContas").textContent   = formatBRL(somaContas);
  $("totalRenda").textContent    = formatBRL(somaRenda);
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
    // Busca o documento completo do usuário
    const userDoc = await getDoc(doc(db, "users", user.uid));
    let nomeCompleto = "";
    if (userDoc.exists()) {
      nomeCompleto = userDoc.data().nomeCompleto || "";
    }

    preencherUsuarioSidebar(user, nomeCompleto);
    await preencherResumoMes(user.uid);
    preencherVisaoAno();

    // Injeta onboarding e contexto
    await renderDashboardChecklist(user.uid, $("onboardingContainer"));
    injectContextHelp("dashboard", "greetingSectionContainer");

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
