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

const description = {
  equipier: {
    label: "Coéquipier non répété",
    desc: "Evite de rejouer plusieurs fois avec le même équipier",
  },
  attente: {
    label: "Attente minimum",
    desc: "Evite d'attendre plusieurs fois, essaye de répartir les attentes sur tout le monde",
  },
  adversaire: {
    label: "Adversaire non répété",
    desc: "Evite de rejouer plusieurs fois contre le même adversaire",
  },
  sexe: {
    label: "Egalité des sexe",
    desc: "Evite de faire jouer un mixte contre un double ou un double homme contre un double dame",
  },
  niveau: {
    label: "Ecart maximum de niveau",
    desc: "Essaye de respecter l'écart maximum pour les niveau, défini par points bonus attribués aux niveaux",
  },
  limitTime: {
    label: "Temps limite par tour",
    desc: "Si le temps est à 0 alors il n'y a pas de temps limite",
  },
  victoire: {
    label: "Victoire",
    desc: "Match remporté avec plus de 2 points d'écart",
  },
  "petite victoire": {
    label: "Petite victoire",
    desc: "Match remporté avec seulement 2 points d'écart",
  },
  défaite: {
    label: "Défaite",
    desc: "Match perdu",
  },
};

const defaultConfig = {
  terrains: 7,
  tours: 8,
  ecartMax: 10,
  priorities: {
    equipier: 100,
    attente: 50,
    adversaire: 20,
    sexe: 2,
    niveau: 1,
  },
  isScoreNegatif: false,
  attribPoint: { victoire: 5, "petite victoire": 2, défaite: 0 },
  limitTime: 0,
};
let tournoi = JSON.parse(localStorage.getItem("gen-tournoi") || "{}");
let players = tournoi.players || [];
let settings = tournoi.settings || defaultConfig;
let scores = tournoi.scores || {};
let planning = tournoi.planning || [];
let currentTour = tournoi.currentTour === undefined ? -1 : tournoi.currentTour;
let currentEditMatchIndex = -1;
let currentStopTimer = null;

let opponentsMap = {}; // { playerName: { opponentName: count } }
let teammateMap = {}; // { playerName: { teammateName: count } }
let waitCount = {};
let sexeIssues = [];
let niveauIssues = [];

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
  if (confirm("Reset ?")) {
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
    })
  );
}

