// ================= CONFIGURACIÓN =================
const URL_NUBE = "https://script.google.com/macros/s/AKfycbwiQdty6L7BEG7NTlA-etwIlk-Kk0j4oRt49KbLn4QbsHnm2hBZPU4UFe83YLWltB9oTQ/exec";
const penalizacionPorError = 0.5; 

const temasPorBloque = {
    bloque1: ["tema1","tema2", "tema3","tema4","tema5","tema6","tema7","tema8","tema9"], 
    bloque2: ["tema1","tema2", "tema3","tema4","tema5"],
    bloque3: ["tema1","tema2", "tema3","tema4","tema5","tema6","tema7","tema8","tema9"],
    bloque4: ["tema1","tema2", "tema3","tema4","tema5","tema6","tema7","tema8","tema9"]
};

let preguntas = [];
let actual = 0;
let respuestasUsuario = [];
let modoExamen = false;
let infoActual = { bloque: "", tema: "" };
let historialGlobal = []; 

let temporizador;
let tiempoRestante;
let timeoutSalto; // Controla el salto automático si aciertas

document.addEventListener("DOMContentLoaded", () => {
    cargarHistorialNube();
    aplicarModoLunaGuardado(); 
    actualizarBotonFallos();
    comprobarTestEnCurso();
});

// ================= 🌙 MODO LUNA =================
function alternarModoLuna() {
    const body = document.body;
    const boton = document.getElementById("theme-toggle");
    if (body.classList.contains("light-mode")) {
        body.classList.remove("light-mode"); body.classList.add("dark-mode");
        if (boton) boton.innerText = "☀️"; localStorage.setItem("theme", "dark");
    } else {
        body.classList.remove("dark-mode"); body.classList.add("light-mode");
        if (boton) boton.innerText = "🌙"; localStorage.setItem("theme", "light");
    }
}
function aplicarModoLunaGuardado() {
    const temaGuardado = localStorage.getItem("theme");
    const body = document.body;
    if (temaGuardado === "dark") { body.classList.add("dark-mode"); body.classList.remove("light-mode"); }
}

// ================= 💾 AUTO-GUARDADO =================
function guardarProgresoActual() {
    if (preguntas.length === 0) return;
    const sesion = {
        preguntas: preguntas,
        actual: actual,
        respuestasUsuario: respuestasUsuario,
        infoActual: infoActual,
        tiempoRestante: tiempoRestante,
        modoExamen: modoExamen
    };
    localStorage.setItem("test_en_curso", JSON.stringify(sesion));
}

function comprobarTestEnCurso() {
    const sesionGuardada = localStorage.getItem("test_en_curso");
    if (sesionGuardada) {
        if (confirm("Tienes un test a medias. ¿Quieres continuar?")) {
            const datos = JSON.parse(sesionGuardada);
            preguntas = datos.preguntas;
            actual = datos.actual;
            respuestasUsuario = datos.respuestasUsuario;
            infoActual = datos.infoActual;
            tiempoRestante = datos.tiempoRestante;
            modoExamen = datos.modoExamen;
            document.getElementById("controles-test").style.display = "flex";
            document.getElementById("navegador").style.display = "flex";
            dibujarNavegador();
            iniciarCronometro();
            cargarPregunta(actual);
        } else { localStorage.removeItem("test_en_curso"); }
    }
}

