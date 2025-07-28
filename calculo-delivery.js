const firebaseConfig = {
  apiKey: "AIzaSyDP39MFp-myGBpfDU5G1iIHEA5rlX4hDsY",
  authDomain: "corridasdelivery.firebaseapp.com",
  projectId: "corridasdelivery",
  storageBucket: "corridasdelivery.appspot.com",
  messagingSenderId: "145625258767",
  appId: "1:145625258767:web:63275b18094e95769bfc7a"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();


const tabelaValores = [
  { cliente: 7.00, entregador: 6.00 },
  { cliente: 8.50, entregador: 7.00 },
  { cliente: 9.50, entregador: 8.00 },
  { cliente: 11.00, entregador: 9.50 },
  { cliente: 12.50, entregador: 10.50 },
  { cliente: 13.00, entregador: 11.50 },
  { cliente: 14.00, entregador: 12.00 },
  { cliente: 15.00, entregador: 13.00 },
  { cliente: 16.00, entregador: 14.50 },
  { cliente: 17.00, entregador: 15.00 },
  { cliente: 20.00, entregador: 18.00 }
];

function calcularValorEntregador(valorCliente, usarValorDireto) {
  if (usarValorDireto) return valorCliente;

  const item = tabelaValores.find(v => v.cliente === valorCliente);
  return item ? item.entregador : 0;
}

function formatarDataHora(data) {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  const hora = String(data.getHours()).padStart(2, '0');
  const minuto = String(data.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}


async function adicionarCorridaPorBotao(valorCliente, usarValorDireto = false) {
  const nome = document.getElementById('nomeEntregador').value.trim();
  if (!nome) return alert('Digite o nome do entregador.');

  const valor = parseFloat(valorCliente.toString().replace(',', '.'));
  if (isNaN(valor) || valor <= 0) return alert('Valor inválido.');

  const valorEntregador = calcularValorEntregador(valor, usarValorDireto);

  try {
    await db.collection('corridas').add({
      entregador: nome,
      valorCliente: valor,
      valorEntregador,
      dataHora: (dataSelecionada ? dataSelecionada.getTime() : new Date().getTime())
    });
    carregarCorridas();
  } catch (err) {
    alert('Erro ao adicionar corrida: ' + err.message);
  }
}


document.getElementById('btnValorManual').addEventListener('click', () => {
  const valorManual = document.getElementById('valorManual').value.trim();
  if (!valorManual) return alert('Digite um valor.');
  adicionarCorridaPorBotao(valorManual, true);
});

function criarBotoes() {
  const container = document.getElementById('botoesValores');
  tabelaValores.forEach(v => {
    const botao = document.createElement('button');
    botao.innerText = `R$ ${v.cliente.toFixed(2).replace('.', ',')}`;
    botao.style.margin = '5px';
    botao.addEventListener('click', () => adicionarCorridaPorBotao(v.cliente, false));
    container.appendChild(botao);
  });
}


async function carregarCorridas() {
  const tbody = document.getElementById('tabelaCorridas');
  tbody.innerHTML = '';

  const snapshot = await db.collection('corridas').orderBy('dataHora', 'desc').get();
  if (snapshot.empty) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhuma corrida.</td></tr>';
    document.getElementById('resumo').innerHTML = '';
    return;
  }

  const porMes = {}; // Agrupamento por mês/ano
  const entregadoresResumo = {}; // Para o resumo por entregador

  snapshot.forEach(doc => {
    const d = doc.data();
    const data = new Date(d.dataHora);
    const mesAno = `${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;

    if (!porMes[mesAno]) porMes[mesAno] = [];
    porMes[mesAno].push({ ...d, id: doc.id });

    const dia = data.toLocaleDateString('pt-BR');
    if (!entregadoresResumo[d.entregador]) entregadoresResumo[d.entregador] = {};
    if (!entregadoresResumo[d.entregador][dia]) entregadoresResumo[d.entregador][dia] = [];
    entregadoresResumo[d.entregador][dia].push(d);
  });

  // Criar abas dos meses
  const resumoDiv = document.getElementById('resumo');
  let htmlResumo = '<h3>Corridas por Mês</h3>';
  htmlResumo += '<div id="abasMeses">';

  const meses = Object.keys(porMes).sort((a, b) => {
    const [ma, aa] = a.split('/').map(Number);
    const [mb, ab] = b.split('/').map(Number);
    return ab !== aa ? ab - aa : mb - ma;
  });

  meses.forEach((mes, i) => {
    htmlResumo += `<button class="abaMes" onclick="mostrarTabelaMes('${mes}')">${mes}</button>`;
  });

  htmlResumo += '</div><div id="conteudoMes"></div>';
  resumoDiv.innerHTML = htmlResumo;

  // Guardar corridas em window para trocar de aba
  window._corridasPorMes = porMes;

  // Mostrar o primeiro mês automaticamente
  if (meses.length) mostrarTabelaMes(meses[0]);
}


async function excluirCorrida(id) {
  if (!confirm('Excluir esta corrida?')) return;
  await db.collection('corridas').doc(id).delete();
  carregarCorridas();
}

async function enviarResumoWhatsApp() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);

  const snapshot = await db.collection('corridas')
    .where('dataHora', '>=', hoje.getTime())
    .where('dataHora', '<', amanha.getTime())
    .orderBy('dataHora', 'desc')
    .get();

  if (snapshot.empty) {
    alert('Nenhuma corrida cadastrada hoje para enviar.');
    return;
  }

  const agrupamento = {};

  snapshot.forEach(doc => {
    const data = doc.data();
    const entregador = data.entregador;
    const valorCliente = data.valorCliente;
    const valorEntregador = data.valorEntregador;

    if (!agrupamento[entregador]) agrupamento[entregador] = [];

    agrupamento[entregador].push({
      valorCliente,
      valorEntregador
    });
  });

  let mensagem = 'Resumo de Hoje:\n\n';

  for (const entregador in agrupamento) {
    const corridas = agrupamento[entregador];
    const totalCliente = corridas.reduce((acc, c) => acc + c.valorCliente, 0);
    const totalEntregador = corridas.reduce((acc, c) => acc + c.valorEntregador, 0);

    mensagem += `${entregador}:\n`;
    mensagem += `${corridas.length} corridas\n`;
    mensagem += `Total: R$ ${totalEntregador.toFixed(2).replace('.', ',')}\n\n`;
  }

  const texto = encodeURIComponent(mensagem);
  const url = `https://wa.me/?text=${texto}`;
  window.open(url, '_blank');
}

let dataSelecionada = null;

const inputData = document.getElementById('dataCorrida');
inputData.addEventListener('change', () => {
  const valor = inputData.value;
  if (valor) {
    const agora = new Date();
    const [ano, mes, dia] = valor.split('-').map(Number);

    dataSelecionada = new Date(ano, mes - 1, dia, agora.getHours(), agora.getMinutes(), agora.getSeconds());
  } else {
    dataSelecionada = null;
  }
});



document.getElementById('btnEnviarWhatsApp').addEventListener('click', enviarResumoWhatsApp);
window.onload = () => {
  criarBotoes();
  carregarCorridas();
};
function mostrarTabelaMes(mesSelecionado) {
  const conteudo = document.getElementById('conteudoMes');
  const corridas = window._corridasPorMes[mesSelecionado] || [];

  if (!corridas.length) {
    conteudo.innerHTML = '<p>Nenhuma corrida neste mês.</p>';
    return;
  }


  const resumoPorEntregador = {};
  corridas.forEach(d => {
    const data = new Date(d.dataHora);
    const dia = data.toLocaleDateString('pt-BR');
    const ent = d.entregador;

    if (!resumoPorEntregador[ent]) resumoPorEntregador[ent] = {};
    if (!resumoPorEntregador[ent][dia]) resumoPorEntregador[ent][dia] = [];

    resumoPorEntregador[ent][dia].push(d);
  });

  let html = `<h4> ${mesSelecionado}</h4>`;


  html += `<div style="margin-bottom: 15px;"><h5>Resumo por entregador</h5>`;
  for (const entregador in resumoPorEntregador) {
    html += `<strong>${entregador}</strong><ul>`;
    for (const dia in resumoPorEntregador[entregador]) {
      const grupo = resumoPorEntregador[entregador][dia];
      const totalCliente = grupo.reduce((acc, item) => acc + item.valorCliente, 0);
      const totalEntregador = grupo.reduce((acc, item) => acc + item.valorEntregador, 0);
      html += `<li><b>${dia}:</b> ${grupo.length} corridas - Cliente: R$ ${totalCliente.toFixed(2).replace('.', ',')} <b>- Entregador: R$ ${totalEntregador.toFixed(2).replace('.', ',')}</b></li>`;
    }
    html += '</ul>';
  }
  html += `</div>`;

  html += `<button id="toggleTabela" class="btnMostrarTodas">Mostrar todas as corridas do mês</button>`;


  html += `<div id="tabelaCompleta" style="display:none;"></div>`;

  conteudo.innerHTML = html;


  function montarTabelaCompleta() {
    let tabela = `
      <table border="1" cellpadding="5" cellspacing="0" style="margin-top: 10px; width: 100%;">
        <thead>
          <tr>
            <th>Data e Hora</th>
            <th>Entregador</th>
            <th>Cliente (R$)</th>
            <th>Entregador (R$)</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
    `;

    corridas.forEach(d => {
      const dataHora = formatarDataHora(new Date(d.dataHora));
      tabela += `
        <tr>
          <td>${dataHora}</td>
          <td>${d.entregador}</td>
          <td>R$ ${d.valorCliente.toFixed(2).replace('.', ',')}</td>
          <td>R$ ${d.valorEntregador.toFixed(2).replace('.', ',')}</td>
          <td><button onclick="excluirCorrida('${d.id}')">Excluir</button></td>
        </tr>
      `;
    });

    tabela += '</tbody></table>';
    return tabela;
  }

  const btnToggle = document.getElementById('toggleTabela');
  const divTabela = document.getElementById('tabelaCompleta');

  btnToggle.addEventListener('click', () => {
    if (divTabela.style.display === 'none') {
      divTabela.innerHTML = montarTabelaCompleta();
      divTabela.style.display = 'block';
      btnToggle.innerText = 'Ocultar todas as corridas do mês';
    } else {
      divTabela.style.display = 'none';
      btnToggle.innerText = 'Mostrar todas as corridas do mês';
    }
  });
}


