// ============================================================
// metas.js — Lógica inteligente de criação e distribuição de Metas
// Finança Fácil | src/financas/metas/metas.js
// ============================================================

import { auth, db } from "../../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  collection, query, getDocs, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = id => document.getElementById(id);

let currentUser = null;
let unsubscribeMetas = null;

const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function initFiltros() {
  const d = new Date();
  const options = meses.map((m, i) => `<option value="${i+1}">${m}</option>`).join("");
  
  $("metaMesIni").innerHTML = options;
  $("metaMesFim").innerHTML = options;

  $("metaMesIni").value = d.getMonth() + 1;
  $("metaAnoIni").value = d.getFullYear();
  
  // Default final meta = current month + 6
  let fM = d.getMonth() + 7;
  let fA = d.getFullYear();
  if (fM > 12) { fM -= 12; fA++; }
  $("metaMesFim").value = fM;
  $("metaAnoFim").value = fA;
}

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// Global Actions window for inline buttons
window.toggleDetalhes = function(id) {
  const el = $(`detalhes_${id}`);
  if (el.classList.contains("open")) {
    el.classList.remove("open");
  } else {
    document.querySelectorAll(".meta-details.open").forEach(d => d.classList.remove("open"));
    el.classList.add("open");
  }
}

window.deleteMeta = async function(id) {
  if (confirm("Deseja realmente excluir esta meta e todo seu histórico de parcelas?")) {
    // Exclui a meta principal (subcoleções não são apagadas automaticamente,
    // mas na nossa UI não listaremos parcelas orfãs se a meta foi apagada).
    await deleteDoc(doc(db, `users/${currentUser.uid}/metas`, id));
  }
}

window.marcarGuardado = async function(metaId, parcelaId, valSugerido) {
  if (!confirm(`Deseja confirmar que guardou ${formatBRL(valSugerido)} neste mês para esta meta?`)) return;

  const mRef = doc(db, `users/${currentUser.uid}/metas`, metaId);
  const pRef = doc(db, `users/${currentUser.uid}/metas/${metaId}/metasParcelas`, parcelaId);

  // É necessário buscar o valor atual da meta para iterar (ou usar increment no backend, faremos client-side para manter simples)
  // Devido a complexidade, vamos só enviar updateDoc 
  // Na vida real a subcoleção é atualizada e poderíamos rodar uma Cloud Function, 
  // mas vamos fazer aqui incrementando (necessita import increment, vamos apenas refetch or atualizar)
  
  // Fetch actual doc to add valorGuardado
  import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js").then(async (fs) => {
    try {
      await updateDoc(pRef, { status: "guardado", valorGuardado: valSugerido });
      await updateDoc(mRef, { valorJaGuardado: fs.increment(valSugerido) });
    } catch(e) {
      console.error(e);
      alert("Erro ao marcar como guardado.");
    }
  });
}

