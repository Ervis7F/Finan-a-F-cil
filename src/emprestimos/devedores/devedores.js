// ============================================================
// devedores.js — Cadastro de devedores + geração automática de parcelas
// Finança Fácil | src/emprestimos/devedores/devedores.js
// ============================================================

import { auth, db } from "../../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  collection, query, orderBy, onSnapshot, getDocs, where,
  addDoc, serverTimestamp, doc, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { injectContextHelp } from "../../onboarding/onboarding.js";

const $ = id => document.getElementById(id);

let currentUser = null;
let unsubscribeDevedores = null;
const BANCOS_CACHE = {};

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function calcularTotalProjetado() {
  const v = Number($("devValorEmprestado").value) || 0;
  const j = Number($("devJuros").value) || 0;
  const p = Number($("devParcelas").value) || 1;
  if (v > 0) {
    const tot = v * (1 + (j / 100) * p);
    $("prevTotal").textContent = "Total a receber: " + formatBRL(tot);
    $("prevCalculo").style.display = "block";
  } else {
    $("prevCalculo").style.display = "none";
  }
}

["devValorEmprestado", "devJuros", "devParcelas"].forEach(id => {
  $(id).addEventListener("input", calcularTotalProjetado);
});

async function populateBancosSelect() {
  const sel = $("devBancoSelect");
  const q = query(collection(db, `users/${currentUser.uid}/bancos`), where("ativo", "==", true));
  const snap = await getDocs(q);
  if (snap.empty) {
    sel.innerHTML = `<option value="" disabled selected>Nenhum banco ativo. Cadastre um!</option>`;
    return;
  }
  sel.innerHTML = `<option value="" disabled selected>Selecione um Cartão/Banco...</option>`;
  snap.forEach(ds => {
    const b = ds.data();
    BANCOS_CACHE[ds.id] = { nomeBanco: b.nomeBanco, nomeCartao: b.nomeCartao, chavePix: b.chavePix || "" };
    sel.innerHTML += `<option value="${ds.id}">${b.nomeBanco} - ${b.nomeCartao} (${formatBRL(b.limiteTotal)})</option>`;
  });
}

// ── Geração automática de parcelas ──────────────────────────
async function gerarParcelas(devedorId, totalParcelas, valorTotal, diaVencimento) {
  const now = new Date();
  let curMes = now.getMonth() + 1; // 1-12
  let curAno = now.getFullYear();
  const valorParcela = +(valorTotal / totalParcelas).toFixed(2);

  const promises = [];
  for (let i = 1; i <= totalParcelas; i++) {
    promises.push(addDoc(
      collection(db, `users/${currentUser.uid}/devedores/${devedorId}/parcelas`),
      {
        numeroParcela: i,
        totalParcelas,
        mes: curMes,
        ano: curAno,
        valorOriginal: valorParcela,
        valorAtualizado: valorParcela,
        status: "pendente",
        dataVencimento: diaVencimento ? new Date(curAno, curMes - 1, diaVencimento) : null,
        diaVencimento: diaVencimento || null,
        dataPagamento: null,
        atrasoDias: 0,
        jurosAtrasoTipo: "simples",
        jurosAtrasoTaxaDiaria: 0,
        valorJurosCalculado: 0,
        observacao: null,
        dataCriacao: serverTimestamp()
      }
    ));
    curMes++;
    if (curMes > 12) { curMes = 1; curAno++; }
  }
  await Promise.all(promises);
}

// ── Contagem rápida de parcelas pagas por devedor ───────────
async function countParcelasPagas(devedorId) {
  const snap = await getDocs(collection(db, `users/${currentUser.uid}/devedores/${devedorId}/parcelas`));
  let pagas = 0, total = 0;
  snap.forEach(d => { total++; if (d.data().status === "pago") pagas++; });
  return { pagas, total };
}

// ── Deletar devedor + subcoleção parcelas ───────────────────
window.deletarDevedor = async function(id) {
  if (!confirm("Excluir permanentemente este devedor e todas as suas parcelas?")) return;
  // Delete sub-collection parcelas first
  const parSnap = await getDocs(collection(db, `users/${currentUser.uid}/devedores/${id}/parcelas`));
  const delPromises = [];
  parSnap.forEach(d => delPromises.push(deleteDoc(d.ref)));
  await Promise.all(delPromises);
  await deleteDoc(doc(db, `users/${currentUser.uid}/devedores`, id));
}

