// --- CONSTANTES E ESTADO DO JOGO ---
const boardContainer = document.getElementById("board-container");
const statusDisplay = document.getElementById("status");
const resetButton = document.getElementById("reset-button");
const promotionModal = document.getElementById("promotion-modal");
const promotionChoices = document.getElementById("promotion-choices");

const PIECES = {
  wP: "♙",
  wR: "♖",
  wN: "♘",
  wB: "♗",
  wQ: "♕",
  wK: "♔",
  bP: "♟︎",
  bR: "♜",
  bN: "♞",
  bB: "♝",
  bQ: "♛",
  bK: "♚︎",
};

let boardState;
let currentPlayer;
let selectedSquare = null;
let validMoves = [];
let gameActive = true;
let enPassantTarget = null; // Armazena a casa vulnerável ao en passant
let castlingRights; // Direitos de roque: { w: { k: true, q: true }, b: { k: true, q: true } }
let promotionPromise = null;
let lastMove = { from: null, to: null };

// --- INICIALIZAÇÃO DO JOGO ---
function initializeGame() {
  boardState = [
    ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
    ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
    ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"],
  ];
  currentPlayer = "w";
  gameActive = true;
  selectedSquare = null;
  validMoves = [];
  enPassantTarget = null;
  lastMove = { from: null, to: null };
  castlingRights = { w: { k: true, q: true }, b: { k: true, q: true } };
  statusDisplay.textContent = "Turno das Brancas";
  renderBoard();
}

// --- RENDERIZAÇÃO DO TABULEIRO ---
function renderBoard() {
  boardContainer.innerHTML = "";
  // Limpa highlights de movimento anterior
  document
    .querySelectorAll(".last-move")
    .forEach((el) => el.classList.remove("last-move"));

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const square = document.createElement("div");
      square.classList.add("square");
      square.classList.add((r + c) % 2 === 0 ? "light" : "dark");
      square.dataset.row = r;
      square.dataset.col = c;

      const piece = boardState[r][c];
      if (piece) {
        square.textContent = PIECES[piece];
      }

      // Adiciona highlights
      if (
        selectedSquare &&
        selectedSquare.row === r &&
        selectedSquare.col === c
      ) {
        square.classList.add("selected");
      }
      if (lastMove.from && lastMove.from.row === r && lastMove.from.col === c) {
        square.classList.add("last-move");
      }
      if (lastMove.to && lastMove.to.row === r && lastMove.to.col === c) {
        square.classList.add("last-move");
      }
      if (piece && piece.endsWith("K") && isKingInCheck(piece[0])) {
        square.classList.add("check-highlight");
      }

      const isValidMove = validMoves.some(
        (move) => move.row === r && move.col === c
      );
      if (isValidMove) {
        const dot = document.createElement("div");
        dot.classList.add("valid-move-indicator");
        square.appendChild(dot);
      }

      boardContainer.appendChild(square);
    }
  }
}

// --- LÓGICA DE MOVIMENTO ---
boardContainer.addEventListener("click", (e) => {
  if (!gameActive) return;

  const square = e.target.closest(".square");
  if (!square) return;

  const row = parseInt(square.dataset.row);
  const col = parseInt(square.dataset.col);
  const piece = boardState[row][col];

  // Tenta mover a peça selecionada
  if (
    selectedSquare &&
    validMoves.some((move) => move.row === row && move.col === col)
  ) {
    movePiece(selectedSquare, { row, col });
  }
  // Seleciona uma peça
  else if (piece && piece[0] === currentPlayer) {
    selectPiece({ row, col });
  }
  // Desseleciona
  else {
    clearSelection();
  }
});

function selectPiece(square) {
  clearSelection();
  selectedSquare = square;
  validMoves = getValidMoves(square.row, square.col);
  renderBoard();
}

function clearSelection() {
  selectedSquare = null;
  validMoves = [];
  renderBoard();
}