function regenerate() {
  if (
    confirm("Un tournoi existe déjà, il va être perdu, voulez vous-continuer ?")
  ) {
    currentTour = -1;
    prepareOptimise();
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
      <div class="flex flex-col flex-auto min-w-96">
        <label for="terrains-value" class="mb-2">Nombre de terrains</label> 
          <div class="flex items-center justify-between">
            <div class="slider-param-terrains flex-auto mr-6"> </div>
            <span id="terrains-value" class="w-8">${settings.terrains} </span>
          </div>
      </div>
      <div class="flex flex-col flex-auto min-w-96">
        <label for="tours-value" class="mb-2">Nombre de tours</label> 
        <div class="flex items-center justify-between">
            <div class="slider-param-tours flex-auto mr-6"> </div>
            <span id="tours-value" class="w-8">${settings.tours} </span>
          </div>
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
            <button class="btn-primary rounded min-w-12" type="submit" id="addPlayer">Ajouter</button>
          </div>
      </form>
      <div id="playerList" class="m-5 flex flex-wrap gap-4"></div>
    </div>

    <footer class="footer flex justify-end">
    ${
      /*➜*/
      planning.length == 0
        ? `
      <button class="btn-primary" onclick="prepareOptimise(); optimisePlanning();"> 🏆 Générer le tournoi</button>
      `
        : `
      <div class="flex justify-between w-full p-2">
        <button class="btn-secondary" onclick="regenerate();"> ↺ Régénérer le tournoi</button>
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
        min: 0,
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
        min: 0,
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

  const sliderLimitTime = document.body.querySelector(
    ".slider-param-tps-limit"
  );
  if (sliderLimitTime) {
    noUiSlider.create(sliderLimitTime, {
      start: parseInt(settings.limitTime),
      connect: [true, false],
      step: 1,
      range: {
        min: 0,
        max: 60,
      },
    });
    sliderLimitTime.noUiSlider.on("slide", (values, handle) => {
      const val = parseInt(values[handle]);
      settings.limitTime = val;
      document.getElementById("tps-limit-value").innerHTML =
        val == 0 ? val + " min" : "Pas de temps limite par tour";
      saveData();
    });
    sliderLimitTime.noUiSlider.on("end", (values, handle) => {
      renderPreparationSection();
    });
  }
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
              : `Tour ${currentTour + 1}`
          }</span>
          
          ${
            currentTour != -1 && currentTour != null
              ? `<span class="justify-center inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-yellow-600/20 ring-inset" id="tps-ecoule-${currentTour}"> </span>`
              : ``
          }
          
        </div>
        ${
          true /*currentTour == -1 || currentTour === null*/
            ? `<button onclick="togglePanel()">⚙️ Paramètres</button>`
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
                                      ${renderTeam(match.team1, "", "")}
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
                                          ontouchstart="(event) => { event.preventDefault(); startTouchScore(true, '${
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
                                            ontouchstart="(event) => { event.preventDefault(); startTouchScore(false, '${
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
                                           ontouchstart="(event) => { event.preventDefault(); startTouchScore(true, '${
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
                                           ontouchstart="(event) => { event.preventDefault(); startTouchScore(false, '${
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
                                      "flex-row-reverse",
                                      ""
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
                                        ${renderTeam(match.team1, "", "")}
                                    </div>
                                    <div class="separator-vertical ${
                                      currentTour === indexTour ? "mx-2" : ""
                                    }"></div>
                                    <div class="flex flex-col flex-1 overflow-hidden items-end">
                                        ${renderTeam(
                                          match.team2,
                                          "flex-row-reverse",
                                          ""
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
      return matchClosed + " / " + nbMatchTotal;
      //return nbMatchTotal - matchClosed + ` match${s} restant${s}`;
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
          <div class="flex justify-between player-tournament player-tournament-${
            player.gender
          } ${customClass}">
          <span class="block truncate">${player.name}</span>
          ${getLevelTournament(player, customStyle)}
          </div>
          
        `;
      })
      .join("")}`;
}

function renderSliderScore(id) {
  return `<div id="${id}" class="slider-score flex-auto m-4 h-24"> </div>`;
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
        <button onclick="exportResultsToPDF()">📄 Exporter en PDF</button>
      <button onclick="togglePanel()">⚙️ Paramètres</button>
    </div>

    <div id="listResult" class="w-full flex flex-col justify-center items-center">
      <div class="flex w-96 justify-between items-center mt-8">
        <h1 class="text-xl">Résultats</h1>
        <span class="text-xl">Durée : ${getTpsTotal()}</span>
      </div>
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
    </div>
  </div>`;
}

