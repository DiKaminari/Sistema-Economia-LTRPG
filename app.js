// === 1. CONFIGURAÇÃO FIREBASE ===
const firebaseConfig = {
  apiKey: "AIzaSyC7AM9AP4YG2H2XM5-uTqEVjOX_m0SDa-0",
  authDomain: "economia-ltrpg.firebaseapp.com",
  projectId: "economia-ltrpg",
  storageBucket: "economia-ltrpg.firebasestorage.app",
  messagingSenderId: "240204072239",
  appId: "1:240204072239:web:d9e3dab0fe950cd42d4dda"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// === Nomes com privilégio total de Admin ===
const administradores = ["Diego Kaminari"];

// === VARIÁVEIS DE ESTADO (Agora vêm do Banco de Dados) ===
let tesouroGoverno = 90000000000000; 
let tesouroRevo = 50000000000;       
let tesouroSubmundo = 200000000000;  
let mercadoCirculante = 1000000000000; 
let logsAuditoria = []; 
let contadorMesGlobal = 1;
let historicoDeBackups = []; 
let ilhas = [];

// Variáveis de Controle Local
let visaoAtual = "player"; 
let playerLogado = ""; 
let ilhaSendoEditadaId = null; 
let ilhaCofreAbertoId = null; 
let ilhaHistoricoAbertoId = null;
let recursosTemporarios = []; 
let modsTemporarios = []; 
let primeiroAcessoDb = true;

// === 2. SISTEMA DE LOGIN E AUTH ===
function exibirMensagemLogin(msg) {
    document.getElementById("msg-erro-login").innerText = msg;
}

function fazerLogin() {
    const email = document.getElementById("login-email").value;
    const senha = document.getElementById("login-senha").value;
    if(!email || !senha) return exibirMensagemLogin("Preencha e-mail e senha.");
    
    auth.signInWithEmailAndPassword(email, senha).catch(err => exibirMensagemLogin("Erro ao logar: " + err.message));
}

function criarConta() {
    const email = document.getElementById("login-email").value;
    const senha = document.getElementById("login-senha").value;
    const nome = document.getElementById("login-nome").value;
    if(!email || !senha || !nome) return exibirMensagemLogin("Para criar conta, preencha email, senha e nome do personagem.");
    
    auth.createUserWithEmailAndPassword(email, senha).then(cred => {
        return cred.user.updateProfile({ displayName: nome });
    }).then(() => {
        window.location.reload(); // Recarrega para aplicar o perfil
    }).catch(err => exibirMensagemLogin("Erro ao criar: " + err.message));
}

function fazerLogoff() { auth.signOut(); }

// Monitor de Login Ativo
auth.onAuthStateChanged(user => {
    if (user) {
        playerLogado = user.displayName || "Jogador Desconhecido";
        visaoAtual = administradores.includes(playerLogado) ? "admin" : "player";
        
        document.getElementById("tela-login").style.display = "none";
        document.getElementById("header-app").style.display = "flex";
        document.getElementById("main-app").style.display = "block";
        document.getElementById("nome-usuario-logado").innerText = playerLogado;
        
        aplicarVisao();
        iniciarEscutaBanco(); // Conecta no Firebase e puxa o mapa
    } else {
        document.getElementById("tela-login").style.display = "block";
        document.getElementById("header-app").style.display = "none";
        document.getElementById("main-app").style.display = "none";
    }
});

function aplicarVisao() {
    document.querySelectorAll('.admin-only').forEach(el => {
        if (visaoAtual === "player") el.classList.add("escondido");
        else el.classList.remove("escondido");
    });
}

// === 3. CONEXÃO COM O FIREBASE (Ouvinte em Tempo Real) ===
function iniciarEscutaBanco() {
    db.collection("grandline").doc("worldData").onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            tesouroGoverno = data.tesouroGoverno;
            tesouroRevo = data.tesouroRevo;
            tesouroSubmundo = data.tesouroSubmundo;
            mercadoCirculante = data.mercadoCirculante;
            contadorMesGlobal = data.contadorMesGlobal;
            ilhas = data.ilhas || [];
            logsAuditoria = data.logsAuditoria || [];
            historicoDeBackups = data.historicoDeBackups || [];
            
            atualizarSaldosGlobais();
            renderizarIlhas();

            let btn = document.getElementById("btn-desfazer-mes");
            if (historicoDeBackups.length > 0 && visaoAtual === "admin") {
                btn.style.display = "inline-block";
                btn.innerText = `↩️ Desfazer Mês (${historicoDeBackups.length})`;
            } else {
                btn.style.display = "none";
            }
        } else {
            if (visaoAtual === "admin" && primeiroAcessoDb) {
                primeiroAcessoDb = false;
                salvarNoBanco(); // Cria a base zerada no primeiro acesso da vida
            }
        }
    }, (error) => {
        console.error("Erro no Firebase:", error);
        alert("Erro de permissão no Firebase. Verifique as Regras de Segurança no painel do Firestore.");
    });
}

// FUNÇÃO MESTRE QUE EMPURRA AS MUDANÇAS PARA A NUVEM
function salvarNoBanco() {
    if (visaoAtual !== "admin") return; // Apenas admin salva alterações estruturais
    db.collection("grandline").doc("worldData").set({
        tesouroGoverno, tesouroRevo, tesouroSubmundo, mercadoCirculante, 
        contadorMesGlobal, ilhas, logsAuditoria, historicoDeBackups
    }).catch(err => console.error("Erro ao salvar:", err));
}

// === 4. O RESTO DO SEU CÓDIGO INTACTO (Agira terminando com salvarNoBanco) ===

// NOVA FUNÇÃO: O Jogo inteiro vai usar isso automaticamente!
function formatarDinheiro(valor) {
    if (valor >= 1000000000000) {
        return "B$ " + (valor / 1000000000000).toFixed(2).replace('.', ',') + " Tri";
    }
    if (valor >= 1000000000) {
        return "B$ " + (valor / 1000000000).toFixed(2).replace('.', ',') + " Bi";
    }
    if (valor >= 1000000) {
        return "B$ " + (valor / 1000000).toFixed(2).replace('.', ',') + " Mi";
    }
    if (valor >= 100000) { 
        return "B$ " + (valor / 1000).toFixed(1).replace('.', ',') + " Mil";
    }
    
    // Se for menos de 100 mil, mostra o valor normal (ex: B$ 5.000)
    return "B$ " + Math.floor(valor).toLocaleString('pt-BR');
}

function formatarDinheiroExato(valor) { 
    return "B$ " + Math.floor(valor).toLocaleString('pt-BR'); 
}

