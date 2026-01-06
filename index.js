// Ce fichier JavaScript contient l'ensemble de l'interface pour gérer
// un tournoi de badminton en double avec des contraintes complexes
// et une interface utilisateur complète responsive et interactive.
const version = 0.3;
// -- SETUP GLOBAL DATA --
const levels = [
  "NC",
  "P12",
  "P11",
  "P10",
  "D9",
  "D8",
  "D7",
  "R6",
  "R5",
  "R4",
  "N3",
  "N2",
  "N1",
];

const levelValue = {
  NC: 12,
  P12: 11,
  P11: 10,
  P10: 9,
  D9: 8,
  D8: 7,
  D7: 6,
  R6: 5,
  R5: 4,
  R4: 3,
  N3: 2,
  N2: 1,
  N1: 0,
};

const titleContrainte = {
  equipier: "Coéquipier différents",
  adversaire: "Adversaires différents",
  niveau: "Ecart de point max.",
  sexe: "Egalité des sexes",
  isScoreNegatif: "Score négatif"
}

const descContrainte = {
  equipier: "Eviter un maximum de jouer plusieurs fois avec le même équipier",
  adversaire: "Eviter un maximum de jouer plusieurs fois contre le même adversaire",
  niveau: "Eviter d'avoir des matchs avec un écart de point supérieur au maximum défini ci-dessous",
  sexe: "Eviter d'avoir des matchs avec un nombre d'homme(s) et de dame(s) différent entre les deux équipes",
  isScoreNegatif: "Si activer, le début du match sera par exemple de -3 / 0 au lieu de 0 / 3"
}

const defaultConfig = {
  typeTournoi: "double",
  DMForbidden: false,
  DHForbidden: false,
  DDForbidden: false,
  allowSimpleIfTypeTournoiDouble: true,
  genderDifferentForbidden: false,
  terrains: 7,
  tours: 6,
  ecartMax: 10,
  priorities: {
    equipier: 100,
    adversaire: 60,
    niveau: 40,
    sexe: 20,
  },
  isScoreNegatif: false,
  attribPoint: { victoire: 5, "petite victoire": 2, défaite: 0 },
  targetTimeTour: 15, // minutes
  activeTargetTimeTour: false,
};

let tournoi = JSON.parse(localStorage.getItem("gen-tournoi") || "{}");
let players = tournoi.players || [];
let settings = tournoi.settings || defaultConfig;
let scores = tournoi.scores || {};
let planning = tournoi.planning || [];
let scoreDistribution = tournoi.scoreDistribution || Infinity;
let nbDistributionTeste = tournoi.nbDistributionTeste || 0;
let currentNbAdversaireSimpleRepetee = tournoi.currentNbAdversaireSimpleRepetee || 0;
let currentNbAdversaireDoubleRepetee = tournoi.currentNbAdversaireDoubleRepetee || 0;
let currentNbCoequipierRepetee = tournoi.currentNbCoequipierRepetee || 0;
let currentNbEgaliteSexeNonRespecte = tournoi.currentNbEgaliteSexeNonRespecte || 0;
let currentNbEcartMaxNonRespecte = tournoi.currentNbEcartMaxNonRespecte || 0;
let currentNbJoueursAttente = tournoi.currentNbJoueursAttente || 0;
let currentTour = tournoi.currentTour === undefined ? -1 : tournoi.currentTour;
let currentEditMatchIndex = -1;
let currentStopTimer = null;

let stopRequested = false;

let intervals = {
  topLeft: null,
  bottomLeft: null,
  topRight: null,
  bottomRight: null,
};

// -- DOM CREATION --
window.addEventListener("DOMContentLoaded", () => {
  document.body.innerHTML = `
  <header class="header flex justify-between items-center">
    <span>🏸 Générateur de tournoi de Badminton</span>
    ${renderMenuGlobal()}
  </header>
  <section id="chargement" class="flex flex-col flex-auto" style="">Chargement ... </section>
  <section id="preparation" class="flex flex-col flex-auto" style="display:none"></section>
  <section id="tournament" class="flex flex-col flex-auto" style="display:none"></section>
  <section id="results" class="flex flex-col flex-auto" style="display:none"></section>
  <aside id="panel" class="h-screen overflow-auto"></aside>
`;

  if (planning.length > 0 && currentTour != null) {
    renderTournament();
    renderPanelTournament();
    if (currentTour != -1) {
      currentStopTimer = afficherTempsEcoule(
        planning[currentTour].startDate,
        currentTour
      );
    }
    showSection("tournament");
  } else if (currentTour == null) {
    renderTournament();
    renderResults();
    renderPanelResults();
    showSection("results");
  } else {
    renderPreparationSection();
    showSection("preparation");
  }

  document.addEventListener("click", (e) => {
    const btnMenu = document.getElementById("btn-menu");
    const menu = document.getElementById("menu-contextuel");
    if (!btnMenu.contains(e.target) && !menu.contains(e.target)) {
      menu.style.display = "none";
    }
  });
});

// -- UI FUNCTIONS --
function showSection(id) {
  document
    .querySelectorAll("section")
    .forEach((sec) => (sec.style.display = "none"));
  document.getElementById(id).style.display = "block";
}

function togglePanel(forceHide = null) {
  const panel = document.getElementById("panel");
  if (forceHide === true) {
    panel.classList.remove("open");
  } else {
    panel.classList.toggle("open");
  }
  if (panel.classList.contains("open")) {
    document.body.classList.add("withPanel");
  } else {
    document.body.classList.remove("withPanel");
  }
}

function reset() {
  if (confirm("Vous allez réinitialiser tous les paramètres (joueurs, préparation, tournoi en cours..) \n\n Voulez-vous continuer ?")) {
    if (currentStopTimer) {
      currentStopTimer();
    }
    players = [];
    settings = defaultConfig;
    scores = {};
    planning = [];
    currentTour = -1;
    saveData();
    renderPreparationSection();
    renderTournament();
    renderPanelTournament();
  }
}

function saveData() {
  localStorage.setItem(
    "gen-tournoi",
    JSON.stringify({
      players,
      settings,
      scores,
      planning,
      currentTour,
      currentNbJoueursAttente,
      currentNbAdversaireSimpleRepetee,
      currentNbAdversaireDoubleRepetee,
      currentNbCoequipierRepetee,
      currentNbEgaliteSexeNonRespecte,
      currentNbEcartMaxNonRespecte, 
      nbDistributionTeste,
      scoreDistribution
    })
  );
}

function regenerate() {
  if (
    confirm("Un tournoi existe déjà, il va être perdu, voulez vous-continuer ?")
  ) {
    currentTour = -1;
    optimisePlanning();
  }
}

