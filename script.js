const BOARD_SIZE = 8;
const CHECKMATE_SCORE = 1000000;
const CLOCK_START_MS = 5 * 60 * 1000;
const CLOCK_TICK_MS = 250;
const PROMOTION_CHOICES = ["queen", "rook", "bishop", "knight"];

const AI_LEVELS = {
  easy: {
    label: "Easy",
    depth: 1,
    thinkDelay: 260,
    randomness: 120,
    topChoices: 4
  },
  medium: {
    label: "Medium",
    depth: 2,
    thinkDelay: 460,
    randomness: 28,
    topChoices: 2
  },
  hard: {
    label: "Hard",
    depth: 3,
    thinkDelay: 700,
    randomness: 0,
    topChoices: 1
  }
};

const PIECE_VALUES = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 20000
};

const PIECE_SYMBOLS = {
  white: {
    king: "\u2654",
    queen: "\u2655",
    rook: "\u2656",
    bishop: "\u2657",
    knight: "\u2658",
    pawn: "\u2659"
  },
  black: {
    king: "\u265A",
    queen: "\u265B",
    rook: "\u265C",
    bishop: "\u265D",
    knight: "\u265E",
    pawn: "\u265F"
  }
};

const PIECE_LETTERS = {
  king: "K",
  queen: "Q",
  rook: "R",
  bishop: "B",
  knight: "N",
  pawn: ""
};

const STARTING_BACK_RANK = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
const STARTING_PIECE_COUNTS = {
  white: {
    pawn: 8,
    knight: 2,
    bishop: 2,
    rook: 2,
    queen: 1,
    king: 1
  },
  black: {
    pawn: 8,
    knight: 2,
    bishop: 2,
    rook: 2,
    queen: 1,
    king: 1
  }
};

const DOM = {};
let state = createNewGameState();
let menuVisible = true;
let matchHasOpened = false;
let clockTimerId = null;
let clockLastTick = null;

function createPiece(type, color) {
  return { type, color, hasMoved: false };
}

function createInitialBoard() {
  const nextBoard = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));

  STARTING_BACK_RANK.forEach((type, column) => {
    nextBoard[0][column] = createPiece(type, "black");
    nextBoard[1][column] = createPiece("pawn", "black");
    nextBoard[6][column] = createPiece("pawn", "white");
    nextBoard[7][column] = createPiece(type, "white");
  });

  return nextBoard;
}