function registrarLogAuditoria(acao, detalhes) {
    const dataHora = new Date().toLocaleString('pt-BR');
    logsAuditoria.unshift(`[${dataHora}] [${acao}] - ${detalhes}`); 
}

function abrirAuditoria() {
    const terminal = document.getElementById("auditoria-corpo");
    if (logsAuditoria.length === 0) {
        terminal.innerHTML = "Nenhuma ação registrada ainda.";
    } else {
        terminal.innerHTML = logsAuditoria.map(log => `<div>> ${log}</div>`).join("");
    }
    document.getElementById("modal-auditoria").style.display = "block";
}

function abrirHistoricoIlha(id) {
    fecharModal('modal-detalhes');
    const ilha = ilhas.find(i => i.id === id); 
    if (!ilha) return;
    const container = document.getElementById("historico-corpo");
    if (!ilha.historico || ilha.historico.length === 0) {
        container.innerHTML = "<p style='color:#aaa;'>Nenhum relatório mensal.</p>";
    } else {
        container.innerHTML = [...ilha.historico].reverse().map(recibo => `
            <div class="log-mes-card">
                <h4>${recibo.mes}</h4>
                <p><strong>Custo de Manutenção Pago:</strong> <span style="color:#ff4d4d;">-${formatarDinheiro(recibo.custo)}</span></p>
                <p><strong>Renda Urbana Gerada:</strong> <span style="color:#2ecc71;">+${formatarDinheiro(recibo.renda)}</span></p>
                <p><strong>Lucro c/ Recursos/Serviços:</strong> <span style="color:#2ecc71;">+${formatarDinheiro(recibo.lucroRecursos)}</span></p>
                <hr style="border-top: 1px solid #444; margin: 8px 0;">
                <p><strong>Impostos Globais Pagos:</strong> <span style="color:#ff4d4d;">-${formatarDinheiro(recibo.impostoGlobal)}</span></p>
                <p><strong>Repasse ao Governante:</strong> <span style="color:#b8860b;">+${formatarDinheiro(recibo.repasseLider)}</span></p>
                <p><strong>Entrada Líquida no Cofre:</strong> <span style="font-weight:bold; color:${recibo.lucroLiquidoFinal >= 0 ? '#2ecc71' : '#ff4d4d'}">${formatarDinheiro(recibo.lucroLiquidoFinal)}</span></p>
                <hr style="border-top: 1px solid #444; margin: 8px 0;">
                <p style="font-style: italic; font-size: 11px; color: #888;">Saúde terminou em ${recibo.saude}%.<br>${recibo.notas}</p>
            </div>
        `).join("");
    }
    document.getElementById("modal-historico").style.display = "block";
}

function atualizarSaldosGlobais() {
    const isAdm = visaoAtual === "admin";

    // Função interna rápida para atualizar o texto e a classe
    const setSaldo = (id, valor) => {
        const el = document.getElementById(id);
        if (isAdm) {
            el.innerText = formatarDinheiro(valor);
            el.classList.remove("texto-sigiloso"); // Remove o cinza, volta a cor da facção
        } else {
            el.innerText = "B$ SIGILOSO";
            el.classList.add("texto-sigiloso"); // Deixa cinza pro player
        }
    };

    setSaldo("saldo-governo", tesouroGoverno);
    setSaldo("saldo-revo", tesouroRevo);
    setSaldo("saldo-submundo", tesouroSubmundo);
    setSaldo("saldo-mercado", mercadoCirculante);
}

function registrarDespesa() {
    const tipoTx = document.getElementById("tipo-transacao-global-toggle").checked ? "pagar" : "receber";
    const origem = document.getElementById("origem-despesa").value;
    const valor = parseInt(document.getElementById("valor-despesa").value);
    
    if (isNaN(valor) || valor <= 0) return alert("Valor inválido.");

    if (tipoTx === "pagar") {
        if (origem === "governo") { if (valor > tesouroGoverno) return alert("Sem fundos!"); tesouroGoverno -= valor; } 
        else if (origem === "revo") { if (valor > tesouroRevo) return alert("Sem fundos!"); tesouroRevo -= valor; } 
        else if (origem === "submundo") { if (valor > tesouroSubmundo) return alert("Sem fundos!"); tesouroSubmundo -= valor; }
        mercadoCirculante += valor;
        registrarLogAuditoria("CAIXA GLOBAL", `Transferiu ${formatarDinheiro(valor)} do(a) ${origem} pro Mercado.`);
    } else {
        if (valor > mercadoCirculante) return alert("Falta dinheiro no Mercado!");
        mercadoCirculante -= valor;
        if (origem === "governo") tesouroGoverno += valor;
        else if (origem === "revo") tesouroRevo += valor;
        else if (origem === "submundo") tesouroSubmundo += valor;
        registrarLogAuditoria("CAIXA GLOBAL", `Confiscou ${formatarDinheiro(valor)} do Mercado pro(a) ${origem}.`);
    }
    document.getElementById("valor-despesa").value = "";
    salvarNoBanco(); // <-- SALVA NA NUVEM
}

function getBadgeClass(alin) {
    if (alin === "Governo Mundial") return "badge-governo";
    if (alin === "Revolucionário") return "badge-revo";
    if (alin === "Submundo") return "badge-submundo";
    if (alin === "Pirata") return "badge-pirata";
    return "badge-independente";
}

function calcularCustosIlha(ilha) {
    let manutencaoBase = ilha.densidade === "Baixa" ? 1000000000 : (ilha.densidade === "Média" ? 3000000000 : 6000000000);
    let multGestao = 1; let sangramentoBase = 0;

    if (ilha.gestao === "Tirânica") { multGestao = 0.5; sangramentoBase -= 10; }
    if (ilha.gestao === "Extrativista") { sangramentoBase -= 15; }
    if (ilha.gestao === "Caótica") { sangramentoBase -= 20; }
    if (ilha.gestao === "Benevolente") { multGestao = 1.4; sangramentoBase += 10; }
    if (ilha.gestao === "Militarizada") { multGestao = 2.0; sangramentoBase += 5; }
    if (ilha.densidade === "Alta") sangramentoBase -= 5; 

    if (ilha.taxa_imposto_percentual > 20) {
        let excesso = ilha.taxa_imposto_percentual - 20;
        let penalidadeFiscal = Math.floor(excesso / 10) * 5;
        sangramentoBase -= penalidadeFiscal;
    }

    let manutencaoCalculada = manutencaoBase * multGestao;
    let rendaCalculada = ilha.renda_bruta_mensal;
    let multManutencao = 1.0, multRenda = 1.0, multProd = 1.0;
    let fixoManutencao = 0, fixoRenda = 0, totalCuraEstabilidade = sangramentoBase; 

    if (ilha.mods && ilha.mods.length > 0) {
        ilha.mods.forEach(mod => {
            multManutencao *= (1 + ((mod.mod_manutencao_perc || 0) / 100));
            multRenda *= (1 + ((mod.mod_renda_perc || 0) / 100));
            multProd *= (1 + ((mod.mod_prod_perc || 0) / 100));
            fixoManutencao += (mod.mod_manutencao_fixa || 0);
            fixoRenda += (mod.mod_renda_fixa || 0);
            totalCuraEstabilidade += (mod.mod_estabilidade || 0);
        });
    }

    let custoFinal = Math.floor((manutencaoCalculada * multManutencao) + fixoManutencao);
    let rendaFinal = Math.floor((rendaCalculada * multRenda) + fixoRenda);
    if (custoFinal < 0) custoFinal = 0; if (rendaFinal < 0) rendaFinal = 0;

    return { custo: custoFinal, renda: rendaFinal, mult_prod: multProd, mudanca_estabilidade: totalCuraEstabilidade };
}