// ================= 📚 TEMAS =================
async function cargarTemas() {
    let bloque = document.getElementById("bloque").value;
    let contenedor = document.getElementById("contenedor-temas");
    if (!bloque) return;
    contenedor.innerHTML = "";
    let html = `<label style="display:flex; align-items:center; margin-bottom:10px;"><input type="checkbox" onchange="marcarTodosTemas(this)" style="margin-right:10px;"><strong>Seleccionar Todos</strong></label>`;
    
    // BLINDAJE: Usamos el ID del bloque tal cual viene del HTML (bloque1, bloque2...)
    temasPorBloque[bloque].forEach(t => {
        html += `<label style="display:flex; align-items:center; justify-content: space-between; margin-bottom:8px; cursor:pointer;">
            <div><input type="checkbox" value="${t}" class="tema-check" style="margin-right:10px;">${t.toUpperCase()}</div>
            <span id="count-${t}" class="badge-conteo" style="background:#3742fa; color:white; padding:2px 8px; border-radius:10px; font-size:0.7rem;">...</span>
        </label>`;
    });
    contenedor.innerHTML = html;

    temasPorBloque[bloque].forEach(async (t) => {
        try {
            const response = await fetch(`./data/${bloque}/${t}.json`);
            const data = await response.json();
            const badge = document.getElementById(`count-${t}`);
            if (badge) badge.innerText = `${data.length} p.`;
        } catch (e) {}
    });
}

function marcarTodosTemas(checkbox) {
    document.querySelectorAll(".tema-check").forEach(c => c.checked = checkbox.checked);
}

// ================= 🚀 INICIAR Y REPETIR =================
async function iniciar() {
    volverAlTest();
    document.getElementById("zona-repaso").style.display = "none";
    const b = document.getElementById("bloque").value; 
    let temasElegidos = Array.from(document.querySelectorAll(".tema-check:checked")).map(c => c.value);
    
    if (!b || temasElegidos.length === 0) return alert("Selecciona bloque y temas.");
    
    let bNombre = b.toUpperCase(); 
    let bID = bNombre.replace("BLOQUE", "B"); 
    let tNombreUnico = temasElegidos.length > 1 ? "VARIOS" : `${bID}-${temasElegidos[0].toUpperCase()}`;
    
    infoActual = { bloque: bNombre, tema: tNombreUnico };
    preguntas = [];

    try {
        for (let t of temasElegidos) {
            const res = await fetch(`./data/${b}/${t}.json`);
            const data = await res.json();
            const dataConDNI = data.map(q => ({...q, temaNombre: `${bID}-${t.toUpperCase()}`}));
            preguntas = preguntas.concat(dataConDNI);
        }

        // --- 🛡️ FILTRO DE PREGUNTAS BLOQUEADAS ---
        const bloqueadas = JSON.parse(localStorage.getItem("preguntas_bloqueadas") || "[]");
        preguntas = preguntas.filter(p => !bloqueadas.includes(p.pregunta));
        // ----------------------------------------

        prepararYArrancarExamen(parseInt(document.getElementById("numPreguntas").value), document.getElementById("tiempoExamen").value || 30);
    } catch (e) { alert("Error al cargar temas del bloque."); }
}

function iniciarTestFallos(temaFiltrado = null) {
    const guardados = JSON.parse(localStorage.getItem("fallos_pendientes") || "[]");
    if (guardados.length === 0) return alert("No hay fallos guardados.");
    volverAlTest();
    document.getElementById("zona-repaso").style.display = "none";
    clearInterval(temporizador);
    if (temaFiltrado) {
        preguntas = guardados.filter(p => p.temaNombre === temaFiltrado);
        infoActual = { bloque: "REPASO", tema: temaFiltrado };
    } else {
        preguntas = guardados;
        infoActual = { bloque: "REPASO", tema: "MIX FALLOS" };
    }
    prepararYArrancarExamen(null, document.getElementById("tiempoExamen").value || 30); 
}

function prepararYArrancarExamen(numLimite, minutos) {
    const contPrincipal = document.getElementById("contenedor-pregunta");
    contPrincipal.innerHTML = `<h3 id="pregunta"></h3><div id="opciones"></div>`;
    if (document.getElementById("modoAleatorioCheck").checked) {
        preguntas = preguntas.sort(() => Math.random() - 0.5); 
    }
    if (numLimite > 0 && numLimite < preguntas.length) preguntas = preguntas.slice(0, numLimite);
    actual = 0;
    respuestasUsuario = new Array(preguntas.length).fill(null); 
    modoExamen = document.getElementById("modoExamenCheck").checked;
    document.getElementById("controles-test").style.display = "flex";
    document.getElementById("navegador").style.display = "flex";
    dibujarNavegador();
    tiempoRestante = minutos * 60;
    iniciarCronometro();
    cargarPregunta(0);
}