async function movePiece(from, to) {
  const piece = boardState[from.row][from.col];
  const capturedPiece = boardState[to.row][to.col];
  let enPassantCapture = false;

  // Atualiza o estado do tabuleiro
  boardState[to.row][to.col] = piece;
  boardState[from.row][from.col] = null;

  // Lógica de En Passant
  if (
    piece.endsWith("P") &&
    enPassantTarget &&
    to.row === enPassantTarget.row &&
    to.col === enPassantTarget.col
  ) {
    const capturedPawnRow = currentPlayer === "w" ? to.row + 1 : to.row - 1;
    boardState[capturedPawnRow][to.col] = null;
    enPassantCapture = true;
  }

  // Define o próximo alvo de en passant (se um peão andou 2 casas)
  if (piece.endsWith("P") && Math.abs(from.row - to.row) === 2) {
    enPassantTarget = { row: (from.row + to.row) / 2, col: from.col };
  } else {
    enPassantTarget = null;
  }

  // Lógica de Roque
  if (piece.endsWith("K") && Math.abs(from.col - to.col) === 2) {
    // Roque do lado do Rei (curto)
    if (to.col === 6) {
      boardState[from.row][5] = boardState[from.row][7];
      boardState[from.row][7] = null;
    }
    // Roque do lado da Dama (longo)
    if (to.col === 2) {
      boardState[from.row][3] = boardState[from.row][0];
      boardState[from.row][0] = null;
    }
  }

  // Atualiza direitos de roque
  if (piece === "wK") {
    castlingRights.w.k = false;
    castlingRights.w.q = false;
  }
  if (piece === "bK") {
    castlingRights.b.k = false;
    castlingRights.b.q = false;
  }
  if (piece === "wR" && from.col === 0) {
    castlingRights.w.q = false;
  }
  if (piece === "wR" && from.col === 7) {
    castlingRights.w.k = false;
  }
  if (piece === "bR" && from.col === 0) {
    castlingRights.b.q = false;
  }
  if (piece === "bR" && from.col === 7) {
    castlingRights.b.k = false;
  }

  // Lógica de Promoção de Peão
  if (piece.endsWith("P") && (to.row === 0 || to.row === 7)) {
    const newPieceType = await handlePromotion(to.row, to.col);
    boardState[to.row][to.col] = currentPlayer + newPieceType;
  }

  // Atualiza estado do jogo
  lastMove = { from, to };
  switchPlayer();
  clearSelection(); // Limpa a seleção e renderiza o tabuleiro
  checkGameStatus();
}

function switchPlayer() {
  currentPlayer = currentPlayer === "w" ? "b" : "w";
  statusDisplay.textContent = `Turno das ${
    currentPlayer === "w" ? "Brancas" : "Pretas"
  }`;
}

// --- VALIDAÇÃO DE MOVIMENTOS E REGRAS ---

function getValidMoves(row, col) {
  const piece = boardState[row][col];
  if (!piece) return [];

  let moves = [];
  const color = piece[0];
  const type = piece[1];

  switch (type) {
    case "P":
      moves = getPawnMoves(row, col, color);
      break;
    case "R":
      moves = getSlidingMoves(row, col, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]);
      break;
    case "N":
      moves = getKnightMoves(row, col);
      break;
    case "B":
      moves = getSlidingMoves(row, col, [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]);
      break;
    case "Q":
      moves = getSlidingMoves(row, col, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]);
      break;
    case "K":
      moves = getKingMoves(row, col, color);
      break;
  }

  // Filtra movimentos que deixariam o rei em xeque
  return moves.filter(
    (move) => !moveLeavesKingInCheck(row, col, move.row, move.col, color)
  );
}

