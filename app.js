const temasPorBloque = {
  bloque1: ["tema1"]
};

let preguntas = [];
let actual = 0;
let respuestasUsuario = [];
let preguntasFalladas = [];
let modoExamen = false;


// 🔹 cargar temas
function cargarTemas() {
  let bloque = document.getElementById("bloque").value;
  let selectTema = document.getElementById("tema");

  selectTema.innerHTML = "";

  let temas = temasPorBloque[bloque];

  temas.forEach(t => {
    let option = document.createElement("option");
    option.value = t;
    option.text = t;
    selectTema.appendChild(option);
  });
}


// 🔹 iniciar test
async function iniciar() {

  let bloque = document.getElementById("bloque").value;
  let tema = document.getElementById("tema").value;

  modoExamen = document.getElementById("modoExamenCheck").checked;

  if (!bloque || !tema) {
    alert("Selecciona bloque y tema");
    return;
  }

  let res = await fetch(`data/${bloque}/${tema}.json`);
  preguntas = await res.json();

  actual = 0;
  respuestasUsuario = [];

  cargarPregunta();
}


// 🔹 cargar pregunta
function cargarPregunta() {

  let p = preguntas[actual];

  document.getElementById("contador").innerText =
    `Pregunta ${actual + 1} / ${preguntas.length}`;

  document.getElementById("pregunta").innerText = p.pregunta;

  let html = "";

  for (let i = 0; i < 4; i++) {
    html += `
      <label onclick="responder(${i})" id="op${i}">
        <input type="radio" name="op">
        ${p.opciones[i]}
      </label>
    `;
  }

  document.getElementById("opciones").innerHTML = html;
}


// 🔹 responder
function responder(i) {

  respuestasUsuario[actual] = i;

  if (modoExamen) return;

  let correcta = preguntas[actual].correcta;
  let opciones = document.querySelectorAll("label");

  opciones.forEach(op => op.style.pointerEvents = "none");

  if (i === correcta) {
    document.getElementById("op" + i).style.background = "#2ed573";
  } else {
    document.getElementById("op" + i).style.background = "#ff4757";
    document.getElementById("op" + correcta).style.background = "#2ed573";
  }
}


// 🔹 siguiente
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


// 🔹 resultado
function mostrarResultado() {

  let aciertos = 0;
  let fallos = 0;
  let blancos = 0;

  preguntasFalladas = [];

  for (let i = 0; i < preguntas.length; i++) {

    if (respuestasUsuario[i] === null) {
      blancos++;
    } else if (respuestasUsuario[i] === preguntas[i].correcta) {
      aciertos++;
    } else {
      fallos++;
      preguntasFalladas.push(preguntas[i]);
    }
  }

  let resultadoHTML = `
    ✅ ${aciertos} | ❌ ${fallos} | ⚪ ${blancos}
  `;

  if (preguntasFalladas.length > 0) {
    resultadoHTML += `
      <br><br>
      <button onclick="repetirFalladas()">Repetir falladas</button>
    `;
  }

  document.getElementById("resultado").innerHTML = resultadoHTML;
}


// 🔹 repetir falladas
function repetirFalladas() {

  preguntas = [...preguntasFalladas];

  actual = 0;
  respuestasUsuario = [];

  cargarPregunta();
}