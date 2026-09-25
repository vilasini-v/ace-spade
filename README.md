# ACE SPADE

Local multiplayer core loop for the ACE SPADE card game.

## Run locally

Requirements: Node.js 18+.

```bash
npm install
npm start
```

Open **http://localhost:3000**.

For local testing, open the URL in 3 browser windows/tabs, use different names, create a room in the first window, enter the room code in the other two, then start the game.

### Rules implemented
- 3–8 players.
- Standard 52-card deck.
- Cards are dealt as evenly as possible; with 3 players one player receives 18 cards.
- A♠ holder starts and must play A♠.
- Clockwise turns.
- Players must follow the lead suit if they have it.
- If they do not have the lead suit, any card they play is an automatic CUT and the round ends immediately.
- On a CUT, the highest card of the lead suit already played wins and takes every card played in that round into their hand.
- If everyone follows suit, the highest card of the lead suit wins and the played cards are set aside.
- The round winner starts the next round with any card.
- Ace is always highest.
- A player wins only after the round has resolved and their hand is empty.

## Architecture

- `server.js`: Express + Socket.IO server and room management.
- `src/game.js`: server-authoritative game rules/state.
- `public/`: lightweight client UI.

The browser never decides whether a move is legal; the server validates turns, suits, CUTs, and the win condition.