function cloneBoard(boardState) {
  return boardState.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function cloneMove(move) {
  if (!move) {
    return null;
  }

  return {
    ...move,
    piece: move.piece ? { ...move.piece } : null,
    capturedPiece: move.capturedPiece ? { ...move.capturedPiece } : null,
    rookMove: move.rookMove ? { ...move.rookMove } : null,
    enPassantCapture: move.enPassantCapture ? { ...move.enPassantCapture } : null
  };
}

function cloneEnPassantTarget(target) {
  return target ? { ...target } : null;
}

function cloneSquare(square) {
  return square ? { ...square } : null;
}

function cloneMoveHistory(entries) {
  return entries.map((entry) => ({ ...entry }));
}

function createSnapshot(gameState) {
  return {
    board: cloneBoard(gameState.board),
    currentTurn: gameState.currentTurn,
    lastMove: cloneMove(gameState.lastMove),
    enPassantTarget: cloneEnPassantTarget(gameState.enPassantTarget),
    halfmoveClock: gameState.halfmoveClock,
    fullmoveNumber: gameState.fullmoveNumber,
    whiteTimeMs: gameState.whiteTimeMs,
    blackTimeMs: gameState.blackTimeMs,
    moveHistory: cloneMoveHistory(gameState.moveHistory),
    repetitionCounts: new Map(gameState.repetitionCounts),
    gameOver: gameState.gameOver,
    winner: gameState.winner,
    drawReason: gameState.drawReason
  };
}

function restoreSnapshot(snapshot) {
  const historySnapshots = state.historySnapshots;
  const aiEnabled = state.aiEnabled;
  const aiDifficulty = state.aiDifficulty;

  state = {
    board: cloneBoard(snapshot.board),
    currentTurn: snapshot.currentTurn,
    selectedSquare: null,
    legalMoves: [],
    gameOver: snapshot.gameOver,
    winner: snapshot.winner,
    drawReason: snapshot.drawReason,
    statusMessage: "",
    aiEnabled,
    aiDifficulty,
    aiThinking: false,
    lastMove: cloneMove(snapshot.lastMove),
    enPassantTarget: cloneEnPassantTarget(snapshot.enPassantTarget),
    halfmoveClock: snapshot.halfmoveClock,
    fullmoveNumber: snapshot.fullmoveNumber,
    whiteTimeMs: snapshot.whiteTimeMs ?? CLOCK_START_MS,
    blackTimeMs: snapshot.blackTimeMs ?? CLOCK_START_MS,
    moveHistory: cloneMoveHistory(snapshot.moveHistory),
    historySnapshots,
    repetitionCounts: new Map(snapshot.repetitionCounts),
    pendingPromotion: null,
    aiTimeoutId: null
  };

  const summary = getPositionSummary(state);
  state.gameOver = summary.gameOver;
  state.winner = summary.winner;
  state.drawReason = summary.drawReason;
  state.statusMessage = summary.message;
}

function createNewGameState() {
  const nextState = {
    board: createInitialBoard(),
    currentTurn: "white",
    selectedSquare: null,
    legalMoves: [],
    gameOver: false,
    winner: null,
    drawReason: null,
    statusMessage: "White to move.",
    aiEnabled: true,
    aiDifficulty: "medium",
    aiThinking: false,
    lastMove: null,
    enPassantTarget: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
    whiteTimeMs: CLOCK_START_MS,
    blackTimeMs: CLOCK_START_MS,
    moveHistory: [],
    historySnapshots: [],
    repetitionCounts: new Map(),
    pendingPromotion: null,
    aiTimeoutId: null
  };

  recordPosition(nextState);
  return nextState;
}

function isInsideBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getOpponentColor(color) {
  return color === "white" ? "black" : "white";
}

function squareName(row, col) {
  return `${String.fromCharCode(97 + col)}${BOARD_SIZE - row}`;
}

function getSquareLabel(row, col, piece) {
  const position = squareName(row, col);

  if (!piece) {
    return `Empty square ${position}`;
  }

  return `${capitalize(piece.color)} ${piece.type} on ${position}`;
}

function countPiecesOnBoard(boardState) {
  const counts = {
    white: {
      pawn: 0,
      knight: 0,
      bishop: 0,
      rook: 0,
      queen: 0,
      king: 0
    },
    black: {
      pawn: 0,
      knight: 0,
      bishop: 0,
      rook: 0,
      queen: 0,
      king: 0
    }
  };

  for (const row of boardState) {
    for (const piece of row) {
      if (!piece) {
        continue;
      }

      counts[piece.color][piece.type] += 1;
    }
  }

  return counts;
}

function getCapturedPiecesText(capturingColor, boardState) {
  const missingColor = getOpponentColor(capturingColor);
  const boardCounts = countPiecesOnBoard(boardState)[missingColor];
  const capturedSymbols = [];

  for (const [pieceType, startingCount] of Object.entries(STARTING_PIECE_COUNTS[missingColor])) {
    const missingCount = startingCount - boardCounts[pieceType];

    for (let index = 0; index < missingCount; index += 1) {
      capturedSymbols.push(PIECE_SYMBOLS[missingColor][pieceType]);
    }
  }

  return capturedSymbols.length ? capturedSymbols.join(" ") : "-";
}

function getGamePhaseLabel(fullmoveNumber) {
  if (fullmoveNumber <= 10) {
    return "Opening";
  }

  if (fullmoveNumber <= 28) {
    return "Middlegame";
  }

  return "Endgame";
}

function getPositionStateLabel() {
  if (state.gameOver) {
    if (state.winner) {
      return `${capitalize(state.winner)} won`;
    }

    return "Draw";
  }

  if (state.pendingPromotion) {
    return "Promotion";
  }

  if (state.aiThinking) {
    return "AI thinking";
  }

  if (isKingInCheck(state.board, state.currentTurn)) {
    return "Check";
  }

  return "In play";
}

function getTensionLabel() {
  if (state.gameOver) {
    return "Settled";
  }

  if (state.pendingPromotion) {
    return "Critical";
  }

  if (state.aiThinking) {
    return "Calculating";
  }

  const legalMoves = getAllLegalMoves(state.currentTurn, state);
  const captureCount = legalMoves.filter((move) => move.isCapture).length;

  if (captureCount >= 6) {
    return "Explosive";
  }

  if (captureCount >= 3) {
    return "Sharp";
  }

  if (captureCount >= 1) {
    return "Tactical";
  }

  return "Calm";
}

function getClockTime(color) {
  return color === "white" ? state.whiteTimeMs : state.blackTimeMs;
}

function setClockTime(color, timeMs) {
  if (color === "white") {
    state.whiteTimeMs = timeMs;
    return;
  }

  state.blackTimeMs = timeMs;
}

function formatClockTime(timeMs) {
  const totalSeconds = Math.max(0, Math.ceil(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isClockActive() {
  return matchHasOpened && !menuVisible && !state.gameOver && !state.pendingPromotion;
}

function renderClockDisplay() {
  if (!DOM.whiteClock || !DOM.blackClock) {
    return;
  }

  DOM.whiteClock.textContent = formatClockTime(state.whiteTimeMs);
  DOM.blackClock.textContent = formatClockTime(state.blackTimeMs);

  DOM.whiteClockCard.classList.toggle("active", isClockActive() && state.currentTurn === "white");
  DOM.blackClockCard.classList.toggle("active", isClockActive() && state.currentTurn === "black");
  DOM.whiteClockCard.classList.toggle("low-time", state.whiteTimeMs <= 30 * 1000);
  DOM.blackClockCard.classList.toggle("low-time", state.blackTimeMs <= 30 * 1000);
}

function stopClock() {
  if (clockTimerId !== null) {
    window.clearInterval(clockTimerId);
    clockTimerId = null;
  }

  clockLastTick = null;
}

function handleClockExpired(color) {
  if (state.gameOver) {
    return;
  }

  clearPendingAI();
  clearSelection();
  state.gameOver = true;
  state.winner = getOpponentColor(color);
  state.drawReason = null;
  state.pendingPromotion = null;
  state.statusMessage = `${capitalize(color)} ran out of time. ${capitalize(state.winner)} wins.`;
  stopClock();
  renderAll();
}

function syncClockTime(now = Date.now()) {
  if (!clockLastTick) {
    clockLastTick = now;
    return;
  }

  if (!isClockActive()) {
    clockLastTick = now;
    return;
  }

  const elapsedMs = Math.max(0, now - clockLastTick);
  if (elapsedMs === 0) {
    return;
  }

  const activeColor = state.currentTurn;
  const nextTime = Math.max(0, getClockTime(activeColor) - elapsedMs);

  setClockTime(activeColor, nextTime);
  clockLastTick = now;

  if (nextTime <= 0) {
    handleClockExpired(activeColor);
  }
}

function startClock() {
  if (!isClockActive() || clockTimerId !== null) {
    return;
  }

  clockLastTick = Date.now();
  clockTimerId = window.setInterval(() => {
    syncClockTime();
    renderClockDisplay();
  }, CLOCK_TICK_MS);
}

function pauseClock() {
  syncClockTime();
  stopClock();
  renderClockDisplay();
}

function updateClockTimer() {
  if (isClockActive()) {
    startClock();
    renderClockDisplay();
    return;
  }

  pauseClock();
}

function cacheDOMElements() {
  DOM.mainMenu = document.getElementById("main-menu");
  DOM.gameApp = document.getElementById("game-app");
  DOM.board = document.getElementById("board");
  DOM.statusMessage = document.getElementById("status-message");
  DOM.turnIndicator = document.getElementById("turn-indicator");
  DOM.modeIndicator = document.getElementById("mode-indicator");
  DOM.positionState = document.getElementById("position-state");
  DOM.moveCount = document.getElementById("move-count");
  DOM.phaseIndicator = document.getElementById("phase-indicator");
  DOM.tensionIndicator = document.getElementById("tension-indicator");
  DOM.whiteClock = document.getElementById("white-clock");
  DOM.blackClock = document.getElementById("black-clock");
  DOM.whiteClockCard = document.getElementById("white-clock-card");
  DOM.blackClockCard = document.getElementById("black-clock-card");
  DOM.aiToggle = document.getElementById("ai-toggle");
  DOM.startButton = document.getElementById("start-button");
  DOM.openMenuButton = document.getElementById("open-menu-button");
  DOM.restartButton = document.getElementById("restart-button");
  DOM.undoButton = document.getElementById("undo-button");
  DOM.difficultySelect = document.getElementById("difficulty-select");
  DOM.whiteCaptures = document.getElementById("white-captures");
  DOM.blackCaptures = document.getElementById("black-captures");
  DOM.moveHistory = document.getElementById("move-history");
  DOM.drawRuleStatus = document.getElementById("draw-rule-status");
  DOM.promotionDialog = document.getElementById("promotion-dialog");
  DOM.promotionOptions = document.getElementById("promotion-options");
}

function renderScreenVisibility() {
  document.body.dataset.screen = menuVisible ? "menu" : "game";
  DOM.mainMenu.classList.toggle("menu-hidden", !menuVisible);
  DOM.mainMenu.setAttribute("aria-hidden", String(!menuVisible));
  DOM.gameApp.classList.toggle("app-hidden", menuVisible);
  DOM.gameApp.setAttribute("aria-hidden", String(menuVisible));

  if ("inert" in DOM.mainMenu) {
    DOM.mainMenu.inert = !menuVisible;
    DOM.gameApp.inert = menuVisible;
  }

  DOM.startButton.textContent = matchHasOpened ? "Resume Match" : "Start Match";
}

function enterGameScreen() {
  matchHasOpened = true;
  menuVisible = false;
  renderScreenVisibility();
  updateClockTimer();
  scheduleAIMoveIfNeeded();
}

function openMenuScreen() {
  pauseClock();
  menuVisible = true;
  renderScreenVisibility();
}

function findKing(boardState, color) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = boardState[row][col];
      if (piece && piece.color === color && piece.type === "king") {
        return { row, col };
      }
    }
  }

  return null;
}

function isSquareAttacked(boardState, targetRow, targetCol, attackerColor) {
  const pawnRow = attackerColor === "white" ? targetRow + 1 : targetRow - 1;
  for (const colOffset of [-1, 1]) {
    const pawnCol = targetCol + colOffset;
    if (!isInsideBoard(pawnRow, pawnCol)) {
      continue;
    }

    const piece = boardState[pawnRow][pawnCol];
    if (piece && piece.color === attackerColor && piece.type === "pawn") {
      return true;
    }
  }

  const knightOffsets = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1]
  ];

  for (const [rowOffset, colOffset] of knightOffsets) {
    const row = targetRow + rowOffset;
    const col = targetCol + colOffset;

    if (!isInsideBoard(row, col)) {
      continue;
    }

    const piece = boardState[row][col];
    if (piece && piece.color === attackerColor && piece.type === "knight") {
      return true;
    }
  }

  const kingOffsets = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1]
  ];

  for (const [rowOffset, colOffset] of kingOffsets) {
    const row = targetRow + rowOffset;
    const col = targetCol + colOffset;

    if (!isInsideBoard(row, col)) {
      continue;
    }

    const piece = boardState[row][col];
    if (piece && piece.color === attackerColor && piece.type === "king") {
      return true;
    }
  }

  const straightDirections = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  for (const [rowStep, colStep] of straightDirections) {
    let row = targetRow + rowStep;
    let col = targetCol + colStep;

    while (isInsideBoard(row, col)) {
      const piece = boardState[row][col];
      if (piece) {
        if (piece.color === attackerColor && (piece.type === "rook" || piece.type === "queen")) {
          return true;
        }
        break;
      }

      row += rowStep;
      col += colStep;
    }
  }

  const diagonalDirections = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1]
  ];

  for (const [rowStep, colStep] of diagonalDirections) {
    let row = targetRow + rowStep;
    let col = targetCol + colStep;

    while (isInsideBoard(row, col)) {
      const piece = boardState[row][col];
      if (piece) {
        if (piece.color === attackerColor && (piece.type === "bishop" || piece.type === "queen")) {
          return true;
        }
        break;
      }

      row += rowStep;
      col += colStep;
    }
  }

  return false;
}