async function loadMetas() {
  if (!currentUser) return;
  if (unsubscribeMetas) unsubscribeMetas();

  const q = query(collection(db, `users/${currentUser.uid}/metas`), orderBy("dataCriacao", "desc"));
  
  unsubscribeMetas = onSnapshot(q, async (snapshot) => {
    const grid = $("metasGrid");
    grid.innerHTML = "";

    if (snapshot.empty) {
      grid.innerHTML = `<div class="empty-state">Nenhuma meta ativa. Crie sua primeira meta acima!</div>`;
      return;
    }

    for (const docSnap of snapshot.docs) {
      const meta = docSnap.data();
      const id = docSnap.id;

      const pct = meta.valorObjetivo ? Math.min(100, (meta.valorJaGuardado / meta.valorObjetivo) * 100) : 0;
      const isConcluida = pct >= 100;
      
      const badgeCls = isConcluida ? "concluida" : "pendente";
      const badgeTxt = isConcluida ? "Concluída" : "Em andamento";

      // HTML Card
      const card = document.createElement("div");
      card.className = "meta-card";
      card.innerHTML = `
        <div class="meta-header">
          <div>
            <div class="meta-title">${meta.nome}</div>
            <div class="meta-period">${meses[meta.mesInicio-1]} ${meta.anoInicio} — ${meses[meta.mesFim-1]} ${meta.anoFim}</div>
          </div>
          <span class="meta-status-badge ${badgeCls}">${badgeTxt}</span>
        </div>
        
        <div class="progress-container">
          <div class="progress-stats">
            <span class="val-guardado">${formatBRL(meta.valorJaGuardado)}</span>
            <span class="val-objetivo">de ${formatBRL(meta.valorObjetivo)}</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${pct}%"></div>
          </div>
          <div class="progress-pct">${pct.toFixed(1)}% alcançado</div>
        </div>

        <div class="meta-actions">
          <button class="btn-action" onclick="toggleDetalhes('${id}')">Ver planejamento mensal</button>
          <button class="btn-action danger" onclick="deleteMeta('${id}')">Excluir</button>
        </div>

        <div class="meta-details" id="detalhes_${id}">
          <div style="text-align:center; padding:1rem; font-size:.8rem; color:#6b7280;">Carregando planejamento...</div>
        </div>
      `;
      grid.appendChild(card);

      // Async fetch das parcelas
      const qParc = query(collection(db, `users/${currentUser.uid}/metas/${id}/metasParcelas`), orderBy("ano"), orderBy("mes"));
      getDocs(qParc).then(pSnap => {
        const dEl = $(`detalhes_${id}`);
        dEl.innerHTML = "";
        
        let somaTarget = 0;

        pSnap.forEach(p => {
          const parc = p.data();
          const pId = p.id;
          somaTarget += parc.valorSugerido;

          let actHtml = "";
          if (parc.status === "guardado") {
            actHtml = `<div class="badge-guardado">✔ Guardado</div>`;
          } else if (parc.valorSugerido > 0) {
            actHtml = `<button class="btn-guardar" onclick="marcarGuardado('${id}', '${pId}', ${parc.valorSugerido})">Marcar que guardei</button>`;
          } else {
               actHtml = `<div class="badge-zerado">Mês s/ folga</div>`;
          }

          dEl.innerHTML += `
            <div class="parcela-item">
              <div class="parcela-mesano">${meses[parc.mes-1]} ${parc.ano}</div>
              <div class="parcela-valor">
                <strong>${formatBRL(parc.valorSugerido)}</strong>
                ${actHtml}
              </div>
            </div>
          `;
        });

        if (somaTarget < meta.valorObjetivo && !isConcluida) {
          const dif = meta.valorObjetivo - somaTarget;
          dEl.insertAdjacentHTML("afterbegin", `
            <div class="detalhes-alerta">
              <strong>Atenção:</strong> De acordo com sua renda e contas atuais, prevemos que faltarão <strong>${formatBRL(dif)}</strong> no fim do prazo. Tente estender a data final ou economizar mais nas despesas.
            </div>
          `);
        }
      });
    }
  });
}

