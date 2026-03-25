// --- CONFIGURACIÓN ---
const URL_NUBE = "https://script.google.com/macros/s/AKfycbwiQdty6L7BEG7NTlA-etwIlk-Kk0j4oRt49KbLn4QbsHnm2hBZPU4UFe83YLWltB9oTQ/exec";
const penalizacionPorError = 0.5; 

// Añade aquí los temas que tengas
const temasPorBloque = {
    bloque1: ["tema1", "tema2", "tema3"], // He añadido varios como ejemplo
    bloque2: ["tema1"],
    bloque3: ["tema1"],
    bloque4: ["tema1"]
};

let preguntas = [];
let actual = 0;
let respuestasUsuario = [];
let modoExamen = false;
let infoActual = { bloque: "", tema: "" };
let historialGlobal = []; 
let preguntasFalladasParaRepaso = []; // Para el botón de "Repetir Fallos"

// Variables del Cronómetro
let temporizador;
let tiempoRestante;

document.addEventListener("DOMContentLoaded", () => {
    cargarHistorialNube();
    aplicarModoLunaGuardado(); 
});

// ================= 🌙 MODO LUNA =================
function alternarModoLuna() {
    const body = document.body;
    const boton = document.getElementById("theme-toggle");
    if (body.classList.contains("light-mode")) {
        body.classList.remove("light-mode"); body.classList.add("dark-mode");
        boton.innerText = "☀️"; localStorage.setItem("theme", "dark");
    } else {
        body.classList.remove("dark-mode"); body.classList.add("light-mode");
        boton.innerText = "🌙"; localStorage.setItem("theme", "light");
    }
}
function aplicarModoLunaGuardado() {
    const temaGuardado = localStorage.getItem("theme");
    const body = document.body; const boton = document.getElementById("theme-toggle");
    if (temaGuardado === "dark") { body.classList.remove("light-mode"); body.classList.add("dark-mode"); if (boton) boton.innerText = "☀️"; } 
    else { body.classList.remove("dark-mode"); body.classList.add("light-mode"); if (boton) boton.innerText = "🌙"; }
}

// ================= 📚 CARGA DE TEMAS MÚLTIPLES =================
function cargarTemas() {
    let bloque = document.getElementById("bloque").value;
    let contenedor = document.getElementById("contenedor-temas");
    contenedor.innerHTML = "";
    if (!bloque) {
        contenedor.innerHTML = '<p style="font-size: 0.9rem;">Selecciona un bloque primero</p>';
        return;
    }

    // Checkbox para seleccionar TODOS
    let html = `<label style="display:flex; align-items:center; margin-bottom:10px; border-bottom:1px solid var(--sidebar-border); padding-bottom:10px; cursor:pointer;">
        <input type="checkbox" id="check-todos" onchange="marcarTodosTemas(this)" style="margin-right:10px; width:18px; height:18px; accent-color:#3742fa;">
        <strong style="color: var(--sidebar-text);">Seleccionar Todos</strong>
    </label>`;

    temasPorBloque[bloque].forEach(t => {
        html += `<label style="display:flex; align-items:center; margin-bottom:8px; cursor:pointer; color: var(--sidebar-text-sec);">
            <input type="checkbox" value="${t}" class="tema-check" style="margin-right:10px; width:16px; height:16px; accent-color:#3742fa;"> 
            ${t.toUpperCase()}
        </label>`;
    });
    contenedor.innerHTML = html;
}

function marcarTodosTemas(checkboxPrincipal) {
    let checks = document.querySelectorAll(".tema-check");
    checks.forEach(c => c.checked = checkboxPrincipal.checked);
}

function barajarArray(array) {
    let copia = [...array];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}

