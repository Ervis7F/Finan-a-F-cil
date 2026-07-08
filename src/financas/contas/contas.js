// ============================================================
// contas.js — Lógica de cadastro, listagem, fixas e adiantamento
// Finança Fácil | src/financas/contas/contas.js
// ============================================================

import { auth, db } from "../../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  collection, query, where, orderBy, getDocs, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { injectContextHelp } from "../../onboarding/onboarding.js";

const $ = id => document.getElementById(id);

let currentUser = null;
let unsubscribeContas = null;

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

function generateGroupId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

window.togglePagamento = async function(id, isVirtual, tipoItem, val, statusDesejado) {
  if (isVirtual) {
    await addDoc(collection(db, `users/${currentUser.uid}/contas`), {
      nome: tipoItem, val,
      mes: Number($("filterMes").value), ano: Number($("filterAno").value),
      status: "pago", isFixa: true, adiantado: false, dataCriacao: serverTimestamp(),
      tipoLancamento: "simples", quantidadeParcelas: 1, numeroParcela: 1, grupoParcelamentoId: null
    });
  } else {
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
      nome: name, valor: valNum,
      mes: Number($("filterMes").value), ano: Number($("filterAno").value),
      status: "pago", isFixa: true, adiantado: true, dataAdiantamento: serverTimestamp(), dataCriacao: serverTimestamp(),
      tipoLancamento: "simples", quantidadeParcelas: 1, numeroParcela: 1, grupoParcelamentoId: null
    });
  } else {
    await updateDoc(doc(db, `users/${currentUser.uid}/contas`, id), {
      valor: valNum, status: "pago", adiantado: true, dataAdiantamento: serverTimestamp()
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
    const nomesBD = {}; 
    
    snapshot.forEach(docSnap => {
      const cData = docSnap.data();
      bdContas.push({ id: docSnap.id, ...cData });
      if (cData.isFixa || fixasAtivas.find(fx => (fx.nome || fx.tipo) === cData.nome)) {
        nomesBD[cData.nome] = true;
      }
    });

    const unified = [...bdContas];
    fixasAtivas.forEach(fx => {
      const fName = fx.nome || fx.tipo;
      if (!nomesBD[fName]) {
        unified.push({
          id: `virtual_${fx.id}`,
          nome: fName,
          valor: fx.valor,
          status: "pendente",
          isFixa: true,
          isVirtual: true,
          diaVencimento: fx.diaVencimento,
          emoji: fx.emoji
        });
      }
    });

    if (unified.length === 0) {
      lista.innerHTML = `<div class="empty-state">✨ Tudo limpo! Não há contas a pagar registradas para este mês.</div>`;
    } else {
      unified.forEach(conta => {
        if (conta.status === "pendente") totalPendente += conta.valor;

        const isPago = conta.status === "pago";
        const isAdiantado = !!conta.adiantado;
        const isVirtual = !!conta.isVirtual;
        const isParcelado = conta.tipoLancamento === "parcelado";
        const jaEraPagaAoCadastrar = !!conta.jaEraPagaAoCadastrar;

        const fixaBorder = conta.isFixa ? "fixa-highlight" : "";
        const idQuoted = `'${conta.id}'`;
        const valQuoted = conta.valor;

        let badgeClass = isPago ? "pago" : "pendente";
        let badgeDisplay = conta.status;
        if (isAdiantado) {
          badgeClass = "adiantado"; badgeDisplay = "ADIANTADO";
        }

        const toggleText = isPago ? "Desmarcar Pago" : "✔ Pagar";
        const toggleAction = isPago ? "pendente" : "pago";

        const btnToggleHtml = `<button class="btn-action" onclick="togglePagamento(${idQuoted}, ${isVirtual}, '${conta.nome}', ${valQuoted}, '${toggleAction}')">${toggleText}</button>`;
        const btnAdiantarHtml = !isPago ? `<button class="btn-action" style="color:var(--blue-500); border-color:var(--blue-200);" onclick="adiantarConta(${idQuoted}, '${conta.nome}', ${valQuoted}, ${isVirtual})">Adiantar</button>` : "";
        const btnExcluirHtml = `<button class="btn-action danger" onclick="deleteConta(${idQuoted}, ${isVirtual})">Excluir</button>`;

        // Construção de badges e infos
        let badgesHtml = "";
        if (conta.isFixa) badgesHtml += `<span class="badge fixa">Fixa</span>`;
        if (isParcelado) badgesHtml += `<span class="badge" style="background:#e0e7ff; color:#4338ca;">Parcela ${conta.numeroParcela}/${conta.quantidadeParcelas}</span>`;
        if (jaEraPagaAoCadastrar) badgesHtml += `<span class="badge" style="background:#f3f4f6; color:#9ca3af;">Já era paga</span>`;

        let extraInfosHtml = "";
        if (conta.emoji) extraInfosHtml += `<span style="font-size:1.1rem; margin-right:4px;">${conta.emoji}</span>`;
        if (conta.diaVencimento) extraInfosHtml += `<span style="font-size:.7rem; color:var(--gray-500); margin-left:6px; display:inline-block; border-left:1px solid var(--gray-300); padding-left:6px;">Venc: ${conta.diaVencimento}</span>`;
        if (conta.observacao) extraInfosHtml += `<div style="font-size:.7rem; color:var(--gray-400); margin-top:2px;">${conta.observacao}</div>`;

        const item = document.createElement("div");
        item.className = `list-item ${fixaBorder}`;
        item.innerHTML = `
          <div class="list-item-left">
            <span class="list-item-title">${extraInfosHtml.includes('emoji') ? conta.emoji + ' ' : ''}${conta.nome} ${badgesHtml} ${conta.diaVencimento ? '<span style="font-size:.7rem; color:var(--gray-500); margin-left:6px;">Venc: '+conta.diaVencimento+'</span>' : ''}</span>
            ${conta.observacao ? '<div style="font-size:.7rem; color:var(--gray-400); margin-top:2px;">' + conta.observacao + '</div>' : ''}
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
  const mesIni = Number($("contaMes").value);
  const anoIni = Number($("contaAno").value);
  const qtdParc = Number($("contaQtdParc").value);
  const pagas = Number($("contaPagas").value);
  const vencStr = $("contaVenc").value;
  const venc = vencStr ? Number(vencStr) : null;
  const observacao = $("contaObs").value.trim();

  if (qtdParc < 1) { alert("Quantidade de parcelas inválida."); $("btnSalvar").disabled = false; return; }
  if (pagas > qtdParc) { alert("As parcelas pagas não podem exceder o total preenchido."); $("btnSalvar").disabled = false; return; }
  if (venc !== null && (venc < 1 || venc > 31)) { alert("Dia de vencimento deve ser entre 1 e 31."); $("btnSalvar").disabled = false; return; }

  const tipoLancamento = qtdParc > 1 ? "parcelado" : "simples";
  const grupoId = qtdParc > 1 ? generateGroupId() : null;

  try {
    let curMes = mesIni, curAno = anoIni;
    const batchPromises = [];
    
    // Gerar documentos dinamicamente
    for (let c = 1; c <= qtdParc; c++) {
      const isAlreadyPaid = c <= pagas;
      
      batchPromises.push(addDoc(collection(db, `users/${currentUser.uid}/contas`), {
        nome, valor,
        mes: curMes,
        ano: curAno,
        status: isAlreadyPaid ? "pago" : "pendente",
        dataCriacao: serverTimestamp(),
        adiantado: false,
        dataAdiantamento: null,
        tipoLancamento,
        quantidadeParcelas: qtdParc,
        numeroParcela: c,
        grupoParcelamentoId: grupoId,
        jaEraPagaAoCadastrar: isAlreadyPaid,
        diaVencimento: venc,
        observacao
      }));

      // Avança data
      curMes++;
      if (curMes > 12) { curMes = 1; curAno++; }
    }

    await Promise.all(batchPromises);
    
    $("formConta").reset();
    
    // Volta o filter para a view inicial em que estava trabalhando
    $("filterMes").value = mesIni;
    $("filterAno").value = anoIni;
    loadContas();
  } catch (error) {
    console.error("Erro ao salvar", error);
    alert("Erro ao salvar.");
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
  injectContextHelp("contas", "obContextHolder");
  loadContas();
});