function toggleMenu() {
  const menu = document.getElementById("menu-contextuel");
  menu.style.display = menu.style.display === "none" ? "block" : "none";
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
  let valeur = ecoule;

  let prefixe = "";
  if (settings.limitTime != 0) {
    valeur = settings.limitTime - ecoule;
    if (valeur < 0) {
      prefixe = "-";
      valeur = Math.abs(valeur);
    }
  }

  if (formatInteger)
    return settings.limitTime != null ? prefixe + valeur : ecoule;

  const jours = Math.floor(valeur / 86400);
  const heures = Math.floor((valeur % 86400) / 3600);
  const minutes = Math.floor((valeur % 3600) / 60);
  const secondes = valeur % 60;

  if (jours >= 1) return `${prefixe}+ de ${jours} jour${jours > 1 ? "s" : ""}`;
  if (heures > 0) return `${prefixe}${heures}h ${minutes}' ${secondes}''`;
  if (minutes > 0) return `${prefixe}${minutes}' ${secondes}''`;
  return `${prefixe}${secondes}''`;
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
        <span>Options avancées </span>
        <span>▼</span>
        </button> 
  <div class="accordion-content flex-wrap gap-4 w-full"> 
  <h3>Gestion du tournoi</h3>
    <div class="flex flex-col flex-auto min-w-96">
      <label for="tps-limit-value" class="mb-2">Temps limite par tour</label> 
      <div class="flex items-center justify-between">
          <div class="slider-param-tps-limit flex-auto mr-6"> </div>
          <span id="tps-limit-value" class="w-8">${settings.limitTime} </span>
        </div>
    </div>
  <h3>Poids des contraintes</h3>
  ${Object.entries(settings.priorities)
    .map(
      ([priority, poids]) =>
        `<label class="flex justify-between items-center">
            <span class="w-12">${priority}</span>
            <div id="slider-contrainte-${priority}" class="slider-contrainte w-64 flex-auto mx-6 my-2"> </div>
            <span id="slider-contrainte-label-${priority}" class="w-12">${poids}</span>
          </label>`
    )
    .join("")}
    
  </div>`;
  return retour;
}

function onInputSlider(e, from, priority, refreshTournament) {
  settings.priorities[priority] = parseInt(e.currentTarget.value);
  document.getElementById(from + "_value_slider_" + priority).innerHTML =
    e.currentTarget.value;
  saveData();
  if (refreshTournament) {
    generePlanning().then(() => {
      renderTournament();
      renderStats();
    });
  }
}

function onInputScore(e, from, priority, refreshTournament) {
  /*settings.priorities[priority] = parseInt(e.currentTarget.value);
  document.getElementById(from + "_value_slider_" + priority).innerHTML =
    e.currentTarget.value;
  saveData();
  if (refreshTournament) {
    generePlanning().then(() => {
      renderTournament();
      renderStats();
    });
  }*/
}

function renderPanelTournament() {
  const panel = document.getElementById("panel");
  panel.innerHTML = `
  <h3 class="header flex justify-between items-center">
  ⚙️ Paramètres
  <button onclick="togglePanel(true);">✖</button>
  </h3>
  ${"" /*<div id="contrainte-panel">*/}
  ${"" /*renderContraintes("panel", true)*/}
  
  <h3 class="sous-header flex justify-between">
  📊 Contraintes <button onclick="evaluerPlanning();renderStats();">↺</button>
  </h3>
  <div id="stats-tournament-panel" class="flex flex-col"></div>
  <h3 class="sous-header flex justify-between">
  ⚙️ Handicaps et avantages
  </h3>
  <div id="handicap-tournament-panel" class="flex flex-col"></div>
  `;
  evaluerPlanning();
  renderStats();
  renderHandicapTournament();
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

function evaluerPlanning() {
  let total = 0,
    invalids = 0;
  opponentsMap = {}; // { playerName: { opponentName: count } }
  teammateMap = {}; // { playerName: { teammateName: count } }
  waitCount = {};
  sexeIssues = [];
  niveauIssues = [];

  planning.forEach((tour, tourIdx) => {
    const playersInTour = new Set();
    tour.matchs.forEach((match, matchIdx) => {
      const allPlayers = [...match.team1, ...match.team2];
      allPlayers.forEach((p) => playersInTour.add(p.name));

      match.team1.forEach((p1) => {
        match.team2.forEach((p2) => {
          opponentsMap[p1.name] = opponentsMap[p1.name] || {};
          opponentsMap[p1.name][p2.name] =
            (opponentsMap[p1.name][p2.name] || 0) + 1;
        });
      });

      [match.team1, match.team2].forEach((team) => {
        team.forEach((p1) => {
          team.forEach((p2) => {
            if (p1.name !== p2.name) {
              teammateMap[p1.name] = teammateMap[p1.name] || {};
              teammateMap[p1.name][p2.name] =
                (teammateMap[p1.name][p2.name] || 0) + 1;
            }
          });
        });
      });

      const s1 = scores[`${tourIdx}-${matchIdx}-t1`];
      const s2 = scores[`${tourIdx}-${matchIdx}-t2`];
      if (typeof s1 === "number" && typeof s2 === "number") {
        total++;
        if (
          !(
            s1 >= 21 &&
            s2 >= 0 &&
            Math.abs(s1 - s2) >= 2 &&
            s1 <= 32 &&
            s2 <= 32
          )
        )
          invalids++;
        j;
      }

      const isMixte = (team) =>
        team.filter((p) => p.gender === "F").length === 1;
      const isDoubleHomme = (team) => team.every((p) => p.gender === "M");
      const isDoubleFemme = (team) => team.every((p) => p.gender === "F");

      const team1Mixte = isMixte(match.team1);
      const team2Mixte = isMixte(match.team2);
      const team1H = isDoubleHomme(match.team1);
      const team2H = isDoubleHomme(match.team2);
      const team1F = isDoubleFemme(match.team1);
      const team2F = isDoubleFemme(match.team2);

      if (
        (team1Mixte && (team2H || team2F)) ||
        (team2Mixte && (team1H || team1F)) ||
        (team1H && team2F) ||
        (team2H && team1F)
      ) {
        sexeIssues.push({
          tour: tourIdx + 1,
          terrain: matchIdx + 1,
          team1: match.team1.map((p) => p.name).join(" & "),
          team2: match.team2.map((p) => p.name).join(" & "),
        });
      }

      const ecart = Math.abs(match.initialScoreTeam1 - match.initialScoreTeam2);
      if (ecart > settings.ecartMax) {
        niveauIssues.push({
          tour: tourIdx + 1,
          terrain: matchIdx + 1,
          ecart,
        });
      }
    });

    players.forEach((p) => {
      if (!playersInTour.has(p.name)) {
        waitCount[p.name] = waitCount[p.name] || [];
        waitCount[p.name].push(tourIdx + 1);
      }
    });
  });

  let score = 0;

  // Adversaires rencontrés plusieurs fois
  let repeatOpponentCount = 0;
  for (const key in opponentsMap) {
    repeatOpponentCount += Object.entries(opponentsMap[key]).reduce(
      (acc, data) => (acc + data > 1 ? data - 1 : 0)
    );
  }
  repeatOpponentCount /= 2;
  score += repeatOpponentCount * settings.priorities.adversaire;

  // Coéquipiers répétés
  let repeatTeammateCount = 0;
  for (const key in teammateMap) {
    repeatTeammateCount += Object.entries(teammateMap[key]).length;
  }
  score += repeatTeammateCount * settings.priorities.equipier;

  // Nombre total d'attentes
  const totalWaits = Object.values(waitCount).reduce((a, b) => a + b.length, 0);
  score += totalWaits * settings.priorities.attente;

  // Problèmes d'équilibre des sexes
  score += sexeIssues.length * settings.priorities.sexe;

  // Problèmes d'écart de niveau
  score += niveauIssues.length * settings.priorities.niveau;

  return score;
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
  const handicapTournament = document.getElementById(
    "handicap-tournament-panel"
  );
  handicapTournament.innerHTML = `
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
    </label>

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
      evaluerPlanning();
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
      evaluerPlanning();
      renderStats();
    });
  }
}