// ================= 🚀 INICIAR TEST NORMAL =================
async function iniciar() {
    volverAlTest();
    document.getElementById("zona-repaso").style.display = "none";
    document.getElementById("zona-repaso").innerHTML = "";

    const b = document.getElementById("bloque").value;
    
    // Buscar qué temas están marcados
    let checks = document.querySelectorAll(".tema-check:checked");
    let temasElegidos = Array.from(checks).map(c => c.value);

    if (!b || temasElegidos.length === 0) return alert("Selecciona un bloque y al menos UN tema.");

    // Nombre para el Excel
    infoActual.bloque = b;
    infoActual.tema = temasElegidos.length > 1 ? `VARIOS (${temasElegidos.length})` : temasElegidos[0];
    
    modoExamen = document.getElementById("modoExamenCheck").checked;
    let minutosInput = document.getElementById("tiempoExamen").value || 30;
    let numPreguntasDeseado = parseInt(document.getElementById("numPreguntas").value);

    document.getElementById("opciones").innerHTML = "<p>Descargando temas... 📚</p>";
    clearInterval(temporizador);

    try {
        // Descargar todos los JSON de los temas elegidos a la vez
        let promesas = temasElegidos.map(t => fetch(`./data/${b}/${t}.json`).then(r => r.ok ? r.json() : []));
        let arraysDePreguntas = await Promise.all(promesas);
        
        // Juntar todos los arrays en uno solo
        preguntas = arraysDePreguntas.flat();

        if (preguntas.length === 0) throw new Error("No hay preguntas en los archivos.");

        prepararYArrancarExamen(numPreguntasDeseado, minutosInput);
    } catch (e) {
        document.getElementById("opciones").innerHTML = "";
        alert("ERROR: No se han encontrado los archivos de esos temas o están vacíos.");
    }
}

// ================= 🔄 REPETIR SOLO FALLOS =================
function iniciarTestFallos() {
    if (preguntasFalladasParaRepaso.length === 0) return;
    
    volverAlTest();
    document.getElementById("zona-repaso").style.display = "none";
    document.getElementById("zona-repaso").innerHTML = "";
    clearInterval(temporizador);

    infoActual.tema = infoActual.tema + " (REPASO)";
    
    // Clonamos las falladas para no estropearlas
    preguntas = JSON.parse(JSON.stringify(preguntasFalladasParaRepaso));
    
    let minutosInput = document.getElementById("tiempoExamen").value || 30;
    prepararYArrancarExamen(null, minutosInput); // null para que no recorte preguntas en el repaso
}

// Lógica compartida para arrancar el test después de tener el array
function prepararYArrancarExamen(numLimite, minutos) {
    // 1. ¿Mezclar?
    if (document.getElementById("modoAleatorioCheck").checked) {
        preguntas = barajarArray(preguntas); 
        preguntas.forEach(p => {
            let textoCorrecta = p.opciones[p.correcta];
            p.opciones = barajarArray(p.opciones);
            p.correcta = p.opciones.indexOf(textoCorrecta); 
        });
    }

    // 2. ¿Recortar número de preguntas?
    if (numLimite > 0 && numLimite < preguntas.length) {
        preguntas = preguntas.slice(0, numLimite);
    }

    actual = 0;
    respuestasUsuario = new Array(preguntas.length).fill(null); 
    preguntasFalladasParaRepaso = []; // Vaciamos para el nuevo test
    
    document.getElementById("controles-test").style.display = "flex";
    document.getElementById("navegador").style.display = "flex";
    document.getElementById("resultado").innerHTML = "";
    
    dibujarNavegador();
    tiempoRestante = minutos * 60;
    iniciarCronometro();
    cargarPregunta(0);
}

// ================= ⏱️ CRONÓMETRO Y NAVEGACIÓN =================
function iniciarCronometro() {
    actualizarPantallaReloj();
    temporizador = setInterval(() => {
        tiempoRestante--;
        actualizarPantallaReloj();
        if (tiempoRestante <= 0) {
            clearInterval(temporizador);
            alert("¡TIEMPO AGOTADO! Se entregará el examen automáticamente.");
            finalizar();
        }
    }, 1000); 
}

