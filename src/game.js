const SUITS = [
  'S',
  'H',
  'D',
  'C'
];

const RANKS = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A'
];

const VALUE = Object.fromEntries(
  RANKS.map((rank, index) => [
    rank,
    index + 2
  ])
);


// -------------------------
// DECK
// -------------------------

function deck() {

  return SUITS.flatMap(
    suit =>
      RANKS.map(
        rank => ({
          id: rank + suit,
          suit,
          rank
        })
      )
  );
}


// -------------------------
// SHUFFLE
// -------------------------

function shuffle(array) {

  for (
    let i = array.length - 1;
    i > 0;
    i--
  ) {

    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [
      array[i],
      array[j]
    ] = [
      array[j],
      array[i]
    ];
  }

  return array;
}


// -------------------------
// CREATE GAME
// -------------------------

function createGame(code) {

  return {
    code,

    players: [],

    started: false,

    turnIndex: 0,

    leadSuit: null,

    trick: [],

    cut: false,

    winnerId: null,

    roundNumber: 0,

    message: 'Waiting for players…'
  };
}


// -------------------------
// JOIN GAME
// -------------------------

function joinGame(game, playerId, name) {
  if (game.started) {
    throw new Error('Game has already started.');
  }

  if (game.players.length >= 8) {
    throw new Error('Room is full.');
  }

  const cleanName = name.trim();

  if (!cleanName) {
    throw new Error('Please enter your name.');
  }

  const nameExists = game.players.some(
    player => player.name.toLowerCase() === cleanName.toLowerCase()
  );

  if (nameExists) {
    throw new Error('Name exists in this room.');
  }

  game.players.push({
    id: playerId,
    name: cleanName,
    hand: [],
    connected: true
  });

  return game.players[game.players.length - 1];
}

// -------------------------
// START GAME
// -------------------------

function startGame(
  game,
  socketId
) {

  if (game.started) {
    throw Error(
      'Game already started.'
    );
  }

  if (game.players.length < 3) {
    throw Error(
      'ACE SPADE needs at least 3 players.'
    );
  }

  const cards = shuffle(deck());

  game.players.forEach(
    player => {
      player.hand = [];
    }
  );


  // Deal cards equally.
  //
  // If the number doesn't divide evenly,
  // the first player(s) receive the extra card.

  cards.forEach(
    (card, index) => {

      game.players[
        index % game.players.length
      ].hand.push(card);

    }
  );


  game.started = true;

  game.roundNumber = 1;

  game.trick = [];

  game.leadSuit = null;

  game.cut = false;

  game.winnerId = null;


  // Find A♠.
  const starter =
    game.players.findIndex(
      player =>
        player.hand.some(
          card => card.id === 'AS'
        )
    );


  game.turnIndex = starter;


  game.message =
    `${game.players[starter].name} has A♠ and starts.`;
}


// -------------------------
// CURRENT PLAYER
// -------------------------

function currentPlayer(game) {

  return game.players[
    game.turnIndex
  ];
}


// -------------------------
// FIND CARD
// -------------------------

function cardById(
  player,
  id
) {

  return player.hand.find(
    card => card.id === id
  );
}


// -------------------------
// HAS SUIT
// -------------------------

function hasSuit(
  player,
  suit
) {

  return player.hand.some(
    card => card.suit === suit
  );
}


// -------------------------
// PLAY CARD
// -------------------------

function playCard(
  game,
  socketId,
  cardId
) {

  if (
    !game.started ||
    game.winnerId
  ) {
    throw Error(
      'Game is not active.'
    );
  }


  const player =
    currentPlayer(game);


  if (
    player.id !== socketId
  ) {
    throw Error(
      'It is not your turn.'
    );
  }


  const card =
    cardById(
      player,
      cardId
    );


  if (!card) {
    throw Error(
      'That card is not in your hand.'
    );
  }


  // FIRST MOVE OF THE ENTIRE GAME
  // MUST BE A♠.

  if (
    game.trick.length === 0 &&
    game.roundNumber === 1 &&
    card.id !== 'AS'
  ) {

    throw Error(
      'The first card of the game must be A♠.'
    );
  }


  // ---------------------------------
  // FOLLOW SUIT
  // ---------------------------------

  if (
    game.leadSuit &&
    card.suit !== game.leadSuit
  ) {

    // Player has the lead suit.
    // They are NOT allowed to play
    // another suit.

    if (
      hasSuit(
        player,
        game.leadSuit
      )
    ) {

      throw Error(
        `You must follow ${symbol(game.leadSuit)}.`
      );
    }


    // Player does NOT have the lead suit.
    // Therefore this is a CUT.

    player.hand =
      player.hand.filter(
        c => c.id !== cardId
      );

    game.trick.push({
      playerId: player.id,
      card
    });


    const leadWinner =
      highestLead(
        game.trick,
        game.leadSuit
      );


    resolveCut(
      game,
      leadWinner,
      player.name
    );

    return;
  }


  // ---------------------------------
  // NORMAL CARD
  // ---------------------------------

  player.hand =
    player.hand.filter(
      c => c.id !== cardId
    );


  // First card establishes the suit.

  if (
    game.trick.length === 0
  ) {

    game.leadSuit =
      card.suit;
  }


  game.trick.push({
    playerId: player.id,
    card
  });


  // Everybody has played.

  if (
    game.trick.length ===
    game.players.length
  ) {

    resolveNormal(game);

    return;
  }


  // Next player clockwise.

  game.turnIndex =
    (
      game.turnIndex + 1
    ) %
    game.players.length;


  game.message =
    `${player.name} played ${label(card)}.`;
}