function onChangeScoreNegatif(event) {
  settings.isScoreNegatif = event.currentTarget.checked;
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
  renderTournament();
}

function renderStats() {
  const stats = document.getElementById("stats-tournament-panel");

  const waitList = Object.entries(waitCount).sort(
    (a, b) => b[1].length - a[1].length
  );

  const coequipierContrainte = renderAccordions(teammateMap, "");
  const nbCoequipierContrainte = Object.entries(teammateMap).reduce(
    (acc, [p, data]) =>
      acc +
      Object.entries(data).reduce(
        (acc2, [p2, data2]) => acc2 + (data2 > 1 ? data2 - 1 : 0),
        0
      ),
    0
  );
  const adversaireContrainte = renderAccordions(opponentsMap, "");
  const nbAdversaireContrainte = Object.entries(opponentsMap).reduce(
    (acc, [p, data]) =>
      acc +
      Object.entries(data).reduce(
        (acc2, [p2, data2]) => acc2 + (data2 > 1 ? data2 - 1 : 0),
        0
      ),
    0
  );

  stats.innerHTML = `
  ${
    coequipierContrainte == ""
      ? `<span class="p-2">✅ Aucun coéquipier identique</span>`
      : `<button class="accordion p-2 flex justify-between items-center" onclick="this.classList.toggle('open')">
          <span>❌ ${nbCoequipierContrainte} coéquipiers répétés</span>
          <span>▼</span>
        </button>
      </div>
      <div class="accordion-content">
        <div class="flex flex-col w-full pl-4">
          ${coequipierContrainte}
        </div>
      </div>`
  }

  ${
    adversaireContrainte == ""
      ? `<span class="p-2">✅ Aucun adversaire identique</span>`
      : `<button class="accordion p-2 flex justify-between items-center" onclick="this.classList.toggle('open')">
          <span>⚠ ${nbAdversaireContrainte} adversaires répétés</span>
          <span>▼</span>
        </button>
       <div class="accordion-content">
        <div class="flex flex-col w-full pl-4">
          ${adversaireContrainte}
        </div>
      </div>`
  }

  ${
    waitList.length == 0
      ? `<span class="p-2">✅ Aucun joueur en attente</span>`
      : `<button class="accordion p-2 flex justify-between items-center" onclick="this.classList.toggle('open')">
        <span>⚠ ${waitList.length} joueurs en attente </span>
        <span>▼</span>
        </button> 
        <div class="accordion-content pl-4">
        <div class="flex flex-col w-full">
           ${waitList
             .map(
               ([name, tours]) => `
                <button class="accordion" onclick="this.classList.toggle('open')">
                  <div class="flex pl-4">
                    <span class="w-full">+ ${name}</span>
                    <span class="justify-center inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-yellow-600/20 ring-inset">x${
                      tours.length
                    }</span>
                  </div></button>
                <div class="accordion-content pl-4">
                  <div class="flex flex-wrap pl-4 gap-1">
                    ${tours
                      .map(
                        (t) =>
                          `<span class="justify-center inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-yellow-600/20 ring-inset" >Tour ${t}</span>`
                      )
                      .join("")}
                  </div>
                </div>
              `
             )
             .join("")}
        </div>
      </div>`
  }

  ${
    sexeIssues.length == 0
      ? `<span class="p-2">✅ Aucun problème de mixité</span>`
      : `<button class="accordion p-2 flex justify-between items-center" onclick="this.classList.toggle('open')">
          <span>⚠ ${sexeIssues.length} problèmes de mixité</span>
          <span>▼</span>
        </button> 
        <div class="accordion-content">
          <div class="flex flex-col w-full">
            ${sexeIssues
              .map((item) => {
                return `
                <button class="accordion w-full flex justify-between" onclick="this.classList.toggle('open')">
                  <span class="w-full">+ Tour ${item.tour} - Terrain ${item.terrain}</span> 
                </button>
                <div class="accordion-content pl-4">
                  <div class="flex flex-col w-full">
                    <span class="flex justify-between w-full p-2 pl-4 ">${item.team1} vs ${item.team2}</span>
                  </div>
                </div>`;
              })
              .join("")}
          </div>
        </div>`
  }

  ${
    niveauIssues.length == 0
      ? `<span class="p-2">✅ Aucun problème d'écart de point</span>`
      : `<button class="accordion p-2 flex justify-between items-center" onclick="this.classList.toggle('open')">
      <span>⚠ ${niveauIssues.length} problèmes d'écart de point</span>
        <span>▼</span>
        </button> 
    <div class="accordion-content pl-4">
      <div class="flex flex-col w-full">
      ${niveauIssues
        .map((item) => {
          return `<div>
          <span class="flex justify-between w-full p-2 pl-4 "> Tour ${item.tour} - Terrain ${item.terrain} : Ecart ${item.ecart} </span>
        </div>
        `;
        })
        .join("")}
      </div>
    </div>`
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

function matchScore(team1, team2, currentPlanning, joueursAttente, params) {
  combinaisonsTeste++;
  let score = 0;
  const { equipier, adversaire, attente, sexe, niveau } = params;

  // Coéquipiers déjà ensemble
  let sameCount1 = sameTeamCount(team1[0], team1[1], currentPlanning);
  if (sameCount1 > 0) {
    score += sameCount1 * equipier; //score += Math.pow(equipier, 2); // ou Math.pow(attente + 1, 1.5) //score -= sameCount1 * equipier;
  }
  let sameCount2 = sameTeamCount(team2[0], team2[1], currentPlanning);
  if (sameCount2 > 0) {
    score += sameCount2 * equipier; //score += Math.pow(equipier, 2); //score -= sameCount2 * equipier;
  }

  // Adversaires déjà rencontrés
  for (const p1 of team1) {
    for (const p2 of team2) {
      let sameOpponent1 = sameOpponentCount(p1, p2, currentPlanning);
      if (sameOpponent1 > 0) score += sameOpponent1 * adversaire;
    }
  }

  // Attente minimisée
  const tousLesJoueurs = [...team1, ...team2];
  tousLesJoueurs.forEach((p) => {
    const nbAttente = joueursAttente[p.id] || 0;
    score += nbAttente * attente; //score += Math.pow(nbAttente, 2); // ou Math.pow(attente + 1, 1.5)
  });

  // Mixité
  const mixte = (t) => t.filter((p) => p.gender === "F").length === 1;
  if (!(mixte(team1) && mixte(team2))) score += 1 * sexe;

  // Écart de niveau max autorisé
  const tous = [...team1, ...team2];
  const ecart =
    Math.max(...tous.map((p) => getLevelScore(p))) -
    Math.min(...tous.map((p) => getLevelScore(p)));
  if (ecart > settings.ecartMax) score += 1 * niveau;

  return score;
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

function compositeScore(
  team1,
  team2,
  currentPlanning,
  joueursAttente,
  priorities,
  coequipiersMap
) {
  let score = matchScore(
    team1,
    team2,
    currentPlanning,
    joueursAttente,
    priorities
  );

  // Bonus pour joueurs ayant attendu
  const bonusAttente = [...team1, ...team2].reduce((acc, p) => {
    const attente = joueursAttente[p.id] || 0;
    return acc + Math.pow(attente, 3); // exponentiel
  }, 0);

  return score - bonusAttente;
}

// -- GÉNÉRATION DU PLANNING --
async function generePlanning() {
  return new Promise(async (resolve, reject) => {
    try {
      let currentPlanning = [];
      let joueursAttente = {};
      let coequipiersMap = {};
      maxTries = 3000; // ou settings.maxTries si défini
      permutationUsed = [];
      let nbTries = 0;
      for (let tour = 0; tour < settings.tours; tour++) {
        const joueursUtilises = new Set();
        const tourMatches = [];

        for (let terrain = 0; terrain < settings.terrains; terrain++) {
          const combinaisons = [];
          let playersShuffle = shuffle(players);
          // Construire liste des joueurs disponibles
          const disponibles = playersShuffle.filter(
            (p) => !joueursUtilises.has(p.id)
          );
          if (disponibles.length < 4) break;
          permutationTotal = factorial(disponibles.length);

          const nbBoucle = Math.min(maxTries, permutationTotal);
          for (let t = 0; t < nbBoucle; t++) {
            const groupe = getPermutationsJoueur(disponibles);
            if (groupe == null) break;

            const team1 = [groupe[0], groupe[1]];
            const team2 = [groupe[2], groupe[3]];
            const score = compositeScore(
              team1,
              team2,
              currentPlanning,
              joueursAttente,
              settings.priorities,
              coequipiersMap
            );
            combinaisons.push({ team1, team2, score });
            nbTries++;
          }

          combinaisons.sort((a, b) => a.score - b.score);
          for (const comb of combinaisons) {
            const [initialScoreTeam1, initialScoreTeam2] = getInitialScore(
              comb.team1,
              comb.team2
            );
            tourMatches.push({
              team1: comb.team1,
              team2: comb.team2,
              scoreTeam1: initialScoreTeam1,
              scoreTeam2: initialScoreTeam2,
              initialScoreTeam1,
              initialScoreTeam2,
            });
            comb.team1.forEach((p) => joueursUtilises.add(p.id));
            comb.team2.forEach((p) => joueursUtilises.add(p.id));
            [...comb.team1, ...comb.team2].forEach((p, _, arr) => {
              if (!coequipiersMap[p.id]) coequipiersMap[p.id] = new Set();
              arr.forEach((autre) => {
                if (autre.id !== p.id) coequipiersMap[p.id].add(autre.id);
              });
            });

            break;
            //on ne prend que le premier
          }

          permutationUsed = [];
        }
        // Marquer les joueurs qui n'ont pas joué
        players.forEach((p) => {
          if (!joueursUtilises.has(p.id)) {
            joueursAttente[p.id] = (joueursAttente[p.id] || 0) + 1;
          }
        });

        currentPlanning.push({
          startDate: null,
          endDate: null,
          matchs: tourMatches,
        });

        combinaisonsTeste += nbTries;
        const container = document.getElementById("label-progress-bar");
        container.innerHTML = `
              <center>
                <span>Combinaisons testées : ${combinaisonsTeste}
              </span></center>
            `;
        await new Promise((r) => requestAnimationFrame(r));
      }
      resolve({ currentPlanning, nbTries });
    } catch (e) {
      console.error("error generatePlanning", e);
      reject();
    }
  });
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

let bestPlanning = null;
let bestScore = -Infinity;
let bestScoreStat = -Infinity;
let scoreStat = -Infinity;
let stopRequested = false;
let shuffledOrders = null;
let shuffledOrdersIndex = -1;
let totalOrdersMessage = null;
let totalOrders = null;
let contraintesUsed = [];
const rangeContraintes = {
  attente: [10, 20],
  equipier: [8, 10],
  sexe: [6, 8],
  adversaire: [4, 6],
  niveau: [2, 4],
};
let contraintesPossible = null;
let permutationUsed = [];
let permutationTotal = null;
let permutationInitiale = null;
let combinaisonsTeste = null;

function prepareOptimise() {
  contraintesUsed = [];
  contraintesPossible = generateConstraintCombinations(rangeContraintes);
  permutationInitiale = factorial(players.length);
  addProgressBar();
  console.log(checkRepetitionCoherence(players.length, settings.tours));
}

/*function getOrder() {
  let candidateOrder = null;
  while (ordersUsed.length < totalOrders) {
    let random = Math.floor(Math.random() * totalOrders);
    if (!ordersUsed.includes(random)) {
      candidateOrder = getNthPermutation(players, random);
      ordersUsed.push(random);
      break;
    }
  }
  return candidateOrder;
}
*/

function getSettingsPriorities() {
  let candidateSettingsPriorities = null;
  while (contraintesUsed.length < contraintesPossible.length) {
    let random = Math.floor(Math.random() * contraintesPossible.length);
    if (!contraintesUsed.includes(random)) {
      candidateSettingsPriorities = contraintesPossible[random];
      contraintesUsed.push(random);
      break;
    }
  }
  return candidateSettingsPriorities;
}

function getPermutationsJoueur(disponibles) {
  let candidatePermutation = null;
  while (permutationUsed.length < permutationTotal) {
    let random = Math.floor(Math.random() * permutationTotal);
    if (!permutationUsed.includes(random)) {
      candidatePermutation = getNthPermutation(disponibles, random);
      permutationUsed.push(random);
      break;
    }
  }
  return candidatePermutation;
}

async function optimisePlanning() {
  showSection("tournament");
  renderPanelTournament();
  togglePanel();

  let historyBestPlanning = [];
  bestScore = Infinity;
  permutationTotal = factorial(players.length);
  combinaisonsTeste = 0;
  planning = [];
  bestPlanning = null;
  stopRequested = false;
  const tentative = 1000;
  for (let i = 0; i < tentative && !stopRequested; i++) {
    const obj = await generePlanning();
    const score = evaluerPlanning();
    if (score < bestScore) {
      bestScore = score;
      bestPlanning = obj.currentPlanning;
      historyBestPlanning.push(`${bestScore / 10} % `);
      renderTournament();
      renderStats();
      const container = document.getElementById("label2-progress-bar");
      container.innerHTML = `
              <center>
                <span>Meilleur score : ${bestScore} </span> </br> <span class="text-sm">Il faut avoir le score le plus petit possible</span></center>
            `;
      await new Promise((r) => requestAnimationFrame(r));
    }
    if (score === 0) break;
  }

  if (bestPlanning) {
    planning = bestPlanning;
    saveData();
    renderPreparationSection();
    renderTournament();
    evaluerPlanning();
    renderStats();
  }
  document.body.removeChild(loader);
  stopRequested = false;
  bestPlanning = null;
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
  label2.innerHTML = ``;
  loader.appendChild(loaderCirc);
  //loader.appendChild(progress);
  loader.appendChild(title);
  loader.appendChild(label);
  loader.appendChild(label2);
  document.body.append(loader);
}

/*function generateShuffledOrders(maxTries) {
  const seen = new Set();
  const results = [];
  const totalOrders = factorial(players.length);

  while (results.length < maxTries && results.length < totalOrders) {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const key = shuffled.map((p) => p.id).join("-");
    if (!seen.has(key)) {
      seen.add(key);
      results.push(shuffled);
    }
  }

  return results;
}*/

function factorial(n) {
  return n <= 1 ? 1 : n * factorial(n - 1);
}
function getNthPermutation(arr, n) {
  const result = [];
  const items = [...arr];
  let k = n;

  for (let i = arr.length; i > 0; i--) {
    const f = factorial(i - 1);
    const index = Math.floor(k / f);
    result.push(items[index]);
    items.splice(index, 1);
    k = k % f;
  }

  return result;
}

function generateConstraintCombinations(ranges) {
  const keys = Object.keys(ranges);
  const result = [];

  function backtrack(index, current) {
    if (index === keys.length) {
      result.push({ ...current });
      return;
    }

    const key = keys[index];
    for (const value of ranges[key]) {
      current[key] = value;
      backtrack(index + 1, current);
    }
  }

  backtrack(0, {});
  return result;
}

//let lastUpdateTime = 0;

async function updateProgressBar(
  combinaisonsTeste,
  permutationInitiale,
  contraintesPossible,
  i
) {
  const now = Date.now();
  //if (now - lastUpdateTime < 5000) return;
  //lastUpdateTime = now;

  const container = document.getElementById("label-progress-bar");
  //container.classList.remove("visible");

  //await new Promise((resolve) => setTimeout(resolve, 500)); // fondu sortant
  await new Promise((r) => requestAnimationFrame(r));
  //await new Promise(requestAnimationFrame); // libère le thread UI

  container.innerHTML = `
    <center>
      <span>${Math.round((i / contraintesPossible.length) * 100)} %</span> </br>
      <span>Combinaisons testées : ${combinaisonsTeste}
    </span></center>
  `;

  /*container.innerHTML = `
    <center><span style="text-align: center; width: 100px;">
      Combinaisons testées : ${combinaisonsTeste} </br>
      seulement ${
        (combinaisonsTeste / permutationInitiale) *
        contraintesPossible.length *
        100
      } % </br> 
      sur  </br>${simplifierNombre(
        permutationInitiale * contraintesPossible.length
      )}
    </span></center>
  `;*/

  //container.classList.add("visible");
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

function checkRepetitionCoherence(nJoueurs, nTours) {
  const maxCoequipiersUnics = nJoueurs - 1;
  if (nTours > maxCoequipiersUnics) {
    return `⚠️ Impossible sans répétition : ${nTours} > ${maxCoequipiersUnics}`;
  } else {
    return `✅ Possible sans répétition (en théorie)`;
  }
}

function exportResultsToPDF() {
  const element = document.getElementById("listResult"); // div contenant les résultats
  const opt = {
    margin: 0.5,
    filename: "resultats-tournoi.pdf",
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
  };
  html2pdf().set(opt).from(element).save();
}