function actualizarPantallaReloj() {
    let relojEl = document.getElementById("reloj");
    if (!relojEl) return;
    let m = Math.floor(tiempoRestante / 60); let s = tiempoRestante % 60;
    relojEl.innerText = `⏱️ ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    if (tiempoRestante <= 60 && tiempoRestante > 0) {
        relojEl.style.color = "white"; relojEl.style.background = "#ff4757"; 
    } else {
        relojEl.style.color = "var(--text-color)"; relojEl.style.background = "var(--panel-bg-sec)"; 
    }
}

function dibujarNavegador() {
    let nav = document.getElementById("navegador"); let html = "";
    for (let i = 0; i < preguntas.length; i++) {
        html += `<button id="nav-btn-${i}" class="btn-nav" onclick="cargarPregunta(${i})">${i + 1}</button>`;
    }
    nav.innerHTML = html;
}

function actualizarNavegadorVisual() {
    for (let i = 0; i < preguntas.length; i++) {
        let btn = document.getElementById(`nav-btn-${i}`);
        btn.className = "btn-nav"; 
        if (i === actual) btn.classList.add("actual"); 
        if (respuestasUsuario[i] !== null) {
            if (modoExamen) btn.classList.add("examen-respondida"); 
            else {
                if (respuestasUsuario[i] === preguntas[i].correcta) btn.classList.add("respondida");
                else btn.classList.add("fallada");
            }
        }
    }
}

function cambiarPregunta(direccion) {
    let nueva = actual + direccion;
    if (nueva >= 0 && nueva < preguntas.length) cargarPregunta(nueva);
}

function cargarPregunta(indice) {
    actual = indice; let p = preguntas[actual];
    document.getElementById("contador").innerText = `Pregunta ${actual + 1} / ${preguntas.length}`;
    document.getElementById("barra-progreso").style.width = ((actual + 1) / preguntas.length * 100) + "%";
    document.getElementById("pregunta").innerText = p.pregunta;

    let html = ""; let respondidaPreviamente = (respuestasUsuario[actual] !== null);
    
    p.opciones.forEach((op, i) => {
        let checked = (respuestasUsuario[actual] === i) ? "checked" : "";
        html += `<label id="op${i}" onclick="responder(${i})"><input type="radio" name="op" id="radio${i}" ${checked}><span>${op}</span></label>`;
    });
    
    document.getElementById("opciones").innerHTML = html;
    
    if (!modoExamen && respondidaPreviamente) {
        document.querySelectorAll("#opciones label").forEach(l => l.style.pointerEvents = "none");
        let correcta = p.correcta;
        if (respuestasUsuario[actual] === correcta) { document.getElementById("op"+correcta).style.background = "#d4edda"; } 
        else {
            document.getElementById("op"+respuestasUsuario[actual]).style.background = "#f8d7da";
            document.getElementById("op"+correcta).style.background = "#d4edda";
        }
    }
    actualizarNavegadorVisual();
}

function responder(i) {
    if (!modoExamen && respuestasUsuario[actual] !== null) return;
    respuestasUsuario[actual] = i;
    document.getElementById(`radio${i}`).checked = true;
    
    if (modoExamen) {
        actualizarNavegadorVisual();
        setTimeout(() => { if (actual < preguntas.length - 1) cambiarPregunta(1); }, 400);
        return; 
    }
    
    let correcta = preguntas[actual].correcta;
    document.querySelectorAll("#opciones label").forEach(l => l.style.pointerEvents = "none");
    if (i === correcta) document.getElementById("op"+i).style.background = "#d4edda";
    else { document.getElementById("op"+i).style.background = "#f8d7da"; document.getElementById("op"+correcta).style.background = "#d4edda"; }
    actualizarNavegadorVisual();
    setTimeout(() => { if (actual < preguntas.length - 1) cambiarPregunta(1); }, 1200);
}

function finalizarManual() {
    let sinResponder = respuestasUsuario.filter(r => r === null).length;
    let mensaje = sinResponder > 0 ? `Tienes ${sinResponder} preguntas sin responder. ¿Seguro que quieres entregar?` : "¿Seguro que quieres entregar el examen?";
    if (confirm(mensaje)) finalizar();
}

// ================= 🏁 FINALIZAR EXAMEN =================
async function finalizar() {
    clearInterval(temporizador);
    document.getElementById("controles-test").style.display = "none";
    document.getElementById("navegador").style.display = "none";
    
    let aciertos = 0, fallos = 0, blancos = 0;
    preguntasFalladasParaRepaso = []; // Guardaremos las que están mal o en blanco
    
    preguntas.forEach((p, i) => {
        if (respuestasUsuario[i] === null) { blancos++; preguntasFalladasParaRepaso.push(p); }
        else if (respuestasUsuario[i] === p.correcta) { aciertos++; }
        else { fallos++; preguntasFalladasParaRepaso.push(p); }
    });

    let nota = (aciertos - (fallos * penalizacionPorError)).toFixed(2);
    if (parseFloat(nota) < 0) nota = "0.00";

    const registro = {
        fecha: new Date().toLocaleDateString(),
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        bloque: infoActual.bloque.toUpperCase(),
        tema: infoActual.tema.toUpperCase(),
        nota: nota,
        detalles: `✅${aciertos} ❌${fallos} ⚪${blancos}`
    };

    let botonRepasoHTML = "";
    if (preguntasFalladasParaRepaso.length > 0) {
        botonRepasoHTML = `<button onclick="iniciarTestFallos()" style="background: #ff9f43; color: #2f3542; padding: 15px 30px; font-weight: bold; width: 100%; margin-top: 20px; font-size: 1.2rem; border-radius: 8px;">🔄 Repetir solo fallos y blancos (${preguntasFalladasParaRepaso.length})</button>`;
    }

    document.getElementById("contenedor-pregunta").innerHTML = `<div style="text-align:center; padding: 20px;">
        <h2 style="font-size: 3rem; color: ${nota >= 5 ? '#2ed573' : '#ff4757'};">${nota}</h2>
        <p style="color:var(--text-color);">Aciertos: ${aciertos} | Fallos: ${fallos} | Blancos: ${blancos}</p>
        <p style="color:var(--text-color-sec); margin-top:10px;">Guardando en tu historial... ☁️</p>
        ${botonRepasoHTML}
    </div>`;

    mostrarRepasoDeExamen();

    try {
        await fetch(URL_NUBE, { method: "POST", mode: 'no-cors', body: JSON.stringify(registro) });
        document.getElementById("contenedor-pregunta").innerHTML = `<div style="text-align:center; padding: 20px;">
            <h2 style="font-size: 3rem; color: ${nota >= 5 ? '#2ed573' : '#ff4757'};">${nota}</h2>
            <p style="color:var(--text-color);">Aciertos: ${aciertos} | Fallos: ${fallos} | Blancos: ${blancos}</p>
            <p style="color: #2ed573; font-weight:bold; margin-top:10px;">¡Nota guardada en la nube! ✅</p>
            ${botonRepasoHTML}
        </div>`;
    } catch (e) {}

    cargarHistorialNube();
}

function mostrarRepasoDeExamen() {
    let divRepaso = document.getElementById("zona-repaso");
    divRepaso.style.display = "block";
    let html = `<h2 style="color: var(--text-color); margin-bottom: 20px;">🔍 Repaso del Examen</h2>`;
    
    preguntas.forEach((p, i) => {
        let respuestaMia = respuestasUsuario[i]; let correcta = p.correcta;
        let claseCaja = "blanco"; let icono = "⚪ Sin responder"; let textoRespuestaMia = "Dejada en blanco";
        
        if (respuestaMia !== null) {
            textoRespuestaMia = p.opciones[respuestaMia];
            if (respuestaMia === correcta) { claseCaja = "acierto"; icono = "✅ Acierto"; } 
            else { claseCaja = "fallo"; icono = "❌ Fallo"; }
        }
        
        html += `<div class="caja-repaso ${claseCaja}">
            <div style="font-weight:bold; margin-bottom:8px; color:var(--text-color);">${i + 1}. ${p.pregunta}</div>
            <div style="font-size:0.9rem; margin-bottom:4px; color:var(--text-color-sec);"><strong>Tú respondiste:</strong> ${textoRespuestaMia}</div>
            ${respuestaMia !== correcta ? `<div style="font-size:0.9rem; color:#2ed573;"><strong>Respuesta correcta:</strong> ${p.opciones[correcta]}</div>` : ''}
            <div style="margin-top:8px; font-size:0.8rem; font-weight:bold; float:right;">${icono}</div>
            <div style="clear:both;"></div>
        </div>`;
    });
    divRepaso.innerHTML = html;
}

// --- HISTORIAL Y DASHBOARD (Sin cambios) ---
async function cargarHistorialNube() {
    const tablaDiv = document.getElementById("tabla-historial"); if (!tablaDiv) return; 
    try {
        let res = await fetch(URL_NUBE); historialGlobal = await res.json(); 
        if (!historialGlobal || historialGlobal.length === 0) { tablaDiv.innerHTML = "<p style='color:#a4b0be;'>No hay tests registrados.</p>"; return; }
        let html = `<table class="historial-table"><tr><th>Fecha</th><th>Tema</th><th>Nota</th></tr>`;
        let ultimos = historialGlobal.slice(-5).reverse();
        ultimos.forEach(fila => {
            let claseNota = parseFloat(fila[4]) >= 5 ? "nota-pass" : "nota-fail";
            html += `<tr>
                <td>${fila[0]} <small>${fila[1]}</small></td>
                <td><strong>${fila[3]}</strong></td>
                <td class="${claseNota}">${fila[4]}</td>
            </tr>`;
        });
        html += "</table><p style='text-align:center; margin-top:10px;'><a href='#' onclick='mostrarDashboard()' style='color:#3742fa; text-decoration:none;'>Ver todo el progreso agrupado →</a></p>";
        tablaDiv.innerHTML = html;
    } catch (e) { tablaDiv.innerHTML = "<p>No se pudo conectar con el historial.</p>"; }
}

function mostrarDashboard() {
    clearInterval(temporizador);
    document.getElementById("zona-test").style.display = "none"; document.getElementById("zona-dashboard").style.display = "block";
    if (historialGlobal.length === 0) cargarHistorialNube().then(() => actualizarFiltrosDashboard());
    else actualizarFiltrosDashboard();
}

function volverAlTest() { document.getElementById("zona-test").style.display = "block"; document.getElementById("zona-dashboard").style.display = "none"; }

function actualizarFiltrosDashboard() {
    const bloqueSelec = document.getElementById("filtro-bloque").value; const selectTema = document.getElementById("filtro-tema");
    selectTema.innerHTML = '<option value="TODOS">Todos los temas</option>';
    if (bloqueSelec !== "TODOS") {
        let bloqueId = bloqueSelec.toLowerCase(); 
        if(temasPorBloque[bloqueId]) {
            temasPorBloque[bloqueId].forEach(t => { let option = document.createElement("option"); option.value = t.toUpperCase(); option.text = t.toUpperCase(); selectTema.appendChild(option); });
        }
    }
    renderizarDashboard(); 
}

function renderizarDashboard() {
    const div = document.getElementById("dashboard-contenido"); const filtroBloque = document.getElementById("filtro-bloque").value; const filtroTema = document.getElementById("filtro-tema").value;
    let temasAgrupados = {};
    historialGlobal.forEach(fila => {
        let bloque = fila[2].toUpperCase(); let tema = fila[3].toUpperCase();   
        if (filtroBloque !== "TODOS" && bloque !== filtroBloque) return;
        if (filtroTema !== "TODOS" && tema !== filtroTema) return;
        if (!temasAgrupados[tema]) temasAgrupados[tema] = { bloque: bloque, intentos: [] };
        temasAgrupados[tema].intentos.push(fila);
    });
    let html = ""; let hayDatos = Object.keys(temasAgrupados).length;
    if (hayDatos === 0) { div.innerHTML = "<div style='text-align:center; padding:30px; color:#a4b0be;'>No hay tests realizados para este filtro.</div>"; return; }
    for (let tema in temasAgrupados) {
        let infoTema = temasAgrupados[tema]; let arrayIntentos = infoTema.intentos.reverse();
        let sumaNotas = 0; arrayIntentos.forEach(intento => sumaNotas += parseFloat(intento[4])); let notaMedia = (sumaNotas / arrayIntentos.length).toFixed(2);
        let colorMedia = notaMedia >= 5 ? "#2ed573" : "#ff4757";
        html += `
        <div style="background: var(--panel-bg); border-radius: 12px; padding: 25px; margin-bottom: 25px; box-shadow: 0 5px 15px var(--shadow); border-left: 5px solid #3742fa;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color); padding-bottom: 15px; margin-bottom: 20px;">
                <div><span style="font-size: 0.8rem; color: var(--text-color-sec); text-transform: uppercase; letter-spacing: 1px;">${infoTema.bloque}</span><h3 style="color: var(--text-color); margin: 5px 0 0 0; font-size: 1.4rem;">${tema}</h3></div>
                <div style="text-align: right;"><span style="font-size: 0.8rem; color: var(--text-color-sec); display:block;">Nota Media</span><strong style="font-size: 1.8rem; color: ${colorMedia};">${notaMedia}</strong></div>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem; text-align: left;">
                <tr style="color: var(--text-color-sec);"><th style="padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">Fecha</th><th style="padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">Resultado</th><th style="padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">Nota</th></tr>
        `;
        arrayIntentos.forEach(intento => {
            let colorNota = parseFloat(intento[4]) >= 5 ? "#2ed573" : "#ff4757";
            html += `<tr>
                <td style="padding: 12px 0; border-bottom: 1px solid var(--border-color); color: var(--text-color-sec);">${intento[0]} <span style="color:#a4b0be; font-size:0.8rem; margin-left:5px;">${intento[1]}</span></td>
                <td style="padding: 12px 0; border-bottom: 1px solid var(--border-color); color: var(--text-color-sec);">${intento[5]}</td>
                <td style="padding: 12px 0; border-bottom: 1px solid var(--border-color); font-weight: bold; color: ${colorNota}; font-size: 1.1rem;">${intento[4]}</td>
            </tr>`;
        });
        html += `</table></div>`;
    }
    div.innerHTML = html;
}