function isKingInCheck(boardState, color) {
  const kingPosition = findKing(boardState, color);
  if (!kingPosition) {
    return true;
  }

  return isSquareAttacked(boardState, kingPosition.row, kingPosition.col, getOpponentColor(color));
}

function createMove(fromRow, fromCol, toRow, toCol, boardState, extras = {}) {
  const piece = boardState[fromRow][fromCol];
  const capturedPiece = extras.isEnPassant
    ? boardState[extras.enPassantCapture.row][extras.enPassantCapture.col]
    : boardState[toRow][toCol];

  return {
    fromRow,
    fromCol,
    toRow,
    toCol,
    piece: piece ? { ...piece } : null,
    capturedPiece: capturedPiece ? { ...capturedPiece } : null,
    isCapture: Boolean(capturedPiece),
    isEnPassant: Boolean(extras.isEnPassant),
    enPassantCapture: extras.enPassantCapture ? { ...extras.enPassantCapture } : null,
    isCastle: Boolean(extras.isCastle),
    castleSide: extras.castleSide || null,
    rookMove: extras.rookMove ? { ...extras.rookMove } : null,
    requiresPromotion: Boolean(extras.requiresPromotion),
    promotion: extras.promotion || null
  };
}

function getPawnMoves(row, col, boardState, stateContext) {
  const moves = [];
  const piece = boardState[row][col];
  const direction = piece.color === "white" ? -1 : 1;
  const startRow = piece.color === "white" ? 6 : 1;
  const promotionRow = piece.color === "white" ? 0 : 7;
  const nextRow = row + direction;

  if (isInsideBoard(nextRow, col) && !boardState[nextRow][col]) {
    moves.push(
      createMove(row, col, nextRow, col, boardState, {
        requiresPromotion: nextRow === promotionRow
      })
    );

    const doubleStepRow = row + direction * 2;
    if (
      row === startRow &&
      !piece.hasMoved &&
      isInsideBoard(doubleStepRow, col) &&
      !boardState[doubleStepRow][col]
    ) {
      moves.push(createMove(row, col, doubleStepRow, col, boardState));
    }
  }

  for (const colOffset of [-1, 1]) {
    const captureCol = col + colOffset;
    if (!isInsideBoard(nextRow, captureCol)) {
      continue;
    }

    const targetPiece = boardState[nextRow][captureCol];
    if (targetPiece && targetPiece.color !== piece.color && targetPiece.type !== "king") {
      moves.push(
        createMove(row, col, nextRow, captureCol, boardState, {
          requiresPromotion: nextRow === promotionRow
        })
      );
    }
  }

  const enPassantTarget = stateContext.enPassantTarget;
  if (
    enPassantTarget &&
    enPassantTarget.row === nextRow &&
    Math.abs(enPassantTarget.col - col) === 1
  ) {
    const targetPawn = boardState[enPassantTarget.pawnRow][enPassantTarget.pawnCol];
    if (targetPawn && targetPawn.color !== piece.color && targetPawn.type === "pawn") {
      moves.push(
        createMove(row, col, enPassantTarget.row, enPassantTarget.col, boardState, {
          isEnPassant: true,
          enPassantCapture: {
            row: enPassantTarget.pawnRow,
            col: enPassantTarget.pawnCol
          }
        })
      );
    }
  }

  return moves;
}