function getPawnMoves(r, c, color) {
  const moves = [];
  const direction = color === "w" ? -1 : 1;
  const startRow = color === "w" ? 6 : 1;

  // Movimento para frente
  if (isValid(r + direction, c) && !boardState[r + direction][c]) {
    moves.push({ row: r + direction, col: c });
    // Movimento duplo inicial
    if (
      r === startRow &&
      isValid(r + 2 * direction, c) &&
      !boardState[r + 2 * direction][c]
    ) {
      moves.push({ row: r + 2 * direction, col: c });
    }
  }

  // Capturas diagonais
  for (let dc of [-1, 1]) {
    const newR = r + direction;
    const newC = c + dc;
    if (isValid(newR, newC)) {
      const targetPiece = boardState[newR][newC];
      // Captura normal
      if (targetPiece && targetPiece[0] !== color) {
        moves.push({ row: newR, col: newC });
      }
      // Captura En Passant
      if (
        enPassantTarget &&
        newR === enPassantTarget.row &&
        newC === enPassantTarget.col
      ) {
        moves.push({ row: newR, col: newC });
      }
    }
  }
  return moves;
}

function getKnightMoves(r, c) {
  const moves = [];
  const directions = [
    [2, 1],
    [2, -1],
    [-2, 1],
    [-2, -1],
    [1, 2],
    [1, -2],
    [-1, 2],
    [-1, -2],
  ];
  for (const [dr, dc] of directions) {
    moves.push({ row: r + dr, col: c + dc });
  }
  return moves.filter(
    (m) =>
      isValid(m.row, m.col) &&
      (!boardState[m.row][m.col] ||
        boardState[m.row][m.col][0] !== currentPlayer)
  );
}

function getSlidingMoves(r, c, directions) {
  const moves = [];
  const color = boardState[r][c][0];
  for (const [dr, dc] of directions) {
    let newR = r + dr;
    let newC = c + dc;
    while (isValid(newR, newC)) {
      const targetPiece = boardState[newR][newC];
      if (targetPiece) {
        if (targetPiece[0] !== color) {
          moves.push({ row: newR, col: newC }); // Captura
        }
        break; // Bloqueado
      }
      moves.push({ row: newR, col: newC }); // Casa vazia
      newR += dr;
      newC += dc;
    }
  }
  return moves;
}

function getKingMoves(r, c, color) {
  const moves = [];
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  for (const [dr, dc] of directions) {
    const newR = r + dr;
    const newC = c + dc;
    if (
      isValid(newR, newC) &&
      (!boardState[newR][newC] || boardState[newR][newC][0] !== color)
    ) {
      moves.push({ row: newR, col: newC });
    }
  }

  // Lógica de Roque
  // Roque do lado do Rei (curto)
  if (
    castlingRights[color].k &&
    !boardState[r][c + 1] &&
    !boardState[r][c + 2] &&
    !isSquareAttacked(r, c, getOpponent(color)) &&
    !isSquareAttacked(r, c + 1, getOpponent(color)) &&
    !isSquareAttacked(r, c + 2, getOpponent(color))
  ) {
    moves.push({ row: r, col: c + 2 });
  }
  // Roque do lado da Dama (longo)
  if (
    castlingRights[color].q &&
    !boardState[r][c - 1] &&
    !boardState[r][c - 2] &&
    !boardState[r][c - 3] &&
    !isSquareAttacked(r, c, getOpponent(color)) &&
    !isSquareAttacked(r, c - 1, getOpponent(color)) &&
    !isSquareAttacked(r, c - 2, getOpponent(color))
  ) {
    moves.push({ row: r, col: c - 2 });
  }

  return moves;
}

function moveLeavesKingInCheck(fromRow, fromCol, toRow, toCol, color) {
  const originalPiece = boardState[toRow][toCol];
  const movingPiece = boardState[fromRow][fromCol];

  // Simula o movimento
  boardState[toRow][toCol] = movingPiece;
  boardState[fromRow][fromCol] = null;

  const inCheck = isKingInCheck(color);

  // Desfaz a simulação
  boardState[fromRow][fromCol] = movingPiece;
  boardState[toRow][toCol] = originalPiece;

  return inCheck;
}