function renderizarIlhas() {
    const container = document.getElementById("lista-ilhas");
    container.innerHTML = ""; 
    
    let termoBusca = document.getElementById("busca-nome").value.toLowerCase();
    let regiaoFiltro = document.getElementById("filtro-regiao").value;

    let ilhasFiltradas = ilhas.filter(ilha => {
        let matchNome = ilha.nome.toLowerCase().includes(termoBusca) || ilha.governante.toLowerCase().includes(termoBusca);
        let matchRegiao = (regiaoFiltro === "Todas") || (ilha.regiao === regiaoFiltro);
        return matchNome && matchRegiao;
    });

    ilhasFiltradas.forEach(ilha => {
        let corLider = (ilha.governante === "Nenhum" || ilha.governante.includes("(NPC)")) ? "#888" : "#e0e0e0";
        let corSaude = ilha.saude >= 70 ? "#2ecc71" : (ilha.saude >= 30 ? "#f39c12" : "#ff4d4d");
        
        let avisoColapso = "";
        if (ilha.saude <= 0) avisoColapso = ` <span style="color:red; font-size:11px; font-weight:bold;">(FANTASMA)</span>`;
        else if (ilha.saude < 30) avisoColapso = ` <span style="color:red; font-size:11px;">(COLAPSO)</span>`;

        // MAPEAMENTO DE IMAGENS ATUALIZADO CONFORME SOLICITADO
        let imagemFundo = "ilha civil.png"; 
        if (ilha.alinhamento === "Governo Mundial") imagemFundo = "ilha governo.png";
        else if (ilha.alinhamento === "Revolucionário") imagemFundo = "ilha revo.png";
        else if (ilha.alinhamento === "Submundo") imagemFundo = "ilha mafia.png";
        else if (ilha.alinhamento === "Pirata") imagemFundo = "ilha pirata.png";

        let htmlEdicao = visaoAtual === "admin" 
            ? `<button onclick="abrirFormIlha('${ilha.id}')" class="btn-ilha-glass"><span class="icon">✏️</span> EDITAR</button>
               <button onclick="abrirModalCofre('${ilha.id}')" class="btn-ilha-glass"><span class="icon">💰</span> CAIXA</button>` : ``;

        let textoCofre = (visaoAtual === "admin" || ilha.governante === playerLogado) 
            ? `<span class="valor-dinheiro" style="font-size: 14px;">${formatarDinheiro(ilha.tesouro_nacional)}</span>` 
            : `<span style="color: #ff4d4d; font-style: italic; font-size: 12px;">Dados Sigilosos</span>`;

        const card = document.createElement("div");
        card.className = "card-ilha-horizontal"; 
        card.innerHTML = `
            <div class="ilha-bg-gradient"></div>

            <div class="ilha-info-lateral">
                <div class="ilha-cabecalho">
                    <h3>${ilha.nome}</h3>
                    <span class="badge-alinhamento ${getBadgeClass(ilha.alinhamento)}">${ilha.alinhamento}</span>
                </div>
                
                <div class="ilha-dados">
                    <div class="info-linha"><span>Governante:</span> <span style="color:${corLider}">${ilha.governante}</span></div>
                    <div class="info-linha"><span>Saúde/Ordem:</span> <span style="color:${corSaude}; font-weight:bold;">${ilha.saude}% ${avisoColapso}</span></div>
                    <div class="info-linha"><span>Cofre Nacional:</span> ${textoCofre}</div>
                </div>
                
                <div class="ilha-botoes">
                    <button onclick="abrirModal('${ilha.id}')" class="btn-ilha-glass highlight"><span class="icon">🔍</span> STATS</button>
                    ${htmlEdicao}
                </div>
            </div>

            <div class="ilha-arte-overflow" style="background-image: url('Imagens/${imagemFundo}');"></div>
        `;
        container.appendChild(card);
    });
}

function venderEstoqueLocal(ilhaId, recIndex) {
    const ilha = ilhas.find(i => i.id === ilhaId);
    const recurso = ilha.recursos[recIndex];
    if (recurso.estoque_acumulado <= 0) return alert("Sem estoque local disponível!");
    
    let qtd = parseInt(prompt(`ESTOQUE LOCAL: ${recurso.estoque_acumulado} un.\nQuantas unidades o player comprou localmente?`));
    if (isNaN(qtd) || qtd <= 0) return;
    if (qtd > recurso.estoque_acumulado) return alert("Quantidade maior que o estoque local.");

    let valorTotal = Math.floor(qtd * recurso.valor_base);
    if (mercadoCirculante < valorTotal) return alert(`O Mercado não tem ${formatarDinheiro(valorTotal)} para pagar.`);
    
    mercadoCirculante -= valorTotal;
    ilha.tesouro_nacional += valorTotal;
    recurso.estoque_acumulado -= qtd; 

    registrarLogAuditoria("VENDA LOCAL", `Player comprou ${qtd} un. de ${recurso.nome} em ${ilha.nome}.`);
    salvarNoBanco(); // <-- SALVA NA NUVEM
    abrirModal(ilhaId); 
}

