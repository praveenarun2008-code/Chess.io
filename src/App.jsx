import { useEffect, useRef, useState } from "react";

const FILE_LABELS = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANK_LABELS = ["8", "7", "6", "5", "4", "3", "2", "1"];

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

const PIECE_VALUES = {
  pawn: 1,
  knight: 3,
  bishop: 3,
  rook: 5,
  queen: 9,
  king: 100
};

const AI_LEVELS = {
  easy: {
    label: "Easy",
    searchDepth: 0,
    thinkDelay: 280,
    randomFactor: 1.1,
    topMovesToPickFrom: 4
  },
  medium: {
    label: "Medium",
    searchDepth: 2,
    thinkDelay: 420,
    randomFactor: 0.18,
    topMovesToPickFrom: 2
  },
  hard: {
    label: "Hard",
    searchDepth: 3,
    thinkDelay: 650,
    randomFactor: 0,
    topMovesToPickFrom: 1
  }
};

const AI_DIFFICULTY_OPTIONS = Object.entries(AI_LEVELS);

function createPiece(type, color) {
  return { type, color };
}

function createInitialBoard() {
  const emptyBoard = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

  backRank.forEach((type, column) => {
    emptyBoard[0][column] = createPiece(type, "black");
    emptyBoard[1][column] = createPiece("pawn", "black");
    emptyBoard[6][column] = createPiece("pawn", "white");
    emptyBoard[7][column] = createPiece(type, "white");
  });

  return emptyBoard;
}

function isInsideBoard(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getSquareLabel(row, column, piece) {
  const file = String.fromCharCode(97 + column);
  const rank = 8 - row;
  const position = `${file}${rank}`;

  if (!piece) {
    return `Empty square ${position}`;
  }

  return `${capitalize(piece.color)} ${piece.type} on ${position}`;
}

function cloneBoard(boardState) {
  return boardState.map((row) =>
    row.map((piece) => (piece ? { ...piece } : null))
  );
}

function hasKing(boardState, color) {
  return boardState.some((row) =>
    row.some((piece) => piece?.type === "king" && piece.color === color)
  );
}

function getPawnMoves(row, col, piece, boardState) {
  const moves = [];
  const direction = piece.color === "white" ? -1 : 1;
  const startingRow = piece.color === "white" ? 6 : 1;
  const oneStepRow = row + direction;

  if (isInsideBoard(oneStepRow, col) && !boardState[oneStepRow][col]) {
    moves.push({ row: oneStepRow, col, capture: false });

    const twoStepRow = row + direction * 2;
    if (row === startingRow && !boardState[twoStepRow][col]) {
      moves.push({ row: twoStepRow, col, capture: false });
    }
  }

  [-1, 1].forEach((columnOffset) => {
    const captureCol = col + columnOffset;

    if (!isInsideBoard(oneStepRow, captureCol)) {
      return;
    }

    const targetPiece = boardState[oneStepRow][captureCol];
    if (targetPiece && targetPiece.color !== piece.color) {
      moves.push({ row: oneStepRow, col: captureCol, capture: true });
    }
  });

  return moves;
}

function getSlidingMoves(row, col, piece, boardState, directions) {
  const moves = [];

  directions.forEach(({ rowOffset, colOffset }) => {
    let nextRow = row + rowOffset;
    let nextCol = col + colOffset;

    while (isInsideBoard(nextRow, nextCol)) {
      const targetPiece = boardState[nextRow][nextCol];

      if (!targetPiece) {
        moves.push({ row: nextRow, col: nextCol, capture: false });
      } else {
        if (targetPiece.color !== piece.color) {
          moves.push({ row: nextRow, col: nextCol, capture: true });
        }
        break;
      }

      nextRow += rowOffset;
      nextCol += colOffset;
    }
  });

  return moves;
}

function getKnightMoves(row, col, piece, boardState) {
  const moves = [];
  const jumps = [
    { rowOffset: -2, colOffset: -1 },
    { rowOffset: -2, colOffset: 1 },
    { rowOffset: -1, colOffset: -2 },
    { rowOffset: -1, colOffset: 2 },
    { rowOffset: 1, colOffset: -2 },
    { rowOffset: 1, colOffset: 2 },
    { rowOffset: 2, colOffset: -1 },
    { rowOffset: 2, colOffset: 1 }
  ];

  jumps.forEach(({ rowOffset, colOffset }) => {
    const nextRow = row + rowOffset;
    const nextCol = col + colOffset;

    if (!isInsideBoard(nextRow, nextCol)) {
      return;
    }

    const targetPiece = boardState[nextRow][nextCol];
    if (!targetPiece || targetPiece.color !== piece.color) {
      moves.push({ row: nextRow, col: nextCol, capture: Boolean(targetPiece) });
    }
  });

  return moves;
}

function getKingMoves(row, col, piece, boardState) {
  const moves = [];

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
      if (!targetPiece || targetPiece.color !== piece.color) {
        moves.push({ row: nextRow, col: nextCol, capture: Boolean(targetPiece) });
      }
    }
  }

  return moves;
}