// =============== LÓGICA DO ALGORITMO DE METAS =============== //
$("formMeta").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("btnSalvar").disabled = true;
  $("btnSalvar").textContent = "Analisando perfil financeiro...";

  const nome = $("metaNome").value.trim();
  const valorObj = Number($("metaValor").value);
  const mIni = Number($("metaMesIni").value);
  const aIni = Number($("metaAnoIni").value);
  const mFim = Number($("metaMesFim").value);
  const aFim = Number($("metaAnoFim").value);

  // Validar data
  if (aFim < aIni || (aFim === aIni && mFim < mIni)) {
    alert("O final da meta não pode ser antes do início.");
    $("btnSalvar").disabled = false; $("btnSalvar").textContent = "Criar Meta Inteligente"; return;
  }

  try {
    // 1. Fetch Rendas, Contas e Fixas para o algoritmo prever a "Folga" de cada mês.
    const [snapRendas, snapContas, snapFixas] = await Promise.all([
      getDocs(query(collection(db, `users/${currentUser.uid}/rendas`))),
      getDocs(query(collection(db, `users/${currentUser.uid}/contas`))),
      getDocs(query(collection(db, `users/${currentUser.uid}/contasFixas`), where("ativo", "==", true)))
    ]);

    // Calcular Renda média para meses futuros
    let somaRendaHist = 0, totRendaMeses = 0;
    const historicoRendas = {}; // format: "ano-mes": totalRenda
    snapRendas.forEach(d => {
      const r = d.data();
      const st = `${r.ano}-${r.mes}`;
      if (!historicoRendas[st]) { historicoRendas[st] = 0; totRendaMeses++; }
      historicoRendas[st] += (Number(r.valor) || 0);
      somaRendaHist += (Number(r.valor) || 0);
    });
    const mediaRendaFutura = totRendaMeses > 0 ? (somaRendaHist / totRendaMeses) : 0;

    // Calcular Fixas Base (que cairão todo mês independente se já existe doc 'contas')
    let baseFixas = 0;
    snapFixas.forEach(d => baseFixas += (Number(d.data().valor) || 0));

    // Mapear Contas Avulsas por "ano-mes"
    const gastosMes = {};
    snapContas.forEach(d => {
      const c = d.data();
      const st = `${c.ano}-${c.mes}`;
      if (!gastosMes[st]) gastosMes[st] = 0;
      // Assume value already merged or ignores if it is duplicate of Fixa?
      // For prediction, if the account is a fixed account, we ALREADY count it in baseFixas.
      // So let's only add strictly if it's NOT fixed, to avoid double-counting in our prediction.
      if (!c.isFixa) {
        gastosMes[st] += (Number(c.valor) || 0);
      }
    });

    // 2. Montar Array do período da meta e calcular "Folga" bruta
    const periodos = [];
    let curM = mIni, curA = aIni;
    while (curA < aFim || (curA === aFim && curM <= mFim)) {
      const k = `${curA}-${curM}`;
      
      const rend = historicoRendas[k] !== undefined ? historicoRendas[k] : mediaRendaFutura;
      const gastosAvulsos = gastosMes[k] || 0;
      const gastosTotais = gastosAvulsos + baseFixas;
      const folga = rend - gastosTotais;

      periodos.push({ mes: curM, ano: curA, folga, sugerido: 0 });

      curM++; if (curM > 12) { curM = 1; curA++; }
    }

    // 3. Rateio Inteligente Proporcional (Apenas para meses com Folga Positiva)
    let folgaPositivaTotal = periodos.reduce((acc, p) => p.folga > 0 ? acc + p.folga : acc, 0);

    // Se folga é 0, todos recebem zero (meta inatingível).
    if (folgaPositivaTotal > 0) {
      // Se folga for menor que o objetivo, salvaremos tudo que dá. Se for maior, aplicamos a ratio.
      const distRatio = folgaPositivaTotal >= valorObj ? (valorObj / folgaPositivaTotal) : 1;
      
      for (let p of periodos) {
        if (p.folga > 0) {
           p.sugerido = Number((p.folga * distRatio).toFixed(2));
        } else {
           p.sugerido = 0;
        }
      }

      // Pequeno ajuste de centavos no ultimo mes positivo devido ao toFixed
      const totalSugeridoArr = periodos.reduce((a,b) => a + b.sugerido, 0);
      const diffCentavos = valorObj - totalSugeridoArr;
      
      // se a diferença for pequena e a gente TIVER fundos pra isso (ou seja meta atingivel)
      if (folgaPositivaTotal >= valorObj && Math.abs(diffCentavos) > 0.001) {
        const ult = [...periodos].reverse().find(x => x.sugerido > 0);
        if (ult) ult.sugerido = Number((ult.sugerido + diffCentavos).toFixed(2));
      }
    }

    // 4. Salvar Meta
    const metaRef = await addDoc(collection(db, `users/${currentUser.uid}/metas`), {
      nome, 
      valorObjetivo: valorObj, 
      mesInicio: mIni, 
      anoInicio: aIni, 
      mesFim: mFim, 
      anoFim: aFim, 
      valorJaGuardado: 0, 
      dataCriacao: serverTimestamp()
    });

    // 5. Salvar Subcoleção de Parcelas
    for (let p of periodos) {
      await addDoc(collection(db, `users/${currentUser.uid}/metas/${metaRef.id}/metasParcelas`), {
        mes: p.mes,
        ano: p.ano,
        valorSugerido: p.sugerido,
        valorGuardado: 0,
        status: "pendente"
      });
    }

    $("metaNome").value = ""; $("metaValor").value = "";
    
  } catch (error) {
    console.error("Erro ao planejar meta", error);
    alert("Erro ao criar a meta inteligente.");
  } finally {
    $("btnSalvar").disabled = false;
    $("btnSalvar").textContent = "Criar Meta Inteligente";
  }
});

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.replace("../../auth/login.html");
    return;
  }
  currentUser = user;
  initFiltros();
  loadMetas();
});