// -------------------------
// HIGHEST LEAD SUIT CARD
// -------------------------

function highestLead(
  trick,
  suit
) {

  return trick
    .filter(
      item =>
        item.card.suit === suit
    )
    .reduce(
      (best, item) => {

        if (
          !best ||
          VALUE[item.card.rank] >
          VALUE[best.card.rank]
        ) {
          return item;
        }

        return best;

      },
      null
    );
}


// -------------------------
// NORMAL ROUND RESOLUTION
// -------------------------

function resolveNormal(game) {

  const winner =
    highestLead(
      game.trick,
      game.leadSuit
    );


  const winnerPlayer =
    game.players.find(
      p =>
        p.id === winner.playerId
    );


  game.message =
    `${winnerPlayer.name} wins the round with ${label(winner.card)}.`;


  // Played cards are discarded
  // after a normal round.


  // WIN CONDITION
  //
  // Check only after the round
  // has completely resolved.

  const emptyPlayer =
    game.players.find(
      p => p.hand.length === 0
    );


  if (emptyPlayer) {

    game.winnerId =
      emptyPlayer.id;

    game.trick = [];

    game.leadSuit = null;

    return;
  }


  // Winner starts next round.

  game.turnIndex =
    game.players.findIndex(
      p =>
        p.id === winnerPlayer.id
    );


  game.trick = [];

  game.leadSuit = null;

  game.roundNumber++;
}


// -------------------------
// CUT RESOLUTION
// -------------------------

function resolveCut(
  game,
  leadWinner,
  cutterName
) {

  const winnerPlayer =
    game.players.find(
      p =>
        p.id === leadWinner.playerId
    );


  // Every card played in this round
  // goes into the hand of the player
  // who had the highest card of the
  // starting suit.

  const cards =
    game.trick.map(
      item => item.card
    );


  winnerPlayer.hand.push(
    ...cards
  );


  game.message =
    `${cutterName} CUT. ${winnerPlayer.name} takes the cards with ${label(leadWinner.card)}.`;


  // Check winner after round resolves.

  const emptyPlayer =
    game.players.find(
      p => p.hand.length === 0
    );


  if (emptyPlayer) {

    game.winnerId =
      emptyPlayer.id;

    game.trick = [];

    game.leadSuit = null;

    return;
  }


  // Winner starts next round.

  game.turnIndex =
    game.players.findIndex(
      p =>
        p.id === winnerPlayer.id
    );


  game.trick = [];

  game.leadSuit = null;

  game.cut = false;

  game.roundNumber++;
}


// -------------------------
// PUBLIC STATE
// -------------------------

function getPublicState(game) {

  return {

    code: game.code,

    started: game.started,

    roundNumber: game.roundNumber,

    turnPlayerId:
      game.started
        ? game.players[
            game.turnIndex
          ]?.id
        : null,

    leadSuit:
      game.leadSuit,

    trick:
      game.trick.map(
        item => ({
          playerId: item.playerId,
          card: item.card
        })
      ),

    winnerId:
      game.winnerId,

    message:
      game.message,

    players:
      game.players.map(
        player => ({
          id: player.id,

          name: player.name,

          // This is kept internally for
          // game logic, but the UI below
          // does NOT display it.

          count:
            player.hand.length,

          hand:
            player.hand
        })
      )
  };
}


// -------------------------
// SUIT SYMBOL
// -------------------------

function symbol(suit) {

  return {
    S: '♠',
    H: '♥',
    D: '♦',
    C: '♣'
  }[suit];
}


// -------------------------
// CARD LABEL
// -------------------------

function label(card) {

  return `${card.rank}${symbol(card.suit)}`;
}


module.exports = {
  createGame,
  joinGame,
  startGame,
  playCard,
  getPublicState
};