function getSlidingMoves(row, col, boardState, directions) {
  const moves = [];
  const piece = boardState[row][col];

  for (const [rowStep, colStep] of directions) {
    let nextRow = row + rowStep;
    let nextCol = col + colStep;

    while (isInsideBoard(nextRow, nextCol)) {
      const targetPiece = boardState[nextRow][nextCol];

      if (!targetPiece) {
        moves.push(createMove(row, col, nextRow, nextCol, boardState));
      } else {
        if (targetPiece.color !== piece.color && targetPiece.type !== "king") {
          moves.push(createMove(row, col, nextRow, nextCol, boardState));
        }
        break;
      }

      nextRow += rowStep;
      nextCol += colStep;
    }
  }

  return moves;
}

function getKnightMoves(row, col, boardState) {
  const moves = [];
  const piece = boardState[row][col];
  const offsets = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1]
  ];

  for (const [rowOffset, colOffset] of offsets) {
    const nextRow = row + rowOffset;
    const nextCol = col + colOffset;

    if (!isInsideBoard(nextRow, nextCol)) {
      continue;
    }

    const targetPiece = boardState[nextRow][nextCol];
    if (!targetPiece || (targetPiece.color !== piece.color && targetPiece.type !== "king")) {
      moves.push(createMove(row, col, nextRow, nextCol, boardState));
    }
  }

  return moves;
}

function canCastle(boardState, color, side) {
  const homeRow = color === "white" ? 7 : 0;
  const king = boardState[homeRow][4];

  if (!king || king.type !== "king" || king.color !== color || king.hasMoved) {
    return false;
  }

  if (isKingInCheck(boardState, color)) {
    return false;
  }

  if (side === "kingside") {
    const rook = boardState[homeRow][7];
    if (!rook || rook.type !== "rook" || rook.color !== color || rook.hasMoved) {
      return false;
    }

    if (boardState[homeRow][5] || boardState[homeRow][6]) {
      return false;
    }

    return !isSquareAttacked(boardState, homeRow, 5, getOpponentColor(color)) &&
      !isSquareAttacked(boardState, homeRow, 6, getOpponentColor(color));
  }

  const rook = boardState[homeRow][0];
  if (!rook || rook.type !== "rook" || rook.color !== color || rook.hasMoved) {
    return false;
  }

  if (boardState[homeRow][1] || boardState[homeRow][2] || boardState[homeRow][3]) {
    return false;
  }

  return !isSquareAttacked(boardState, homeRow, 3, getOpponentColor(color)) &&
    !isSquareAttacked(boardState, homeRow, 2, getOpponentColor(color));
}

function getKingMoves(row, col, boardState) {
  const moves = [];
  const piece = boardState[row][col];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) {
        continue;
      }

      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (!isInsideBoard(nextRow, nextCol)) {
        continue;
      }

      const targetPiece = boardState[nextRow][nextCol];
      if (!targetPiece || (targetPiece.color !== piece.color && targetPiece.type !== "king")) {
        moves.push(createMove(row, col, nextRow, nextCol, boardState));
      }
    }
  }

  if (col === 4) {
    if (canCastle(boardState, piece.color, "kingside")) {
      moves.push(
        createMove(row, col, row, 6, boardState, {
          isCastle: true,
          castleSide: "kingside",
          rookMove: { fromRow: row, fromCol: 7, toRow: row, toCol: 5 }
        })
      );
    }

    if (canCastle(boardState, piece.color, "queenside")) {
      moves.push(
        createMove(row, col, row, 2, boardState, {
          isCastle: true,
          castleSide: "queenside",
          rookMove: { fromRow: row, fromCol: 0, toRow: row, toCol: 3 }
        })
      );
    }
  }

  return moves;
}

function getPseudoMovesForPiece(row, col, boardState, stateContext) {
  if (!isInsideBoard(row, col)) {
    return [];
  }

  const piece = boardState[row][col];
  if (!piece) {
    return [];
  }

  switch (piece.type) {
    case "pawn":
      return getPawnMoves(row, col, boardState, stateContext);
    case "rook":
      return getSlidingMoves(row, col, boardState, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
    case "knight":
      return getKnightMoves(row, col, boardState);
    case "bishop":
      return getSlidingMoves(row, col, boardState, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    case "queen":
      return getSlidingMoves(row, col, boardState, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1]
      ]);
    case "king":
      return getKingMoves(row, col, boardState);
    default:
      return [];
  }
}

function applyMoveToBoard(boardState, move, promotionChoice = null) {
  const nextBoard = cloneBoard(boardState);
  const movingPiece = nextBoard[move.fromRow][move.fromCol];

  if (!movingPiece) {
    return nextBoard;
  }

  nextBoard[move.fromRow][move.fromCol] = null;

  if (move.isEnPassant && move.enPassantCapture) {
    nextBoard[move.enPassantCapture.row][move.enPassantCapture.col] = null;
  }

  if (move.isCastle && move.rookMove) {
    const rook = nextBoard[move.rookMove.fromRow][move.rookMove.fromCol];
    nextBoard[move.rookMove.fromRow][move.rookMove.fromCol] = null;
    nextBoard[move.rookMove.toRow][move.rookMove.toCol] = { ...rook, hasMoved: true };
  }

  const nextType = promotionChoice || move.promotion || (move.requiresPromotion ? "queen" : movingPiece.type);
  nextBoard[move.toRow][move.toCol] = {
    ...movingPiece,
    type: nextType,
    hasMoved: true
  };

  return nextBoard;
}

function getNextEnPassantTarget(move) {
  if (!move?.piece || move.piece.type !== "pawn") {
    return null;
  }

  if (Math.abs(move.toRow - move.fromRow) !== 2) {
    return null;
  }

  return {
    row: (move.fromRow + move.toRow) / 2,
    col: move.fromCol,
    pawnRow: move.toRow,
    pawnCol: move.toCol,
    color: move.piece.color
  };
}

function simulateStateAfterMove(stateContext, move, promotionChoice = null) {
  const movingColor = move.piece.color;
  const nextHalfmove = move.piece.type === "pawn" || move.isCapture
    ? 0
    : (stateContext.halfmoveClock ?? 0) + 1;
  const nextFullmove = (stateContext.fullmoveNumber ?? 1) + (movingColor === "black" ? 1 : 0);

  return {
    board: applyMoveToBoard(stateContext.board, move, promotionChoice),
    currentTurn: getOpponentColor(movingColor),
    enPassantTarget: getNextEnPassantTarget(move),
    halfmoveClock: nextHalfmove,
    fullmoveNumber: nextFullmove,
    repetitionCounts: stateContext.repetitionCounts ?? null
  };
}