function ajustarEstoque(ilhaId, recIndex, tipoEstoque) {
    const ilha = ilhas.find(i => i.id === ilhaId);
    const recurso = ilha.recursos[recIndex];
    
    let estoqueAtual = tipoEstoque === 'local' ? recurso.estoque_acumulado : recurso.estoque_transito;
    let nomeEstoque = tipoEstoque === 'local' ? 'ESTOQUE LOCAL' : 'CARGA EM TRÂNSITO';

    let qtdStr = prompt(`PIRATARIA/AJUSTE (${nomeEstoque})\nAtual: ${estoqueAtual}\nDigite o NOVO VALOR TOTAL:`, estoqueAtual);
    if (qtdStr === null) return;
    let novaQtd = parseInt(qtdStr);
    if (isNaN(novaQtd) || novaQtd < 0) return alert("Valor inválido.");

    if (tipoEstoque === 'local') recurso.estoque_acumulado = novaQtd;
    else recurso.estoque_transito = novaQtd;

    registrarLogAuditoria("AJUSTE DE ESTOQUE", `Alterou ${nomeEstoque} de ${recurso.nome} em ${ilha.nome}.`);
    salvarNoBanco(); // <-- SALVA NA NUVEM
    abrirModal(ilhaId); 
}

function abrirModal(id) {
    ilhaHistoricoAbertoId = id; 
    const ilha = ilhas.find(i => i.id === id);
    if (!ilha) return;

    let botaoHistorico = document.getElementById("btn-ver-historico");
    if (visaoAtual === "admin" || ilha.governante === playerLogado) {
        botaoHistorico.style.display = "block";
        botaoHistorico.setAttribute("onclick", `abrirHistoricoIlha('${ilha.id}')`);
    } else { botaoHistorico.style.display = "none"; }

    let stats = calcularCustosIlha(ilha);
    let iconeEvolucao = stats.mudanca_estabilidade >= 0 ? `<span style="color:#2ecc71;">(+${stats.mudanca_estabilidade}/mês)</span>` : `<span style="color:#ff4d4d;">(${stats.mudanca_estabilidade}/mês)</span>`;
    let isCollapsed = ilha.saude < 30;

    let infoPrivada = ""; let htmlRecursos = "";
    
    if (visaoAtual === "admin" || ilha.governante === playerLogado) {
        infoPrivada = `
            <p><strong>Custo Manut.:</strong> <span style="color:#ff4d4d;">-${formatarDinheiro(stats.custo)}</span></p>
            <p><strong>Imposto do Líder:</strong> ${ilha.taxa_imposto_percentual}%</p>
            <p><strong>Último Repasse:</strong> <span style="color:#b8860b;">${formatarDinheiro(ilha.repasse_mensal_atual)}</span></p>
        `;

        if (ilha.recursos && ilha.recursos.length > 0) {
            htmlRecursos = "<ul style='margin-top:10px;'>";
            ilha.recursos.forEach((rec, idx) => {
                let botoesAdmin = "";
                if (visaoAtual === "admin") {
                    if (rec.tipo === "Material") {
                        botoesAdmin = `
                        <div style="margin-top:5px; margin-bottom: 10px;">
                            <button onclick="venderEstoqueLocal('${ilha.id}', ${idx})" style="padding:2px 8px; font-size:11px; background:#2ecc71; color:#111; border:none; border-radius:3px;">💰 Vender Local</button>
                            <button onclick="ajustarEstoque('${ilha.id}', ${idx}, 'local')" style="padding:2px 8px; font-size:11px; background:#4a86e8; color:white; border:none; border-radius:3px;">+/- Local</button>
                            ${rec.foco === "Global" ? `<button onclick="ajustarEstoque('${ilha.id}', ${idx}, 'transito')" style="padding:2px 8px; font-size:11px; background:#f39c12; color:#111; border:none; border-radius:3px;">+/- Trânsito</button>` : ''}
                        </div>`;
                    } else {
                        botoesAdmin = `<button onclick="venderEstoqueLocal('${ilha.id}', ${idx})" style="padding:2px 8px; font-size:11px; background:#2ecc71; color:#111; border:none; border-radius:3px; margin-left:10px;">🛎️ Usar Serviço</button>`;
                    }
                }

                let prodBuffada = Math.floor(rec.producao_mensal * stats.mult_prod);
                if (isCollapsed || ilha.saude === 0) prodBuffada = 0; 
                let avisoBuff = stats.mult_prod > 1.0 && !isCollapsed ? `<span style="color:#2ecc71; font-size:10px;">(Buffado)</span>` : "";

                if (rec.tipo === "Material") {
                    let infoTransito = rec.foco === "Global" ? ` | 🚢 Trânsito: <span style="color:#f39c12;font-weight:bold;">${rec.estoque_transito}</span>` : "";
                    htmlRecursos += `<li style='color:#aaa; font-size:13px; margin-bottom:5px; border-left: 2px solid #555; padding-left: 5px;'>
                        📦 <strong>${rec.nome}</strong> [${rec.foco}]<br>
                        (Prod Mês: ${prodBuffada} ${avisoBuff} | 🏠 Estoque Local: <span style="color:white;font-weight:bold;">${rec.estoque_acumulado}</span>${infoTransito})<br>
                        Valor: ${formatarDinheiro(rec.valor_base)} ${botoesAdmin}
                    </li>`;
                } else {
                    htmlRecursos += `<li style='color:#aaa; font-size:13px; margin-bottom:5px;'>🛎️ <strong>${rec.nome}</strong> [${rec.foco}] (Vagas: <span style="color:white;font-weight:bold;">${rec.estoque_acumulado}</span>) - ${formatarDinheiro(rec.valor_base)} ${botoesAdmin}</li>`;
                }
            });
            htmlRecursos += "</ul>";
        }
    } else {
        infoPrivada = `<p style="color: #ff4d4d; font-style: italic;">Dados Financeiros Sigilosos.</p>`;
        htmlRecursos = `<p style="color: #ff4d4d; font-style: italic; margin-top:10px;">Dados Comerciais Sigilosos.</p>`;
    }

    let htmlMods = "";
    if (ilha.mods && ilha.mods.length > 0) {
        htmlMods = "<div style='margin-top: 15px;'><h4 style='color:#b8860b; font-size: 13px;'>Addons Ativos:</h4><ul style='color:#aaa; font-size: 12px;'>";
        ilha.mods.forEach(mod => htmlMods += `<li>${mod.nome}</li>`);
        htmlMods += "</ul></div>";
    }

    let textoCofre = (visaoAtual === "admin" || ilha.governante === playerLogado) ? `<span class="valor-dinheiro">${formatarDinheiroExato(ilha.tesouro_nacional)}</span>` : `<span style="color: #ff4d4d; font-style: italic; font-size: 12px;">Sigiloso</span>`;

    document.getElementById("modal-titulo").innerText = ilha.nome;
    document.getElementById("modal-corpo").innerHTML = `
        <div style="display: flex; justify-content: space-between;">
            <div style="flex: 1; padding-right: 10px;">
                <p><strong>Região:</strong> ${ilha.regiao}</p><p><strong>Alinhamento:</strong> ${ilha.alinhamento}</p><p><strong>Governante:</strong> ${ilha.governante}</p>
                <p><strong>Gestão:</strong> ${ilha.gestao} | <strong>Densidade:</strong> ${ilha.densidade}</p>
                <p><strong>Saúde/Ordem:</strong> ${ilha.saude}% ${iconeEvolucao}</p>
                ${htmlMods} ${htmlRecursos}
            </div>
            <div style="flex: 1; text-align: right; border-left: 1px solid #333; padding-left: 10px;">
                <p><strong>Cofre Nacional:</strong> ${textoCofre}</p>${infoPrivada}
            </div>
        </div>`;
    document.getElementById("modal-detalhes").style.display = "block";
}

