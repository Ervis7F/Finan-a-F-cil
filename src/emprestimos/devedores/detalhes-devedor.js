// ============================================================
// detalhes-devedor.js — Parcelas, pagamento, atraso e WhatsApp
// Finança Fácil | src/emprestimos/devedores/detalhes-devedor.js
// ============================================================

import { auth, db } from "../../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, query, orderBy, getDocs, getDoc, doc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { injectContextHelp } from "../../onboarding/onboarding.js";

const $ = id => document.getElementById(id);
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

let currentUser = null;
let devedorId = null;
let devedorData = null;
let bancoData = null;
let parcelasSnap = [];

function formatBRL(v) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

// ── Carregar dados do devedor ───────────────────────────────
async function loadDevedor() {
  const ref = doc(db, `users/${currentUser.uid}/devedores`, devedorId);
  const snap = await getDoc(ref);
  if (!snap.exists()) { alert("Devedor não encontrado."); return; }
  devedorData = snap.data();

  $("pageTitle").textContent = `📋 ${devedorData.nome}`;
  $("infoEmprestado").textContent = formatBRL(devedorData.valorEmprestado);
  $("infoTotal").textContent = formatBRL(devedorData.valorTotal);
  $("infoJuros").textContent = `${devedorData.jurosMensais}% a.m`;
  $("infoBanco").textContent = `${devedorData.nomeBanco} — ${devedorData.nomeCartao}`;

  if (devedorData.whatsapp) {
    $("infoWhatsapp").style.display = "block";
    const san = devedorData.whatsapp.replace(/\D/g, "");
    $("linkWhatsapp").href = `https://wa.me/55${san}`;
    $("linkWhatsapp").textContent = `📱 ${devedorData.whatsapp}`;
  }

  // Carregar banco para pegar chavePix
  try {
    const bRef = doc(db, `users/${currentUser.uid}/bancos`, devedorData.bancoId);
    const bSnap = await getDoc(bRef);
    if (bSnap.exists()) bancoData = bSnap.data();
  } catch(e) { /* banco pode ter sido excluído */ }

  await loadParcelas();
}

// ── Carregar parcelas ───────────────────────────────────────
async function loadParcelas() {
  const q = query(
    collection(db, `users/${currentUser.uid}/devedores/${devedorId}/parcelas`),
    orderBy("numeroParcela", "asc")
  );
  const snap = await getDocs(q);
  parcelasSnap = [];
  snap.forEach(d => parcelasSnap.push({ id: d.id, ...d.data() }));

  renderProgress();
  renderParcelas();
}

// ── Renderizar progresso ────────────────────────────────────
function renderProgress() {
  let pagas = 0, pendentes = 0, atrasadas = 0;
  parcelasSnap.forEach(p => {
    if (p.status === "pago") pagas++;
    else if (p.status === "atrasado") atrasadas++;
    else pendentes++;
  });
  const total = parcelasSnap.length;
  const pct = total > 0 ? Math.round((pagas / total) * 100) : 0;

  $("progressBar").style.width = pct + "%";
  $("progressChips").innerHTML = `
    <span class="progress-chip chip-pagas">✔ ${pagas} paga(s)</span>
    <span class="progress-chip chip-pend">⏳ ${pendentes} pendente(s)</span>
    <span class="progress-chip chip-atras">⚠ ${atrasadas} atrasada(s)</span>
    <span style="font-size:.8rem; font-weight:700; color:var(--gray-600);">${pct}% quitado</span>
  `;
}