function getLegalMovesForPiece(row, col, stateContext) {
  const boardState = stateContext.board;
  const piece = boardState[row][col];
  if (!piece) {
    return [];
  }

  return getPseudoMovesForPiece(row, col, boardState, stateContext).filter((move) => {
    const simulatedState = simulateStateAfterMove(stateContext, move, move.requiresPromotion ? "queen" : null);
    return !isKingInCheck(simulatedState.board, piece.color);
  });
}

function getAllLegalMoves(color, stateContext) {
  const moves = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = stateContext.board[row][col];
      if (!piece || piece.color !== color) {
        continue;
      }

      moves.push(...getLegalMovesForPiece(row, col, stateContext));
    }
  }

  return moves;
}

function getCastlingRights(stateContext) {
  const rights = [];
  const whiteKing = stateContext.board[7][4];
  const blackKing = stateContext.board[0][4];

  if (whiteKing && whiteKing.type === "king" && whiteKing.color === "white" && !whiteKing.hasMoved) {
    const whiteKingsideRook = stateContext.board[7][7];
    const whiteQueensideRook = stateContext.board[7][0];
    if (whiteKingsideRook && whiteKingsideRook.type === "rook" && whiteKingsideRook.color === "white" && !whiteKingsideRook.hasMoved) {
      rights.push("K");
    }
    if (whiteQueensideRook && whiteQueensideRook.type === "rook" && whiteQueensideRook.color === "white" && !whiteQueensideRook.hasMoved) {
      rights.push("Q");
    }
  }

  if (blackKing && blackKing.type === "king" && blackKing.color === "black" && !blackKing.hasMoved) {
    const blackKingsideRook = stateContext.board[0][7];
    const blackQueensideRook = stateContext.board[0][0];
    if (blackKingsideRook && blackKingsideRook.type === "rook" && blackKingsideRook.color === "black" && !blackKingsideRook.hasMoved) {
      rights.push("k");
    }
    if (blackQueensideRook && blackQueensideRook.type === "rook" && blackQueensideRook.color === "black" && !blackQueensideRook.hasMoved) {
      rights.push("q");
    }
  }

  return rights.length ? rights.join("") : "-";
}

function serializeBoard(boardState) {
  const symbols = {
    pawn: "p",
    knight: "n",
    bishop: "b",
    rook: "r",
    queen: "q",
    king: "k"
  };

  return boardState
    .map((row) =>
      row
        .map((piece) => {
          if (!piece) {
            return "1";
          }

          const symbol = symbols[piece.type];
          return piece.color === "white" ? symbol.toUpperCase() : symbol;
        })
        .join("")
    )
    .join("/");
}

function getPositionKey(stateContext) {
  const enPassant = stateContext.enPassantTarget
    ? squareName(stateContext.enPassantTarget.row, stateContext.enPassantTarget.col)
    : "-";

  return [serializeBoard(stateContext.board), stateContext.currentTurn, getCastlingRights(stateContext), enPassant].join("|");
}

function recordPosition(stateContext) {
  const key = getPositionKey(stateContext);
  const existingCount = stateContext.repetitionCounts.get(key) || 0;
  stateContext.repetitionCounts.set(key, existingCount + 1);
}

function getPositionRepetitionCount(stateContext) {
  const key = getPositionKey(stateContext);
  return stateContext.repetitionCounts?.get(key) || 0;
}

function isInsufficientMaterial(boardState) {
  const nonKingPieces = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = boardState[row][col];
      if (!piece || piece.type === "king") {
        continue;
      }

      nonKingPieces.push({
        ...piece,
        squareColor: (row + col) % 2
      });
    }
  }

  if (nonKingPieces.length === 0) {
    return true;
  }

  if (nonKingPieces.length === 1) {
    return ["bishop", "knight"].includes(nonKingPieces[0].type);
  }

  if (nonKingPieces.length === 2) {
    if (
      nonKingPieces.every((piece) => piece.type === "bishop") &&
      nonKingPieces[0].squareColor === nonKingPieces[1].squareColor
    ) {
      return true;
    }
  }

  return false;
}

function getPositionSummary(stateContext) {
  const inCheck = isKingInCheck(stateContext.board, stateContext.currentTurn);
  const legalMoves = getAllLegalMoves(stateContext.currentTurn, stateContext);

  if (legalMoves.length === 0) {
    if (inCheck) {
      return {
        inCheck: true,
        checkmate: true,
        stalemate: false,
        gameOver: true,
        winner: getOpponentColor(stateContext.currentTurn),
        drawReason: null,
        message: `Checkmate! ${capitalize(getOpponentColor(stateContext.currentTurn))} wins.`
      };
    }

    return {
      inCheck: false,
      checkmate: false,
      stalemate: true,
      gameOver: true,
      winner: null,
      drawReason: "stalemate",
      message: "Draw by stalemate."
    };
  }

  if (isInsufficientMaterial(stateContext.board)) {
    return {
      inCheck,
      checkmate: false,
      stalemate: false,
      gameOver: true,
      winner: null,
      drawReason: "insufficient-material",
      message: "Draw by insufficient material."
    };
  }

  if ((stateContext.halfmoveClock ?? 0) >= 100) {
    return {
      inCheck,
      checkmate: false,
      stalemate: false,
      gameOver: true,
      winner: null,
      drawReason: "fifty-move-rule",
      message: "Draw by the 50-move rule."
    };
  }

  if (stateContext.repetitionCounts && getPositionRepetitionCount(stateContext) >= 3) {
    return {
      inCheck,
      checkmate: false,
      stalemate: false,
      gameOver: true,
      winner: null,
      drawReason: "threefold-repetition",
      message: "Draw by threefold repetition."
    };
  }

  if (inCheck) {
    return {
      inCheck: true,
      checkmate: false,
      stalemate: false,
      gameOver: false,
      winner: null,
      drawReason: null,
      message: `${capitalize(stateContext.currentTurn)} is in check.`
    };
  }

  return {
    inCheck: false,
    checkmate: false,
    stalemate: false,
    gameOver: false,
    winner: null,
    drawReason: null,
    message: `${capitalize(stateContext.currentTurn)} to move.`
  };
}

function getDistanceFromCenter(row, col) {
  return Math.abs(3.5 - row) + Math.abs(3.5 - col);
}

function getPositionalScore(piece, row, col) {
  const forwardRow = piece.color === "white" ? 7 - row : row;
  const centerControl = 7 - getDistanceFromCenter(row, col);

  switch (piece.type) {
    case "pawn":
      return forwardRow * 10 + centerControl * 4;
    case "knight":
      return centerControl * 11;
    case "bishop":
      return centerControl * 8 + forwardRow * 2;
    case "rook":
      return forwardRow * 3;
    case "queen":
      return centerControl * 4;
    case "king":
      return -centerControl * 6;
    default:
      return 0;
  }
}