function fecharModal(modalId) { document.getElementById(modalId).style.display = "none"; }

// DENTRO DA FUNÇÃO abrirModalCofre(id)...
function abrirModalCofre(id) {
    ilhaCofreAbertoId = id; const ilha = ilhas.find(i => i.id === id);
    document.getElementById("cofre-titulo").innerText = `Caixa: ${ilha.nome}`;
    // AQUI: Usando o dinheiro exato!
    document.getElementById("cofre-saldo-atual").innerText = formatarDinheiroExato(ilha.tesouro_nacional);
    document.getElementById("valor-transacao").value = ""; document.getElementById("motivo-transacao").value = "";
    document.getElementById("modal-cofre").style.display = "block";
}

function transacaoCofre(tipoOperacao) {
    const valor = parseInt(document.getElementById("valor-transacao").value);
    const motivo = document.getElementById("motivo-transacao").value.trim();
    if (isNaN(valor) || valor <= 0) return alert("Valor inválido.");
    if (!motivo) return alert("Preencha o motivo para salvar na Auditoria.");

    const ilha = ilhas.find(i => i.id === ilhaCofreAbertoId);

    if (tipoOperacao === 'retirar') {
        if (valor > ilha.tesouro_nacional) return alert("Cofre insuficiente!");
        ilha.tesouro_nacional -= valor; mercadoCirculante += valor;
        registrarLogAuditoria("SAQUE COFRE", `[${ilha.nome}] Retirou ${formatarDinheiro(valor)}. Motivo: ${motivo}`);
    } else {
        if (valor > mercadoCirculante) return alert("Falta dinheiro no Mercado.");
        mercadoCirculante -= valor; ilha.tesouro_nacional += valor;
        registrarLogAuditoria("DEPÓSITO COFRE", `[${ilha.nome}] Depositou ${formatarDinheiro(valor)}. Motivo: ${motivo}`);
    }
    fecharModal('modal-cofre'); salvarNoBanco(); // <-- SALVA NA NUVEM
}

function renderizarRecursosForm() {
    const contRec = document.getElementById("lista-recursos-form"); contRec.innerHTML = "";
    recursosTemporarios.forEach((rec, idx) => {
        let tag = rec.tipo === "Material" ? "📦" : "🛎️";
        contRec.innerHTML += `<div class="item-recurso"><span><strong>${tag} ${rec.nome}</strong> (${rec.foco} | Base: ${formatarDinheiro(rec.valor_base)})</span>
        <div><button type="button" onclick="editarRecursoMemoria(${idx})" style="padding:2px 5px; background:#4a86e8; border:none; cursor:pointer; border-radius:3px; margin-right:5px;">✏️</button><button type="button" onclick="removerRecursoMemoria(${idx})" class="btn-remover-rec">X</button></div></div>`;
    });

    const contMod = document.getElementById("lista-mods-form"); contMod.innerHTML = "";
    modsTemporarios.forEach((mod, idx) => {
        contMod.innerHTML += `<div class="item-recurso" style="border-left-color: #b8860b;"><span><strong>${mod.nome}</strong></span>
        <div><button type="button" onclick="editarModMemoria(${idx})" style="padding:2px 5px; background:#4a86e8; border:none; cursor:pointer; border-radius:3px; margin-right:5px;">✏️</button><button type="button" onclick="removerModMemoria(${idx})" class="btn-remover-rec">X</button></div></div>`;
    });
}

function adicionarModMemoria() {
    const idxEdit = parseInt(document.getElementById("edit-mod-index").value);
    const nome = document.getElementById("add-mod-nome").value;
    if (!nome) return alert("Nome obrigatório.");
    let novoMod = { nome, mod_manutencao_perc: parseInt(document.getElementById("add-mod-manu-perc").value) || 0, mod_renda_perc: parseInt(document.getElementById("add-mod-renda-perc").value) || 0, mod_prod_perc: parseInt(document.getElementById("add-mod-prod-perc").value) || 0, mod_estabilidade: parseInt(document.getElementById("add-mod-estabilidade").value) || 0, mod_manutencao_fixa: parseInt(document.getElementById("add-mod-manu-fixo").value) || 0, mod_renda_fixa: parseInt(document.getElementById("add-mod-renda-fixo").value) || 0 };
    if (idxEdit >= 0) modsTemporarios[idxEdit] = novoMod; else modsTemporarios.push(novoMod);
    document.getElementById("add-mod-nome").value = ""; document.getElementById("add-mod-manu-perc").value = "0"; document.getElementById("add-mod-renda-perc").value = "0"; document.getElementById("add-mod-prod-perc").value = "0"; document.getElementById("add-mod-estabilidade").value = "0"; document.getElementById("add-mod-manu-fixo").value = "0"; document.getElementById("add-mod-renda-fixo").value = "0"; document.getElementById("edit-mod-index").value = "-1"; renderizarRecursosForm();
}

function editarModMemoria(idx) {
    let mod = modsTemporarios[idx];
    document.getElementById("add-mod-nome").value = mod.nome; document.getElementById("add-mod-manu-perc").value = mod.mod_manutencao_perc; document.getElementById("add-mod-renda-perc").value = mod.mod_renda_perc; document.getElementById("add-mod-prod-perc").value = mod.mod_prod_perc; document.getElementById("add-mod-estabilidade").value = mod.mod_estabilidade; document.getElementById("add-mod-manu-fixo").value = mod.mod_manutencao_fixa; document.getElementById("add-mod-renda-fixo").value = mod.mod_renda_fixa; document.getElementById("edit-mod-index").value = idx;
}

function removerModMemoria(idx) { modsTemporarios.splice(idx, 1); renderizarRecursosForm(); }