// -- RENDER PLAYERS SECTION --
function renderPreparationSection() {
  const el = document.getElementById("preparation");
  el.innerHTML = `
    <div class="sous-header">
      <h2>🛠️ Préparation</h2>
    </div>
    <div class="flex flex-wrap gap-4 m-5">
      <div class="flex flex-col flex-auto">
        <label for="type-tournoi-value" class="mb-2">Type de tournoi</label> 
          <select id="type-tournoi-select" onchange="settings.typeTournoi = this.value == 'double' ? 'double' : 'simple';saveData(); renderPreparationSection();" class="w-full">
            <option value="double" ${settings.typeTournoi === "double" ? "selected" : ""}>Double</option>
            <option value="simple" ${settings.typeTournoi === "simple" ? "selected" : ""}>Simple</option>
          </select>
        ${settings.typeTournoi == "double" ? `
        <label class="flex items-center gap-4 p-4">
          <input type="checkbox" onchange="onChangeAllowSimpleIfTournoiDouble(event);" ${
            settings.allowSimpleIfTypeTournoiDouble ? "checked" : ""
          } />
          <span class="">Autoriser les matchs simples</span>
        </label>` : ""}
      </div>
      
      <div class="flex flex-col flex-auto min-w-64">
        <div class="flex flex-col flex-auto">
          <label for="terrains-value" class="mb-2">Nombre de terrains</label> 
            <div class="flex items-center justify-between">
              <div class="slider slider-param-terrains flex-auto mr-6"> </div>
              <span id="terrains-value" class="w-8 ml-2">${settings.terrains} </span>
            </div>
        </div>
        <div class="flex flex-col flex-auto">
          <label for="tours-value" class="mb-2">Nombre de tours</label> 
          <div class="flex items-center justify-between">
              <div class="slider slider-param-tours flex-auto mr-6"> </div>
              <span id="tours-value" class="w-8 ml-2">${settings.tours} </span>
            </div>
        </div>
      </div>

      <div class="flex flex-col gap-4 flex-auto">
      <label class="flex items-center gap-4">
        <input type="checkbox" onchange="onChangeActiveTargetTimeTour(event);" ${
          settings.activeTargetTimeTour ? "checked" : ""
        } />
        <span class="">Définir un temps limite par tour</span>
      </label>
      ${settings.activeTargetTimeTour ? `
        <div class="flex items-center justify-between">
            <div class="slider slider-param-target-time-tour flex-auto mr-6"> </div>
            <span id="target-time-tour-value" class="w-8 ml-2">${settings.targetTimeTour} </span>
          </div>` : ""}
      </div>
      
      
      ${renderContraintes("preparation", false)}

    </div>

    <div class="sous-header justify-between items-center">
      <h2>👥 Liste des joueurs</h2>
      <span>${
        players.length == 0 ? "Aucun joueur" : ` ${players.length} joueurs`
      }</span>
    </div>
    <div class="flex-auto">
      <form id="form-add-player" class=" sous-header-secondary flex flex-wrap gap-1">
          <div class="flex items-start gap-1" >
            <div class="flex flex-auto flex-wrap gap-1" >
              <input class="w-full" id="name-player" placeholder="Nouveau joueur" value="" />
              <div class="flex flex-auto gap-1" >
                <select id="gender-player" class="flex-auto" >
                    <option value="H" selected>H</option>
                    <option value="F">F</option>
                </select>
                <select id="level-player" >
                ${levels
                  .map(
                    (l) =>
                      `<option value="${l}" ${
                        "NC" === l ? "selected" : ""
                      }>${l}</option>`
                  )
                  .join("")}
                </select>
              </div>
            </div>
            <button class="overflow-hidden text-ellipsis btn-primary rounded min-w-12" type="submit" id="addPlayer">Ajouter</button>
          </div>
      </form>
      <div id="playerList" class="m-5 flex flex-wrap gap-4"></div>
    </div>

    <footer class="footer flex justify-end">
    ${
      /*➜*/
      planning.length == 0
        ? `
      <button class="btn-primary" onclick="optimisePlanning();"> 🏆 Générer le tournoi</button>
      `
        : `
      <div class="flex justify-between w-full p-2">
        ${(settings.typeTournoi === "double" && players.length >= 4) || (settings.typeTournoi !== "double" && players.length >= 2) ?
          `<button class="btn-secondary" onclick="regenerate();"> ↺ Régénérer le tournoi</button>`
          : `<span>Pas assez de joueurs..</span>`
        }
        <button class="btn-primary" onclick="showSection('tournament');renderPanelTournament();"> Tournoi ${
          currentTour == null
            ? "terminé"
            : currentTour == -1
            ? "prêt"
            : "en cours"
        } ⭢ </button>
      </div>
      `
    }
    </footer>
  `;

  el.querySelector("#form-add-player").onsubmit = () => {
    let name = el.querySelector("#name-player").value.trim();
    let gender = el.querySelector("#gender-player").value;
    let level = el.querySelector("#level-player").value;
    const wasEmpty = name == "";
    if (name == "" || players.find((p) => p.name === name)) {
      const names = [
        ["Paul", "H", "D9"],
        ["Robin", "H", "P10"],
        ["Celine", "F", "P11"],
        ["John", "H", "D8"],
        ["Olivier", "H", "P11"],
        ["Fabien", "H", "P10"],
        ["Marie", "F", "D9"],
        ["Ludivine", "F", "P12"],
        ["Audrey", "F", "P11"],
        ["Katy", "F", "NC"],
      ];
      let tries = 0;
      do {
        const rdm = Math.floor(Math.random() * names.length);
        name = wasEmpty
          ? names[rdm][0] + "_" + Math.floor(Math.random() * 100)
          : name + "_" + Math.floor(Math.random() * 100);
        gender = names[rdm][1];
        level = names[rdm][2];
        tries++;
      } while (players.find((p) => p.name === name) && tries < 50);
    }
    const newPlayer = {
      name,
      gender,
      level: level,
      id: crypto.randomUUID?.(),
    };
    players.splice(0, 0, newPlayer);
    saveData();
    renderPreparationSection();
    if (!wasEmpty) {
      el.querySelector("#name-player").focus();
    }
  };

  const list = el.querySelector("#playerList");
  list.innerHTML = players
    .map(
      (p, i) => `
      <div class="player player-preparation-${
        p.gender
      } w-96 flex items-start gap-1 p-2 border rounded-lg 
      }" >
        <div class="flex flex-col flex-auto" >
          <input class="w-full" id="name_${i}" value="${
        p.name
      }" onchange="players[${i}].name=this.value;saveData();renderPreparationSection()" />
          <div class="flex" >
            <select class="flex-auto" onchange="players[${i}].gender=this.value;saveData();renderPreparationSection()">
              <option value="H" ${p.gender === "H" ? "selected" : ""}>H</option>
              <option value="F" ${p.gender === "F" ? "selected" : ""}>F</option>
            </select>
            <select onchange="players[${i}].level=this.value;saveData();renderPreparationSection()">
              ${levels
                .map(
                  (l) =>
                    `<option value="${l}" ${
                      p.level === l ? "selected" : ""
                    }>${l}</option>`
                )
                .join("")}
            </select>
          </div>
        </div>
          <button class="text-2xl" onclick="requestDeletePlayer(event, ${i});"> ⛔ </button>
      </div>
  `
    )
    .join("");

  const sliderTerrains = document.body.querySelector(".slider-param-terrains");
  if (sliderTerrains) {
    noUiSlider.create(sliderTerrains, {
      start: parseInt(settings.terrains),
      connect: [true, false],
      step: 1,
      range: {
        min: 1,
        max: 20,
      },
    });
    sliderTerrains.noUiSlider.on("slide", (values, handle) => {
      settings.terrains = parseInt(values[handle]);
      document.getElementById("terrains-value").innerHTML = parseInt(
        values[handle]
      );
      saveData();
    });
    sliderTerrains.noUiSlider.on("end", (values, handle) => {
      renderPreparationSection();
    });
  }

  const sliderTours = document.body.querySelector(".slider-param-tours");
  if (sliderTours) {
    noUiSlider.create(sliderTours, {
      start: parseInt(settings.tours),
      connect: [true, false],
      step: 1,
      range: {
        min: 1,
        max: 20,
      },
    });
    sliderTours.noUiSlider.on("slide", (values, handle) => {
      settings.tours = parseInt(values[handle]);
      document.getElementById("tours-value").innerHTML = parseInt(
        values[handle]
      );
      saveData();
    });
    sliderTours.noUiSlider.on("end", (values, handle) => {
      renderPreparationSection();
    });
  }

  const sliderTargetTimeTour = document.body.querySelector(".slider-param-target-time-tour");
  if (sliderTargetTimeTour) {
    noUiSlider.create(sliderTargetTimeTour, {
      start: parseInt(settings.targetTimeTour),
      connect: [true, false],
      step: 1,
      range: {
        min: 1,
        max: 45,
      },
    });
    sliderTargetTimeTour.noUiSlider.on("slide", (values, handle) => {
      settings.targetTimeTour = parseInt(values[handle]);
      document.getElementById("target-time-tour-value").innerHTML = parseInt(values[handle]);
      saveData();
    });
    sliderTargetTimeTour.noUiSlider.on("end", (values, handle) => {
      renderPreparationSection();
    });
  }

  document.body.querySelectorAll(".slider-contrainte").forEach((slider) => {
    const obj = slider.id.split("-");
    noUiSlider.create(slider, {
      start: settings.priorities[obj[2]],
      connect: [true, false],
      step: 1,
      range: {
        min: 0,
        max: 100,
      },
    });
    slider.noUiSlider.on("slide", (values, handle) => {
      settings.priorities[obj[2]] = parseInt(values[handle]);
      document.getElementById(`slider-contrainte-label-${obj[2]}`).innerHTML =
        parseInt(values[handle]);
    });
    slider.noUiSlider.on("end", (values, handle) => {
      saveData();
    });
  });

  renderHandicapTournament();

}

function requestDeletePlayer(event, i) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.innerHTML = "⛔ Supprimer";
  event.currentTarget.setAttribute("class", "text-base btn-warning");
  const listener = (event) => {
    event.preventDefault();
    players.splice(i, 1);
    saveData();
    renderPreparationSection();
  };
  event.currentTarget.addEventListener("click", listener, { once: true });
  document.body.addEventListener(
    "click",
    ((target, listener, evt) => {
      target.innerHTML = "⛔";
      target.setAttribute("class", "text-2xl");
      target.removeEventListener("click", listener);
    }).bind(this, event.currentTarget, listener),
    { once: true }
  );
}

