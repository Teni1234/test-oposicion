// --- CONFIGURACIÓN ---
const URL_NUBE = "https://script.google.com/macros/s/AKfycbwiQdty6L7BEG7NTlA-etwIlk-Kk0j4oRt49KbLn4QbsHnm2hBZPU4UFe83YLWltB9oTQ/exec";
const penalizacionPorError = 0.5; 

const temasPorBloque = {
    bloque1: ["tema1"], // Ve añadiendo aquí tus "tema2", "tema3"...
    bloque2: ["tema1"],
    bloque3: ["tema1"],
    bloque4: ["tema1"]
};

let preguntas = [];
let actual = 0;
let respuestasUsuario = [];
let modoExamen = false;
let infoActual = { bloque: "", tema: "" };
let historialGlobal = []; // <--- GUARDAREMOS LOS DATOS AQUÍ PARA FILTRAR RÁPIDO

document.addEventListener("DOMContentLoaded", cargarHistorialNube);

function cargarTemas() {
    let bloque = document.getElementById("bloque").value;
    let selectTema = document.getElementById("tema");
    selectTema.innerHTML = "";
    if (!bloque) return;
    temasPorBloque[bloque].forEach(t => {
        let option = document.createElement("option");
        option.value = t;
        option.text = t.toUpperCase();
        selectTema.appendChild(option);
    });
}

async function iniciar() {
    volverAlTest();

    const b = document.getElementById("bloque").value;
    const t = document.getElementById("tema").value;
    if (!b || !t) return alert("Selecciona bloque y tema");

    infoActual.bloque = b;
    infoActual.tema = t;
    modoExamen = document.getElementById("modoExamenCheck").checked;

    document.getElementById("opciones").innerHTML = "<p>Cargando preguntas...</p>";

    try {
        const res = await fetch(`./data/${b}/${t}.json`);
        if (!res.ok) throw new Error("No existe el archivo");
        
        preguntas = await res.json(); 
        actual = 0;
        respuestasUsuario = [];
        document.getElementById("btn-siguiente").style.display = "block";
        document.getElementById("resultado").innerHTML = "";
        cargarPregunta();
    } catch (e) {
        document.getElementById("opciones").innerHTML = "";
        alert("ERROR: No se encuentra el archivo JSON o tiene un fallo de sintaxis.");
    }
}

function cargarPregunta() {
    let p = preguntas[actual];
    document.getElementById("contador").innerText = `Pregunta ${actual + 1} / ${preguntas.length}`;
    document.getElementById("barra-progreso").style.width = ((actual + 1) / preguntas.length * 100) + "%";
    document.getElementById("pregunta").innerText = p.pregunta;

    let html = "";
    p.opciones.forEach((op, i) => {
        html += `<label id="op${i}" onclick="responder(${i})"><input type="radio" name="op" id="radio${i}"><span>${op}</span></label>`;
    });
    document.getElementById("opciones").innerHTML = html;
}

function responder(i) {
    if (respuestasUsuario[actual] !== undefined && !modoExamen) return;
    respuestasUsuario[actual] = i;
    document.getElementById(`radio${i}`).checked = true;
    
    if (modoExamen) return;
    
    let correcta = preguntas[actual].correcta;
    document.querySelectorAll("#opciones label").forEach(l => l.style.pointerEvents = "none");
    
    if (i === correcta) {
        document.getElementById("op"+i).style.background = "#d4edda";
    } else {
        document.getElementById("op"+i).style.background = "#f8d7da";
        document.getElementById("op"+correcta).style.background = "#d4edda";
    }
}

function siguiente() {
    if (respuestasUsuario[actual] === undefined) respuestasUsuario[actual] = null;
    actual++;
    if (actual >= preguntas.length) finalizar();
    else cargarPregunta();
}

async function finalizar() {
    let aciertos = 0, fallos = 0;
    preguntas.forEach((p, i) => {
        if (respuestasUsuario[i] === p.correcta) aciertos++;
        else if (respuestasUsuario[i] !== null) fallos++;
    });

    let nota = (aciertos - (fallos * penalizacionPorError)).toFixed(2);
    if (parseFloat(nota) < 0) nota = "0.00";

    const registro = {
        fecha: new Date().toLocaleDateString(),
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        bloque: infoActual.bloque.toUpperCase(),
        tema: infoActual.tema.toUpperCase(),
        nota: nota,
        detalles: `✅${aciertos} ❌${fallos}`
    };

    document.getElementById("opciones").innerHTML = `<div style="text-align:center; padding: 20px;">
        <h2 style="font-size: 3rem; color: ${nota >= 5 ? '#2ed573' : '#ff4757'};">${nota}</h2>
        <p>Guardando en tu historial... ☁️</p>
    </div>`;
    document.getElementById("btn-siguiente").style.display = "none";

    try {
        await fetch(URL_NUBE, {
            method: "POST",
            mode: 'no-cors',
            body: JSON.stringify(registro)
        });
        document.getElementById("opciones").innerHTML = `<div style="text-align:center; padding: 20px;">
            <h2 style="font-size: 3rem; color: ${nota >= 5 ? '#2ed573' : '#ff4757'};">${nota}</h2>
            <p style="color: #57606f;">¡Nota guardada en la nube! ✅</p>
        </div>`;
    } catch (e) {}

    cargarHistorialNube();
}

// --- FUNCIONES DE HISTORIAL Y DASHBOARD CON FILTROS ---