function adicionarRecursoMemoria() {
    const idxEdit = parseInt(document.getElementById("edit-rec-index").value);
    const nome = document.getElementById("add-rec-nome").value; const tipo = document.getElementById("add-rec-tipo").value; const foco = document.getElementById("add-rec-foco").value;
    const prod = parseInt(document.getElementById("add-rec-prod").value); const valor = parseInt(document.getElementById("add-rec-valor").value);
    if (!nome || isNaN(prod) || isNaN(valor)) return alert("Preencha corretamente.");
    
    let novoRec = { nome, tipo, foco, producao_mensal: prod, estoque_acumulado: prod, estoque_transito: 0, valor_base: valor };
    if (idxEdit >= 0) { 
        novoRec.estoque_acumulado = recursosTemporarios[idxEdit].estoque_acumulado; 
        novoRec.estoque_transito = recursosTemporarios[idxEdit].estoque_transito || 0; 
        recursosTemporarios[idxEdit] = novoRec; 
    } else { 
        recursosTemporarios.push(novoRec); 
    }
    
    document.getElementById("add-rec-nome").value = ""; document.getElementById("add-rec-prod").value = ""; document.getElementById("add-rec-valor").value = ""; document.getElementById("edit-rec-index").value = "-1"; document.getElementById("btn-salvar-rec").innerText = "➕ Add"; resetarCamposRecurso(); renderizarRecursosForm();
}

function editarRecursoMemoria(idx) {
    let rec = recursosTemporarios[idx];
    document.getElementById("add-rec-nome").value = rec.nome; document.getElementById("add-rec-tipo").value = rec.tipo; document.getElementById("add-rec-foco").value = rec.foco; document.getElementById("add-rec-prod").value = rec.producao_mensal; document.getElementById("add-rec-valor").value = rec.valor_base; document.getElementById("edit-rec-index").value = idx; document.getElementById("btn-salvar-rec").innerText = "💾 Ok"; verificarTipoRecurso(); 
}

function removerRecursoMemoria(idx) { recursosTemporarios.splice(idx, 1); renderizarRecursosForm(); }

function abrirFormIlha(id = null) {
    ilhaSendoEditadaId = id; recursosTemporarios = []; modsTemporarios = [];
    const btnExcluir = document.getElementById("btn-excluir-ilha");
    if (id) {
        const ilha = ilhas.find(i => i.id === id);
        if(ilha.recursos) recursosTemporarios = JSON.parse(JSON.stringify(ilha.recursos));
        if(ilha.mods) modsTemporarios = JSON.parse(JSON.stringify(ilha.mods));
        document.getElementById("form-titulo").innerText = "Editar: " + ilha.nome; document.getElementById("form-nome").value = ilha.nome; document.getElementById("form-lider").value = ilha.governante; document.getElementById("form-regiao").value = ilha.regiao || "Novo Mundo"; document.getElementById("form-alinhamento").value = ilha.alinhamento; document.getElementById("form-saude").value = ilha.saude; document.getElementById("form-densidade").value = ilha.densidade; document.getElementById("form-gestao").value = ilha.gestao; document.getElementById("form-imposto").value = ilha.taxa_imposto_percentual; document.getElementById("form-renda").value = ilha.renda_bruta_mensal; btnExcluir.style.display = "block";
    } else {
        document.getElementById("form-titulo").innerText = "Cadastrar Nova"; document.getElementById("form-nome").value = ""; document.getElementById("form-lider").value = "Nenhum"; document.getElementById("form-saude").value = 100; document.getElementById("form-renda").value = 0; btnExcluir.style.display = "none";
    }
    renderizarRecursosForm(); document.getElementById("modal-form-ilha").style.display = "block";
}

function salvarIlha() {
    const nome = document.getElementById("form-nome").value;
    if (!nome) return alert("O nome é obrigatório!");
    let dadosObj = {
        nome: nome, governante: document.getElementById("form-lider").value || "Nenhum", regiao: document.getElementById("form-regiao").value, alinhamento: document.getElementById("form-alinhamento").value, saude: parseInt(document.getElementById("form-saude").value) || 0, densidade: document.getElementById("form-densidade").value, gestao: document.getElementById("form-gestao").value, taxa_imposto_percentual: parseInt(document.getElementById("form-imposto").value) || 0, renda_bruta_mensal: parseInt(document.getElementById("form-renda").value) || 0, recursos: JSON.parse(JSON.stringify(recursosTemporarios)), mods: JSON.parse(JSON.stringify(modsTemporarios))
    };

    if (ilhaSendoEditadaId) {
        const idx = ilhas.findIndex(i => i.id === ilhaSendoEditadaId);
        Object.assign(ilhas[idx], dadosObj);
        registrarLogAuditoria("EDITAR ILHA", `As configurações da ilha ${nome} foram alteradas.`);
    } else {
        dadosObj.id = Date.now().toString(); dadosObj.tesouro_nacional = 0; dadosObj.repasse_mensal_atual = 0; dadosObj.historico = [];
        ilhas.push(dadosObj);
        registrarLogAuditoria("CRIAR ILHA", `Nova ilha cadastrada: ${nome}.`);
    }
    fecharModal('modal-form-ilha'); salvarNoBanco(); // <-- SALVA NA NUVEM
}

function excluirIlha() {
    if (!ilhaSendoEditadaId) return;
    const ilha = ilhas.find(i => i.id === ilhaSendoEditadaId);

    if (confirm(`Tem certeza que deseja excluir a ilha ${ilha.nome}?`)) {
        
        // SALVAGUARDA DA SOMA ZERO: Salva o dinheiro antes de destruir a ilha
        if (ilha.tesouro_nacional > 0) {
            let destino = confirm(`⚠️ ALERTA DE SOMA ZERO:\nA ilha possui B$ ${formatarDinheiro(ilha.tesouro_nacional)} no cofre.\n\nClique em OK para despejar esse valor no Mercado Circulante (Saque de Ruínas).\nClique em CANCELAR para destruir o dinheiro permanentemente.`);
            
            if (destino) {
                mercadoCirculante += ilha.tesouro_nacional;
                registrarLogAuditoria("SAQUE DE RUÍNAS", `A ilha ${ilha.nome} foi destruída e seu cofre de B$ ${formatarDinheiro(ilha.tesouro_nacional)} foi despejado no Mercado Circulante.`);
            } else {
                registrarLogAuditoria("DESTRUIÇÃO DE RIQUEZA", `A ilha ${ilha.nome} foi destruída e seu cofre foi apagado do mundo.`);
            }
        }

        const idx = ilhas.findIndex(i => i.id === ilhaSendoEditadaId);
        registrarLogAuditoria("EXCLUIR ILHA", `A ilha ${ilha.nome} foi deletada do mapa global.`);
        ilhas.splice(idx, 1);
        
        fecharModal('modal-form-ilha'); 
        salvarNoBanco(); // Salva a exclusão e a redistribuição do dinheiro na Nuvem
    }
}