// -- RENDER TOURNAMENT SECTION --
function renderTournament() {
  const el = document.getElementById("tournament");
  let indexMatch = 0; /*➜*/
  const nbMatchRestant = getNombreMatchRestant();

  el.innerHTML = `
      <div class="sous-header flex justify-between items-center w-full">
        <button onclick="togglePanel(true);renderPreparationSection();showSection('preparation');"> ⭠ Retour<div> </button>
        <div class="flex justify-between mx-3 gap-4 ">
          ${
            "" /*<span>${
            players.length == 0 ? "Aucun joueur" : ` ${players.length} joueurs`
          }</span>
          */
          }

          <span>${
            currentTour == null
              ? `Tournoi terminé - durée : ${getTpsTotal()}`
              : currentTour == -1
              ? "Prêt à lancer !"
              : ``
          }</span>
          
          ${
            currentTour != -1 && currentTour != null
              ? `<span class="justify-center inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-yellow-600/20 ring-inset" id="tps-ecoule-${currentTour}"> </span>`
              : ``
          }
          
        </div>
        ${
          currentTour == null
            ? `<button onclick="togglePanel()">📊</button>`
            : ""
        }
      </div>
      ${planning
        .map((tour, indexTour) => {
          return `
            <div class="">
              <button id="tour-${
                indexTour + 1
              }" class="accordion sous-header-secondary justify-between ${
            currentTour == -1 || currentTour == null || currentTour == indexTour
              ? "open"
              : ""
          } ${
            currentTour == indexTour && "bg-green-100"
          }" onclick="this.classList.toggle('open')">
                <h3 class="">
                Tour ${indexTour + 1} ${
            currentTour == indexTour
              ? "en cours"
              : tour.closed
              ? "terminé"
              : "à venir"
          }</h3>

                <span>▼</span>
         
              </button>
              <div class="accordion-content w-full"> 
                <div class="flex justify-center flex-wrap gap-4 w-full">
                  ${tour.matchs
                    .map((match, index) => {
                      indexMatch++;
                      const team1IsWinner = isWinner(indexTour, index, true);
                      const team2IsWinner = isWinner(indexTour, index, false);
                      return `
                        <div class="flex flex-col mx-2 max-w-96 w-full">
                          <div class="flex justify-between items-center w-full p-2 ">
                            <h3>Match ${indexMatch}</h3>
                            <h3>Terrain ${index + 1}</h3>
                          </div>

                          ${
                            currentTour == indexTour
                              ? ` 
                              <div class="relative flex flex-col items-center border p-2 rounded">
                              
                                <span class="flex justify-center items-center text-2xl gap-4 w-full">
                                  ${
                                    currentEditMatchIndex != -1 &&
                                    currentEditMatchIndex == index
                                      ? `<button onclick="teamWin(true);" class="${
                                          team1IsWinner ? "" : "opacity-50"
                                        }">🏆</button>`
                                      : team1IsWinner
                                      ? `<button class="absolute top-0 left-5">🏆</button>`
                                      : ``
                                  }
                                  <span class="w-8 text-right" ${
                                    currentEditMatchIndex == index
                                      ? 'id="currentScoreIndex1"'
                                      : ""
                                  }>${match.scoreTeam1}</span>
                                  ${
                                    currentEditMatchIndex == index
                                      ? `<button class="text-xl" onclick="currentEditMatchIndex=-1;renderTournament();"> ✔️ </button>`
                                      : `<button class="text-xl" onclick="currentEditMatchIndex=${index};renderTournament();"> ✏️ </button>`
                                  }
                                  <span class="w-8 text-left" ${
                                    currentEditMatchIndex == index
                                      ? 'id="currentScoreIndex2"'
                                      : ""
                                  }>${match.scoreTeam2}</span>
                                  ${
                                    currentEditMatchIndex != -1 &&
                                    currentEditMatchIndex == index
                                      ? `<button onclick="teamWin(false);" class="${
                                          team2IsWinner ? "" : "opacity-50"
                                        }">🏆</button>`
                                      : team2IsWinner
                                      ? `<button class="absolute top-0 right-5">🏆</button>`
                                      : ``
                                  }
                                </span>
                                <div class="flex justify-between items-center h-full w-full">
                                    <div class="flex flex-col flex-1 overflow-hidden">
                                      ${renderTeam(
                                        match.team1,
                                        "",
                                        "float: right;"
                                      )}
                                    </div>
                                    ${
                                      currentEditMatchIndex == index
                                        ? `<div class="flex justify-between items-center h-full">
                                                <div class="flex flex-col justify-between items-center h-full">
                                                  ${renderSliderScore(
                                                    indexTour +
                                                      "-" +
                                                      index +
                                                      "-scoreTeam1"
                                                  )}
                                                </div>
                                          </div>
                                          <div id="plus-top-left" class="absolute flex justify-center items-center left-0 top-0 w-16 h-16 bg-yellow-100 rounded opacity-50 cursor-pointer" onmousedown="startTouchScore(true, '${
                                            indexTour +
                                            "-" +
                                            index +
                                            "-scoreTeam1"
                                          }', intervals, 'topLeft');"
                                          onmouseup="stopTouchScore(intervals, 'topLeft');" 
                                          onmouseleave="stopTouchScore(intervals, 'topLeft');"
                                          ontouchstart="(e) => { e.preventDefault(); startTouchScore(true, '${
                                            indexTour +
                                            "-" +
                                            index +
                                            "-scoreTeam1"
                                          }', intervals, 'topLeft');}" 
                                          ontouchend="stopTouchScore(intervals, 'topLeft');">
                                              +
                                          </div>
                                          <div id="plus-bottom-left" class="absolute flex justify-center items-center left-0 bottom-0 w-16 h-16 bg-yellow-100 rounded opacity-50 cursor-pointer" onmousedown="startTouchScore(false, '${
                                            indexTour +
                                            "-" +
                                            index +
                                            "-scoreTeam1"
                                          }', intervals, 'bottomLeft');"
                                           onmouseup="stopTouchScore(intervals, 'bottomLeft');" 
                                           onmouseleave="stopTouchScore(intervals, 'bottomLeft');"
                                            ontouchstart="(e) => { e.preventDefault(); startTouchScore(false, '${
                                              indexTour +
                                              "-" +
                                              index +
                                              "-scoreTeam1"
                                            }', intervals, 'bottomLeft');}" 
                                          ontouchend="stopTouchScore(intervals, 'bottomLeft');">
                                              -
                                          </div>
                                        `
                                        : ``
                                    }
                                  
                                  <div class="separator-vertical ${
                                    currentTour === indexTour ? "mx-2" : ""
                                  }"></div>
                                  
                                  ${
                                    currentEditMatchIndex == index
                                      ? `<div class="flex justify-between items-center h-full ">
                                          <div class="flex flex-col justify-between items-center h-full">
                                            ${renderSliderScore(
                                              indexTour +
                                                "-" +
                                                index +
                                                "-scoreTeam2"
                                            )}
                                          </div>
                                      </div>
                                      <div id="plus-top-left" class="absolute flex justify-center items-center right-0 top-0 w-16 h-16 bg-yellow-100 rounded opacity-50 cursor-pointer" onmousedown="startTouchScore(true, '${
                                        indexTour + "-" + index + "-scoreTeam2"
                                      }', intervals, 'topRight');"
                                           onmouseup="stopTouchScore(intervals, 'topRight');" 
                                           onmouseleave="stopTouchScore(intervals, 'topRight');"
                                           ontouchstart="(e) => { e.preventDefault(); startTouchScore(true, '${
                                             indexTour +
                                             "-" +
                                             index +
                                             "-scoreTeam2"
                                           }', intervals, 'topRight');}" 
                                          ontouchend="stopTouchScore(intervals, 'topRight');">
                                              +
                                          </div>
                                          <div id="plus-top-left" class="absolute flex justify-center items-center right-0 bottom-0 w-16 h-16 bg-yellow-100 rounded opacity-50 cursor-pointer" onmousedown="startTouchScore(false, '${
                                            indexTour +
                                            "-" +
                                            index +
                                            "-scoreTeam2"
                                          }', intervals, 'bottomRight');"
                                           onmouseup="stopTouchScore(intervals, 'bottomRight');" 
                                           onmouseleave="stopTouchScore(intervals, 'bottomRight');"
                                           ontouchstart="(e) => { e.preventDefault(); startTouchScore(false, '${
                                             indexTour +
                                             "-" +
                                             index +
                                             "-scoreTeam2"
                                           }', intervals, 'bottomRight');}" 
                                          ontouchend="stopTouchScore(intervals, 'bottomRight');">
                                              -
                                          </div>
                                      `
                                      : ``
                                  }

                                  <div class="flex flex-col flex-1 overflow-hidden items-end">
                                    ${renderTeam(
                                      match.team2,
                                      "text-right",
                                      "float: left;"
                                    )}
                                  </div>
                                    
                                </div>
                              </div>`
                              : `
                              <div class="flex flex-col items-center border p-2 rounded w-full">
                                  <span class="text-2xl gap-2 h-full flex justify-content items-center">
                                    <span class="w-8 text-right">${
                                      currentTour == -1 ||
                                      (currentTour != null &&
                                        indexTour >= currentTour)
                                        ? match.initialScoreTeam1
                                        : match.scoreTeam1
                                    }</span>
                                    <div class="separator-vertical ${
                                      currentTour === indexTour ? "mx-1" : ""
                                    }"></div>
                                    <span class="w-8 text-left">${
                                      currentTour == -1 ||
                                      (currentTour != null &&
                                        indexTour >= currentTour)
                                        ? match.initialScoreTeam2
                                        : match.scoreTeam2
                                    }</span>
                                  </span>
                                  <div class="flex justify-between items-center w-full">
                                    <div class="flex flex-col flex-1 overflow-hidden ">
                                        ${renderTeam(
                                          match.team1,
                                          "",
                                          "float: right;"
                                        )}
                                    </div>
                                    <div class="separator-vertical ${
                                      currentTour === indexTour ? "mx-2" : ""
                                    }"></div>
                                    <div class="flex flex-col flex-1 overflow-hidden items-end">
                                        ${renderTeam(
                                          match.team2,
                                          "text-right",
                                          "float: left;"
                                        )}
                                    </div>
                                  </div>
                              </div>
                              `
                          }

                         </div>
                      `;
                    })
                    .join("")}
                </div>
                
            </div>
            ${tour.attentes.length > 0 ? 
              `<div class="flex justify-center flex-wrap w-full bg-gray-10 m-2">
                <h3>Joueurs en attente </h3>
                <div class="flex justify-center flex-wrap gap-4 w-full">
                  ${tour.attentes
                    .map((player, index) => {
                      return `
                      <div class="block truncate player-attente player-attente-${
                          player.gender
                        }">
                        <span>${player.name}</span>
                        ${/*getLevelTournament(player)*/ ""}
                      </div>
                      `;
                    })
                    .join("")}
                </div>
              </div>` : ""
            }
            </div>
        `;
        })
        .join("")}
      
      <footer class="footer flex justify-end">
      ${
        currentTour === null
          ? `<button class="btn-primary" onclick="renderResults(); showSection('results');renderPanelResults();">Résultats ➜</button>`
          : currentTour == -1
          ? `<button class="btn-primary" onclick="launchTournoi();"> 🏆 Lancer le tournoi</button>`
          : `${
              currentTour < planning.length - 1
                ? `
            <div class="flex justify-between w-full p-2">
              <button class="btn-secondary" onclick="clotureTournoi();"> Clotûrer le tournoi</button>
              <div class="flex items-center">
                <span class="text-sm mr-2" id="label-match-restant">${nbMatchRestant} </span>
                <button id="button-cloture" ${
                  nbMatchRestant && "disabled"
                } class="btn-primary" onclick="clotureTour();"> Clotûrer le tour</button>
              </div>
            </div>`
                : `<button class="btn-primary" onclick="clotureTournoi();"> Clotûrer le tournoi</button>`
            }
          `
      }
      </footer>
    `;

  document.body.querySelectorAll(".slider-score").forEach((slider) => {
    const obj = slider.id.split("-");
    const [initialScoreTeam1, initialScoreTeam2] = getInitialScore(
      planning[obj[0]].matchs[obj[1]].team1,
      planning[obj[0]].matchs[obj[1]].team2
    );
    const start =
      obj[2] == "scoreTeam1" ? initialScoreTeam1 : initialScoreTeam2;
    noUiSlider.create(slider, {
      start: planning[obj[0]].matchs[obj[1]][obj[2]],
      connect: [true, false],
      direction: "rtl",
      step: 1,
      orientation: "vertical",
      range: {
        min: start,
        max: 32,
      },
    });
    slider.noUiSlider.on("slide", (values, handle) => {
      changeLevelScore(parseInt(values[handle]), slider.id);
    });
    slider.noUiSlider.on("end", (values, handle) => {
      saveData();
      renderTournament();
    });
    slider.noUiSlider.on("set", (values, handle) => {
      saveData();
      renderTournament();
    });
  });
}

