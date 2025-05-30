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
      dataHora: new Date().getTime()
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

  const agrupado = {};
  snapshot.forEach(doc => {
    const d = doc.data();
    const data = new Date(d.dataHora);
    const dia = data.toLocaleDateString('pt-BR');
    const ent = d.entregador;
    if (!agrupado[ent]) agrupado[ent] = {};
    if (!agrupado[ent][dia]) agrupado[ent][dia] = [];
    agrupado[ent][dia].push({ ...d, id: doc.id });
  });

  snapshot.forEach(doc => {
    const d = doc.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatarDataHora(new Date(d.dataHora))}</td>
      <td>${d.entregador}</td>
      <td>R$ ${d.valorCliente.toFixed(2).replace('.', ',')}</td>
      <td>R$ ${d.valorEntregador.toFixed(2).replace('.', ',')}</td>
      <td><button onclick="excluirCorrida('${doc.id}')">Excluir</button></td>
    `;
    tbody.appendChild(tr);
  });

  let htmlResumo = '<h3>Resumo</h3>';
  for (const entregador in agrupado) {
    htmlResumo += `<h4>${entregador}</h4><ul>`;
    for (const dia in agrupado[entregador]) {
      const corridas = agrupado[entregador][dia];
      const totalCli = corridas.reduce((s, c) => s + c.valorCliente, 0);
      const totalEnt = corridas.reduce((s, c) => s + c.valorEntregador, 0);
      htmlResumo += `<li>${dia}: ${corridas.length} corridas - Cliente: R$ ${totalCli.toFixed(2).replace('.', ',')} - Entregador: R$ ${totalEnt.toFixed(2).replace('.', ',')}</li>`;
    }
    htmlResumo += '</ul>';
  }
  document.getElementById('resumo').innerHTML = htmlResumo;
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

document.getElementById('btnEnviarWhatsApp').addEventListener('click', enviarResumoWhatsApp);
window.onload = () => {
  criarBotoes();
  carregarCorridas();
};