// === DESFAZER O MÊS (Agora salva direto no DB) ===
function salvarBackupEstado() {
    const snapshot = JSON.stringify({ tesouroGoverno, tesouroRevo, tesouroSubmundo, mercadoCirculante, contadorMesGlobal, ilhas, logsAuditoria });
    historicoDeBackups.push(snapshot);
    if (historicoDeBackups.length > 6) historicoDeBackups.shift(); 
}

function desfazerMes() {
    if (historicoDeBackups.length === 0) return alert("Não há meses para desfazer.");
    const backupJSON = historicoDeBackups.pop(); const backup = JSON.parse(backupJSON);
    tesouroGoverno = backup.tesouroGoverno; tesouroRevo = backup.tesouroRevo; tesouroSubmundo = backup.tesouroSubmundo; mercadoCirculante = backup.mercadoCirculante; contadorMesGlobal = backup.contadorMesGlobal;
    ilhas.splice(0, ilhas.length, ...backup.ilhas); logsAuditoria.splice(0, logsAuditoria.length, ...backup.logsAuditoria);
    registrarLogAuditoria("REVERSÃO TEMPORAL", `O mês foi anulado. Restam ${historicoDeBackups.length} retornos.`);
    
    document.getElementById("painel-relatorio").style.display = "none";
    fecharModal('modal-detalhes'); fecharModal('modal-historico'); fecharModal('modal-auditoria');
    
    salvarNoBanco(); // <-- SALVA NA NUVEM E A TELA ATUALIZA SOZINHA
    alert("Reversão Temporal concluída no Servidor!");
}

// ==== O MOTOR DO TEMPO ====
function processarMes() {
    salvarBackupEstado();

    const clima = Math.floor(Math.random() * 6) + 1;
    let multClima = (clima === 1) ? 0.5 : (clima === 6 ? 1.5 : 1);
    const rolM = Math.floor(Math.random() * 100) + 1;
    let txAbs = rolM <= 30 ? 0.3 : (rolM <= 70 ? 0.6 : (rolM <= 95 ? 0.9 : 1.0));
    let multEsc = rolM > 95 ? 1.25 : 1.0;
    let climaNome = clima === 1 ? "Recessão" : (clima === 6 ? "Boom" : "Estável");
    let mercadoNome = rolM <= 30 ? "Demanda Fria" : (rolM > 95 ? "Escassez" : "Estável");
    registrarLogAuditoria("MOTOR DO TEMPO", `Mês ${contadorMesGlobal} processado. Clima: ${climaNome}. Mercado: ${mercadoNome}.`);

    let gGov = tesouroGoverno * 0.05; let gRev = tesouroRevo * 0.08; let gSub = tesouroSubmundo * 0.10; 
    tesouroGoverno -= gGov; tesouroRevo -= gRev; tesouroSubmundo -= gSub;
    mercadoCirculante += (gGov + gRev + gSub);

    let repasses = {}; let tGov = 0, tRev = 0, tSub = 0;

    ilhas.forEach(ilha => {
        if (!ilha.historico) ilha.historico = []; 
        if (ilha.governante === "Nenhum (Ilha Fantasma)") return;

        let stats = calcularCustosIlha(ilha);
        ilha.saude += stats.mudanca_estabilidade;
        if (ilha.saude > 100) ilha.saude = 100;
        
        if (ilha.saude <= 0) {
            ilha.saude = 0; ilha.governante = "Nenhum (Ilha Fantasma)"; ilha.mods = [];
            ilha.recursos.forEach(r => { r.estoque_acumulado = 0; r.estoque_transito = 0; });
            registrarLogAuditoria("MORTE DA ILHA", `${ilha.nome} colapsou completamente.`);
            return;
        }

        let isCollapsed = ilha.saude < 30;
        let colapsoMod = isCollapsed ? 0.0 : 1.0; 
        mercadoCirculante += stats.custo; 

        let ganhoBrutoEsperado = Math.floor((stats.renda * multClima) * colapsoMod);
        let ganhoBrutoReal = 0;
        if (mercadoCirculante >= ganhoBrutoEsperado) { mercadoCirculante -= ganhoBrutoEsperado; ganhoBrutoReal = ganhoBrutoEsperado; } 
        else { ganhoBrutoReal = mercadoCirculante; mercadoCirculante = 0; }

        let lucroRec = 0; let logsRecursos = [];

        if (ilha.recursos && ilha.recursos.length > 0) {
            ilha.recursos.forEach(rec => {
                let estoqueDisponivel = rec.estoque_acumulado; 
                let qtdLocal = 0, qtdGlobal = 0;
                
                if (rec.foco === "Local") { qtdLocal = estoqueDisponivel; } 
                else { qtdLocal = Math.floor(estoqueDisponivel * 0.20); qtdGlobal = Math.floor(estoqueDisponivel * 0.80); }

                let qtdGlobalAbsorvida = Math.floor(qtdGlobal * txAbs);
                let vVendaTotal = Math.floor((qtdLocal * rec.valor_base) + (qtdGlobalAbsorvida * Math.floor(rec.valor_base * multEsc)));

                if (mercadoCirculante >= vVendaTotal) { 
                    mercadoCirculante -= vVendaTotal; lucroRec += vVendaTotal;
                    let totalVendido = qtdLocal + qtdGlobalAbsorvida;

                    if (rec.tipo === "Material") {
                        rec.estoque_acumulado -= totalVendido; if(rec.estoque_acumulado < 0) rec.estoque_acumulado = 0;
                        logsRecursos.push(`${rec.nome}: Vendeu ${qtdLocal} un. Local e ${qtdGlobalAbsorvida} un. Exportação | Total: B$ ${formatarDinheiro(vVendaTotal)}`);
                    } else { logsRecursos.push(`${rec.nome}: Ocupou ${qtdLocal} vagas | Total: B$ ${formatarDinheiro(vVendaTotal)}`); }
                } else {
                    lucroRec += mercadoCirculante; 
                    if (rec.tipo === "Material") rec.estoque_acumulado -= Math.floor(mercadoCirculante / rec.valor_base);
                    mercadoCirculante = 0; logsRecursos.push(`${rec.nome}: Venda travada por quebra global.`);
                }

                let prodBuffada = Math.floor(rec.producao_mensal * stats.mult_prod * colapsoMod);
                if (rec.tipo === "Material") {
                    if (rec.foco === "Local") { rec.estoque_acumulado += prodBuffada; rec.estoque_transito = 0; } 
                    else { rec.estoque_acumulado += Math.floor(prodBuffada * 0.20); rec.estoque_transito = Math.floor(prodBuffada * 0.80); }
                } else { rec.estoque_acumulado = prodBuffada; rec.estoque_transito = 0; }

                if (rec.foco === "Global") {
                    let precoAntigo = rec.valor_base;
                    if (rolM <= 30) rec.valor_base = Math.floor(rec.valor_base * 0.90); 
                    else if (rolM > 70 && rolM <= 95) rec.valor_base = Math.floor(rec.valor_base * 1.10); 
                    else if (rolM > 95) rec.valor_base = Math.floor(rec.valor_base * 1.25); 
                    if (rec.valor_base < 100) rec.valor_base = 100; 
                    if (precoAntigo !== rec.valor_base) logsRecursos.push(`[Inflação/Deflação] Novo preço de ${rec.nome}: B$ ${formatarDinheiro(rec.valor_base)}`);
                }
            });
        }
        
        ganhoBrutoReal += lucroRec;
        let lucroLiq = ganhoBrutoReal - stats.custo;

        if (lucroLiq > 0) {
            if (ilha.alinhamento === "Governo Mundial") { let tx = Math.floor(lucroLiq * 0.20); lucroLiq -= tx; tGov += tx; }
            else if (ilha.alinhamento === "Revolucionário") { let tx = Math.floor(lucroLiq * 0.10); lucroLiq -= tx; tRev += tx; }
            else if (ilha.alinhamento === "Submundo") { let tx = Math.floor(lucroLiq * 0.25); lucroLiq -= tx; tSub += tx; }

            if (ilha.governante !== "Nenhum" && !ilha.governante.includes("(NPC)")) {
                let corte = Math.floor(lucroLiq * (ilha.taxa_imposto_percentual / 100));
                lucroLiq -= corte; ilha.repasse_mensal_atual = corte;
                if (!repasses[ilha.governante]) repasses[ilha.governante] = 0;
                repasses[ilha.governante] += corte;
                mercadoCirculante += corte; 
            }
        } else { ilha.repasse_mensal_atual = 0; }
        
        ilha.tesouro_nacional += lucroLiq; 
        
        let stringNota = logsRecursos.join("<br>");
        if (isCollapsed) stringNota = "ILHA EM COLAPSO ABSOLUTO. Renda base e produção inativas.";

        ilha.historico.push({ mes: `Mês ${contadorMesGlobal}`, custo: stats.custo, renda: ganhoBrutoReal - lucroRec, lucroRecursos: lucroRec, impostoGlobal: tGov+tRev+tSub, repasseLider: ilha.repasse_mensal_atual, lucroLiquidoFinal: lucroLiq, saude: ilha.saude, notas: stringNota });
    });

    tesouroGoverno += tGov; tesouroRevo += tRev; tesouroSubmundo += tSub;
    contadorMesGlobal++;
    
    // AQUI VOLTAMOS COM OS CARDS BONITOS NO RELATÓRIO
    const conteudo = document.getElementById("conteudo-relatorio");
    let html = "<div class='grid-repasses'>"; let teve = false;
    for (let lider in repasses) { 
        html += `
        <div class="repasse-card">
            <span class="lider-nome">👤 ${lider}</span>
            <span class="lider-valor">+${formatarDinheiro(repasses[lider])}</span>
        </div>`; 
        teve = true; 
    }
    if (!teve) html += `<div class="repasse-card nulo">Nenhum Player lucrou.</div>`;
    html += "</div>";
    
    conteudo.innerHTML = html; document.getElementById("painel-relatorio").style.display = "block";

    salvarNoBanco(); // <-- SALVA NA NUVEM E A TELA ATUALIZA SOZINHA
}