function getValidMoves(row, col, boardState) {
  const piece = boardState[row][col];

  if (!piece) {
    return [];
  }

  switch (piece.type) {
    case "pawn":
      return getPawnMoves(row, col, piece, boardState);
    case "rook":
      return getSlidingMoves(row, col, piece, boardState, [
        { rowOffset: 1, colOffset: 0 },
        { rowOffset: -1, colOffset: 0 },
        { rowOffset: 0, colOffset: 1 },
        { rowOffset: 0, colOffset: -1 }
      ]);
    case "knight":
      return getKnightMoves(row, col, piece, boardState);
    case "bishop":
      return getSlidingMoves(row, col, piece, boardState, [
        { rowOffset: 1, colOffset: 1 },
        { rowOffset: 1, colOffset: -1 },
        { rowOffset: -1, colOffset: 1 },
        { rowOffset: -1, colOffset: -1 }
      ]);
    case "queen":
      return getSlidingMoves(row, col, piece, boardState, [
        { rowOffset: 1, colOffset: 0 },
        { rowOffset: -1, colOffset: 0 },
        { rowOffset: 0, colOffset: 1 },
        { rowOffset: 0, colOffset: -1 },
        { rowOffset: 1, colOffset: 1 },
        { rowOffset: 1, colOffset: -1 },
        { rowOffset: -1, colOffset: 1 },
        { rowOffset: -1, colOffset: -1 }
      ]);
    case "king":
      return getKingMoves(row, col, piece, boardState);
    default:
      return [];
  }
}

function getAllValidMoves(color, boardState) {
  const moves = [];

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = boardState[row][col];

      if (!piece || piece.color !== color) {
        continue;
      }

      getValidMoves(row, col, boardState).forEach((move) => {
        moves.push({
          from: { row, col },
          to: { row: move.row, col: move.col },
          piece,
          capturedPiece: boardState[move.row][move.col]
        });
      });
    }
  }

  return moves;
}

function createNextBoard(boardState, from, to) {
  const nextBoard = cloneBoard(boardState);
  const movingPiece = nextBoard[from.row][from.col];

  nextBoard[to.row][to.col] = movingPiece;
  nextBoard[from.row][from.col] = null;

  if (nextBoard[to.row][to.col].type === "pawn" && (to.row === 0 || to.row === 7)) {
    nextBoard[to.row][to.col] = { ...nextBoard[to.row][to.col], type: "queen" };
  }

  return nextBoard;
}

function evaluateBoard(boardState) {
  if (!hasKing(boardState, "white")) {
    return 100000;
  }

  if (!hasKing(boardState, "black")) {
    return -100000;
  }

  let score = 0;

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = boardState[row][col];

      if (!piece) {
        continue;
      }

      const materialValue = PIECE_VALUES[piece.type];
      const distanceToCenter = Math.abs(3.5 - row) + Math.abs(3.5 - col);
      const centerBonus = (7 - distanceToCenter) * 0.08;
      const pieceScore = materialValue + centerBonus;

      score += piece.color === "black" ? pieceScore : -pieceScore;
    }
  }

  const blackMobility = getAllValidMoves("black", boardState).length;
  const whiteMobility = getAllValidMoves("white", boardState).length;

  return score + (blackMobility - whiteMobility) * 0.05;
}