function evaluateBoard(stateContext) {
  if (isInsufficientMaterial(stateContext.board)) {
    return 0;
  }

  let score = 0;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = stateContext.board[row][col];
      if (!piece) {
        continue;
      }

      const pieceScore = PIECE_VALUES[piece.type] + getPositionalScore(piece, row, col);
      score += piece.color === "black" ? pieceScore : -pieceScore;
    }
  }

  const blackMobility = getAllLegalMoves("black", stateContext).length;
  const whiteMobility = getAllLegalMoves("white", stateContext).length;
  score += (blackMobility - whiteMobility) * 3;

  if (isKingInCheck(stateContext.board, "white")) {
    score += 40;
  }

  if (isKingInCheck(stateContext.board, "black")) {
    score -= 40;
  }

  return score;
}

function scoreMoveForOrdering(move) {
  let score = 0;

  if (move.isCapture && move.capturedPiece) {
    score += PIECE_VALUES[move.capturedPiece.type] - PIECE_VALUES[move.piece.type] / 10;
  }

  if (move.requiresPromotion || move.promotion) {
    score += PIECE_VALUES.queen;
  }

  if (move.isCastle) {
    score += 60;
  }

  score += (7 - getDistanceFromCenter(move.toRow, move.toCol)) * 4;
  return score;
}

function orderMoves(moves) {
  return [...moves].sort((firstMove, secondMove) => scoreMoveForOrdering(secondMove) - scoreMoveForOrdering(firstMove));
}

function minimax(searchState, depth, alpha, beta) {
  const legalMoves = orderMoves(getAllLegalMoves(searchState.currentTurn, searchState));

  if (legalMoves.length === 0) {
    if (isKingInCheck(searchState.board, searchState.currentTurn)) {
      return searchState.currentTurn === "black"
        ? -CHECKMATE_SCORE - depth
        : CHECKMATE_SCORE + depth;
    }

    return 0;
  }

  if (depth === 0 || isInsufficientMaterial(searchState.board) || (searchState.halfmoveClock ?? 0) >= 100) {
    return evaluateBoard(searchState);
  }

  if (searchState.currentTurn === "black") {
    let bestScore = -Infinity;

    for (const move of legalMoves) {
      const nextState = simulateStateAfterMove(searchState, move, move.requiresPromotion ? "queen" : null);
      const score = minimax(nextState, depth - 1, alpha, beta);
      bestScore = Math.max(bestScore, score);
      alpha = Math.max(alpha, score);

      if (beta <= alpha) {
        break;
      }
    }

    return bestScore;
  }

  let bestScore = Infinity;

  for (const move of legalMoves) {
    const nextState = simulateStateAfterMove(searchState, move, move.requiresPromotion ? "queen" : null);
    const score = minimax(nextState, depth - 1, alpha, beta);
    bestScore = Math.min(bestScore, score);
    beta = Math.min(beta, score);

    if (beta <= alpha) {
      break;
    }
  }

  return bestScore;
}

function chooseAIMove(runtimeState) {
  const level = AI_LEVELS[runtimeState.aiDifficulty] ?? AI_LEVELS.medium;
  const searchState = {
    board: cloneBoard(runtimeState.board),
    currentTurn: runtimeState.currentTurn,
    enPassantTarget: cloneEnPassantTarget(runtimeState.enPassantTarget),
    halfmoveClock: runtimeState.halfmoveClock,
    fullmoveNumber: runtimeState.fullmoveNumber
  };
  const legalMoves = orderMoves(getAllLegalMoves("black", searchState));

  if (!legalMoves.length) {
    return null;
  }

  const scoredMoves = legalMoves.map((move) => {
    const nextState = simulateStateAfterMove(searchState, move, move.requiresPromotion ? "queen" : null);
    const score = minimax(nextState, Math.max(level.depth - 1, 0), -Infinity, Infinity) +
      (Math.random() * 2 - 1) * level.randomness;

    return { move, score };
  });

  scoredMoves.sort((firstMove, secondMove) => secondMove.score - firstMove.score);
  const selectionPool = scoredMoves.slice(0, Math.min(level.topChoices, scoredMoves.length));
  const choice = selectionPool[Math.floor(Math.random() * selectionPool.length)] ?? scoredMoves[0];

  return cloneMove(choice.move);
}

function clearSelection() {
  state.selectedSquare = null;
  state.legalMoves = [];
}

function getCurrentModeLabel() {
  if (!state.aiEnabled) {
    return "Mode: Local two-player";
  }

  const difficulty = AI_LEVELS[state.aiDifficulty] ?? AI_LEVELS.medium;
  return `Mode: Human vs AI (${difficulty.label})`;
}

function renderStatus() {
  DOM.statusMessage.textContent = state.statusMessage;
  DOM.turnIndicator.textContent = state.gameOver
    ? state.winner
      ? `Game over: ${capitalize(state.winner)} wins`
      : "Game over: Draw"
    : `Current turn: ${capitalize(state.currentTurn)}`;
  DOM.modeIndicator.textContent = getCurrentModeLabel();

  const repetitionCount = getPositionRepetitionCount(state);
  const repetitionSuffix = repetitionCount > 1 ? ` | repetition: ${repetitionCount}x` : "";
  DOM.drawRuleStatus.textContent = `50-move counter: ${state.halfmoveClock} / 100${repetitionSuffix}`;
  DOM.positionState.textContent = getPositionStateLabel();
  DOM.moveCount.textContent = String(state.moveHistory.length);
  DOM.phaseIndicator.textContent = getGamePhaseLabel(state.fullmoveNumber);
  DOM.tensionIndicator.textContent = getTensionLabel();
  DOM.whiteCaptures.textContent = getCapturedPiecesText("white", state.board);
  DOM.blackCaptures.textContent = getCapturedPiecesText("black", state.board);

  DOM.aiToggle.textContent = `Play vs AI: ${state.aiEnabled ? "On" : "Off"}`;
  DOM.aiToggle.classList.toggle("active", state.aiEnabled);
  DOM.aiToggle.setAttribute("aria-pressed", String(state.aiEnabled));
  DOM.difficultySelect.value = state.aiDifficulty;
  DOM.difficultySelect.disabled = state.aiThinking || Boolean(state.pendingPromotion);
  DOM.undoButton.disabled = !state.historySnapshots.length || state.aiThinking || Boolean(state.pendingPromotion);
  renderClockDisplay();

  document.body.dataset.turn = state.currentTurn;
  document.body.dataset.positionState = state.gameOver
    ? "game-over"
    : state.pendingPromotion
      ? "promotion"
      : state.aiThinking
        ? "thinking"
        : isKingInCheck(state.board, state.currentTurn)
          ? "check"
          : "live";
}