// ================= ⏱️ RELOJ Y PREGUNTAS =================
function iniciarCronometro() {
    if (temporizador) clearInterval(temporizador);
    temporizador = setInterval(() => {
        tiempoRestante--;
        let m = Math.floor(tiempoRestante / 60); let s = tiempoRestante % 60;
        let clock = document.getElementById("reloj");
        if(clock) clock.innerText = `⏱️ ${m}:${s < 10 ? '0'+s : s}`;
        if (tiempoRestante % 10 === 0) guardarProgresoActual();
        if (tiempoRestante <= 0) finalizar();
    }, 1000); 
}

function dibujarNavegador() {
    document.getElementById("navegador").innerHTML = preguntas.map((_, i) => `<button id="nav-btn-${i}" class="btn-nav" onclick="cargarPregunta(${i})">${i + 1}</button>`).join("");
}

function cargarPregunta(indice) {
    clearTimeout(timeoutSalto); 
    const exVieja = document.getElementById("explicacion-temporal");
    if (exVieja) exVieja.remove();

    actual = indice; 
    let p = preguntas[actual];

    // Añadimos el botón de papelera al lado del contador
    document.getElementById("contador").innerHTML = `
        Pregunta ${actual + 1} / ${preguntas.length} 
        <span onclick="bloquearPreguntaActual()" style="margin-left:15px; cursor:pointer; opacity:0.6;" title="Marcar como repetida/eliminar">🗑️</span>
    `;

    document.getElementById("barra-progreso").style.width = ((actual + 1) / preguntas.length * 100) + "%";
    document.getElementById("pregunta").innerText = p.pregunta;
    document.getElementById("opciones").innerHTML = p.opciones.map((op, i) => `
        <label id="op${i}" onclick="responder(${i})">
            <input type="radio" name="op" ${respuestasUsuario[actual] === i ? "checked" : ""}>
            <span>${op}</span>
        </label>
    `).join("");

    if (!modoExamen && respuestasUsuario[actual] !== null) {
        document.querySelectorAll("#opciones label").forEach(l => l.style.pointerEvents = "none");
        document.getElementById("op" + p.correcta).classList.add("opcion-correcta");
        if (respuestasUsuario[actual] !== p.correcta) {
            document.getElementById("op" + respuestasUsuario[actual]).classList.add("opcion-erronea");
        }
        mostrarExplicacionDePregunta();
    }
    actualizarNavVisual();
}

function actualizarNavVisual() {
    preguntas.forEach((p, i) => {
        let btn = document.getElementById(`nav-btn-${i}`);
        if(!btn) return;
        btn.className = "btn-nav" + (i === actual ? " actual" : "") + (respuestasUsuario[i] !== null ? (modoExamen ? " examen-respondida" : (respuestasUsuario[i] === p.correcta ? " respondida" : " fallada")) : "");
    });
}

function cambiarPregunta(dir) {
    let nueva = actual + dir;
    if (nueva >= 0 && nueva < preguntas.length) cargarPregunta(nueva);
}

// ================= ✅ ACCIÓN =================
function responder(i) {
    if (!modoExamen && respuestasUsuario[actual] !== null) return;
    
    const esCorrecta = (i === preguntas[actual].correcta);
    respuestasUsuario[actual] = i;
    guardarProgresoActual();
    
    if (modoExamen) { 
        timeoutSalto = setTimeout(() => cambiarPregunta(1), 400); 
        return; 
    }

    cargarPregunta(actual);
    mostrarExplicacionDePregunta();
    
    // MOTOR DE SALTO: Si aciertas, pasa solo. Si fallas, se queda quieto para leer.
    if (esCorrecta) {
        timeoutSalto = setTimeout(() => {
            if (actual < preguntas.length - 1) cambiarPregunta(1);
        }, 4000);
    }
}