function scoreMove(move) {
  let score = 0;

  if (move.capturedPiece) {
    score += PIECE_VALUES[move.capturedPiece.type] * 12;
    score -= PIECE_VALUES[move.piece.type];
  }

  if (move.piece.type === "pawn" && move.to.row === 7) {
    score += 9;
  }

  const distanceToCenter = Math.abs(3.5 - move.to.row) + Math.abs(3.5 - move.to.col);
  score += (7 - distanceToCenter) * 0.2;

  return score;
}

function orderMoves(moves) {
  return [...moves].sort((firstMove, secondMove) => scoreMove(secondMove) - scoreMove(firstMove));
}

function minimax(boardState, depth, isBlackTurn, alpha, beta) {
  if (!hasKing(boardState, "white") || !hasKing(boardState, "black")) {
    return evaluateBoard(boardState);
  }

  if (depth === 0) {
    return evaluateBoard(boardState);
  }

  const colorToMove = isBlackTurn ? "black" : "white";
  const moves = orderMoves(getAllValidMoves(colorToMove, boardState));

  if (!moves.length) {
    return evaluateBoard(boardState);
  }

  if (isBlackTurn) {
    let bestScore = -Infinity;

    for (const move of moves) {
      const nextBoard = createNextBoard(boardState, move.from, move.to);
      const score = minimax(nextBoard, depth - 1, false, alpha, beta);
      bestScore = Math.max(bestScore, score);
      alpha = Math.max(alpha, score);

      if (beta <= alpha) {
        break;
      }
    }

    return bestScore;
  }

  let bestScore = Infinity;

  for (const move of moves) {
    const nextBoard = createNextBoard(boardState, move.from, move.to);
    const score = minimax(nextBoard, depth - 1, true, alpha, beta);
    bestScore = Math.min(bestScore, score);
    beta = Math.min(beta, score);

    if (beta <= alpha) {
      break;
    }
  }

  return bestScore;
}

function getDifficultyDescription(difficulty) {
  const level = AI_LEVELS[difficulty] ?? AI_LEVELS.medium;
  return `${level.label} AI controls black.`;
}

function getTurnStatusMessage(player, vsAI, aiDifficulty) {
  const baseMessage = `${capitalize(player)} to move.`;
  return vsAI ? `${baseMessage} ${getDifficultyDescription(aiDifficulty)}` : baseMessage;
}

function chooseAIMove(boardState, difficulty) {
  const levelConfig = AI_LEVELS[difficulty] ?? AI_LEVELS.medium;
  const moves = orderMoves(getAllValidMoves("black", boardState));

  if (!moves.length) {
    return null;
  }

  if (levelConfig.searchDepth === 0) {
    const movePool = moves.slice(0, Math.min(levelConfig.topMovesToPickFrom, moves.length));
    return movePool[Math.floor(Math.random() * movePool.length)];
  }

  let bestScore = -Infinity;
  let scoredMoves = [];

  moves.forEach((move) => {
    const nextBoard = createNextBoard(boardState, move.from, move.to);
    const score =
      minimax(nextBoard, levelConfig.searchDepth - 1, false, -Infinity, Infinity) +
      Math.random() * levelConfig.randomFactor;

    if (score > bestScore) {
      bestScore = score;
      scoredMoves = [{ move, score }];
      return;
    }

    if (Math.abs(score - bestScore) < 0.15) {
      scoredMoves.push({ move, score });
    }
  });

  const finalists = scoredMoves
    .sort((firstMove, secondMove) => secondMove.score - firstMove.score)
    .slice(0, levelConfig.topMovesToPickFrom);

  return finalists[Math.floor(Math.random() * finalists.length)]?.move ?? moves[0];
}

