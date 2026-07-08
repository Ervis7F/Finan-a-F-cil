// ============================================================
// contas.js — Lógica de cadastro, listagem, fixas e adiantamento
// Finança Fácil | src/financas/contas/contas.js
// ============================================================

import { auth, db } from "../../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  collection, query, where, orderBy, getDocs, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);

let currentUser = null;
let unsubscribeContas = null;

// Meses
const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function initFiltros() {
  const d = new Date();
  const options = meses.map((m, i) => `<option value="${i+1}">${m}</option>`).join("");
  
  $("filterMes").innerHTML = options;
  $("contaMes").innerHTML = options;

  $("filterMes").value = d.getMonth() + 1;
  $("contaMes").value = d.getMonth() + 1;

  $("filterAno").value = d.getFullYear();
  $("contaAno").value = d.getFullYear();

  $("filterMes").addEventListener("change", loadContas);
  $("filterAno").addEventListener("change", loadContas);
}

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// Global para que os listeners de ações dentro dos botões gerados acessem
window.togglePagamento = async function(id, isVirtual, tipoItem, val, statusDesejado) {
  if (isVirtual) {
    // Virtual fixa => deve criar um doc real como PAGO
    await addDoc(collection(db, `users/${currentUser.uid}/contas`), {
      nome: tipoItem,
      valor: val,
      mes: Number($("filterMes").value),
      ano: Number($("filterAno").value),
      status: "pago",
      isFixa: true,
      adiantado: false, // se marca como pago normalmente sendo virtal
      dataCriacao: serverTimestamp()
    });
  } else {
    // Documento real
    await updateDoc(doc(db, `users/${currentUser.uid}/contas`, id), { status: statusDesejado, adiantado: false });
  }
}

window.deleteConta = async function(id, isVirtual) {
  if (isVirtual) {
    alert("Esta é uma conta fixa automática. Para não vê-la, desative-a no menu Contas Fixas.");
    return;
  }
  if (confirm("Tem certeza que deseja excluir esta conta?")) {
    await deleteDoc(doc(db, `users/${currentUser.uid}/contas`, id));
  }
}

window.adiantarConta = async function(id, name, valAtual, isVirtual) {
  const rawInput = prompt(`Valor a adiantar/pagar da conta "${name}":`, valAtual);
  if (rawInput === null) return;
  const valNum = Number(rawInput.replace(",", "."));
  if (isNaN(valNum) || valNum <= 0) {
    alert("Valor inválido."); return;
  }

  if (isVirtual) {
    await addDoc(collection(db, `users/${currentUser.uid}/contas`), {
      nome: name,
      valor: valNum,
      mes: Number($("filterMes").value),
      ano: Number($("filterAno").value),
      status: "pago",
      isFixa: true,
      adiantado: true,
      dataAdiantamento: serverTimestamp(),
      dataCriacao: serverTimestamp()
    });
  } else {
    await updateDoc(doc(db, `users/${currentUser.uid}/contas`, id), {
      valor: valNum,
      status: "pago",
      adiantado: true,
      dataAdiantamento: serverTimestamp()
    });
  }
}

async function fetchFixas() {
  const qObj = await getDocs(query(collection(db, `users/${currentUser.uid}/contasFixas`), where("ativo", "==", true)));
  const list = [];
  qObj.forEach(docSnap => list.push({ ...docSnap.data(), id: docSnap.id }));
  return list;
}