async function cargarHistorialNube() {
    const tablaDiv = document.getElementById("tabla-historial");
    if (!tablaDiv) return; 
    
    try {
        let res = await fetch(URL_NUBE);
        historialGlobal = await res.json(); // Lo guardamos globalmente
        
        if (!historialGlobal || historialGlobal.length === 0) {
            tablaDiv.innerHTML = "<p style='color:#a4b0be;'>No hay tests registrados.</p>";
            return;
        }

        let html = `<table class="historial-table">
            <tr><th>Fecha</th><th>Tema</th><th>Nota</th></tr>`;
        
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
    } catch (e) {
        tablaDiv.innerHTML = "<p>No se pudo conectar con el historial.</p>";
    }
}

function mostrarDashboard() {
    document.getElementById("zona-test").style.display = "none";
    document.getElementById("zona-dashboard").style.display = "block";
    
    // Si no tenemos datos (por error o internet lento), los bajamos otra vez
    if (historialGlobal.length === 0) {
        cargarHistorialNube().then(() => actualizarFiltrosDashboard());
    } else {
        actualizarFiltrosDashboard();
    }
}

function volverAlTest() {
    document.getElementById("zona-test").style.display = "block";
    document.getElementById("zona-dashboard").style.display = "none";
}

// 🔹 Actualiza el segundo desplegable (Temas) según el Bloque elegido
function actualizarFiltrosDashboard() {
    const bloqueSelec = document.getElementById("filtro-bloque").value; // Ej: BLOQUE1
    const selectTema = document.getElementById("filtro-tema");
    
    selectTema.innerHTML = '<option value="TODOS">Todos los temas</option>';

    if (bloqueSelec !== "TODOS") {
        let bloqueId = bloqueSelec.toLowerCase(); // Convertimos a "bloque1"
        if(temasPorBloque[bloqueId]) {
            temasPorBloque[bloqueId].forEach(t => {
                let option = document.createElement("option");
                option.value = t.toUpperCase();
                option.text = t.toUpperCase();
                selectTema.appendChild(option);
            });
        }
    }
    
    renderizarDashboard(); // Pintar resultados
}

// 🔹 Filtra y pinta las tarjetas
function renderizarDashboard() {
    const div = document.getElementById("dashboard-contenido");
    const filtroBloque = document.getElementById("filtro-bloque").value;
    const filtroTema = document.getElementById("filtro-tema").value;

    let temasAgrupados = {};

    historialGlobal.forEach(fila => {
        let bloque = fila[2].toUpperCase(); 
        let tema = fila[3].toUpperCase();   

        // Aplicamos los filtros
        if (filtroBloque !== "TODOS" && bloque !== filtroBloque) return;
        if (filtroTema !== "TODOS" && tema !== filtroTema) return;

        if (!temasAgrupados[tema]) {
            temasAgrupados[tema] = { bloque: bloque, intentos: [] };
        }
        temasAgrupados[tema].intentos.push(fila);
    });

    let html = "";
    let hayDatos = Object.keys(temasAgrupados).length;

    if (hayDatos === 0) {
        div.innerHTML = "<div style='text-align:center; padding:30px; color:#a4b0be;'>No hay tests realizados para este filtro.</div>";
        return;
    }

    for (let tema in temasAgrupados) {
        let infoTema = temasAgrupados[tema];
        let arrayIntentos = infoTema.intentos.reverse();
        
        let sumaNotas = 0;
        arrayIntentos.forEach(intento => sumaNotas += parseFloat(intento[4]));
        let notaMedia = (sumaNotas / arrayIntentos.length).toFixed(2);
        let colorMedia = notaMedia >= 5 ? "#2ed573" : "#ff4757";

        html += `
        <div style="background: white; border-radius: 12px; padding: 25px; margin-bottom: 25px; box-shadow: 0 5px 15px rgba(0,0,0,0.05); border-left: 5px solid #3742fa;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f2f6; padding-bottom: 15px; margin-bottom: 20px;">
                <div>
                    <span style="font-size: 0.8rem; color: #a4b0be; text-transform: uppercase; letter-spacing: 1px;">${infoTema.bloque}</span>
                    <h3 style="color: #2f3542; margin: 5px 0 0 0; font-size: 1.4rem;">${tema}</h3>
                </div>
                <div style="text-align: right;">
                    <span style="font-size: 0.8rem; color: #a4b0be; display:block;">Nota Media</span>
                    <strong style="font-size: 1.8rem; color: ${colorMedia};">${notaMedia}</strong>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 0.95rem; text-align: left;">
                <tr style="color: #747d8c;">
                    <th style="padding-bottom: 10px; border-bottom: 1px solid #dfe4ea;">Fecha</th>
                    <th style="padding-bottom: 10px; border-bottom: 1px solid #dfe4ea;">Resultado</th>
                    <th style="padding-bottom: 10px; border-bottom: 1px solid #dfe4ea;">Nota</th>
                </tr>
        `;

        arrayIntentos.forEach(intento => {
            let nota = parseFloat(intento[4]);
            let colorNota = nota >= 5 ? "#2ed573" : "#ff4757";
            html += `
                <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #f1f2f6; color: #57606f;">${intento[0]} <span style="color:#a4b0be; font-size:0.8rem; margin-left:5px;">${intento[1]}</span></td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #f1f2f6; color: #57606f;">${intento[5]}</td>
                    <td style="padding: 12px 0; border-bottom: 1px solid #f1f2f6; font-weight: bold; color: ${colorNota}; font-size: 1.1rem;">${intento[4]}</td>
                </tr>
            `;
        });
        html += `</table></div>`;
    }
    div.innerHTML = html;
}