// ── Renderizar cards de parcelas ────────────────────────────
function renderParcelas() {
  const container = $("parcelasContainer");
  container.innerHTML = "";

  if (parcelasSnap.length === 0) {
    container.innerHTML = `<div class="empty-state">Nenhuma parcela encontrada.</div>`;
    return;
  }

  const canWhatsApp = devedorData.whatsapp && bancoData && bancoData.chavePix;
  const pendentesRestantes = parcelasSnap.filter(p => p.status !== "pago").length;

  parcelasSnap.forEach(p => {
    let badgeClass = "chip-pend", badgeTxt = "PENDENTE";
    if (p.status === "pago") { badgeClass = "chip-pagas"; badgeTxt = "PAGO"; }
    if (p.status === "atrasado") { badgeClass = "chip-atras"; badgeTxt = "ATRASADO"; }

    let jurosInfoHtml = "";
    if (p.atrasoDias > 0 && p.valorJurosCalculado > 0) {
      jurosInfoHtml = `<div class="parc-juros-info">⚠️ Atraso de ${p.atrasoDias} dia(s) — Juros ${p.jurosAtrasoTipo}: ${formatBRL(p.valorJurosCalculado)} — <strong>Valor atualizado com juros: ${formatBRL(p.valorAtualizado)}</strong></div>`;
    }

    let actionsHtml = "";
    if (p.status !== "pago") {
      actionsHtml += `<button class="btn-action" style="color:var(--green-600)" onclick="marcarPago('${p.id}')">✔ Marcar como Pago</button>`;
      actionsHtml += `<button class="btn-action" style="color:var(--red-500)" onclick="abrirModalAtraso('${p.id}', ${p.valorOriginal})">⚠ Registrar Atraso</button>`;
      if (canWhatsApp) {
        actionsHtml += `<button class="btn-action" style="color:#16a34a;" onclick="cobrarWhatsApp('${p.id}', ${p.numeroParcela}, ${p.totalParcelas}, ${p.mes}, ${p.ano}, ${p.valorAtualizado}, ${pendentesRestantes})">📱 Cobrar no WhatsApp</button>`;
      }
    }

    const card = document.createElement("div");
    card.className = "parcela-card";
    card.id = `parc-${p.id}`;
    card.innerHTML = `
      <div class="parc-header">
        <div>
          <div class="parc-title">Parcela ${p.numeroParcela}/${p.totalParcelas}</div>
          <div class="parc-periodo">${MESES[p.mes - 1]} / ${p.ano}${p.diaVencimento ? ' — Venc. dia ' + p.diaVencimento : ''}</div>
        </div>
        <span class="progress-chip ${badgeClass}">${badgeTxt}</span>
      </div>
      <div class="parc-vals">
        <div><div class="pv-lbl">Valor Original</div><div class="pv-val">${formatBRL(p.valorOriginal)}</div></div>
        <div><div class="pv-lbl">Valor Atualizado</div><div class="pv-val" style="color:${p.valorAtualizado > p.valorOriginal ? 'var(--red-500)' : 'var(--gray-900)'}">${formatBRL(p.valorAtualizado)}</div></div>
      </div>
      ${jurosInfoHtml}
      <div class="parc-actions">${actionsHtml}</div>
    `;
    container.appendChild(card);
  });
}

// ── Marcar parcela como paga ────────────────────────────────
window.marcarPago = async function(parcelaId) {
  if (!confirm("Confirmar pagamento desta parcela?")) return;
  const ref = doc(db, `users/${currentUser.uid}/devedores/${devedorId}/parcelas`, parcelaId);
  await updateDoc(ref, { status: "pago", dataPagamento: serverTimestamp() });

  // Checar se todas foram pagas => atualizar devedor para "quitado"
  await loadParcelas();
  const todasPagas = parcelasSnap.every(p => p.status === "pago");
  if (todasPagas) {
    await updateDoc(doc(db, `users/${currentUser.uid}/devedores`, devedorId), { status: "quitado" });
    alert("🎉 Todas as parcelas foram pagas! Devedor quitado.");
  }
}

// ── Modal de Atraso ─────────────────────────────────────────
let currentModalValorOriginal = 0;

window.abrirModalAtraso = function(parcelaId, valorOriginal) {
  $("modalParcelaId").value = parcelaId;
  currentModalValorOriginal = valorOriginal;
  $("modalAtraso").classList.add("open");
  calcPreviewAtraso();
}

$("btnCancelarAtraso").addEventListener("click", () => {
  $("modalAtraso").classList.remove("open");
});

