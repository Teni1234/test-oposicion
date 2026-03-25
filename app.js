// --- CONFIGURACIÓN ---
const URL_NUBE = "https://script.google.com/macros/s/AKfycbw3dTrRxdC0O5Rf3HQfKqUBjhmWEUbTkRlMP0DtRPyS8_BEi9NChS4qM-OhsEqCkUZJWA/exec";
const penalizacionPorError = 0.5; // Modo Academia Dura

const temasPorBloque = {
    bloque1: ["tema1"], // Añade aquí tus temas (ej: "tema1", "tema2")
    bloque2: ["tema1"],
    bloque3: ["tema1"],
    bloque4: ["tema1"]
};

let preguntas = [];
let actual = 0;
let respuestasUsuario = [];
let modoExamen = false;
let infoActual = { bloque: "", tema: "" };

// 🔹 Al cargar la web, traemos los datos de la nube (Google Sheets)
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
    infoActual.bloque = document.getElementById("bloque").value;
    infoActual.tema = document.getElementById("tema").value;
    modoExamen = document.getElementById("modoExamenCheck").checked;

    if (!infoActual.bloque || !infoActual.tema) return alert("Selecciona bloque y tema");

    try {
        let res = await fetch(`data/${infoActual.bloque}/${infoActual.tema}.json`);
        preguntas = await res.json();
        actual = 0;
        respuestasUsuario = [];
        document.getElementById("btn-siguiente").style.display = "block";
        cargarPregunta();
    } catch (e) { alert("Error al cargar el JSON"); }
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

// 🔹 FINALIZAR Y ENVIAR A LA NUBE
async function finalizar() {
    let aciertos = 0, fallos = 0;
    preguntas.forEach((p, i) => {
        if (respuestasUsuario[i] === p.correcta) aciertos++;
        else if (respuestasUsuario[i] !== null) fallos++;
    });

    let nota = (aciertos - (fallos * penalizacionPorError)).toFixed(2);
    if (nota < 0) nota = "0.00";

    let fecha = new Date();
    let nuevoRegistro = {
        fecha: fecha.toLocaleDateString(),
        hora: fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        bloque: infoActual.bloque.toUpperCase(),
        tema: infoActual.tema.toUpperCase(),
        nota: nota,
        detalles: `✅${aciertos} ❌${fallos}`
    };

    document.getElementById("opciones").innerHTML = "<h3>Guardando en la nube... ☁️</h3>";
    
    try {
        // Enviamos al Excel de Google
        await fetch(URL_NUBE, {
            method: "POST",
            mode: 'no-cors', // Importante para Google Apps Script
            body: JSON.stringify(nuevoRegistro)
        });
        
        document.getElementById("opciones").innerHTML = `<h3>Nota Final: ${nota}</h3><p>Guardado con éxito.</p>`;
        cargarHistorialNube(); // Refrescamos la tabla
    } catch (e) {
        document.getElementById("opciones").innerHTML = `<h3>Nota: ${nota}</h3><p>Error al guardar en la nube.</p>`;
    }
    
    document.getElementById("btn-siguiente").style.display = "none";
}

// 🔹 LEER DE LA NUBE
async function cargarHistorialNube() {
    const tablaDiv = document.getElementById("tabla-historial");
    tablaDiv.innerHTML = "<p>Cargando historial compartido...</p>";
    
    try {
        let res = await fetch(URL_NUBE);
        let datos = await res.json();
        
        if (!datos || datos.length === 0) {
            tablaDiv.innerHTML = "<p>No hay historial todavía.</p>";
            return;
        }

        let html = `<table class="historial-table">
            <tr><th>Fecha</th><th>Tema</th><th>Nota</th><th>Detalles</th></tr>`;
        
        // El Excel devuelve las filas, las ponemos al revés (más nuevo arriba)
        datos.reverse().forEach(fila => {
            let claseNota = parseFloat(fila[4]) >= 5 ? "nota-pass" : "nota-fail";
            html += `<tr>
                <td>${fila[0]} <small>${fila[1]}</small></td>
                <td><small>${fila[2]}</small><br><strong>${fila[3]}</strong></td>
                <td class="${claseNota}">${fila[4]}</td>
                <td>${fila[5]}</td>
            </tr>`;
        });
        html += "</table>";
        tablaDiv.innerHTML = html;
    } catch (e) {
        tablaDiv.innerHTML = "<p>Error al sincronizar historial.</p>";
    }
}