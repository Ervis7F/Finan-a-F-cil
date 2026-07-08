// ============================================================
// esqueci-senha.js — Lógica de recuperação de senha
// Finança Fácil | src/auth/esqueci-senha.js
// ============================================================

import { auth } from "../firebase/firebase-config.js";
import {
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ── Mapeamento de erros Firebase → Português ──────────────────
const ERROS_FIREBASE = {
  "auth/invalid-email":          "Formato de e-mail inválido.",
  "auth/user-not-found":         "Nenhuma conta encontrada com este e-mail.",
  "auth/too-many-requests":      "Muitas tentativas. Aguarde alguns minutos.",
  "auth/network-request-failed": "Sem conexão com a internet. Tente novamente.",
};

function traduzirErro(code) {
  return ERROS_FIREBASE[code] || "Ocorreu um erro inesperado. Tente novamente.";
}

// ── Utilitários de UI ──────────────────────────────────────────
const $ = id => document.getElementById(id);

function setFieldError(fieldId, msg) {
  const input = $(fieldId);
  const err   = $(`${fieldId}Error`);
  if (msg) {
    input.classList.add("error");
    err.textContent = msg;
  } else {
    input.classList.remove("error");
    err.textContent = "";
  }
}

function showAlert(msg, type = "error") {
  const box = $("alertBox");
  $("alertMsg").textContent = msg;
  box.className = `alert show ${type}`;
}

function hideAlert() {
  $("alertBox").className = "alert";
}

function setLoading(isLoading) {
  const btn = $("btnEnviar");
  btn.disabled = isLoading;
  btn.classList.toggle("loading", isLoading);
}

// ── Lógica de recuperação ──────────────────────────────────────
$("esqueciForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  setFieldError("email", "");
  hideAlert();

  const email = $("email").value.trim();

  // Validação
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) {
    setFieldError("email", "Informe seu e-mail.");
    return;
  }
  if (!emailRegex.test(email)) {
    setFieldError("email", "Formato de e-mail inválido.");
    return;
  }

  setLoading(true);

  try {
    await sendPasswordResetEmail(auth, email);

    showAlert(
      `Link de recuperação enviado para ${email}. Verifique também sua caixa de spam.`,
      "success"
    );

    // Desabilita o formulário após sucesso
    $("email").disabled = true;
    $("btnEnviar").disabled = true;

  } catch (error) {
    console.error("Erro na recuperação de senha:", error);
    showAlert(traduzirErro(error.code));
    setLoading(false);
  }
});