function mostrarExplicacionDePregunta() {
    if (document.getElementById("explicacion-temporal")) return;
    let div = document.createElement("div");
    div.id = "explicacion-temporal";
    div.innerHTML = `<div style="margin-top:15px; padding:15px; background:rgba(55,66,250,0.1); border-left:5px solid #3742fa; text-align:left; border-radius:8px;">
        <strong>Explicación:</strong><br>${preguntas[actual].explicacion || "No hay explicación disponible."}
    </div>`;
    document.getElementById("contenedor-pregunta").appendChild(div);
}

function finalizarManual() { if (confirm("¿Entregar examen?")) finalizar(); }

// ================= 🏁 FINALIZAR =================
async function finalizar() {
    clearInterval(temporizador);
    localStorage.removeItem("test_en_curso");
    document.getElementById("controles-test").style.display = "none";
    document.getElementById("navegador").style.display = "none";
    let aciertos = 0, fallos = 0, blancos = 0;
    let actualesFalladas = [];
    
    preguntas.forEach((p, i) => {
        if (respuestasUsuario[i] === null) { blancos++; actualesFalladas.push(p); }
        else if (respuestasUsuario[i] === p.correcta) aciertos++;
        else { fallos++; actualesFalladas.push(p); }
    });
    
    // PERSISTENCIA DE FALLOS (Con DNI Bloque-Tema)
    const viejosFallos = JSON.parse(localStorage.getItem("fallos_pendientes") || "[]");
    const totalFallos = [...viejosFallos, ...actualesFalladas].filter((v,i,a)=>a.findIndex(t=>(t.pregunta===v.pregunta))===i);
    localStorage.setItem("fallos_pendientes", JSON.stringify(totalFallos));
    actualizarBotonFallos();

    let nota = Math.max(0, aciertos - (fallos * penalizacionPorError)).toFixed(2);
    
    // STATS INSTANTÁNEAS: Metemos la nota en memoria local para verla YA
    const registroLocal = [
        new Date().toLocaleDateString(), 
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        infoActual.bloque, 
        infoActual.tema, 
        nota, 
        `✅${aciertos} ❌${fallos} ⚪${blancos}`
    ];
    historialGlobal.push(registroLocal);

    document.getElementById("contenedor-pregunta").innerHTML = `
        <div style="text-align:center; padding: 20px;">
            <h2 style="font-size: 3rem; color: ${nota >= 5 ? '#2ed573' : '#ff4757'};">${nota}</h2>
            <p>✅:${aciertos} | ❌:${fallos} | ⚪:${blancos}</p>
            ${actualesFalladas.length > 0 ? `<button onclick="iniciarRepasoInmediato()" style="background:#ff9f43; color:#2f3542; padding:15px; width:100%; margin-top:20px; font-weight:bold; border-radius:8px; border:none; cursor:pointer;">🔄 REPETIR ESTOS FALLOS AHORA</button>` : ''}
            <button onclick="location.reload()" style="background:#a4b0be; color:white; padding:10px; width:100%; margin-top:10px; border-radius:8px; border:none; cursor:pointer;">Volver al Inicio</button>
        </div>`;

    window.iniciarRepasoInmediato = () => {
        preguntas = actualesFalladas;
        infoActual = { bloque: "REPASO", tema: "REPASO INMEDIATO" };
        prepararYArrancarExamen(null, document.getElementById("tiempoExamen").value || 30);
        document.getElementById("zona-repaso").style.display = "none";
    };

    mostrarRepasoDeExamen();

    try { 
        await fetch(URL_NUBE, { method: "POST", mode: 'no-cors', body: JSON.stringify({
            fecha: registroLocal[0], bloque: registroLocal[2], tema: registroLocal[3], nota: registroLocal[4], detalles: registroLocal[5]
        }) }); 
    } catch (e) { console.error("Error al enviar nota:", e); }
    
    cargarHistorialNube();
}

