const temasPorBloque = {
    bloque1: ["tema1"]
};

let preguntas = [];
let actual = 0;
let respuestasUsuario = [];
let preguntasFalladas = [];
let modoExamen = false;

function cargarTemas() {
    let bloque = document.getElementById("bloque").value;
    let selectTema = document.getElementById("tema");
    selectTema.innerHTML = "";
    if (!bloque) return;
    let temas = temasPorBloque[bloque];
    temas.forEach(t => {
        let option = document.createElement("option");
        option.value = t;
        option.text = t;
        selectTema.appendChild(option);
    });
}

async function iniciar() {
    let bloque = document.getElementById("bloque").value;
    let tema = document.getElementById("tema").value;
    modoExamen = document.getElementById("modoExamenCheck").checked;

    if (!bloque || !tema) {
        alert("Selecciona bloque y tema");
        return;
    }

    try {
        let res = await fetch(`data/${bloque}/${tema}.json`);
        preguntas = await res.json();
        actual = 0;
        respuestasUsuario = [];
        document.getElementById("resultado").innerHTML = "";
        cargarPregunta();
    } catch (e) {
        alert("Error al cargar el JSON. Revisa la ruta.");
    }
}

function cargarPregunta() {
    let p = preguntas[actual];
    
    // Contador y Barra de progreso
    document.getElementById("contador").innerText = `Pregunta ${actual + 1} / ${preguntas.length}`;
    let porcentaje = ((actual + 1) / preguntas.length) * 100;
    document.getElementById("barra-progreso").style.width = porcentaje + "%";

    document.getElementById("pregunta").innerText = p.pregunta;

    let opcionesContenedor = document.getElementById("opciones");
    opcionesContenedor.innerHTML = "";

    p.opciones.forEach((opcion, i) => {
        let label = document.createElement("label");
        label.id = `op${i}`;
        label.innerHTML = `
            <input type="radio" name="op" id="radio${i}">
            <span>${opcion}</span>
        `;
        label.onclick = () => responder(i);
        opcionesContenedor.appendChild(label);
    });
}

function responder(i) {
    if (respuestasUsuario[actual] !== undefined && !modoExamen) return;
    
    respuestasUsuario[actual] = i;
    document.getElementById(`radio${i}`).checked = true;

    if (modoExamen) return;

    let correcta = preguntas[actual].correcta;
    let opciones = document.querySelectorAll("#opciones label");

    opciones.forEach(op => op.style.pointerEvents = "none");

    if (i === correcta) {
        document.getElementById("op" + i).style.background = "#d4edda";
        document.getElementById("op" + i).style.borderColor = "#28a745";
    } else {
        document.getElementById("op" + i).style.background = "#f8d7da";
        document.getElementById("op" + i).style.borderColor = "#dc3545";
        document.getElementById("op" + correcta).style.background = "#d4edda";
        document.getElementById("op" + correcta).style.borderColor = "#28a745";
    }
}

function siguiente() {
    if (respuestasUsuario[actual] === undefined) {
        respuestasUsuario[actual] = null;
    }
    actual++;
    if (actual >= preguntas.length) {
        mostrarResultado();
    } else {
        cargarPregunta();
    }
}

function mostrarResultado() {
    let aciertos = 0, fallos = 0, blancos = 0;
    preguntasFalladas = [];

    preguntas.forEach((p, i) => {
        if (respuestasUsuario[i] === null) blancos++;
        else if (respuestasUsuario[i] === p.correcta) aciertos++;
        else {
            fallos++;
            preguntasFalladas.push(p);
        }
    });

    let resultadoHTML = `
        <div style="background: white; color: black; padding: 15px; border-radius: 10px;">
            <p>✅ Aciertos: ${aciertos}</p>
            <p>❌ Fallos: ${fallos}</p>
            <p>⚪ En blanco: ${blancos}</p>
        </div>
    `;

    if (preguntasFalladas.length > 0) {
        resultadoHTML += `<button onclick="repetirFalladas()" style="background: #e67e22; color: white; margin-top: 10px;">REPETIR FALLADAS</button>`;
    }

    document.getElementById("resultado").innerHTML = resultadoHTML;
    document.getElementById("opciones").innerHTML = "<h3>Test Finalizado</h3>";
}

function repetirFalladas() {
    preguntas = [...preguntasFalladas];
    actual = 0;
    respuestasUsuario = [];
    document.getElementById("resultado").innerHTML = "";
    cargarPregunta();
}