function renderMoveHistory() {
  DOM.moveHistory.innerHTML = "";

  if (!state.moveHistory.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "No moves yet.";
    DOM.moveHistory.appendChild(empty);
    return;
  }

  for (let index = 0; index < state.moveHistory.length; index += 2) {
    const whiteMove = state.moveHistory[index];
    const blackMove = state.moveHistory[index + 1];
    const row = document.createElement("div");
    row.className = "history-row";

    const moveNumber = document.createElement("span");
    moveNumber.className = "move-number";
    moveNumber.textContent = `${whiteMove.moveNumber}.`;

    const whiteMoveCell = document.createElement("span");
    whiteMoveCell.className = "history-move";
    whiteMoveCell.textContent = whiteMove.notation;

    const blackMoveCell = document.createElement("span");
    blackMoveCell.className = "history-move";
    blackMoveCell.textContent = blackMove ? blackMove.notation : "";

    row.append(moveNumber, whiteMoveCell, blackMoveCell);
    DOM.moveHistory.appendChild(row);
  }

  DOM.moveHistory.scrollTop = DOM.moveHistory.scrollHeight;
}

function renderPromotionDialog() {
  if (!state.pendingPromotion) {
    DOM.promotionDialog.classList.add("hidden");
    DOM.promotionDialog.setAttribute("aria-hidden", "true");
    DOM.promotionOptions.innerHTML = "";
    return;
  }

  DOM.promotionDialog.classList.remove("hidden");
  DOM.promotionDialog.setAttribute("aria-hidden", "false");
  DOM.promotionOptions.innerHTML = "";

  const promotionColor = state.pendingPromotion.piece.color;
  for (const pieceType of PROMOTION_CHOICES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "promotion-button";
    button.dataset.piece = pieceType;

    const icon = document.createElement("span");
    icon.className = "promotion-piece";
    icon.textContent = PIECE_SYMBOLS[promotionColor][pieceType];

    const label = document.createElement("span");
    label.textContent = capitalize(pieceType);

    button.append(icon, label);
    DOM.promotionOptions.appendChild(button);
  }
}

function renderBoard() {
  DOM.board.innerHTML = "";
  DOM.board.classList.toggle("disabled", state.aiThinking || Boolean(state.pendingPromotion));

  const currentKing = findKing(state.board, state.currentTurn);
  const currentKingInCheck = currentKing ? isKingInCheck(state.board, state.currentTurn) : false;
  const fragment = document.createDocumentFragment();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = state.board[row][col];
      const squareButton = document.createElement("button");
      const moveInfo = state.legalMoves.find((move) => move.toRow === row && move.toCol === col);
      const isSelected = state.selectedSquare && state.selectedSquare.row === row && state.selectedSquare.col === col;
      const isPartOfLastMove = state.lastMove &&
        ((state.lastMove.fromRow === row && state.lastMove.fromCol === col) ||
          (state.lastMove.toRow === row && state.lastMove.toCol === col));
      const isCheckedKing = currentKingInCheck && currentKing.row === row && currentKing.col === col;

      squareButton.type = "button";
      squareButton.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
      squareButton.dataset.row = String(row);
      squareButton.dataset.col = String(col);
      squareButton.setAttribute("role", "gridcell");
      squareButton.setAttribute("aria-label", getSquareLabel(row, col, piece));

      if (isSelected) {
        squareButton.classList.add("selected");
      }

      if (moveInfo) {
        squareButton.classList.add("valid-move");
        if (moveInfo.isCapture) {
          squareButton.classList.add("capture-move");
        }
      }

      if (isPartOfLastMove) {
        squareButton.classList.add("last-move");
      }

      if (isCheckedKing) {
        squareButton.classList.add("checked-king");
      }

      if (piece) {
        const pieceElement = document.createElement("span");
        pieceElement.className = `piece ${piece.color}-piece`;
        pieceElement.textContent = PIECE_SYMBOLS[piece.color][piece.type];
        squareButton.appendChild(pieceElement);
      }

      fragment.appendChild(squareButton);
    }
  }

  DOM.board.appendChild(fragment);
}

function renderAll() {
  renderScreenVisibility();
  renderStatus();
  renderBoard();
  renderMoveHistory();
  renderPromotionDialog();
  updateClockTimer();
}

function formatMoveNotation(move, promotionChoice, summary) {
  if (move.isCastle) {
    return `${move.castleSide === "kingside" ? "O-O" : "O-O-O"}${summary.checkmate ? "#" : summary.inCheck ? "+" : ""}`;
  }

  const pieceLetter = PIECE_LETTERS[move.piece.type];
  const from = squareName(move.fromRow, move.fromCol);
  const to = squareName(move.toRow, move.toCol);
  let notation = `${pieceLetter}${from}${move.isCapture ? "x" : "-"}${to}`;

  if (move.isEnPassant) {
    notation += " e.p.";
  }

  if (promotionChoice) {
    notation += `=${PIECE_LETTERS[promotionChoice]}`;
  }

  if (summary.checkmate) {
    notation += "#";
  } else if (summary.inCheck) {
    notation += "+";
  }

  return notation;
}

function finalizeMove(move, promotionChoice = null) {
  syncClockTime();
  if (state.gameOver) {
    return;
  }

  const movingColor = move.piece.color;
  const moveNumber = state.fullmoveNumber;

  state.historySnapshots.push(createSnapshot(state));
  state.board = applyMoveToBoard(state.board, move, promotionChoice);
  state.lastMove = { ...cloneMove(move), promotion: promotionChoice || move.promotion || null };
  state.enPassantTarget = getNextEnPassantTarget(move);
  state.currentTurn = getOpponentColor(movingColor);
  state.selectedSquare = null;
  state.legalMoves = [];
  state.pendingPromotion = null;
  state.aiThinking = false;
  state.halfmoveClock = move.piece.type === "pawn" || move.isCapture ? 0 : state.halfmoveClock + 1;

  if (movingColor === "black") {
    state.fullmoveNumber += 1;
  }

  recordPosition(state);
  const summary = getPositionSummary(state);
  state.gameOver = summary.gameOver;
  state.winner = summary.winner;
  state.drawReason = summary.drawReason;
  state.statusMessage = summary.message;

  state.moveHistory.push({
    moveNumber,
    color: movingColor,
    notation: formatMoveNotation(move, promotionChoice, summary)
  });

  renderAll();

  if (!state.gameOver) {
    scheduleAIMoveIfNeeded();
  }
}