// ================= 🗑️ LIMPIEZA DE FALLOS =================
function limpiarFallosPorTema(tema) {
    if (confirm(`¿Quieres borrar todos los fallos del tema ${tema}?`)) {
        let guardados = JSON.parse(localStorage.getItem("fallos_pendientes") || "[]");
        let filtrados = guardados.filter(p => p.temaNombre !== tema);
        localStorage.setItem("fallos_pendientes", JSON.stringify(filtrados));
        actualizarBotonFallos();
        renderizarDashboard();
    }
}

function limpiarTodosLosFallos() {
    if (confirm("¿Estás seguro de que quieres borrar TODOS los fallos guardados?")) {
        localStorage.removeItem("fallos_pendientes");
        actualizarBotonFallos();
        renderizarDashboard();
    }
}

function actualizarBotonFallos() {
    const btn = document.getElementById("btn-rescatar-fallos");
    const guardados = JSON.parse(localStorage.getItem("fallos_pendientes") || "[]");
    if (btn) {
        btn.style.display = guardados.length > 0 ? "block" : "none";
        btn.innerText = `🚀 REPASAR ${guardados.length} FALLOS`;
    }
}

function mostrarRepasoDeExamen() {
    let div = document.getElementById("zona-repaso");
    div.style.display = "block";
    div.innerHTML = `<h2 style="margin-bottom: 20px;">🔍 Repaso</h2>` + preguntas.map((p, i) => {
        let miRes = respuestasUsuario[i]; let corr = p.correcta;
        let colorB = miRes === null ? "#a4b0be" : (miRes === corr ? "#2ed573" : "#ff4757");
        return `<div style="border-left: 5px solid ${colorB}; background:var(--panel-bg); padding:15px; margin-bottom:10px; border-radius:8px; text-align:left;">
            <strong>${i+1}. ${p.pregunta}</strong><br><small>Tú: ${miRes !== null ? p.opciones[miRes] : "Blanco"} | Correcta: ${p.opciones[corr]}</small>
        </div>`;
    }).join("");
}

// ================= 📊 DASHBOARD Y FILTROS =================
async function cargarHistorialNube() {
    const tablaDiv = document.getElementById("tabla-historial"); if (!tablaDiv) return; 
    try {
        let res = await fetch(URL_NUBE); historialGlobal = await res.json(); 
        actualizarMiniTabla();
    } catch (e) {}
}

function actualizarMiniTabla() {
    const tablaDiv = document.getElementById("tabla-historial");
    if (!tablaDiv) return;
    let html = `<table class="historial-table"><tr><th>Fecha</th><th>Tema</th><th>Nota</th></tr>`;
    historialGlobal.filter(f => f[0] && f[4]).slice(-5).reverse().forEach(f => {
        html += `<tr><td>${f[0]}</td><td>${f[3]}</td><td style="color:${parseFloat(f[4])>=5?'#2ed573':'#ff4757'}">${f[4]}</td></tr>`;
    });
    tablaDiv.innerHTML = html + "</table><p style='text-align:center; margin-top:10px;'><a href='#' onclick='mostrarDashboard()' style='color:#3742fa;'>Ver todo el progreso →</a></p>";
}