function teamWin(isTeam1) {
  if (currentEditMatchIndex != -1) {
    const match = planning[currentTour].matchs[currentEditMatchIndex];
    let newScoreTeam;
    const scoreAdverse = isTeam1 ? match.scoreTeam2 : match.scoreTeam1;
    if (scoreAdverse <= 19) {
      newScoreTeam = 21;
    } else if (scoreAdverse >= 32) {
      newScoreTeam = 32;
    } else {
      newScoreTeam = scoreAdverse + 2;
    }
    changeLevelScore(
      newScoreTeam,
      `${currentTour}-${currentEditMatchIndex}-scoreTeam${isTeam1 ? 1 : 2}`
    );
    saveData();
    renderTournament();
  }
}

function isWinner(indexTour, indexMatch, isTeam1) {
  const match = planning[indexTour].matchs[indexMatch];
  return isTeam1
    ? match.scoreTeam1 > match.scoreTeam2
    : match.scoreTeam2 > match.scoreTeam1;
}

function changeLevelScore(newScore, id) {
  const obj = id.split("-");
  document.getElementById(
    obj[2] == "scoreTeam1" ? "currentScoreIndex1" : "currentScoreIndex2"
  ).innerHTML = newScore;
  planning[obj[0]].matchs[obj[1]][obj[2]] = newScore;
}

function startTouchScore(increment, id, inter, key) {
  touchScore(increment, id); // Appel immédiat
  inter[key] = setInterval(() => {
    touchScore(increment, id);
  }, 100);
}

function stopTouchScore(inter, key) {
  clearInterval(inter[key]);
}

function touchScore(isPlus, idSlider) {
  const slider = document.getElementById(idSlider);
  var newScore = parseInt(slider.noUiSlider.get()) + (isPlus ? 1 : -1);
  if (
    newScore < slider.noUiSlider.options.range.min ||
    newScore > slider.noUiSlider.options.range.max
  )
    return;
  changeLevelScore(newScore, idSlider);
  slider.noUiSlider.set(newScore);
}

function getNombreMatchRestant() {
  if (currentTour != -1 && currentTour != null) {
    let nbMatchTotal = planning[currentTour].matchs.length;
    let matchClosed = 0;
    planning[currentTour].matchs.forEach((match) => {
      if (match.scoreTeam1 >= 21 || match.scoreTeam2 >= 21) {
        matchClosed++;
      }
    });
    if (nbMatchTotal - matchClosed == 0) {
      return "";
    } else {
      const s = nbMatchTotal - matchClosed > 1 ? "s" : "";
      return nbMatchTotal - matchClosed + ` match${s} restant${s}`;
    }
  } else {
    return "";
  }
}

function renderTeam(team, customClass, customStyle) {
  return `
    ${team
      .map((player) => {
        return `
          <div class="block truncate player-tournament player-tournament-${
            player.gender
          } ${customClass}">
          <span>${player.name}</span>
          ${getLevelTournament(player, customStyle)}
          </div>
          
        `;
      })
      .join("")}`;
}

function renderSliderScore(id) {
  return `<div id="${id}" class="slider slider-score flex-auto m-4 h-24"> </div>`;
}

function getLevelTournament(p, customStyle) {
  return `<div style="${customStyle}" class="
    ${
      p.level == "NC"
        ? `inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-500/10 ring-inset`
        : p.level == "P12"
        ? `inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-green-600/20 ring-inset`
        : p.level == `P11`
        ? `inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-green-600/20 ring-inset`
        : p.level == `P10`
        ? `inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-green-600/20 ring-inset`
        : p.level == `D9`
        ? `inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset`
        : p.level == `D8`
        ? `inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset`
        : p.level == `D7`
        ? `inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 ring-inset`
        : p.level == `R6`
        ? `inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-yellow-600/20 ring-inset`
        : p.level == `R5`
        ? `inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-yellow-600/20 ring-inset`
        : p.level == `R4`
        ? `inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-yellow-600/20 ring-inset`
        : p.level == `N3`
        ? `inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-red-600/10 ring-inset`
        : p.level == `N2`
        ? `inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-red-600/10 ring-inset`
        : p.level == `N1`
        ? `inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-red-600/10 ring-inset`
        : `<div></div>`
    } ">${p.level}</div>`;
}

function getTpsTotal() {
  const timeTotal = planning.reduce(
    (acc, tour) =>
      acc + (tour ? getTempsEcoule(tour.startDate, tour.endDate, true) : 0),
    0
  );

  if (timeTotal >= 86400) return "plus de 24h";

  const heures = Math.floor(timeTotal / 3600);
  const minutes = Math.floor((timeTotal % 3600) / 60);
  const secondes = timeTotal % 60;

  if (heures > 0) return `${heures}h ${minutes}' ${secondes}''`;
  if (minutes > 0) return `${minutes}' ${secondes}''`;
  return `${secondes}''`;
}

function renderResults() {
  const el = document.getElementById("results");
  const scores = calculerScores();

  const joueurs = players.map((p) => ({
    nom: p.name,
    id: p.id,
    points: scores[p.id]?.points || 0,
    scoreTotal: scores[p.id]?.scoreTotal || 0,
  }));

  joueurs.sort((a, b) => b.points - a.points || b.scoreTotal - a.scoreTotal);

  el.innerHTML = `
    <div class="sous-header flex justify-between items-center w-full">
      <button onclick="togglePanel(true);showSection('tournament');">⭠ Retour</button>
      <span>Tournoi terminé - durée : ${getTpsTotal()}</span>
      <button onclick="togglePanel()">⚙️ Paramètres</button>
    </div>

    <div class="w-full flex flex-col justify-center items-center">
      <h1 class="text-xl mt-4">Résultats</h1>
      <ol class="mt-4">
        ${joueurs
          .map(
            (j, i) => `
          <li class="mb-2">
            <strong>${i + 1}.</strong> ${j.nom} — 
            ${j.points} pts 
            <span class="text-gray-500 text-sm">(score : ${j.scoreTotal})</span>
          </li>
        `
          )
          .join("")}
      </ol>
    </div>
  `;
}

function calculerScores() {
  const scores = {};

  for (const tour of planning) {
    for (const match of tour.matchs) {
      const s1 = match.scoreTeam1;
      const s2 = match.scoreTeam2;

      let pointsTeam1 = 0;
      let pointsTeam2 = 0;

      if (s1 > s2) {
        pointsTeam1 =
          settings.attribPoint[s1 - s2 <= 2 ? "petite victoire" : "victoire"];
        pointsTeam2 = settings.attribPoint["défaite"];
      } else if (s2 > s1) {
        pointsTeam2 =
          settings.attribPoint[s2 - s1 <= 2 ? "petite victoire" : "victoire"];
        pointsTeam1 = settings.attribPoint["défaite"];
      }

      for (const p of match.team1) {
        if (!scores[p.id]) scores[p.id] = { points: 0, scoreTotal: 0 };
        scores[p.id].points += pointsTeam1;
        scores[p.id].scoreTotal += s1;
      }
      for (const p of match.team2) {
        if (!scores[p.id]) scores[p.id] = { points: 0, scoreTotal: 0 };
        scores[p.id].points += pointsTeam2;
        scores[p.id].scoreTotal += s2;
      }
    }
  }

  return scores;
}

function renderMenuGlobal() {
  return `<div style="position: relative; display: inline-block;">
    <button id="btn-menu" class="text-2xl" onclick="toggleMenu();">☰</button>
    <div id="menu-contextuel" class="menu-context" style="display:none;">
      <div class="menu-item" onclick="reset(); toggleMenu();">↺ Reset</div>  
      <div class="menu-item" onclick="showAboutPopup(); toggleMenu();">🛈 A propos</div>
    </div>
  </div>`;
}

function toggleMenu() {
  const menu = document.getElementById("menu-contextuel");
  menu.style.display = menu.style.display === "none" ? "block" : "none";
}

function showAboutPopup() {
  const popup = document.createElement("div");
  popup.id = "about-popup";
  popup.className = "popup-overlay";
  popup.innerHTML = `
    <div class="popup-content overflow-auto w-full m-10">
      <h2>Générateur de tournoi de Badminton</h2>

      <h3 style="font-weight: bold;">A propos du développeur</h3>
      <p>Développé par <mark>Jonathan Merandat</mark>, joueur de badminton et passionné de développement web depuis des années, ce générateur de tournoi est mis à disposition gratuitement.</br>
      <p>Cette application permet de générer automatiquement des matchs de badminton en double, en simple avec des contraintes personnalisées.</p>
      
      <h3 style="font-weight: bold;">Confidentialité des données</h3>
      <p>Toutes les informations saisies sont uniquement stocké en local sur le terminal (smartphone, ordinateur, etc...)</p>
      
      <h3 style="font-weight: bold;">Usage</h3>
      <p>
        <span>Préparer le tournoi en renseigner les joueurs et les paramètres.</span><br/>
        <span>Lancer le tournoi et gérer les scores en temps réel.</span><br/>
        <span>Consulter les résultats à la fin du tournoi.</span>
      </p>

      <h2  style="text-align: center;">Bon tournois ! 🏸</h2>
      <center><button class="btn-primary" style="text-align: center;" onclick="closeAboutPopup()">Fermer</button></center>
    </div>
  `;
  
  popup.onclick = function(e) {
    if (e.target === popup) {
      closeAboutPopup();
    }
  };
  
  document.body.appendChild(popup);
}