function performMove(move, options = {}) {
  if (!move || state.gameOver) {
    return false;
  }

  syncClockTime();
  if (state.gameOver) {
    return false;
  }

  const promotionChoice = options.promotionChoice || null;
  if (move.requiresPromotion && !promotionChoice) {
    clearPendingAI();
    state.pendingPromotion = cloneMove(move);
    state.selectedSquare = null;
    state.legalMoves = [];
    state.statusMessage = `${capitalize(move.piece.color)} pawn reached ${squareName(move.toRow, move.toCol)}. Choose promotion.`;
    renderAll();
    return true;
  }

  finalizeMove(move, promotionChoice);
  return true;
}

function clearPendingAI() {
  if (state.aiTimeoutId !== null) {
    window.clearTimeout(state.aiTimeoutId);
    state.aiTimeoutId = null;
  }

  state.aiThinking = false;
}

function scheduleAIMoveIfNeeded() {
  clearPendingAI();

  if (!state.aiEnabled || state.currentTurn !== "black" || state.gameOver || state.pendingPromotion) {
    return;
  }

  const difficulty = AI_LEVELS[state.aiDifficulty] ?? AI_LEVELS.medium;
  state.aiThinking = true;
  state.statusMessage = `Black is thinking (${difficulty.label})...`;
  renderAll();

  state.aiTimeoutId = window.setTimeout(() => {
    state.aiTimeoutId = null;

    if (!state.aiEnabled || state.currentTurn !== "black" || state.gameOver || state.pendingPromotion) {
      state.aiThinking = false;
      renderAll();
      return;
    }

    const aiMove = chooseAIMove(state);
    if (!aiMove) {
      state.aiThinking = false;
      const summary = getPositionSummary(state);
      state.gameOver = summary.gameOver;
      state.winner = summary.winner;
      state.drawReason = summary.drawReason;
      state.statusMessage = summary.message;
      renderAll();
      return;
    }

    performMove(aiMove, {
      fromAI: true,
      promotionChoice: aiMove.requiresPromotion ? "queen" : null
    });
  }, difficulty.thinkDelay);
}

function selectPiece(row, col) {
  state.selectedSquare = { row, col };
  state.legalMoves = getLegalMovesForPiece(row, col, state);
  renderBoard();
}

function handleSquareSelection(row, col) {
  if (state.gameOver || state.aiThinking || state.pendingPromotion) {
    return;
  }

  if (state.aiEnabled && state.currentTurn === "black") {
    return;
  }

  const piece = state.board[row][col];

  if (!state.selectedSquare) {
    if (piece && piece.color === state.currentTurn) {
      selectPiece(row, col);
    }
    return;
  }

  if (state.selectedSquare.row === row && state.selectedSquare.col === col) {
    clearSelection();
    renderBoard();
    return;
  }

  const chosenMove = state.legalMoves.find((move) => move.toRow === row && move.toCol === col);
  if (chosenMove) {
    performMove(chosenMove);
    return;
  }

  if (piece && piece.color === state.currentTurn) {
    selectPiece(row, col);
    return;
  }

  clearSelection();
  renderBoard();
}

function handleBoardClick(event) {
  const square = event.target.closest(".square");
  if (!square) {
    return;
  }

  handleSquareSelection(Number(square.dataset.row), Number(square.dataset.col));
}

function handlePromotionClick(event) {
  const button = event.target.closest(".promotion-button");
  if (!button || !state.pendingPromotion) {
    return;
  }

  const promotionChoice = button.dataset.piece;
  performMove(state.pendingPromotion, { promotionChoice });
}

function refreshStatusFromPosition() {
  const summary = getPositionSummary(state);
  state.gameOver = summary.gameOver;
  state.winner = summary.winner;
  state.drawReason = summary.drawReason;
  state.statusMessage = summary.message;
}

function toggleAI() {
  clearPendingAI();
  state.aiEnabled = !state.aiEnabled;
  refreshStatusFromPosition();
  renderAll();
  scheduleAIMoveIfNeeded();
}

function handleDifficultyChange(event) {
  state.aiDifficulty = event.target.value;
  renderStatus();

  if (state.aiEnabled && state.currentTurn === "black" && !state.gameOver) {
    scheduleAIMoveIfNeeded();
  }
}

function restartGame() {
  const aiEnabled = state.aiEnabled;
  const aiDifficulty = state.aiDifficulty;

  pauseClock();
  clearPendingAI();
  state = createNewGameState();
  state.aiEnabled = aiEnabled;
  state.aiDifficulty = aiDifficulty;
  refreshStatusFromPosition();
  renderAll();
}

function undoMove() {
  syncClockTime();
  clearPendingAI();
  state.pendingPromotion = null;

  if (!state.historySnapshots.length) {
    return;
  }

  const targetSteps = state.aiEnabled ? 2 : 1;
  let restoredSteps = 0;

  while (restoredSteps < targetSteps && state.historySnapshots.length) {
    const snapshot = state.historySnapshots.pop();
    restoreSnapshot(snapshot);
    restoredSteps += 1;

    if (!state.aiEnabled || state.currentTurn === "white") {
      break;
    }
  }

  renderAll();
}

function bindUI() {
  if (DOM.board.dataset.bound === "true") {
    return;
  }

  DOM.board.addEventListener("click", handleBoardClick);
  DOM.promotionOptions.addEventListener("click", handlePromotionClick);
  DOM.aiToggle.addEventListener("click", toggleAI);
  DOM.startButton.addEventListener("click", enterGameScreen);
  DOM.openMenuButton.addEventListener("click", openMenuScreen);
  DOM.restartButton.addEventListener("click", restartGame);
  DOM.undoButton.addEventListener("click", undoMove);
  DOM.difficultySelect.addEventListener("change", handleDifficultyChange);
  DOM.board.dataset.bound = "true";
}

function startGame() {
  cacheDOMElements();
  bindUI();
  refreshStatusFromPosition();
  renderAll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startGame);
} else {
  startGame();
}

globalThis.chessPracticeApp = {
  restartGame,
  undoMove,
  toggleAI,
  enterGameScreen,
  openMenuScreen,
  getState() {
    return {
      board: cloneBoard(state.board),
      currentTurn: state.currentTurn,
      gameOver: state.gameOver,
      winner: state.winner,
      statusMessage: state.statusMessage,
      whiteTimeMs: state.whiteTimeMs,
      blackTimeMs: state.blackTimeMs,
      moveHistory: cloneMoveHistory(state.moveHistory)
    };
  }
};