function mostrarDashboard() {
    document.getElementById("zona-test").style.display = "none"; 
    document.getElementById("zona-dashboard").style.display = "block";
    const div = document.getElementById("dashboard-contenido");

    // --- NUEVO: Botón para entrar al Cementerio ---
    let btnCementerio = `<button onclick="mostrarCementerio()" style="width:100%; background:#2f3542; color:white; padding:12px; border-radius:8px; margin-bottom:20px; border:none; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:10px;">
        🪦 GESTIONAR CEMENTERIO (Preguntas Bloqueadas)
    </button>`;

    div.innerHTML = btnCementerio + `
        <div style="background:var(--panel-bg-sec); padding:20px; border-radius:12px; margin-bottom:20px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <div style="flex:1; min-width:150px;">
                <label style="font-size:0.8rem; font-weight:bold;">Filtrar Bloque</label>
                <select id="filtro-bloque" onchange="actualizarFiltrosDashboard()" style="width:100%; padding:8px; border-radius:5px; background:var(--panel-bg); color:var(--text-color);">
                    <option value="TODOS">Todos los Bloques</option>
                    <option value="BLOQUE1">Bloque 1</option><option value="BLOQUE2">Bloque 2</option>
                    <option value="BLOQUE3">Bloque 3</option><option value="BLOQUE4">Bloque 4</option>
                </select>
            </div>
            <div style="flex:1; min-width:150px;">
                <label style="font-size:0.8rem; font-weight:bold;">Filtrar Tema</label>
                <select id="filtro-tema" onchange="renderizarDashboard()" style="width:100%; padding:8px; border-radius:5px; background:var(--panel-bg); color:var(--text-color);">
                    <option value="TODOS">Todos los temas</option>
                </select>
            </div>
        </div>
        <div id="dashboard-lista-fallos"></div>
        <div id="dashboard-lista-stats"></div>
    `;
    actualizarFiltrosDashboard();
}

function actualizarFiltrosDashboard() {
    const selBloque = document.getElementById("filtro-bloque").value; // Ejemplo: BLOQUE3
    const selTema = document.getElementById("filtro-tema");
    selTema.innerHTML = '<option value="TODOS">Todos los temas</option>';
    
    let temasVistos = new Set();
    historialGlobal.forEach(f => {
        if (!f[2] || !f[3]) return;
        let bFila = f[2].toString().toUpperCase().replace(/\s+/g, '');
        if (selBloque === "TODOS" || bFila === selBloque) temasVistos.add(f[3].toString().toUpperCase());
    });

    Array.from(temasVistos).sort().forEach(t => {
        selTema.appendChild(new Option(t, t));
    });
    renderizarDashboard();
}

function renderizarDashboard() {
    const divFallos = document.getElementById("dashboard-lista-fallos");
    const divStats = document.getElementById("dashboard-lista-stats");
    const guardados = JSON.parse(localStorage.getItem("fallos_pendientes") || "[]");
    const fB = document.getElementById("filtro-bloque").value;
    const fT = document.getElementById("filtro-tema").value;

    // --- SECCIÓN FALLOS ---
    let fallosPorTema = {};
    guardados.forEach(f => {
        let bPrefijo = fB !== "TODOS" ? fB.replace("BLOQUE", "B") : "";
        if (bPrefijo && !f.temaNombre.startsWith(bPrefijo)) return;
        fallosPorTema[f.temaNombre] = (fallosPorTema[f.temaNombre] || 0) + 1;
    });

    divFallos.innerHTML = `<div style="background:#ff9f43; padding:20px; border-radius:12px; margin-bottom:25px; color:#2f3542;">
        <h3 style="margin:0 0 15px 0;">🚀 Repasar fallos acumulados</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:10px;">
            ${Object.keys(fallosPorTema).map(tema => `
                <div style="display:flex; gap:5px;">
                    <button onclick="iniciarTestFallos('${tema}')" style="flex:1; background:#2f3542; color:white; border:none; padding:10px; border-radius:5px; cursor:pointer; font-size:0.8rem; text-align:left;">
                        ${tema} (${fallosPorTema[tema]})
                    </button>
                    <button onclick="limpiarFallosPorTema('${tema}')" style="background:rgba(255,255,255,0.2); border:none; padding:10px; border-radius:5px; cursor:pointer; color:#2f3542;">🗑️</button>
                </div>`).join("")}
        </div>
    </div>`;

    // --- SECCIÓN ESTADÍSTICAS ---
    let agrupados = {};
    historialGlobal.forEach(fila => {
        if (!fila[2] || !fila[3]) return;
        let b = fila[2].toString().toUpperCase().replace(/\s+/g, '');
        let t = fila[3].toString().toUpperCase();
        if (fB !== "TODOS" && b !== fB) return;
        if (fT !== "TODOS" && t !== fT) return;
        if (!agrupados[t]) agrupados[t] = { intentos: [] };
        agrupados[t].intentos.push(fila);
    });

    let htmlStats = "";
    for (let t in agrupados) {
        let intentos = agrupados[t].intentos.slice().reverse();
        let media = (intentos.reduce((s, i) => s + parseFloat(i[4] || 0), 0) / intentos.length).toFixed(2);
        htmlStats += `<div style="background:var(--panel-bg); padding:15px; margin-bottom:15px; border-radius:12px; border-left:5px solid #3742fa; box-shadow:0 2px 5px var(--shadow);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <strong>${t}</strong><strong style="color:${media>=5?'#2ed573':'#ff4757'}">Media: ${media}</strong>
            </div>
            <table style="width:100%; font-size:0.85rem;">
                ${intentos.map(i => `<tr><td>${i[0]}</td><td>${i[5] || ""}</td><td style="text-align:right; font-weight:bold;">${i[4]}</td></tr>`).join("")}
            </table>
        </div>`;
    }
    divStats.innerHTML = htmlStats || "<p style='text-align:center;'>No hay datos para este filtro.</p>";
}