function closeAboutPopup() {
  const popup = document.getElementById("about-popup");
  if (popup) {
    popup.remove();
  }
}

function afficherTempsEcoule(dateDepart, currentTour) {
  let frameId;

  function update() {
    document.getElementById(
      "tps-ecoule-" + currentTour
    ).textContent = `${getTempsEcoule(dateDepart)}`;
    frameId = requestAnimationFrame(update);
  }

  frameId = requestAnimationFrame(update);
  return () => cancelAnimationFrame(frameId); // retourne une fonction pour stopper
}

function getTempsEcoule(dateDepart, dateFin = null, formatInteger = false) {
  const maintenant = dateFin ? dateFin : new Date();
  const ecoule = Math.floor((maintenant - dateDepart) / 1000);
  if (formatInteger) return ecoule;

  const jours = Math.floor(ecoule / 86400);
  const heures = Math.floor((ecoule % 86400) / 3600);
  const minutes = Math.floor((ecoule % 3600) / 60);
  const secondes = ecoule % 60;
  if (jours >= 1) return `+ de ${jours} jour${jours > 1 ? "s" : ""}`;
  if (heures > 0) return `${heures} h ${minutes} min ${secondes} s`;
  if (minutes > 0) return `${minutes} min ${secondes} s`;
  return `${secondes}'s`;
}

function launchTournoi() {
  togglePanel(true);
  currentTour = 0;
  document
    .getElementById("tour-" + (currentTour + 1))
    .scrollIntoView({ behavior: "smooth", block: "start" });
  planning[currentTour].startDate = Date.now();
  renderTournament();
  currentStopTimer = afficherTempsEcoule(
    planning[currentTour].startDate,
    currentTour
  );
  saveData();
}

function clotureTournoi() {
  planning[currentTour].endDate = Date.now();
  planning[currentTour].closed = true;
  currentTour = null;
  currentStopTimer();
  renderTournament();
  saveData();
}

function clotureTour() {
  currentStopTimer();
  planning[currentTour].endDate = Date.now();
  planning[currentTour].closed = true;
  if (currentTour < planning.length) {
    currentTour++;
    document
      .getElementById("tour-" + (currentTour + 1))
      .scrollIntoView({ behavior: "smooth", block: "start" });
    renderTournament();
    planning[currentTour].startDate = Date.now();
    currentStopTimer = afficherTempsEcoule(
      planning[currentTour].startDate,
      currentTour
    );
  } else {
    currentTour = -1;
  }
  saveData();
}

function renderContraintes() {
  const retour = `<button class="accordion p-2 flex justify-between items-center" onclick="this.classList.toggle('open')">
        <span>⚙️ Options avancées</span>
        <span>▼</span>
        </button> 
  <div class="accordion-content flex-wrap gap-4 w-full"> 
      <div class="flex flex-col flex-auto">
          <h3 class="sous-header sous-sous-header flex justify-between mb-5">Contraintes</h3>
          ${Object.entries(settings.priorities)
            .map(
              ([priority, poids]) =>
                `<label class="flex flex-col justify-between flex-start">
                    <span class="">${titleContrainte[priority]}</span>
                    <div class="w-128 text-xs italic">${descContrainte[priority]}</div>
                    <div class="flex items-center gap-2">
                      <div id="slider slider-contrainte-${priority}" class="slider-contrainte flex-auto mx-6 my-2"> </div>
                      <span id="slider-contrainte-label-${priority}" class="w-12">${poids}</span>
                      </div>
                  </label>`
            )
            .join("")}

            ${settings.typeTournoi == "double" ? `
          <div class="flex flex-col flex-auto gap-1">
            <label class="flex gap-4">
              <input type="checkbox" onchange="onChangeAllowDDForbidden(event);" ${
                settings.DDForbidden ? "checked" : ""
              } />
              <span class="">Interdire les doubles dame</span>
            </label>
            <label class="flex gap-4">
              <input type="checkbox" onchange="onChangeAllowDHForbidden(event);" ${
                settings.DHForbidden ? "checked" : ""
              } />
              <span class="">Interdire les doubles homme</span>
            </label>
            <label class="flex gap-4">
              <input type="checkbox" onchange="onChangeAllowDMForbidden(event);" ${
                settings.DMForbidden ? "checked" : ""
              } />
              <span class="">Interdire les doubles mixtes</span>
            </label>
          </div>
            ` : ""}
      </div>

    <div class="flex flex-col flex-auto">
        <h3 class="sous-header sous-sous-header flex justify-between mb-5">Scores initiaux</h3>
        <div id="score-panel" class="flex flex-col"></div>
    </div>

    <div class="flex flex-col flex-auto">
        <h3 class="sous-header sous-sous-header flex justify-between mb-5"> Handicaps et avantages</h3>
        <div id="handicap-tournament-panel" class="flex flex-col"></div>
    </div>

  </div>`;
  return retour;
}

function renderPanelTournament() {
  const panel = document.getElementById("panel");
  panel.innerHTML = `
  <h3 class="header flex justify-between items-center">
  📊 Statistiques
  <button onclick="togglePanel(true);">✖</button>
  </h3>
  ${"" /*<div id="contrainte-panel">*/}
  ${"" /*renderContraintes("panel", true)*/}
  <div class="flex flex-col gap-4 my-4">
  <div class="ml-4">Score de distribution : ${scoreDistribution == 0 ? "0 (Parfait)" : scoreDistribution}</div>
  <div class="ml-4">Nombre de distribution testées : ${nbDistributionTeste}</div>
  <div id="stats-tournament-panel" class="flex flex-col"></div>
  </div>
  `;
  renderStats();
}

function renderPanelResults() {
  const panel = document.getElementById("panel");
  panel.innerHTML = `
  <h3 class="header flex justify-between items-center">
  ⚙️ Paramètres
  <button onclick="togglePanel(true);">✖</button>
  </h3>
  ${"" /*<div id="contrainte-panel">*/}
  ${"" /*renderContraintes("panel", true)*/}
  </div>
  <h3 class="sous-header flex justify-between">
  ⚙️ Attribution des points <button onclick="renderResults();">↺</button>
  </h3>
  <div class="pl-4 mt-4">
    ${Object.entries(settings.attribPoint)
      .map(
        ([key, level]) =>
          `<label class="flex flex-col">
            <span class="">${key}</span>
            <div class="flex">
              <div id="slider-point-${key}" class="slider-point flex-auto mx-6 my-2"> </div>
              <span id="slider-point-label-${key}" class="w-8">${level}</span>
            </div>
          </label>
        `
      )
      .join("")}
  </div>
  `;

  document.body.querySelectorAll(".slider-point").forEach((slider) => {
    const obj = slider.id.split("-");
    noUiSlider.create(slider, {
      start: settings.attribPoint[obj[2]],
      connect: [true, false],
      step: 1,
      range: {
        min: 0,
        max: 10,
      },
    });
    slider.noUiSlider.on("slide", (values, handle) => {
      settings.attribPoint[obj[2]] = parseInt(values[handle]);
      document.getElementById(`slider-point-label-${obj[2]}`).innerHTML =
        parseInt(values[handle]);
    });
    slider.noUiSlider.on("end", (values, handle) => {
      saveData();
      renderResults();
    });
  });

  renderResults();
}

function renderAccordions(map, label) {
  return Object.entries(map)
    .map(([p, data]) => {
      const repeated = Object.entries(data).filter(([, count]) => count > 1);
      if (!repeated.length) return "";
      return `
      <button class="accordion w-full flex justify-between" onclick="this.classList.toggle('open')">
        <span class="w-full">+ ${p} ${label}</span> 
        <span class="justify-center inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-yellow-600/20 ring-inset">x${
          repeated.length
        }</span>
      </button>
      <div class="accordion-content pl-4">
        <div class="flex flex-col w-full">
          ${repeated
            .map(
              ([other, count]) =>
                `<div class="flex justify-between w-full p-2 pl-4 ">
              <div class="">${other}</div>
              <div class="justify-center inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-yellow-600/20 ring-inset">x${count}</div>
              </div>`
            )
            .join("")}
          </div>
      </div>
    `;
    })
    .join("");
}

function renderHandicapTournament() {
const scoreTournament = document.getElementById(
    "score-panel"
  );
  scoreTournament.innerHTML = `
    <label class="flex w-full gap-4 p-4">
      <input type="checkbox" onchange="onChangeScoreNegatif(event);" ${
        settings.isScoreNegatif ? "checked" : ""
      } />
      <span class="">Score négatif</span>
    </label>

    <label class="flex flex flex-col w-full gap-4 p-4">
      <span class="">Ecart de point max</span>
      <div class="flex">
        <div class="slider-ecart-max flex-auto mx-6 my-2"> </div>
        <span id="slider-ecart-max" class="">${settings.ecartMax}</span>
      </div>
    </label>`;

  const handicapTournament = document.getElementById(
    "handicap-tournament-panel"
  );
  handicapTournament.innerHTML = `
    <h3 class="pl-4">Point bonus</h3>
    <div class="pl-4">
    ${Object.entries(levelValue)
      .map(
        ([key, level]) =>
          `<label class="flex justify-between items-center">
            <span class="w-6">${key}</span>
            <div id="slider-level-${key}" class="slider-level flex-auto mx-6 my-2"> </div>
            <span id="slider-level-label-${key}" class="w-8">${level}</span>
          </label>
        `
      )
      .join("")}
    </div>
  `;

  document.body.querySelectorAll(".slider-level").forEach((slider) => {
    const obj = slider.id.split("-");
    noUiSlider.create(slider, {
      start: levelValue[obj[2]],
      connect: [true, false],
      step: 1,
      range: {
        min: 0,
        max: 12,
      },
    });
    slider.noUiSlider.on("slide", (values, handle) => {
      levelValue[obj[2]] = parseInt(values[handle]);
      document.getElementById(`slider-level-label-${obj[2]}`).innerHTML =
        parseInt(values[handle]);
    });
    slider.noUiSlider.on("end", (values, handle) => {
      planning.forEach((tour) => {
        tour.matchs.forEach((match) => {
          const [initialScoreTeam1, initialScoreTeam2] = getInitialScore(
            match.team1,
            match.team2
          );
          match.initialScoreTeam1 = initialScoreTeam1;
          match.initialScoreTeam2 = initialScoreTeam2;
        });
      });
      saveData();
      renderStats();
      renderTournament();
    });
  });

  const sliderEcartMax = document.body.querySelector(".slider-ecart-max");
  if (sliderEcartMax) {
    noUiSlider.create(sliderEcartMax, {
      start: parseInt(settings.ecartMax),
      connect: [true, false],
      step: 1,
      range: {
        min: 0,
        max: 30,
      },
    });
    sliderEcartMax.noUiSlider.on("slide", (values, handle) => {
      settings.ecartMax = parseInt(values[handle]);
      document.getElementById("slider-ecart-max").innerHTML = parseInt(
        values[handle]
      );
    });
    sliderEcartMax.noUiSlider.on("end", (values, handle) => {
      saveData();
      renderStats();
    });
  }
}