function findKing(color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (boardState[r][c] === color + "K") {
        return { row: r, col: c };
      }
    }
  }
  return null; // Não deveria acontecer
}

function isKingInCheck(kingColor) {
  const kingPos = findKing(kingColor);
  if (!kingPos) return false;
  const opponentColor = getOpponent(kingColor);
  return isSquareAttacked(kingPos.row, kingPos.col, opponentColor);
}

function isSquareAttacked(row, col, attackerColor) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = boardState[r][c];
      if (piece && piece[0] === attackerColor) {
        // Para peões, a lógica de ataque é diferente do movimento
        if (piece.endsWith("P")) {
          const direction = attackerColor === "w" ? -1 : 1;
          if (
            (r + direction === row && c + 1 === col) ||
            (r + direction === row && c - 1 === col)
          ) {
            return true;
          }
        } else {
          // Para outras peças, podemos usar getValidMoves, mas sem a verificação de xeque para evitar recursão infinita
          const moves = getRawMoves(r, c);
          if (moves.some((move) => move.row === row && move.col === col)) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

// Obtém movimentos brutos, sem verificar se o próprio rei fica em xeque
function getRawMoves(row, col) {
  const piece = boardState[row][col];
  if (!piece) return [];
  const color = piece[0];
  const type = piece[1];

  switch (type) {
    case "P":
      return getPawnMoves(row, col, color);
    case "R":
      return getSlidingMoves(row, col, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]);
    case "N":
      return getKnightMoves(row, col);
    case "B":
      return getSlidingMoves(row, col, [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]);
    case "Q":
      return getSlidingMoves(row, col, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]);
    case "K":
      return getKingMoves(row, col, color);
    default:
      return [];
  }
}

function checkGameStatus() {
  const hasLegalMove = hasAnyLegalMove(currentPlayer);
  const inCheck = isKingInCheck(currentPlayer);

  if (!hasLegalMove) {
    if (inCheck) {
      statusDisplay.textContent = `Xeque-mate! As ${
        getOpponent(currentPlayer) === "w" ? "Brancas" : "Pretas"
      } venceram.`;
    } else {
      statusDisplay.textContent = "Empate por Afogamento (Stalemate)!";
    }
    gameActive = false;
  } else if (inCheck) {
    statusDisplay.textContent = `Xeque! Turno das ${
      currentPlayer === "w" ? "Brancas" : "Pretas"
    }.`;
  }
}

function hasAnyLegalMove(color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = boardState[r][c];
      if (piece && piece[0] === color) {
        const moves = getValidMoves(r, c);
        if (moves.length > 0) {
          return true;
        }
      }
    }
  }
  return false;
}

function handlePromotion(row, col) {
  return new Promise((resolve) => {
    promotionPromise = resolve;
    promotionModal.style.display = "flex";
    promotionChoices.innerHTML = "";
    const piecesToPromote = ["Q", "R", "B", "N"];
    piecesToPromote.forEach((type) => {
      const pieceEl = document.createElement("div");
      pieceEl.classList.add("promotion-piece");
      pieceEl.textContent = PIECES[currentPlayer + type];
      pieceEl.dataset.type = type;
      pieceEl.addEventListener("click", () => {
        promotionModal.style.display = "none";
        if (promotionPromise) {
          promotionPromise(type);
          promotionPromise = null;
        }
      });
      promotionChoices.appendChild(pieceEl);
    });
  });
}

// --- FUNÇÕES UTILITÁRIAS ---
function isValid(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function getOpponent(color) {
  return color === "w" ? "b" : "w";
}

// --- EVENT LISTENERS ---
resetButton.addEventListener("click", initializeGame);

// --- INICIAR O JOGO ---
document.addEventListener("DOMContentLoaded", initializeGame);