// === BOTÃO DE RESET PARA A FASE DE TESTES (MODO DEV) ===
function resetarMundoDev() {
    if (!confirm("⚠️ ATENÇÃO ADM! Isso vai apagar todos os históricos, resetar os cofres globais e devolver a saúde de todas as ilhas para 100%. As ilhas NÃO serão deletadas. Deseja resetar a economia?")) return;

    // 1. Reseta o Mundo
    tesouroGoverno = 90000000000000; 
    tesouroRevo = 50000000000;       
    tesouroSubmundo = 200000000000;  
    mercadoCirculante = 1000000000000; 
    contadorMesGlobal = 1;
    logsAuditoria = [];
    historicoDeBackups = [];

    // 2. Reseta o Status das Ilhas
    ilhas.forEach(ilha => {
        ilha.saude = 100;
        ilha.tesouro_nacional = 0;
        ilha.repasse_mensal_atual = 0;
        ilha.historico = [];
        
        // Tira do status de Ilha Fantasma se tiver morrido
        if (ilha.governante === "Nenhum (Ilha Fantasma)") {
            ilha.governante = "Nenhum"; 
        }

        // Reseta os estoques para a produção base
        if (ilha.recursos) {
            ilha.recursos.forEach(rec => {
                rec.estoque_acumulado = rec.producao_mensal;
                rec.estoque_transito = 0;
            });
        }
    });

    // 3. Esconde janelas abertas
    document.getElementById("painel-relatorio").style.display = "none";
    document.getElementById("btn-desfazer-mes").style.display = "none";
    fecharModal('modal-detalhes'); 
    fecharModal('modal-historico'); 
    fecharModal('modal-auditoria');

    // 4. Salva na Nuvem e Atualiza a Tela
    registrarLogAuditoria("RESET DEV", "O mundo foi resetado para os valores iniciais de teste.");
    salvarNoBanco();
    alert("☢️ O Mundo foi resetado com sucesso! Pronto para novos testes.");
}

function verificarTipoRecurso() {
    const tipo = document.getElementById("add-rec-tipo").value;
    const focoSelect = document.getElementById("add-rec-foco");

    if (tipo === "Servico") {
        focoSelect.value = "Local";
        focoSelect.disabled = true; // Desativa o campo
        focoSelect.style.opacity = "0.5";
    } else {
        focoSelect.disabled = false;
        focoSelect.style.opacity = "1";
    }
}

// Chame essa função também dentro da 'abrirFormIlha' para garantir 
// que o campo resete corretamente ao fechar/abrir o modal.
function resetarCamposRecurso() {
    const focoSelect = document.getElementById("add-rec-foco");
    focoSelect.disabled = false;
    focoSelect.style.opacity = "1";
    document.getElementById("add-rec-tipo").value = "Material";
}

// Alterna o texto e a cor do Switch da Caixa Global
function alternarTextoSwitch() {
    const toggle = document.getElementById("tipo-transacao-global-toggle");
    const texto = document.getElementById("texto-transacao");
    
    if (toggle.checked) {
        texto.innerHTML = "💸 Pagar (Cofre ➔ Mercado)";
        texto.style.color = "#58a6ff"; // Azul da Ação
    } else {
        texto.innerHTML = "📥 Confiscar (Mercado ➔ Cofre)";
        texto.style.color = "#f85149"; // Vermelho de Confisco
    }
}