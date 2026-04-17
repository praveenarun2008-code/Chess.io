# Chess Practice

Chess Practice is a browser-based chess game with a clean menu screen, a playable board, offline AI support, clocks, move history, captured pieces, and standard chess flow such as promotion and draw detection.

## Features

- Play locally in the browser
- Play against AI or switch to local two-player mode
- AI difficulty levels: `Easy`, `Medium`, and `Hard`
- Move history panel
- Captured pieces tracker
- Chess clocks for both sides
- Pawn promotion dialog
- Draw detection:
  - Stalemate
  - Insufficient material
  - Fifty-move rule
  - Threefold repetition
- Undo and restart controls

## Tech Stack

- HTML
- CSS
- JavaScript
- Vite

## Getting Started

### Requirements

- Node.js `20.19.0` or higher

### Install

```bash
npm install
```

### Run the project

```bash
npm run dev
```

Vite will start a local development server. Open the local URL shown in the terminal.

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

## How To Play

1. Open the game in your browser.
2. On the menu page, choose whether to play against AI.
3. Select the AI difficulty if AI mode is enabled.
4. Click `Start Match`.
5. On the board, click one of your pieces.
6. Click a highlighted destination square to move it.
7. Continue until one side wins or the game ends in a draw.

## Game Manual

### Menu

- `Play vs AI: On` lets you play against the computer.
- If AI is turned off, the game becomes local two-player mode.
- `AI Difficulty` changes how strong the AI plays.
- `Start Match` opens the player area and begins the game.

### Player Area

The player area includes:

- `Live status` for current game messages
- `Game info` cards for position, move count, phase, and tension
- `Controls` for restart, undo, and menu
- `Move history` showing white and black moves
- `Captured pieces` for both sides
- `Clocks` for white and black

### Controls

- Click a piece to select it
- Click a legal target square to move
- `Undo Move` reverts the latest move
- In AI mode, undo can step back both your move and the AI reply
- `Restart Match` resets the board
- `Menu` returns to the menu screen

### Special Rules Supported

- Castling
- En passant
- Pawn promotion
- Check
- Checkmate
- Stalemate
- Draw by insufficient material
- Draw by fifty-move rule
- Draw by threefold repetition

### Promotion

When a pawn reaches the last rank, the game opens a promotion dialog. Choose the piece you want:

- Queen
- Rook
- Bishop
- Knight

### Clock

- Each side starts with `5:00`
- The active player's clock runs during their turn
- If a clock reaches zero, that player loses on time

## Project Structure

```text
.
|-- index.html
|-- style.css
|-- script.js
|-- package.json
|-- vite.config.js
|-- src/
```

Main gameplay UI and logic are driven by:

- `index.html`
- `style.css`
- `script.js`

## Scripts

- `npm run dev` - start the development server
- `npm run build` - create a production build
- `npm run preview` - preview the production build

## Notes

- The game is designed for browser play.
- AI plays as black when AI mode is enabled.
- White moves first.