function onChangeScoreNegatif(event) {
  settings.isScoreNegatif = event.currentTarget.checked;
  saveData();
}

function onChangeAllowSimpleIfTournoiDouble(event) {
  settings.allowSimpleIfTypeTournoiDouble = event.currentTarget.checked;
  saveData();
}
function onChangeActiveTargetTimeTour(event) {
  settings.activeTargetTimeTour = event.currentTarget.checked;
  saveData();
  renderPreparationSection();
}
function onChangeAllowDDForbidden(event) {
  settings.DDForbidden = event.currentTarget.checked;
  saveData();
}
function onChangeAllowDHForbidden(event) {
  settings.DHForbidden = event.currentTarget.checked;
  saveData();
}
function onChangeAllowDMForbidden(event) {
  settings.DMForbidden = event.currentTarget.checked;
  saveData();
}

function renderStats() {
  const stats = document.getElementById("stats-tournament-panel");

  stats.innerHTML = `
  ${settings.typeTournoi == "double" ? 
    (currentNbCoequipierRepetee == 0
      ? `<span class="p-2">✅ Aucun coéquipier identique</span>`
      : `<span class="p-2">❌ ${currentNbCoequipierRepetee} coéquipiers répétés</span>`)
      : ""
  }

  ${
    settings.typeTournoi == "double" ? 
    (currentNbAdversaireDoubleRepetee + currentNbAdversaireSimpleRepetee == 0
      ? `<span class="p-2">✅ Aucun adversaire identique</span>`
      : `<span class="p-2">⚠ ${currentNbAdversaireDoubleRepetee + currentNbAdversaireSimpleRepetee} adversaires répétés</span>`)
      : ""
  }

  ${
    currentNbJoueursAttente == 0
      ? `<span class="p-2">✅ Aucun joueur en attente</span>`
      : `<span class="p-2">⚠ ${currentNbJoueursAttente} joueurs en attente </span>`
  }

  ${
    currentNbEgaliteSexeNonRespecte == 0
      ? `<span class="p-2">✅ Aucun problème de mixité</span>`
      : `<span class="p-2">⚠ ${currentNbEgaliteSexeNonRespecte} problèmes de mixité</span>`
  }

  ${
    currentNbEcartMaxNonRespecte == 0
      ? `<span class="p-2">✅ Aucun problème d'écart de point</span>`
      : `<span class="p-2">⚠ ${currentNbEcartMaxNonRespecte} problèmes d'écart de point</span>`
  }
  