function App() {
  const [board, setBoard] = useState(() => createInitialBoard());
  const [currentPlayer, setCurrentPlayer] = useState("white");
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [vsAI, setVsAI] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState("medium");
  const [aiThinking, setAiThinking] = useState(false);
  const [winner, setWinner] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [statusMessage, setStatusMessage] = useState("White to move.");
  const aiMoveTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (aiMoveTimeoutRef.current !== null) {
        window.clearTimeout(aiMoveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!vsAI || currentPlayer !== "black" || gameOver) {
      return undefined;
    }

    const levelConfig = AI_LEVELS[aiDifficulty] ?? AI_LEVELS.medium;
    setAiThinking(true);
    setStatusMessage(`Black is thinking... ${levelConfig.label} AI is planning a move.`);

    aiMoveTimeoutRef.current = window.setTimeout(() => {
      const aiMove = chooseAIMove(board, aiDifficulty);

      setAiThinking(false);
      aiMoveTimeoutRef.current = null;

      if (!aiMove) {
        setGameOver(true);
        setWinner("white");
        setStatusMessage("Black has no valid moves. White wins.");
        return;
      }

      performMove(aiMove.from, aiMove.to);
    }, levelConfig.thinkDelay);

    return () => {
      if (aiMoveTimeoutRef.current !== null) {
        window.clearTimeout(aiMoveTimeoutRef.current);
        aiMoveTimeoutRef.current = null;
      }
    };
  }, [aiDifficulty, board, currentPlayer, gameOver, vsAI]);

  function resetGame() {
    if (aiMoveTimeoutRef.current !== null) {
      window.clearTimeout(aiMoveTimeoutRef.current);
      aiMoveTimeoutRef.current = null;
    }

    setBoard(createInitialBoard());
    setCurrentPlayer("white");
    setSelectedSquare(null);
    setValidMoves([]);
    setGameOver(false);
    setAiThinking(false);
    setWinner(null);
    setLastMove(null);
    setStatusMessage(getTurnStatusMessage("white", vsAI, aiDifficulty));
  }

  function performMove(from, to) {
    const movingPiece = board[from.row][from.col];
    const capturedPiece = board[to.row][to.col];

    if (!movingPiece) {
      return;
    }

    const nextBoard = createNextBoard(board, from, to);
    const nextPlayer = currentPlayer === "white" ? "black" : "white";

    setBoard(nextBoard);
    setSelectedSquare(null);
    setValidMoves([]);
    setLastMove({ from: { ...from }, to: { ...to } });

    if (capturedPiece?.type === "king") {
      setGameOver(true);
      setWinner(movingPiece.color);
      setStatusMessage(`${capitalize(movingPiece.color)} captured the king. Game over.`);
      return;
    }

    setCurrentPlayer(nextPlayer);

    if (capturedPiece) {
      setStatusMessage(
        `${capitalize(movingPiece.color)} captured ${capitalize(capturedPiece.color)} ${capturedPiece.type}.`
      );
      return;
    }

    setStatusMessage(getTurnStatusMessage(nextPlayer, vsAI, aiDifficulty));
  }

  function handleSquareClick(row, col) {
    if (gameOver || aiThinking) {
      return;
    }

    if (vsAI && currentPlayer === "black") {
      return;
    }

    const clickedPiece = board[row][col];

    if (!selectedSquare) {
      if (clickedPiece && clickedPiece.color === currentPlayer) {
        setSelectedSquare({ row, col });
        setValidMoves(getValidMoves(row, col, board));
      }
      return;
    }

    if (selectedSquare.row === row && selectedSquare.col === col) {
      setSelectedSquare(null);
      setValidMoves([]);
      return;
    }

    const chosenMove = validMoves.find((move) => move.row === row && move.col === col);
    if (chosenMove) {
      performMove(selectedSquare, { row, col });
      return;
    }

    if (clickedPiece && clickedPiece.color === currentPlayer) {
      setSelectedSquare({ row, col });
      setValidMoves(getValidMoves(row, col, board));
      return;
    }

    setSelectedSquare(null);
    setValidMoves([]);
  }

  function toggleAI() {
    const nextVsAI = !vsAI;

    if (!nextVsAI && aiMoveTimeoutRef.current !== null) {
      window.clearTimeout(aiMoveTimeoutRef.current);
      aiMoveTimeoutRef.current = null;
      setAiThinking(false);
    }

    setVsAI(nextVsAI);

    if (gameOver) {
      return;
    }

    setStatusMessage(getTurnStatusMessage(currentPlayer, nextVsAI, aiDifficulty));
  }

  const turnIndicator = gameOver
    ? `Game over${winner ? `: ${capitalize(winner)} wins` : ""}`
    : `Current turn: ${capitalize(currentPlayer)}`;

  return (
    <main className="app">
      <section className="game-shell" aria-label="Chess game">
        <div className="info-panel">
          <p className="eyebrow">Offline Chess</p>
          <h1>Basic Chess Game</h1>
          <p className="subtitle">
            Local two-player mode with an optional offline AI that plays as black.
          </p>

          <div className="status-card">
            <p className="status-label">Status</p>
            <p className="status-message">{statusMessage}</p>
            <p className="turn-indicator">{turnIndicator}</p>
          </div>

          <div className="controls">
            <button
              className={`control-button ${vsAI ? "active" : ""}`}
              type="button"
              aria-pressed={vsAI}
              onClick={toggleAI}
            >
              Play vs AI: {vsAI ? "On" : "Off"}
            </button>
            <button className="control-button secondary" type="button" onClick={resetGame}>
              Restart Game
            </button>
          </div>

          <div className="control-group">
            <label className="control-label" htmlFor="ai-difficulty">
              AI Difficulty
            </label>
            <select
              id="ai-difficulty"
              className="difficulty-select"
              value={aiDifficulty}
              onChange={(event) => setAiDifficulty(event.target.value)}
            >
              {AI_DIFFICULTY_OPTIONS.map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="control-note">
              Easy makes more human mistakes, medium looks ahead, and hard searches deeper.
            </p>
          </div>

          <div className="legend">
            <p><span className="legend-dot selected-dot"></span> Selected piece</p>
            <p><span className="legend-dot move-dot"></span> Valid move</p>
            <p><span className="legend-dot move-trail-dot"></span> Last move</p>
          </div>
        </div>

        <div className="board-panel">
          <div className="board-frame">
            <div className="board-label board-label-top" aria-hidden="true">
              {FILE_LABELS.map((label) => (
                <span key={`top-${label}`}>{label}</span>
              ))}
            </div>

            <div className="board-with-ranks">
              <div className="rank-labels" aria-hidden="true">
                {RANK_LABELS.map((label) => (
                  <span key={`rank-${label}`}>{label}</span>
                ))}
              </div>

              <div className={`board ${aiThinking ? "disabled" : ""}`} role="grid" aria-label="Chess board">
                {board.flatMap((boardRow, row) =>
                  boardRow.map((piece, col) => {
                    const isLightSquare = (row + col) % 2 === 0;
                    const moveInfo = validMoves.find((move) => move.row === row && move.col === col);
                    const isSelected =
                      selectedSquare && selectedSquare.row === row && selectedSquare.col === col;
                    const isPartOfLastMove =
                      lastMove &&
                      ((lastMove.from.row === row && lastMove.from.col === col) ||
                        (lastMove.to.row === row && lastMove.to.col === col));

                    const classNames = [
                      "square",
                      isLightSquare ? "light" : "dark",
                      isSelected ? "selected" : "",
                      moveInfo ? "valid-move" : "",
                      moveInfo?.capture ? "capture-move" : "",
                      isPartOfLastMove ? "last-move" : ""
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <button
                        key={`${row}-${col}`}
                        type="button"
                        className={classNames}
                        role="gridcell"
                        aria-label={getSquareLabel(row, col, piece)}
                        onClick={() => handleSquareClick(row, col)}
                      >
                        {piece ? (
                          <span className={`piece ${piece.color}-piece`}>
                            {PIECE_SYMBOLS[piece.color][piece.type]}
                          </span>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="board-label board-label-bottom" aria-hidden="true">
              {FILE_LABELS.map((label) => (
                <span key={`bottom-${label}`}>{label}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