async function loadContas() {
  if (!currentUser) return;
  if (unsubscribeContas) unsubscribeContas();

  const mesInfo = Number($("filterMes").value);
  const anoInfo = Number($("filterAno").value);
  $("lblMesAtual").textContent = `(${meses[mesInfo-1]} ${anoInfo})`;

  const fixasAtivas = await fetchFixas();

  const q = query(
    collection(db, `users/${currentUser.uid}/contas`),
    where("mes", "==", mesInfo),
    where("ano", "==", anoInfo),
    orderBy("dataCriacao", "desc")
  );

  unsubscribeContas = onSnapshot(q, (snapshot) => {
    let totalPendente = 0;
    const lista = $("listaContas");
    lista.innerHTML = "";

    const bdContas = [];
    const nomesBD = {}; // Set lookup para evitar fixas duplicadas
    
    snapshot.forEach(docSnap => {
      const cData = docSnap.data();
      bdContas.push({ id: docSnap.id, ...cData });
      if (cData.isFixa || fixasAtivas.find(fx => fx.tipo === cData.nome)) {
        nomesBD[cData.nome] = true;
      }
    });

    // Merge Fixas Virtuais
    const unified = [...bdContas];
    fixasAtivas.forEach(fx => {
      if (!nomesBD[fx.tipo]) {
        // Conta fixa não existe nesse mês no BD real, vamos criá-la virtualmente
        unified.push({
          id: `virtual_${fx.id}`,
          nome: fx.tipo,
          valor: fx.valor,
          status: "pendente",
          isFixa: true,
          isVirtual: true
        });
      }
    });

    if (unified.length === 0) {
      lista.innerHTML = `<div class="empty-state">Nenhuma conta cadastrada neste mês.</div>`;
    } else {
      unified.forEach(conta => {
        if (conta.status === "pendente") totalPendente += conta.valor;

        const isPago = conta.status === "pago";
        const isAdiantado = !!conta.adiantado;
        const isVirtual = !!conta.isVirtual;
        const fixaBorder = conta.isFixa ? "fixa-highlight" : "";
        const idQuoted = `'${conta.id}'`;
        const valQuoted = conta.valor;

        let badgeClass = isPago ? "pago" : "pendente";
        let badgeDisplay = conta.status;
        if (isAdiantado) {
          badgeClass = "adiantado";
          badgeDisplay = "ADIANTADO";
        }

        const toggleText = isPago ? "Desmarcar Pago" : "✔ Pagar";
        const toggleAction = isPago ? "pendente" : "pago";

        // btn actions logic HTML injecting functions globally
        const btnToggleHtml = `<button class="btn-action" onclick="togglePagamento(${idQuoted}, ${isVirtual}, '${conta.nome}', ${valQuoted}, '${toggleAction}')">${toggleText}</button>`;
        const btnAdiantarHtml = !isPago ? `<button class="btn-action" style="color:var(--blue-500); border-color:var(--blue-200);" onclick="adiantarConta(${idQuoted}, '${conta.nome}', ${valQuoted}, ${isVirtual})">Adiantar</button>` : "";
        const btnExcluirHtml = `<button class="btn-action danger" onclick="deleteConta(${idQuoted}, ${isVirtual})">Excluir</button>`;

        const item = document.createElement("div");
        item.className = `list-item ${fixaBorder}`;
        item.innerHTML = `
          <div class="list-item-left">
            <span class="list-item-title">${conta.nome} ${conta.isFixa ? '<span class="badge fixa">Fixa</span>' : ''}</span>
            <div class="item-actions">
              ${btnToggleHtml}
              ${btnAdiantarHtml}
              ${btnExcluirHtml}
            </div>
          </div>
          <div class="list-item-right">
            <span class="list-item-value">${formatBRL(conta.valor)}</span>
            <span class="badge ${badgeClass}">${badgeDisplay}</span>
          </div>
        `;
        lista.appendChild(item);
      });
    }
    
    $("totalPendente").textContent = formatBRL(totalPendente);
  });
}

$("formConta").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("btnSalvar").disabled = true;

  const nome = $("contaNome").value.trim();
  const valor = Number($("contaValor").value);
  const mes = Number($("contaMes").value);
  const ano = Number($("contaAno").value);

  try {
    await addDoc(collection(db, `users/${currentUser.uid}/contas`), {
      nome, valor, mes, ano, status: "pendente", adiantado: false, dataCriacao: serverTimestamp()
    });
    
    $("contaNome").value = "";
    $("contaValor").value = "";
    
    $("filterMes").value = mes;
    $("filterAno").value = ano;
    loadContas();
  } catch (error) {
    console.error("Erro ao salvar conta", error);
    alert("Erro ao salvar a conta.");
  }

  $("btnSalvar").disabled = false;
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("../../auth/login.html");
    return;
  }
  currentUser = user;
  initFiltros();
  loadContas();
});