function volverAlTest() { 
    document.getElementById("zona-test").style.display = "block"; 
    document.getElementById("zona-dashboard").style.display = "none"; 
}
// ================= 🪦 LÓGICA DEL CEMENTERIO =================

function bloquearPreguntaActual() {
    let p = preguntas[actual];
    if (!p) return;

    if (confirm("¿Enviar esta pregunta al cementerio? No volverá a salir en ningún test por estar repetida o mal.")) {
        let bloqueadas = JSON.parse(localStorage.getItem("preguntas_bloqueadas") || "[]");
        if (!bloqueadas.includes(p.pregunta)) {
            bloqueadas.push(p.pregunta);
            localStorage.setItem("preguntas_bloqueadas", JSON.stringify(bloqueadas));
        }
        
        // La eliminamos del test que estamos haciendo ahora mismo
        preguntas.splice(actual, 1);
        respuestasUsuario.splice(actual, 1);
        
        if (preguntas.length === 0) {
            alert("Has vaciado el test.");
            location.reload();
        } else {
            if (actual >= preguntas.length) actual = preguntas.length - 1;
            dibujarNavegador();
            cargarPregunta(actual);
        }
    }
}

// Lógica para verlas en el Dashboard (opcional)
function mostrarCementerio() {
    const lista = JSON.parse(localStorage.getItem("preguntas_bloqueadas") || "[]");
    const div = document.getElementById("dashboard-contenido");
    
    let html = `<h3>🪦 Preguntas deshabilitadas (${lista.length})</h3>`;
    if (lista.length === 0) {
        html += "<p>No hay preguntas en el cementerio.</p>";
    } else {
        html += lista.map((p, i) => `
            <div style="background:var(--panel-bg); padding:10px; margin-bottom:5px; border-radius:5px; display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; text-align:left;">
                <span style="flex:1; margin-right:10px;">${p}</span>
                <button onclick="resucitarPregunta(${i})" style="background:#2ed573; border:none; color:white; padding:5px; border-radius:3px; cursor:pointer;">Resucitar</button>
            </div>
        `).join("");
        html += `<button onclick="localStorage.removeItem('preguntas_bloqueadas'); mostrarDashboard();" style="width:100%; margin-top:20px; padding:10px; background:#ff4757; color:white; border:none; border-radius:8px;">VACIAR CEMENTERIO</button>`;
    }
    html += `<button onclick="mostrarDashboard()" style="width:100%; margin-top:10px; padding:10px; background:#a4b0be; color:white; border:none; border-radius:8px;">Volver</button>`;
    div.innerHTML = html;
}

function resucitarPregunta(index) {
    let bloqueadas = JSON.parse(localStorage.getItem("preguntas_bloqueadas") || "[]");
    bloqueadas.splice(index, 1);
    localStorage.setItem("preguntas_bloqueadas", JSON.stringify(bloqueadas));
    mostrarCementerio();
}