// ── Listagem de devedores ───────────────────────────────────
function loadDevedores() {
  if (!currentUser) return;
  if (unsubscribeDevedores) unsubscribeDevedores();

  const q = query(collection(db, `users/${currentUser.uid}/devedores`), orderBy("dataCriacao", "desc"));

  unsubscribeDevedores = onSnapshot(q, async (snapshot) => {
    let totEmprestado = 0, totReceber = 0;
    const grid = $("devedoresGrid");
    grid.innerHTML = "";

    if (snapshot.empty) {
      grid.innerHTML = `<div class="empty-state">Nenhum devedor cadastrado.</div>`;
    } else {
      for (const docSnap of snapshot.docs) {
        const d = docSnap.data();
        const id = docSnap.id;

        if (d.status === "ativo" || d.status === "atrasado") {
          totEmprestado += d.valorEmprestado;
          totReceber += d.valorTotal;
        }

        // Contagem de parcelas
        const { pagas, total } = await countParcelasPagas(id);
        const pct = total > 0 ? Math.round((pagas / total) * 100) : 0;

        let bgClass = "ativo", txtClass = "ATIVO";
        if (d.status === "quitado") { bgClass = "quitado"; txtClass = "QUITADO"; }
        if (d.status === "atrasado") { bgClass = "atrasado"; txtClass = "ATRASADO"; }

        let wppHtml = "";
        if (d.whatsapp) {
          const san = d.whatsapp.replace(/\D/g, "");
          wppHtml = `<a href="https://wa.me/55${san}" target="_blank" class="dev-whatsapp">📱 ${d.whatsapp}</a>`;
        }

        const card = document.createElement("div");
        card.className = "devedor-card";
        card.innerHTML = `
          <div class="dev-header">
            <div>
              <div class="dev-name">${d.nome}</div>
              ${wppHtml}
            </div>
            <span class="dev-badge ${bgClass}">${txtClass}</span>
          </div>
          <div style="font-size:.85rem; color:var(--gray-600); margin:.5rem 0;">
            <div class="val-row">
              <span class="val-lbl">Valor Emprestado</span>
              <span class="val-num">${formatBRL(d.valorEmprestado)}</span>
            </div>
            <div class="val-row" style="border:none;">
              <span class="val-lbl" style="color:var(--blue-600); font-weight:600;">Total a Receber</span>
              <span class="val-num" style="color:var(--blue-600)">${formatBRL(d.valorTotal)}</span>
            </div>
            <div class="juros-row">${d.numeroParcelas} parcela(s) • ${d.jurosMensais}% juros a.m</div>
          </div>
          <div class="dev-bank-tag">💳 ${d.nomeBanco} — ${d.nomeCartao}</div>
          ${d.observacao ? `<div style="font-size:.7rem; color:var(--gray-400); margin-top:.4rem;">${d.observacao}</div>` : ''}
          <div style="display:flex; align-items:center; gap:.5rem; margin-top:.5rem;">
            <div class="dev-progress-bg" style="flex:1;">
              <div class="dev-progress-fill" style="width:${pct}%;"></div>
            </div>
            <span style="font-size:.7rem; font-weight:700; color:var(--gray-500);">${pagas}/${total} (${pct}%)</span>
          </div>
          <div class="b-actions" style="margin-top:.75rem;">
            <a href="detalhes-devedor.html?id=${id}" class="btn-action" style="color:var(--blue-600); text-decoration:none; text-align:center;">Abrir Detalhes</a>
            <button class="btn-action danger" onclick="deletarDevedor('${id}')">Excluir</button>
          </div>
        `;
        grid.appendChild(card);
      }
    }

    $("resumoEmprestado").textContent = formatBRL(totEmprestado);
    $("resumoReceber").textContent = formatBRL(totReceber);
  });
}

// ── Submit: cria devedor + parcelas ─────────────────────────
$("formDevedor").addEventListener("submit", async(e) => {
  e.preventDefault();
  const bId = $("devBancoSelect").value;
  if (!bId) { alert("Selecione um banco!"); return; }
  $("btnSalvar").disabled = true;

  const nome   = $("devNome").value.trim();
  const whats  = $("devWhats").value.trim();
  const valE   = Number($("devValorEmprestado").value);
  const juros  = Number($("devJuros").value) || 0;
  const parc   = Number($("devParcelas").value) || 1;
  const diaV   = $("devDiaVenc").value ? Number($("devDiaVenc").value) : null;
  const obs    = $("devObs").value.trim();

  const totalCalculado = valE * (1 + (juros / 100) * parc);
  const bMeta = BANCOS_CACHE[bId];

  try {
    const devRef = await addDoc(collection(db, `users/${currentUser.uid}/devedores`), {
      nome,
      whatsapp: whats || null,
      valorEmprestado: valE,
      valorTotal: totalCalculado,
      numeroParcelas: parc,
      jurosMensais: juros,
      diaVencimento: diaV,
      bancoId: bId,
      nomeBanco: bMeta.nomeBanco,
      nomeCartao: bMeta.nomeCartao,
      status: "ativo",
      observacao: obs,
      dataCriacao: serverTimestamp()
    });

    // Gerar parcelas automaticamente
    await gerarParcelas(devRef.id, parc, totalCalculado, diaV);

    $("formDevedor").reset();
    $("prevCalculo").style.display = "none";
  } catch (error) {
    console.error("Erro ao salvar", error);
    alert("Erro ao adicionar.");
  }
  $("btnSalvar").disabled = false;
});

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.replace("../../auth/login.html"); return; }
  currentUser = user;
  populateBancosSelect();
  loadDevedores();
  injectContextHelp("devedores", "obContextHolder");
});
