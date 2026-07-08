// ============================================================
// relatorios.js — Relatórios consolidados de empréstimos
// Finança Fácil | src/emprestimos/relatorios/relatorios.js
// ============================================================

import { auth, db } from "../../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, query, orderBy, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);
const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

let currentUser = null;

function formatBRL(v) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

async function loadRelatorios() {
  // ── 1. Carregar devedores ─────────────────────────────────
  const devSnap = await getDocs(query(
    collection(db, `users/${currentUser.uid}/devedores`),
    orderBy("dataCriacao", "desc")
  ));

  let totalEmprestado = 0;
  let totalReceber = 0;
  let totalRecebido = 0;
  let devedoresAtivos = 0;
  let parcelasAtrasadas = 0;
  let maiorDevedor = { nome: "—", valor: 0 };
  const devedoresList = [];
  // mês->valor para volume previsto
  const volumePorMes = {};

  for (const ds of devSnap.docs) {
    const d = ds.data();
    totalEmprestado += d.valorEmprestado;
    totalReceber += d.valorTotal;
    if (d.status === "ativo" || d.status === "atrasado") devedoresAtivos++;
    if (d.valorEmprestado > maiorDevedor.valor) {
      maiorDevedor = { nome: d.nome, valor: d.valorEmprestado };
    }
    devedoresList.push({ nome: d.nome, valor: d.valorEmprestado, status: d.status });

    // Carregar parcelas de cada devedor
    const parSnap = await getDocs(collection(db, `users/${currentUser.uid}/devedores/${ds.id}/parcelas`));
    parSnap.forEach(ps => {
      const p = ps.data();
      if (p.status === "pago") totalRecebido += p.valorAtualizado;
      if (p.status === "atrasado") parcelasAtrasadas++;
      // Volume previsto por mês (apenas pendentes e atrasadas)
      if (p.status !== "pago") {
        const key = `${p.ano}-${String(p.mes).padStart(2, "0")}`;
        volumePorMes[key] = (volumePorMes[key] || 0) + p.valorAtualizado;
      }
    });
  }

  // ── 2. Carregar bancos para "maior limite usado" ──────────
  const bancosSnap = await getDocs(collection(db, `users/${currentUser.uid}/bancos`));
  let maiorCartao = { nome: "—", usado: 0 };
  bancosSnap.forEach(bs => {
    const b = bs.data();
    if (b.limiteUsado > maiorCartao.usado) {
      maiorCartao = { nome: `${b.nomeBanco} — ${b.nomeCartao}`, usado: b.limiteUsado };
    }
  });

  // ── 3. Mês com maior volume previsto ──────────────────────
  let mesMaior = { key: "—", valor: 0 };
  for (const [k, v] of Object.entries(volumePorMes)) {
    if (v > mesMaior.valor) mesMaior = { key: k, valor: v };
  }
  let mesMaiorLabel = "—";
  if (mesMaior.key !== "—") {
    const [a, m] = mesMaior.key.split("-");
    mesMaiorLabel = `${MESES[parseInt(m) - 1]} / ${a}`;
  }

  // ── 4. Renderizar ─────────────────────────────────────────
  $("rTotalEmprestado").textContent = formatBRL(totalEmprestado);
  $("rTotalReceber").textContent = formatBRL(totalReceber);
  $("rTotalRecebido").textContent = formatBRL(totalRecebido);
  $("rDevedoresAtivos").textContent = devedoresAtivos;
  $("rParcelasAtrasadas").textContent = parcelasAtrasadas;

  $("rMaiorDevedor").textContent = formatBRL(maiorDevedor.valor);
  $("rMaiorDevedorNome").textContent = maiorDevedor.nome;

  $("rMaiorCartao").textContent = formatBRL(maiorCartao.usado);
  $("rMaiorCartaoNome").textContent = maiorCartao.nome;

  $("rMesMaiorVolume").textContent = mesMaiorLabel;
  $("rMesMaiorVolumeSub").textContent = mesMaior.valor > 0 ? `Previsão: ${formatBRL(mesMaior.valor)}` : "Nenhuma parcela pendente";

  // ── 5. Ranking de devedores ───────────────────────────────
  devedoresList.sort((a, b) => b.valor - a.valor);
  const lista = $("rankingList");
  if (devedoresList.length === 0) {
    lista.innerHTML = `<li style="color:var(--gray-400)">Nenhum devedor cadastrado.</li>`;
  } else {
    lista.innerHTML = devedoresList.map((d, i) => {
      let badge = "";
      if (d.status === "quitado") badge = `<span style="font-size:.7rem; background:var(--green-50); color:var(--green-600); padding:.15rem .4rem; border-radius:6px; font-weight:700;">QUITADO</span>`;
      if (d.status === "atrasado") badge = `<span style="font-size:.7rem; background:var(--red-50); color:var(--red-500); padding:.15rem .4rem; border-radius:6px; font-weight:700;">ATRASADO</span>`;
      return `<li>
        <span class="top-name">${i + 1}. ${d.nome} ${badge}</span>
        <span class="top-val">${formatBRL(d.valor)}</span>
      </li>`;
    }).join("");
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.replace("../../auth/login.html"); return; }
  currentUser = user;
  loadRelatorios();
});
