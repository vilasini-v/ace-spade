const socket = io();

let code = '';
let me = '';
let state = null;
let lastWinner = null;


const $ = id =>
  document.getElementById(id);


const sym = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣'
};


// =========================
// ERROR MESSAGE
// =========================

function err(msg) {

  $('lobbyMsg').textContent = msg;

  $('gameMsg').textContent = msg;
}


// =========================
// TUTORIAL
// =========================

function openTutorial() {

  $('tutorial')
    .classList
    .remove('hidden');
}


function closeTutorial() {

  $('tutorial')
    .classList
    .add('hidden');
}


$('tutorialBtn').onclick =
  openTutorial;


$('closeTutorial').onclick =
  closeTutorial;


$('tutorialDone').onclick =
  closeTutorial;


$('tutorial').onclick = e => {

  if (
    e.target === $('tutorial')
  ) {
    closeTutorial();
  }

};


// =========================
// CREATE GAME
// =========================

$('create').onclick = () => {

  const name =
    $('name').value.trim() ||
    'Player';


  socket.emit(
    'createGame',
    { name },
    result => {

      if (!result.ok) {
        return err(result.error);
      }


      code = result.code;

      me = result.playerId;

      enterGame();

    }
  );

};


// =========================
// JOIN GAME
// =========================

$('join').onclick = () => {

  const name =
    $('name').value.trim() ||
    'Player';


  const roomCode =
    $('code')
      .value
      .trim()
      .toUpperCase();


  if (!roomCode) {
    return err(
      'Enter a room code.'
    );
  }


  socket.emit(
    'joinGame',
    {
      name,
      code: roomCode
    },
    result => {

      if (!result.ok) {
        lobbyMsg.textContent = result.error;
        return;
      }


      code = result.code;

      me = result.playerId;

      enterGame();

    }
  );

};


// =========================
// ENTER GAME
// =========================

function enterGame() {

  $('lobby')
    .classList
    .add('hidden');


  $('game')
    .classList
    .remove('hidden');


  $('roomCode')
    .textContent = code;
}


// =========================
// RETURN TO LOBBY
// =========================

function leaveToLobby() {

  socket.emit(
    'leaveGame',
    { code },
    () => {}
  );


  state = null;

  lastWinner = null;


  $('celebration')
    .classList
    .add('hidden');


  $('game')
    .classList
    .add('hidden');


  $('lobby')
    .classList
    .remove('hidden');


  $('gameMsg').textContent = '';

  $('lobbyMsg').textContent = '';
}


$('exitGame').onclick =
  leaveToLobby;


$('newGame').onclick =
  leaveToLobby;


$('celebrateExit').onclick =
  leaveToLobby;


$('celebrateNew').onclick =
  leaveToLobby;


// =========================
// RECEIVE GAME STATE
// =========================

socket.on(
  'state',
  newState => {

    const previousWinner =
      lastWinner;


    state = newState;


    render();


    if (
      newState.winnerId &&
      newState.winnerId !==
      previousWinner
    ) {

      showCelebration(
        newState.winnerId
      );

    }


    lastWinner =
      newState.winnerId ||
      null;

  }
);


// =========================
// WINNER CELEBRATION
// =========================

function showCelebration(id) {

  const winner =
    state.players.find(
      player =>
        player.id === id
    );


  if (!winner) {
    return;
  }


  $('winnerName')
    .textContent =
    `${winner.name} wins!`;


  $('celebration')
    .classList
    .remove('hidden');
}


// =========================
// RENDER
// =========================