function calcPreviewAtraso() {
  const dias = Number($("modalDias").value) || 0;
  const taxa = Number($("modalTaxa").value) || 0;
  const tipo = $("modalTipoJuros").value;
  const taxaDecimal = taxa / 100;
  let atualizado, jurosCalc;

  if (tipo === "composto") {
    atualizado = currentModalValorOriginal * Math.pow(1 + taxaDecimal, dias);
    jurosCalc = atualizado - currentModalValorOriginal;
  } else {
    jurosCalc = currentModalValorOriginal * taxaDecimal * dias;
    atualizado = currentModalValorOriginal + jurosCalc;
  }

  $("modalPreview").innerHTML = `
    Juros calculados: <strong>${formatBRL(jurosCalc)}</strong><br>
    Valor atualizado: <strong style="color:var(--red-500)">${formatBRL(atualizado)}</strong>
  `;
}

["modalDias", "modalTaxa", "modalTipoJuros"].forEach(id => {
  $(id).addEventListener("input", calcPreviewAtraso);
  $(id).addEventListener("change", calcPreviewAtraso);
});

$("btnConfirmarAtraso").addEventListener("click", async () => {
  const parcelaId = $("modalParcelaId").value;
  const dias = Number($("modalDias").value) || 0;
  const taxa = Number($("modalTaxa").value) || 0;
  const tipo = $("modalTipoJuros").value;
  const taxaDecimal = taxa / 100;

  let atualizado, jurosCalc;
  if (tipo === "composto") {
    atualizado = currentModalValorOriginal * Math.pow(1 + taxaDecimal, dias);
    jurosCalc = atualizado - currentModalValorOriginal;
  } else {
    jurosCalc = currentModalValorOriginal * taxaDecimal * dias;
    atualizado = currentModalValorOriginal + jurosCalc;
  }

  const ref = doc(db, `users/${currentUser.uid}/devedores/${devedorId}/parcelas`, parcelaId);
  await updateDoc(ref, {
    atrasoDias: dias,
    jurosAtrasoTaxaDiaria: taxa,
    jurosAtrasoTipo: tipo,
    valorJurosCalculado: +jurosCalc.toFixed(2),
    valorAtualizado: +atualizado.toFixed(2),
    status: "atrasado"
  });

  // Atualizar status do devedor para "atrasado"
  await updateDoc(doc(db, `users/${currentUser.uid}/devedores`, devedorId), { status: "atrasado" });

  $("modalAtraso").classList.remove("open");
  await loadParcelas();
});

// ── Cobrança WhatsApp ───────────────────────────────────────
window.cobrarWhatsApp = function(parcelaId, numParc, totalParc, mes, ano, valorAtualizado, faltam) {
  const nome = devedorData.nome;
  const chavePix = bancoData.chavePix;
  const nomeBanco = devedorData.nomeBanco;
  const nomeCartao = devedorData.nomeCartao;
  const mesTxt = MESES[mes - 1];

  const msg =
    `Olá, ${nome}. Tudo bem?\n\n` +
    `Segue a cobrança da parcela *${numParc}/${totalParc}*, referente a *${mesTxt}/${ano}*, no valor de *${formatBRL(valorAtualizado)}*.\n\n` +
    `*Chave Pix para pagamento:*\n` +
    `\`\`\`${chavePix}\`\`\`\n\n` +
    `*Banco/Cartão de referência:* ${nomeBanco} - ${nomeCartao}\n\n` +
    `Após o pagamento, me envie o comprovante.\n` +
    `Faltam *${faltam} parcela(s)* para finalizar.\n\n` +
    `Obrigado!`;

  let num = devedorData.whatsapp.replace(/\D/g, "");
  // Se não começa com código de país, assumir Brasil
  if (!num.startsWith("55") && num.length <= 11) num = "55" + num;

  const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  window.open(url, "_blank");
}

// ── Init ────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.replace("../../auth/login.html"); return; }
  currentUser = user;

  const params = new URLSearchParams(window.location.search);
  devedorId = params.get("id");
  if (!devedorId) { alert("ID do devedor não informado."); return; }

  loadDevedor();
  injectContextHelp("detalhes-devedor", "obContextHolder");
});
