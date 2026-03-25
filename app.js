// --- CONFIGURACIÓN ---
const URL_NUBE = "https://script.google.com/macros/s/AKfycbw3dTrRxdC0O5Rf3HQfKqUBjhmWEUbTkRlMP0DtRPyS8_BEi9NChS4qM-OhsEqCkUZJWA/exec";
const penalizacionPorError = 0.5; 

const temasPorBloque = {
    bloque1: ["tema1"], 
    bloque2: ["tema1"],
    bloque3: ["tema1"],
    bloque4: ["tema1"]
};

let preguntas = [];
let actual = 0;
let respuestasUsuario = [];
let modoExamen = false;
let infoActual = { bloque: "", tema: "" };

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

    // --- RUTA CORREGIDA ---
    // Añadimos ./ al principio para asegurar que busque en la carpeta local
    const rutaArchivo = `./data/${infoActual.bloque}/${infoActual.tema}.json`;

    try {
        let res = await fetch(rutaArchivo);
        
        if (!res.ok) throw new Error(`No se encontró el archivo en: ${rutaArchivo}`);
        
        preguntas = await res.json();
        actual = 0;
        respuestasUsuario = [];
        document.getElementById("btn-siguiente").style.display = "block";
        cargarPregunta();
    } catch (e) { 
        console.error(e);
        alert("Error al cargar el JSON. Revisa que la carpeta 'data' y 'bloque1' existan en GitHub."); 
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
        await fetch(URL_NUBE, {
            method: "POST",
            mode: 'no-cors',
            body: JSON.stringify(nuevoRegistro)
        });
        
        document.getElementById("opciones").innerHTML = `<h3>Nota Final: ${nota}</h3><p>Guardado con éxito.</p>`;
        cargarHistorialNube(); 
    } catch (e) {
        document.getElementById("opciones").innerHTML = `<h3>Nota: ${nota}</h3><p>Error al guardar en la nube.</p>`;
    }
    
    document.getElementById("btn-siguiente").style.display = "none";
}

async function cargarHistorialNube() {
    const tablaDiv = document.getElementById("tabla-historial");
    if (!tablaDiv) return; // Por si acaso no existe el div en el HTML
    
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