`;
}

// -- UTILITAIRES --
function shuffle(array) {
  return array
    .map((x) => [Math.random(), x])
    .sort()
    .map((x) => x[1]);
}

function getLevelScore(p) {
  return levelValue[p.level] || 0;
}

function attentePenalty(joueurs, joueursAttente) {
  let penalty = 0;
  for (const joueur of joueurs) {
    const attente = joueursAttente[joueur.id] || 0;
    // pénalité exponentielle (2^n - 1) : 0, 1, 3, 7, 15...
    penalty += Math.pow(2, attente) - 1;
  }
  return penalty;
}

function sameTeamCount(p1, p2, currentPlanning) {
  let count = 0;
  for (const tour of currentPlanning) {
    for (const match of tour.matchs) {
      const team1Ids = match.team1.map((p) => p.id);
      const team2Ids = match.team2.map((p) => p.id);
      if (
        (team1Ids.includes(p1.id) && team1Ids.includes(p2.id)) ||
        (team2Ids.includes(p1.id) && team2Ids.includes(p2.id))
      ) {
        count++;
      }
    }
  }
  return count;
}

function sameOpponentCount(p1, p2, currentPlanning) {
  let count = 0;
  for (const tour of currentPlanning) {
    for (const match of tour.matchs) {
      const team1Ids = match.team1.map((p) => p.id);
      const team2Ids = match.team2.map((p) => p.id);
      if (
        (team1Ids.includes(p1.id) && team2Ids.includes(p2.id)) ||
        (team2Ids.includes(p1.id) && team1Ids.includes(p2.id))
      ) {
        count++;
      }
    }
  }
  return count;
}

function getMatchStartScore(match) {
  const joueurs = [...match.team1, ...match.team2];
  return joueurs.reduce((acc, p) => acc + getLevelScore(p), 0);
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) {
      result.push([arr[i], ...p]);
    }
  }
  return result;
}


function getInitialScore(team1, team2) {
  let scoreTeam1 = team1.reduce((acc, p) => acc + getLevelScore(p), 0);
  let scoreTeam2 = team2.reduce((acc, p) => acc + getLevelScore(p), 0);
  const minScore = Math.min(scoreTeam1, scoreTeam2);
  const maxScore = Math.max(scoreTeam1, scoreTeam2);
  const diff = settings.isScoreNegatif
    ? minScore - maxScore
    : maxScore - minScore;
  if (settings.isScoreNegatif) {
    return [
      scoreTeam1 >= scoreTeam2 ? 0 : diff,
      scoreTeam1 >= scoreTeam2 ? diff : 0,
    ];
  } else {
    return [
      scoreTeam1 >= scoreTeam2 ? diff : 0,
      scoreTeam1 >= scoreTeam2 ? 0 : diff,
    ];
  }
}

async function optimisePlanning() {

  addProgressBar();
  const container = document.getElementById("label2-progress-bar");
    container.innerHTML = `
      <center>
        <span>Démarrage ...</span> </br> 
      </center>
    `;

  showSection("tournament");
  togglePanel();

  const n = players.length;
  const t = settings.terrains;
  const k = settings.tours;
  const typeTournoiDouble = settings.typeTournoi === "double";
  const DHForbidden = settings.DHForbidden || false;
  const DDForbidden = settings.DDForbidden || false;
  const DMForbidden = settings.DMForbidden || false;
  const allowSimpleIfTypeTournoiDouble = settings.allowSimpleIfTypeTournoiDouble || false;
  const ecartMax = settings.ecartMax || null;

  let coequipierRepetee;
  let adversaireSimpleRepetee;
  let adversaireDoubleRepetee;
  
  // on attribue un id unique aux joueurs
  players = players.map((p, index) => ({ ...p , id: index }));

  let equipesPossibleSimple; 
  let equipesPossibleDouble;
  let matchPossibleSimple; 
  let matchPossibleDouble;
  let matchsPossibleTour;

  scoreDistribution = Infinity;
  let meilleureDistribution = null;

  let nbAdversaireSimpleRepetee;
  let nbAdversaireDoubleRepetee;
  let nbCoequipierRepetee;
  let nbEgaliteSexeNonRespecte;
  let nbEcartMaxNonRespecte;

  let playersIds = players.map((p) => p.id);
  let curPlayersIds = null;
  let curPlayersIdsAttente = null;
  let curMatchPossibleTourSimple = null;
  nbDistributionTeste = 0;
  while (scoreDistribution != 0 &&!stopRequested) {

    if (stopRequested) break;
    if (scoreDistribution  == 0) break;

    coequipierRepetee = {};
    adversaireSimpleRepetee = {};
    adversaireDoubleRepetee = {};
    curPlayersIds = shuffle(playersIds); //melangeJoueurs[iter];
    curPlayersIdsAttente = shuffle(playersIds);
    equipesPossibleSimple = getEquipesPossibleSimple(curPlayersIds, coequipierRepetee);
    equipesPossibleDouble = typeTournoiDouble ? getEquipesPossibleDouble(curPlayersIds, DHForbidden, DDForbidden, DMForbidden) : [];
    matchPossibleSimple = getMatchsPossibleSimple(equipesPossibleSimple, adversaireSimpleRepetee);
    matchPossibleDouble = typeTournoiDouble ? getMatchsPossibleDouble(equipesPossibleDouble, adversaireDoubleRepetee, coequipierRepetee) : [];
    matchsPossibleTour = typeTournoiDouble ? [...matchPossibleDouble] : [...matchPossibleSimple];

    nbAdversaireSimpleRepetee = 0;
    nbAdversaireDoubleRepetee = 0;
    nbCoequipierRepetee = 0;
    nbEgaliteSexeNonRespecte = 0;
    nbEcartMaxNonRespecte = 0;
    coequipierRepetee = {};
    adversaireSimpleRepetee = {};
    adversaireDoubleRepetee = {};

    const attenteJoueurs = {};
    const currentDistribution = [];
    let currentScore = 0;
    currentNbJoueursAttente = 0;
    let curMatchsPossibleTour = [];   

    for (let indexTour = 0; indexTour < k; indexTour++) {

      if (curMatchsPossibleTour.length == 0){
        curMatchsPossibleTour = [...matchsPossibleTour];
        curMatchsPossibleTour = shuffle(curMatchsPossibleTour);
      }

      //on met de côté les joueurs qui vont attendre
      curPlayersIdsAttente = shuffle(curPlayersIdsAttente);
      const joueursByAttente = [...curPlayersIdsAttente].sort((a, b) => {
        const attenteA = attenteJoueurs[a] || 0;
        const attenteB = attenteJoueurs[b] || 0;
        return attenteA - attenteB;
      });

      const currentJoueursAttente = [];
      let nbJoueurAttente = n - (t * (typeTournoiDouble ? 4 : 2));
      if (nbJoueurAttente < 0) {
        nbJoueurAttente = typeTournoiDouble ? n%4 : n%2;
        if (typeTournoiDouble && allowSimpleIfTypeTournoiDouble && nbJoueurAttente >= 2){
          nbJoueurAttente -= 2;
        }
      }

      for(let i = 0; i < nbJoueurAttente; i++){
        //on prend une fois au début, une fois à la fin pour les attentes
        const joueurAttente = joueursByAttente[i]; 
        currentJoueursAttente.push(joueurAttente);
        attenteJoueurs[joueurAttente] = (attenteJoueurs[joueurAttente] || 0) + 1;
      }

      const matchsTour = [];
      const joueursUtilises = new Set();
      for (let indexTerrain = 0; indexTerrain < t; indexTerrain++) {
        
        //si plus assez de joueurs
        if (n - joueursUtilises.size < (typeTournoiDouble ? 4 : 2)){
          if (typeTournoiDouble){
            if (allowSimpleIfTypeTournoiDouble){
              curMatchPossibleTourSimple = [...matchPossibleSimple];
            }else{
              break;
            }
          }else{
              break;
          }
        }

        let curMatchPossible = curMatchPossibleTourSimple != null ? curMatchPossibleTourSimple : curMatchsPossibleTour;
        let indexMatch = 0;
        for (indexMatch = 0 ; indexMatch < curMatchPossible.length; indexMatch++){
          //const nbJoueurRestant = n - joueursUtilises.size();
          let curMatch = curMatchPossible[indexMatch];
          //if (nbEssai > 0) break;
          if (!curMatch[0].some(val => joueursUtilises.has(val)) &&
          !curMatch[1].some(val => joueursUtilises.has(val)) &&
          !curMatch[0].some(val => currentJoueursAttente.includes(val)) &&
          !curMatch[1].some(val => currentJoueursAttente.includes(val))){
            break;
          }
          curMatchPossible.splice(indexMatch, 1);
          indexMatch--;
        }

        if (curMatchPossible.length == 0) {
          curMatchsPossibleTour = [...matchsPossibleTour];
          curMatchsPossibleTour = shuffle(curMatchsPossibleTour);
          continue;
        }

        const match = curMatchPossible[indexMatch];
        matchsTour.push(match);
        for (let j = 0; j < match[0].length; j++){
          joueursUtilises.add(match[0][j]);
        }
        for (let j = 0; j < match[1].length; j++){
          joueursUtilises.add(match[1][j]);
        }
        curMatchPossible.splice(indexMatch, 1);

        //adversaire répété
        if (match[0].length == 1){
          if (adversaireSimpleRepetee[match[0][0]] && adversaireSimpleRepetee[match[0][0]][match[1][0]]) {
            adversaireSimpleRepetee[match[0][0]][match[1][0]]++;
            nbAdversaireSimpleRepetee++;
          } else {
            if (adversaireSimpleRepetee[match[0][0]] == undefined){
              adversaireSimpleRepetee[match[0][0]] = {};
            }
            adversaireSimpleRepetee[match[0][0]][match[1][0]] = 1;
          }
          if (adversaireSimpleRepetee[match[1][0]] && adversaireSimpleRepetee[match[1][0]][match[0][0]]) {
            adversaireSimpleRepetee[match[1][0]][match[0][0]]++;
            nbAdversaireSimpleRepetee++;
          } else {
            if (adversaireSimpleRepetee[match[1][0]] == undefined){
              adversaireSimpleRepetee[match[1][0]] = {};
            }
            adversaireSimpleRepetee[match[1][0]][match[0][0]] = 1;
          }
          
        } else if (match[0].length > 1){
          if (adversaireDoubleRepetee[match[0][0]] && adversaireDoubleRepetee[match[0][0]][match[1][0]]) {
            adversaireDoubleRepetee[match[0][0]][match[1][0]]++;
            nbAdversaireDoubleRepetee++;
          } else {
            if (adversaireDoubleRepetee[match[0][0]] == undefined){
              adversaireDoubleRepetee[match[0][0]] = {};
            }
            adversaireDoubleRepetee[match[0][0]][match[1][0]] = 1;
          }
          if (adversaireDoubleRepetee[match[1][0]] && adversaireDoubleRepetee[match[1][0]][match[0][0]]) {
            adversaireDoubleRepetee[match[1][0]][match[0][0]]++;
            nbAdversaireDoubleRepetee++;
          } else{
            if (adversaireDoubleRepetee[match[1][0]] == undefined){
              adversaireDoubleRepetee[match[1][0]] = {};
            }
            adversaireDoubleRepetee[match[1][0]][match[0][0]] = 1;
          }
          if (adversaireDoubleRepetee[match[0][1]] && adversaireDoubleRepetee[match[0][1]][match[1][1]]) {
            adversaireDoubleRepetee[match[0][1]][match[1][1]]++;
            nbAdversaireDoubleRepetee++;
          } else {
            if (adversaireDoubleRepetee[match[0][1]] == undefined){
              adversaireDoubleRepetee[match[0][1]] = {};
            }
            adversaireDoubleRepetee[match[0][1]][match[1][1]] = 1;
          }
          if (adversaireDoubleRepetee[match[1][1]] && adversaireDoubleRepetee[match[1][1]][match[0][1]]) {
            adversaireDoubleRepetee[match[1][1]][match[0][1]]++;
            nbAdversaireDoubleRepetee++;
          } else {
            if (adversaireDoubleRepetee[match[1][1]] == undefined){
              adversaireDoubleRepetee[match[1][1]] = {};
            }
            adversaireDoubleRepetee[match[1][1]][match[0][1]] = 1;
          }
        }
        //coequipier répété
        if (match[0].length > 1){
          if (coequipierRepetee[match[0][0]] && coequipierRepetee[match[0][0]][match[0][1]]) {
            coequipierRepetee[match[0][0]][match[0][1]]++;
            nbCoequipierRepetee++;
          } else {
            if (coequipierRepetee[match[0][0]] == undefined){
              coequipierRepetee[match[0][0]] = {};
            }
            coequipierRepetee[match[0][0]][match[0][1]] = 1;
          }
          if (coequipierRepetee[match[0][1]] && coequipierRepetee[match[0][1]][match[0][0]]) {
            coequipierRepetee[match[0][1]][match[0][0]]++;
            nbCoequipierRepetee++;
          } else {
            if (coequipierRepetee[match[0][1]] == undefined){
              coequipierRepetee[match[0][1]] = {};
            }
            coequipierRepetee[match[0][1]][match[0][0]] = 1;
          }
          if (coequipierRepetee[match[1][0]] && coequipierRepetee[match[1][0]][match[1][1]]) {
            coequipierRepetee[match[1][0]][match[1][1]]++;
            nbCoequipierRepetee++;
          } else {
            if (coequipierRepetee[match[1][0]] == undefined){
              coequipierRepetee[match[1][0]] = {};
            }
            coequipierRepetee[match[1][0]][match[1][1]] = 1;
          }
          if (coequipierRepetee[match[1][1]] && coequipierRepetee[match[1][1]][match[1][0]]) {
            coequipierRepetee[match[1][1]][match[1][0]]++;
            nbCoequipierRepetee++;
          } else {
            if (coequipierRepetee[match[1][1]] == undefined){
              coequipierRepetee[match[1][1]] = {};
            }
            coequipierRepetee[match[1][1]][match[1][0]] = 1;
          }
        }

        //égalité des sexe
        const nbHommeEquipe1 = match[0].reduce((acc, joueur) => acc + (isHomme(joueur) ? 1 : 0), 0);
        const nbHommeEquipe2 = match[1].reduce((acc, joueur) => acc + (isHomme(joueur) ? 1 : 0), 0);
        if (nbHommeEquipe1 !== nbHommeEquipe2){
            currentScore += 1 * settings.priorities.sexe;
            nbEgaliteSexeNonRespecte++;
        }

        //écart de niveau
        const [initialScoreTeam1, initialScoreTeam2] = getInitialScore(match[0],match[1]);
        match["initialScoreTeam1"] = initialScoreTeam1;
        match["initialScoreTeam2"] = initialScoreTeam2;
        match["scoreTeam1"] = initialScoreTeam1;
        match["scoreTeam2"] = initialScoreTeam2;
        const ecart = Math.abs(initialScoreTeam1 - initialScoreTeam2);
        if (ecart > ecartMax){
          currentScore += 1 * settings.priorities.niveau;
          nbEcartMaxNonRespecte++;
        }

      }

      //init
      curMatchPossibleTourSimple = null;

      currentScore += (nbAdversaireSimpleRepetee + nbAdversaireDoubleRepetee) * settings.priorities.adversaire;
      currentScore += nbCoequipierRepetee * settings.priorities.equipier;
      
      currentDistribution.push({ matchs: matchsTour, attente: currentJoueursAttente });
      currentNbJoueursAttente += currentJoueursAttente.length;

    }

    nbDistributionTeste++;

    if (currentScore < scoreDistribution){
      scoreDistribution = currentScore;
      currentNbEcartMaxNonRespecte = nbEcartMaxNonRespecte;
      currentNbEgaliteSexeNonRespecte = nbEgaliteSexeNonRespecte;
      currentNbAdversaireDoubleRepetee = nbAdversaireDoubleRepetee;
      currentNbAdversaireSimpleRepetee = nbAdversaireSimpleRepetee;
      currentNbCoequipierRepetee = nbCoequipierRepetee;
      meilleureDistribution = { 
        distribution: currentDistribution, 
        score: currentScore, 
        attente: attenteJoueurs 
      };
    }

    const container = document.getElementById("label2-progress-bar");
    container.innerHTML = `
      <center>
        <span>Meilleur score : ${scoreDistribution} </span> </br> 
        <span class="text-sm">Il faut avoir le score le plus petit possible</span> </br> 
        <div class="w-full">Nombre de distribution testée : ${nbDistributionTeste} </div>
      </center>
    `;
    renderTournament();
    renderPanelTournament();
    await new Promise((r) => requestAnimationFrame(r));

  }

  if (meilleureDistribution == null){
    alert("Aucune distribution trouvée");
  }else{
    planning = transformerDistribution(meilleureDistribution);
    saveData();
    renderTournament();
    renderPanelTournament();
  }

  document.body.removeChild(loader);
  stopRequested = false;

}

function getLevel(playerId){
  const player = players.find(p => p.id === playerId);
  return player ? levelValue[player.level] : 0;
}

function isHomme(playerId){
  const player = players.find(p => p.id === playerId);
  return player && player.gender === "H";
}

function getEquipesPossibleSimple(playersIds){
  const retour = [];
  for (let i = 0; i < playersIds.length; i++) {
    retour.push([playersIds[i]]);
  }
  //console.log("Equipes simple :", retour);
  return retour;
}

function getMatchsPossibleSimple(equipePossibles){
  const retour = [];
  let nbIterations = equipePossibles.length;
  let compt = 1;
  for (let i = 0; i < nbIterations; i++) {
    for (let j = compt; j < nbIterations; j++) {
      retour.push([equipePossibles[i], equipePossibles[j]]);
    }
    compt++;
  }
  //console.log("Matchs simple :", retour);
  return retour;
}

function getEquipesPossibleDouble(playersIds, DHForbidden, DDForbidden, DMForbidden){
  const retour = [];
  let nbIterations = playersIds.length;
  let compt = 1;
  for (let i = 0; i < nbIterations; i++) {
    for (let j = compt; j < nbIterations; j++) {
      const isHommeP1 = isHomme(playersIds[i]);
      const isHommeP2 = isHomme(playersIds[j]);
      if ((isHommeP1 && isHommeP2 && DHForbidden) ||
          (!isHommeP1 && !isHommeP2 && DDForbidden) ||
          ((isHommeP1 != isHommeP2) && DMForbidden)){
            continue;
          }
      retour.push([playersIds[i], playersIds[j]]);
    }
    compt++;
  }
  //console.log("Equipes double :", retour);
  return retour;
}

function getMatchsPossibleDouble(equipePossibles){
  const retour = [];
  let nbIterations = equipePossibles.length;
  let compt = 1;
  for (let i = 0; i < nbIterations; i++) {
    for (let j = compt; j < nbIterations; j++) {
      //si un joueur est répété dans les deux équipes, on skip  
      if (equipePossibles[i][0] == equipePossibles[j][0] ||
          equipePossibles[i][0] == equipePossibles[j][1] ||
          equipePossibles[i][1] == equipePossibles[j][0] ||
          equipePossibles[i][1] == equipePossibles[j][1]){
            continue;
          } 
      retour.push([equipePossibles[i], equipePossibles[j]]);
    }
    compt++;
  }
  //console.log("Match double :", retour);
  return retour;
}

function transformerDistribution(obj) {

  return obj["distribution"].map(tour => {
    const matchsTransformes = tour.matchs.map(match => {
      //const matchId = `${match[0].map(j => j.id).sort().join('-')}-${match[1].map(j => j.id).sort().join('-')}`;
      return {
        team1: match[0].map(j =>  players.find(p => p.id === j)),
        team2: match[1].map(j =>  players.find(p => p.id === j)),
        scoreTeam1: match.scoreTeam1,
        scoreTeam2: match.scoreTeam2,
        initialScoreTeam1: match.initialScoreTeam1,
        initialScoreTeam2: match.initialScoreTeam2
      };
    });
    const attentes = tour.attente.map(id => players.find(p => p.id === id));
    return {
      attentes: attentes,
      matchs: matchsTransformes,
    };
  });
}

function stopRequest() {
  stopRequested = true;
}

function addProgressBar() {
  const loader = document.createElement("div");
  loader.id = "loader";
  loader.style.position = "fixed";
  loader.style.top = "0";
  loader.style.left = "0";
  loader.style.width = "100%";
  loader.style.height = "100%";
  loader.style.background = "rgba(255,255,255,0.8)";
  loader.style.display = "flex";
  loader.style.flexDirection = "column";
  loader.style.alignItems = "center";
  loader.style.justifyContent = "center";
  loader.style.zIndex = "1000";
  const loaderCirc = document.createElement("div");
  loaderCirc.className = "loader";
  /* const progress = document.createElement("progress");
  progress.id = "progress-bar";
  progress.max = 1000;
  progress.value = 0;*/
  const title = document.createElement("div");
  title.style.marginTop = "1em";
  title.id = "title-progress-bar";
  title.innerHTML = `<center><span class="flex flex-col w-80" >Génération du tournoi en cours... </br> </br><button class="btn-secondary" onclick="stopRequest()"> Arrêter la recherche </button></span> </br>
  <span style="font-size:0.8em; font-style:italic;">La meilleure distribution sera retenue</span> </center>`;
  const label = document.createElement("div");
  label.style.marginTop = "1em";
  label.id = "label-progress-bar";
  label.innerHTML = ``;
  const label2 = document.createElement("div");
  label2.style.marginTop = "1em";
  label2.id = "label2-progress-bar";
  label2.classList.add("w-full")
  label2.innerHTML = ``;
  loader.appendChild(loaderCirc);
  //loader.appendChild(progress);
  loader.appendChild(title);
  loader.appendChild(label);
  loader.appendChild(label2);
  document.body.append(loader);
}

function simplifierNombre(nombre) {
  const suffixes = [
    {
      seuil: 1e36,
      suffixe: "undécillions",
      metaphors: [
        "le nombre d’univers dans le multivers selon certaines théories",
        "le nombre de notes de musique jouées si chaque particule vibrait",
        "le nombre d’univers que pourrait simuler un ordinateur divin",
        "le nombre de moments vécus si le temps était fractal",
        "le nombre d’étoiles dans toutes les galaxies de 1000 univers",
      ],
    },
    {
      seuil: 1e33,
      suffixe: "décillions",
      metaphors: [
        "le nombre d’atomes dans un petit astéroïde",
        "le nombre de scénarios de parties d’échecs possibles en 1 siècle",
        "le nombre de respirations qu’un humain pourrait prendre en 1 milliard d’années",
        "le nombre de livres imaginables en combinant tous les mots du dictionnaire",
        "le nombre d’émotions ressenties par une civilisation immortelle",
      ],
    },
    {
      seuil: 1e30,
      suffixe: "nonillions",
      metaphors: [
        "le nombre de planètes qu’on pourrait imaginer dans des univers parallèles",
        "le nombre de rêves faits par toute l'humanité depuis l'aube du temps",
        "le nombre de permutations possibles d’une bibliothèque infinie",
        "le nombre de grains de poussière dans tous les déserts de toutes les galaxies",
        "le nombre de combinaisons possibles d’une vie humaine au choix près",
      ],
    },
    {
      seuil: 1e27,
      suffixe: "octillions",
      metaphors: [
        "le nombre d’atomes dans une cuillère d’hélium",
        "le nombre de combinaisons de parties de Tetris sur 100 planètes",
        "le nombre de gouttelettes dans toutes les pluies de l'histoire",
        "le nombre de variations possibles d'une symphonie de Beethoven",
        "le nombre de microbes dans 1 milliard d’écosystèmes",
      ],
    },
    {
      seuil: 1e24,
      suffixe: "septillions",
      metaphors: [
        "le nombre d'atomes dans un grain de sel multiplié par toute la Voie Lactée",
        "le nombre de brins d’herbe si chaque planète était un champ",
        "le nombre de secondes dans 100 milliards d’années",
        "le nombre de pixels si chaque centimètre de la Terre était un écran 8K",
        "le nombre de pensées que pourrait avoir une intelligence artificielle éternelle",
      ],
    },
    {
      seuil: 1e21,
      suffixe: "sextillions",
      metaphors: [
        "le nombre de bactéries dans tous les océans de la Terre",
        "le nombre d’empreintes digitales sur toutes les planètes d'une galaxie",
        "le nombre de clics de souris possibles en 10 vies humaines",
        "le nombre de flocons de neige tombés depuis le début de l'humanité",
        "le nombre de neurones simulés dans un superordinateur infini",
      ],
    },
    {
      seuil: 1e18,
      suffixe: "quintillions",
      metaphors: [
        "le nombre d’atomes dans une goutte d’eau",
        "le nombre de mots prononcés par l’humanité en 1 000 ans",
        "le nombre de plumes que 1 milliard d'oies pourraient perdre",
        "le nombre de photos qu’on pourrait prendre chaque jour pendant des millénaires",
        "le nombre d’étoiles dans 1 million de galaxies",
      ],
    },
    {
      seuil: 1e15,
      suffixe: "quadrillions",
      metaphors: [
        "le nombre de fourmis sur Terre pendant 1 million d'années",
        "le nombre de grains de sable sur toutes les plages du monde",
        "le nombre de cellules dans 10 000 corps humains",
        "le nombre de battements de cœur de l’humanité en une semaine",
        "le nombre de secondes écoulées depuis la naissance de la Terre",
      ],
    },
  ];

  for (let i = 0; i < suffixes.length; i++) {
    if (nombre >= suffixes[i].seuil) {
      const val = (nombre / suffixes[i].seuil).toFixed(2);
      const metaphor =
        suffixes[i].metaphors[
          Math.floor(Math.random() * suffixes[i].metaphors.length)
        ];
      return `${val} ${suffixes[i].suffixe} <br/><i>≈ ${metaphor}</i>`;
    }
  }
  return nombre.toLocaleString();
}