function render() {

  if (!state) {
    return;
  }


  // -----------------------
  // PLAYER LIST
  // -----------------------

  $('players').innerHTML =
    state.players
      .map(player => {

        return `
          <div
            class="player
              ${player.id === state.turnPlayerId ? 'turn' : ''}
              ${player.id === me ? 'me' : ''}
            "
          >

            ${escapeHtml(player.name)}

            ${
              player.id ===
              state.turnPlayerId
                ? ' ◀'
                : ''
            }

          </div>
        `;

      })
      .join('');



  // -----------------------
  // STATUS
  // -----------------------

  if (state.winnerId) {

    const winner =
      state.players.find(
        player =>
          player.id ===
          state.winnerId
      );


    $('status').innerHTML = `
      <div class="winner">
        ${escapeHtml(winner?.name || 'Player')}
        wins! ♠
      </div>
    `;

  } else if (state.started) {

    $('status').innerHTML = `
      Round ${state.roundNumber}
      ·
      ${
        state.leadSuit
          ? `Follow ${sym[state.leadSuit]}`
          : 'Choose any card to lead'
      }
    `;

  } else {

    $('status').textContent =
      'Waiting for game to start';

  }



  // -----------------------
  // TABLE
  // -----------------------

  $('trick').innerHTML =
    state.trick
      .map(item => {

        const player =
          state.players.find(
            p =>
              p.id ===
              item.playerId
          );


        return `
          <div>

            <div
              class="card
                ${red(item.card)}
                played-card
              "
            >
              ${item.card.rank}
              ${sym[item.card.suit]}
            </div>

            <small>
              ${escapeHtml(player?.name || '')}
            </small>

          </div>
        `;

      })
      .join('');



  // -----------------------
  // YOUR HAND
  // -----------------------

  const mePlayer =
    state.players.find(
      p => p.id === me
    );


  $('turnHint').textContent =
    mePlayer
      ? (
          state.turnPlayerId === me
            ? ' · YOUR TURN'
            : ''
        )
      : '';


  $('hand').innerHTML =
    (
      mePlayer?.hand || []
    )
      .map(card => {

        const playable =
          canPlay(card);


        return `
          <button
            class="
              card
              ${red(card)}
              ${
                playable
                  ? 'playable'
                  : 'disabled-card'
              }
            "
            ${
              playable
                ? ''
                : 'disabled'
            }
            onclick="
              play('${card.id}')
            "
          >
            ${card.rank}
            ${sym[card.suit]}
          </button>
        `;

      })
      .join('');



  // -----------------------
  // START BUTTON
  // -----------------------

  let extra = '';


  if (
    !state.started &&
    state.players.length >= 3
  ) {

    extra = `
      <button onclick="start()">
        Start game
      </button>
    `;

  }


  $('gameMsg').innerHTML =
    (state.message || '') +
    ` ${extra}`;
}


// =========================
// CAN PLAY?
// =========================

function canPlay(card) {

  if (
    !card ||
    !state.started ||
    state.winnerId ||
    state.turnPlayerId !== me
  ) {

    return false;
  }


  // First move of game MUST be A♠.

  if (
    !state.trick.length &&
    state.roundNumber === 1
  ) {

    return card.id === 'AS';
  }


  // Following suit.

  if (
    state.leadSuit &&
    card.suit !== state.leadSuit
  ) {

    const mePlayer =
      state.players.find(
        p => p.id === me
      );


    // If player has the suit,
    // off-suit cards are disabled.

    if (
      mePlayer.hand.some(
        c =>
          c.suit ===
          state.leadSuit
      )
    ) {

      return false;
    }

    // Otherwise this card can CUT.

    return true;
  }


  return true;
}


// =========================
// PLAY
// =========================

function play(id) {

  const mePlayer =
    state.players.find(
      p => p.id === me
    );


  const card =
    mePlayer?.hand?.find(
      c => c.id === id
    );


  if (!canPlay(card)) {
    return;
  }


  socket.emit(
    'playCard',
    {
      code,
      cardId: id
    },
    result => {

      if (!result.ok) {
        err(result.error);
      }

    }
  );
}


// =========================
// START
// =========================

function start() {

  socket.emit(
    'startGame',
    { code },
    result => {

      if (!result.ok) {
        err(result.error);
      }

    }
  );
}


// =========================
// HELPERS
// =========================

function red(card) {

  return (
    card.suit === 'H' ||
    card.suit === 'D'
  )
    ? 'red'
    : '';
}


function escapeHtml(value) {

  return String(value)
    .replace(
      /[&<>"']/g,
      match => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[match])
    );
}


window.play = play;
window.start = start;