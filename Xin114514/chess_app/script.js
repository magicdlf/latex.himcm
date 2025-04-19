const chessboard = document.getElementById('chessboard');
const whiteTimerEl = document.getElementById('white-timer');
const blackTimerEl = document.getElementById('black-timer');
const gameStatusEl = document.getElementById('game-status');
const promotionChoiceEl = document.getElementById('promotion-choice');
const gameOverDialogEl = document.getElementById('game-over-dialog');
const gameOverMessageEl = document.getElementById('game-over-message');
const newGameButton = document.getElementById('new-game-button');
const difficultySelectionEl = document.getElementById('difficulty-selection');
const gameAreaEl = document.getElementById('game-area');
const resignButton = document.getElementById('resign-button');
const evalBarContainer = document.getElementById('evaluation-bar-container');
const evalBar = document.getElementById('evaluation-bar');
const evalScoreEl = document.getElementById('evaluation-score');

// Unicode pieces
const pieces = {
    'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟', // Black
    'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'  // White
};

// Initial board setup (FEN notation can also be used)
// Uppercase for white, lowercase for black
const initialBoard = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

let boardState = JSON.parse(JSON.stringify(initialBoard)); // Deep copy for current state
let selectedSquare = null;
let possibleMoves = [];
let currentPlayer = 'W'; // W for White, B for Black
let gameActive = true;

// Timer settings (in seconds)
const initialTime = 10 * 60; // 10 minutes
let whiteTimeLeft = initialTime;
let blackTimeLeft = initialTime;
let timerInterval = null;

// Castling rights state
let castlingRights = {
    W: { K: true, Q: true }, // White: Kingside (K), Queenside (Q)
    B: { K: true, Q: true }  // Black: Kingside (K), Queenside (Q)
};

// State for promotion
let awaitingPromotion = false;
let promotionCoords = null; // {row, col} where pawn landed

// State for En Passant
let enPassantTargetSquare = null;

// State for Last Move Highlight
let lastMove = null; // { from: 'e2', to: 'e4' }

// State for Captured Pieces
let capturedByWhite = [];
let capturedByBlack = [];

// Rendering Flag
let isBoardRendered = false;

// Player Configuration
const playerType = {
    W: 'human', // White is Human
    B: 'AI'     // Black is AI
};

let aiDifficultyLevel = 'survivor'; // Default difficulty

// --- Piece Values for Evaluation ---
const pieceValues = {
    'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'K': 0 // King value is irrelevant for material count
};

// --- Piece-Square Tables (Simplified) ---
// Scores are added for White, subtracted for Black (tables are from White's perspective)
// We need to mirror the row index for Black

const pawnTable = [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0]
];

const knightTable = [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
];

const bishopTable = [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
];

// Simplified King tables (encourages castling and staying safe)
const kingTableMidGame = [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20] 
];

const kingTableEndGame = [
    [-50,-40,-30,-20,-20,-30,-40,-50],
    [-30,-20,-10,  0,  0,-10,-20,-30],
    [-30,-10, 20, 30, 30, 20,-10,-30],
    [-30,-10, 30, 40, 40, 30,-10,-30],
    [-30,-10, 30, 40, 40, 30,-10,-30],
    [-30,-10, 20, 30, 30, 20,-10,-30],
    [-30,-30,  0,  0,  0,  0,-30,-30],
    [-50,-30,-30,-30,-30,-30,-30,-50]
];

// (Rook and Queen tables could be added too, often simpler, e.g., bonus for open files/7th rank)

// Game State
let moveHistory = []; // Track moves like "e2e4", "g8f6"

// Simple Opening Book (for Black)
// Key: semicolon-separated move history string
// Value: The next move Black should play (e.g., "g8f6")
const openingBook = {
    "e2e4;": "c7c5", // Sicilian Defense
    "d2d4;": "g8f6", // Indian Defense
    "c2c4;": "e7e5", // Reversed Sicilian/English Opening response
    "e2e4;c7c5;g1f3;": "d7d6", // Sicilian, Najdorf/Classical main line start
    "e2e4;c7c5;b1c3;": "b8c6", // Closed Sicilian
    "d2d4;g8f6;c2c4;": "e7e6", // Nimzo-Indian/Queen's Indian/Bogo setup
    "d2d4;g8f6;g1f3;": "g7g6", // King's Indian setup
    // Add more lines as desired
};

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function updateTimerDisplay() {
    whiteTimerEl.textContent = `White: ${formatTime(whiteTimeLeft)}`;
    blackTimerEl.textContent = `Black: ${formatTime(blackTimeLeft)}`;

    whiteTimerEl.classList.remove('active');
    blackTimerEl.classList.remove('active');

    if (gameActive) {
        if (currentPlayer === 'W') {
            whiteTimerEl.classList.add('active');
        } else {
            blackTimerEl.classList.add('active');
        }
    }
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function startTimer() {
    stopTimer(); // Ensure only one timer runs
    if (!gameActive) return;

    timerInterval = setInterval(() => {
        if (currentPlayer === 'W') {
            whiteTimeLeft--;
            if (whiteTimeLeft <= 0) {
                endGame('Black wins on time!');
            }
        } else {
            blackTimeLeft--;
            if (blackTimeLeft <= 0) {
                endGame('White wins on time!');
            }
        }
        updateTimerDisplay();
    }, 1000); // Update every second
}

function endGame(message) {
    stopTimer();
    gameActive = false;
    console.log("Game Over:", message); // Keep console log
    // gameStatusEl.textContent = message; // No longer setting simple text
    updateTimerDisplay(); // Update display to remove active class

    // Show Game Over Dialog
    gameOverMessageEl.textContent = message;
    gameOverDialogEl.classList.remove('hidden');
}

function resetGame() {
    console.log("--- Resetting Game (keeping difficulty) --- ");
    // Reset game state variables
    boardState = JSON.parse(JSON.stringify(initialBoard));
    currentPlayer = 'W';
    gameActive = true;
    selectedSquare = null;
    possibleMoves = [];
    lastMove = null;
    enPassantTargetSquare = null;
    awaitingPromotion = false;
    promotionCoords = null;
    castlingRights = { W: { K: true, Q: true }, B: { K: true, Q: true } };
    capturedByWhite = [];
    capturedByBlack = [];
    moveHistory = []; // Clear move history

    // Reset timers
    whiteTimeLeft = initialTime;
    blackTimeLeft = initialTime;
    stopTimer(); // Ensure timer is stopped before potentially restarting

    // Hide dialogs
    gameOverDialogEl.classList.add('hidden');
    promotionChoiceEl.classList.add('hidden'); // Also hide promotion if it was somehow open

    // Reset UI text elements
    gameStatusEl.textContent = ''; // Clear check/status message

    // Render the initial board
    renderBoard(); // This will also call updateTimerDisplay and renderCapturedPieces

    // Start the timer for the first player (conditionally)
     if (gameActive && playerType[currentPlayer] === 'human') {
         startTimer();
     } else if (gameActive && playerType[currentPlayer] === 'AI') {
          setTimeout(makeAIMove, 500); // If White is AI in config
     }
}

// --- Helper to calculate sum of piece values ---
function sumPieceValues(pieceArray) {
    return pieceArray.reduce((sum, pieceCode) => {
        return sum + (pieceValues[pieceCode.toUpperCase()] || 0);
    }, 0);
}

function renderCapturedPieces() {
    const capturedWEl = document.getElementById('captured-by-white');
    const capturedBEl = document.getElementById('captured-by-black');
    const materialDiffWEl = document.getElementById('material-diff-white');
    const materialDiffBEl = document.getElementById('material-diff-black');

    // Display captured pieces (sorted by value descending, then type)
    const sortPieces = (a, b) => (pieceValues[b.toUpperCase()] || 0) - (pieceValues[a.toUpperCase()] || 0) || a.localeCompare(b);
    capturedByWhite.sort(sortPieces);
    capturedByBlack.sort(sortPieces);
    capturedWEl.innerHTML = capturedByWhite.map(code => pieces[code] || '').join(' ');
    capturedBEl.innerHTML = capturedByBlack.map(code => pieces[code] || '').join(' ');

    // Calculate and display material difference
    const whiteCapturedValue = sumPieceValues(capturedByWhite);
    const blackCapturedValue = sumPieceValues(capturedByBlack);
    const diff = whiteCapturedValue - blackCapturedValue;

    materialDiffWEl.textContent = (diff > 0) ? `+${diff}` : '';
    materialDiffBEl.textContent = (diff < 0) ? `+${Math.abs(diff)}` : '';

    // Hide score display if difference is zero
    materialDiffWEl.style.display = (diff > 0) ? 'inline' : 'none';
    materialDiffBEl.style.display = (diff < 0) ? 'inline' : 'none';
}

function renderBoard() {
    console.log("--- Rendering Board --- Last Move:", lastMove, "Selected:", selectedSquare?.id, "Possible:", possibleMoves);

    // --- 1. Clear ALL previous highlights from the entire board --- 
    if (isBoardRendered) { // Only clear if board already exists
        console.log("RENDER: Clearing previous highlights...");
        const highlightedSquares = chessboard.querySelectorAll('.last-move, .selected, .possible-move');
        highlightedSquares.forEach(sq => {
            sq.classList.remove('last-move', 'selected', 'possible-move');
        });
        console.log(`RENDER: Cleared highlights from ${highlightedSquares.length} squares.`);
    }

    // --- 2. Iterate through board state and update squares --- 
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const file = String.fromCharCode('a'.charCodeAt(0) + col);
            const rank = 8 - row;
            const squareId = `${file}${rank}`;
            let square = document.getElementById(squareId);

            // --- Create square element only if it doesn't exist (initial render) ---
            if (!square) {
                 console.log(`RENDER: Creating square ${squareId}`);
                square = document.createElement('div');
                square.id = squareId;
                square.classList.add('square');
                const isLight = (row + col) % 2 === 0;
                square.classList.add(isLight ? 'light' : 'dark');
                square.addEventListener('click', handleSquareClick);
                chessboard.appendChild(square);
            }

            // --- Update piece display (only if changed) ---
            const pieceCode = boardState[row][col];
            const currentPieceDisplay = square.innerHTML; // Read current HTML
            // Use &nbsp; for empty squares to prevent collapse
            const newPieceDisplay = pieceCode ? (pieces[pieceCode] || '') : '&nbsp;'; 
            if (currentPieceDisplay !== newPieceDisplay) {
                // console.log(`RENDER: Updating piece on ${squareId} from '${currentPieceDisplay}' to '${newPieceDisplay}'`);
                square.innerHTML = newPieceDisplay; // Update only if necessary
            }
            // Update dataset (less critical for rendering)
            if (pieceCode) {
                square.dataset.piece = pieceCode;
            } else {
                delete square.dataset.piece;
            }

             // --- 3. Add CURRENT highlights --- 
             // Note: We add highlights *after* potentially changing innerHTML 

             // Add Last Move Highlight
             if (lastMove && (squareId === lastMove.from || squareId === lastMove.to)) {
                 // console.log(`RENDER: Adding 'last-move' to ${squareId}`);
                 square.classList.add('last-move');
             }
             // Highlight possible moves
             if (possibleMoves.includes(squareId)) {
                 // console.log(`RENDER: Adding 'possible-move' to ${squareId}`);
                 square.classList.add('possible-move');
             }
             // Highlight selected square
             if (selectedSquare && selectedSquare.id === squareId) {
                 // console.log(`RENDER: Adding 'selected' to ${squareId}`);
                 square.classList.add('selected');
             }
        }
    }
    
    isBoardRendered = true; // Mark board as rendered

    // --- 4. Update non-board elements --- 
    updateTimerDisplay();
    renderCapturedPieces();
    updateEvaluationDisplay();
    console.log("--- Finished Rendering Board ---");
}

function handleSquareClick(event) {
    // Ignore clicks if game is over, promotion pending, or it's AI's turn
    if (!gameActive || awaitingPromotion || playerType[currentPlayer] === 'AI') return;

    const clickedSquare = event.currentTarget;
    const clickedCoords = getCoordsFromId(clickedSquare.id);
    const clickedPieceCode = boardState[clickedCoords.row][clickedCoords.col];
    const pieceColor = getPieceColor(clickedPieceCode);

    if (selectedSquare) {
        if (possibleMoves.includes(clickedSquare.id)) {
            const moveResult = movePiece(selectedSquare, clickedSquare);
            if (moveResult === 'promotion') {
                 renderBoard();
            } else {
                selectedSquare = null;
                possibleMoves = [];
                switchPlayer(); // Calls checkGameStatus, maybe starts timer or triggers AI
                renderBoard();
                // No need to trigger AI here, switchPlayer handles it
            }
        } else {
            // Deselect or select another piece
            selectedSquare.classList.remove('selected');
            if (pieceColor === currentPlayer && clickedSquare.id !== selectedSquare.id) {
                 selectedSquare = clickedSquare;
                 selectedSquare.classList.add('selected');
                 possibleMoves = calculatePossibleMoves(selectedSquare);
                 renderBoard();
            } else {
                 selectedSquare = null;
                 possibleMoves = [];
                 renderBoard(); // Re-render to clear selection/moves
            }
        }
        // Removed renderBoard from here as it's called within the branches now
    } else if (clickedPieceCode && pieceColor === currentPlayer) {
        // Selecting a piece
        selectedSquare = clickedSquare;
        selectedSquare.classList.add('selected');
        possibleMoves = calculatePossibleMoves(selectedSquare);
        renderBoard(); // Re-render to show possible moves
    }
}

function getCoordsFromId(id) {
    const file = id.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = 8 - parseInt(id[1]);
    return { row: rank, col: file };
}

function getIdFromCoords(row, col) {
     if (row < 0 || row > 7 || col < 0 || col > 7) return null;
     const file = String.fromCharCode('a'.charCodeAt(0) + col);
     const rank = 8 - row;
     return `${file}${rank}`;
}

function getPieceColor(pieceCode) {
    if (!pieceCode) return null;
    return pieceCode === pieceCode.toUpperCase() ? 'W' : 'B';
}

function switchPlayer() {
    currentPlayer = (currentPlayer === 'W' ? 'B' : 'W');
    console.log(`--- Player switched to: ${currentPlayer} (${playerType[currentPlayer]}) ---`);
    checkGameStatus(); // Check status first

    if (gameActive) {
        // Stop any existing timer interval before starting the new one
        stopTimer(); 
        
        if (playerType[currentPlayer] === 'AI') {
            console.log("AI's turn. Starting AI timer and scheduling move.");
            startTimer(); // Start the AI's timer immediately
            // Visual delay for the move itself - Make it longer than timer interval
            setTimeout(makeAIMove, 1100); // Changed from 500ms to 1100ms
        } else {
            console.log("Human's turn. Starting timer.");
            startTimer(); // Start timer for human player
        }
    } else {
        console.log("Game is not active, not starting timer.")
        stopTimer(); // Ensure timer is stopped if game ended
    }
    // Render board is called after AI moves or handled by human click logic
}

function makeAIMove() {
    if (!gameActive || playerType[currentPlayer] !== 'AI') return;
    console.log(`AI (${currentPlayer}) starting makeAIMove with difficulty: ${aiDifficultyLevel}...`);

    // --- 1. Check Opening Book --- 
    const historyKey = moveHistory.join(';') + ';'; // Create key like "e2e4;e7e5;"
    let openingMove = null;
    if (openingBook[historyKey]) {
        // TODO: Verify the book move is legal in the current position!
        // This requires generating legal moves for the piece specified in the book move.
        // For now, we assume the book is correct and the move is valid.
        const bookMoveString = openingBook[historyKey];
        const fromSq = bookMoveString.substring(0, 2);
        const toSq = bookMoveString.substring(2, 4);
        // Very basic check: does the piece exist on the from square and belong to AI?
        const fromCoords = getCoordsFromId(fromSq);
        if (fromCoords && boardState[fromCoords.row][fromCoords.col] && getPieceColor(boardState[fromCoords.row][fromCoords.col]) === currentPlayer) {
             // We still need to check if 'toSq' is a *legal* destination
             const legalMovesForPiece = calculatePossibleMoves({ id: fromSq });
             if (legalMovesForPiece.includes(toSq)) {
                  openingMove = { from: fromSq, to: toSq };
                  console.log(`AI found opening book move: ${historyKey} -> ${bookMoveString}`);
             } else {
                 console.warn(`Opening book move ${fromSq}->${toSq} is illegal! Ignoring book.`);
             }
        } else {
             console.warn(`Opening book piece mismatch for ${fromSq}! Ignoring book.`);
        }
    }

    let chosenMove = null;
    if (openingMove) {
        chosenMove = openingMove;
    } else {
         // --- 2. Calculate Move based on Difficulty (if not in book) --- 
         console.log("AI move not in opening book, calculating...");
        if (aiDifficultyLevel === 'survivor') {
            const allMyPieces = []; for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) { const pc = boardState[r][c]; if (pc && getPieceColor(pc) === currentPlayer) allMyPieces.push({ id: getIdFromCoords(r, c), piece: pc }); } }
            let allPossibleMoves = [];
            for (const pieceInfo of allMyPieces) { const moves = calculatePossibleMoves({ id: pieceInfo.id }); moves.forEach(toSquareId => allPossibleMoves.push({ from: pieceInfo.id, to: toSquareId }));}
            if (allPossibleMoves.length > 0) chosenMove = allPossibleMoves[Math.floor(Math.random() * allPossibleMoves.length)];
            console.log("AI [Survivor] chose random move:", chosenMove);
        } else if (aiDifficultyLevel === 'veteran') {
            let bestCaptureValue = -Infinity; let bestCaptureMove = null; let otherMoves = []; const allMyPieces = []; for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) { const pc = boardState[r][c]; if (pc && getPieceColor(pc) === currentPlayer) allMyPieces.push({ id: getIdFromCoords(r, c), piece: pc }); } } for (const pieceInfo of allMyPieces) { const moves = calculatePossibleMoves({ id: pieceInfo.id }); moves.forEach(toSquareId => { const targetCoords = getCoordsFromId(toSquareId); const capturedPieceCode = boardState[targetCoords.row][targetCoords.col]; const currentMove = { from: pieceInfo.id, to: toSquareId }; if (capturedPieceCode) { const capturedValue = pieceValues[capturedPieceCode.toUpperCase()] || 0; if (capturedValue > bestCaptureValue) { bestCaptureValue = capturedValue; bestCaptureMove = currentMove; } } else { otherMoves.push(currentMove); } }); } if (bestCaptureMove) { chosenMove = bestCaptureMove; console.log(`AI [Veteran] chose best capture (value ${bestCaptureValue}):`, chosenMove); } else if (otherMoves.length > 0) { chosenMove = otherMoves[Math.floor(Math.random() * otherMoves.length)]; console.log("AI [Veteran] chose random non-capture move:", chosenMove); }
        } else if (aiDifficultyLevel === 'nightmare') {
            chosenMove = findBestMoveAlphaBeta(1); 
            console.log("AI [Nightmare] chose move via Alpha-Beta(1):", chosenMove);
        } else if (aiDifficultyLevel === 'doomsday') {
            // Attempting Depth 3 again with make/undo logic
            chosenMove = findBestMoveAlphaBeta(3); 
            console.log("AI [Doomsday] chose move via Alpha-Beta(3):", chosenMove);
        }

        // Fallback if calculation failed
        if (!chosenMove) {
             console.warn("AI calculation failed, falling back to random.");
             const allMyPieces = []; for (let r = 0; r < 8; r++) { for (let c = 0; c < 8; c++) { const pc = boardState[r][c]; if (pc && getPieceColor(pc) === currentPlayer) allMyPieces.push({ id: getIdFromCoords(r, c), piece: pc }); } }
             let allPossibleMoves = []; for (const pieceInfo of allMyPieces) { const moves = calculatePossibleMoves({ id: pieceInfo.id }); moves.forEach(toSquareId => allPossibleMoves.push({ from: pieceInfo.id, to: toSquareId }));}
             if (allPossibleMoves.length > 0) chosenMove = allPossibleMoves[Math.floor(Math.random() * allPossibleMoves.length)];
        }
    }

    if (!chosenMove) {
        console.error("AI ERROR: No move chosen or found!");
        return; 
    }
    console.log(`AI executing final chosen move: ${chosenMove.from} -> ${chosenMove.to}`);
    const fromSquare = { id: chosenMove.from };
    const toSquare = { id: chosenMove.to };
    const moveResult = movePiece(fromSquare, toSquare);
    if (moveResult === 'promotion') {
        console.log("AI handling promotion to Queen");
        const promoCoords = promotionCoords;
        const aiColor = currentPlayer;
        const newPieceCode = (aiColor === 'W') ? 'Q' : 'q';
        boardState[promoCoords.row][promoCoords.col] = newPieceCode;
        awaitingPromotion = false;
        promotionCoords = null;
        hidePromotionChoice();
        checkGameStatus();
        if(gameActive) {
            switchPlayer(); 
        }
        // Push promotion move to history (e.g., e7e8Q)
        const fromSquareId = getIdFromCoords(promoCoords.row + (aiColor === 'W' ? 1 : -1), promoCoords.col); // Approx original square
        const toSquareId = getIdFromCoords(promoCoords.row, promoCoords.col);
        moveHistory.push(`${fromSquareId}${toSquareId}${newPieceCode.toUpperCase()}`);
        console.log("Move History Updated (AI Promotion):", moveHistory);
    } else if (moveResult === true) {
        if(gameActive) {
            switchPlayer(); 
        }
    } else {
        console.error("Move failed unexpectedly for AI");
    }
    renderBoard(); 
}

function movePiece(fromSquare, toSquare) {
    const fromCoords = getCoordsFromId(fromSquare.id);
    const toCoords = getCoordsFromId(toSquare.id);
    const pieceCode = boardState[fromCoords.row][fromCoords.col];
    const pieceType = pieceCode.toUpperCase();
    const pieceColor = getPieceColor(pieceCode);
    const capturedPieceCode = boardState[toCoords.row][toCoords.col];
    let enPassantCapturedPiece = null;
    const previousEnPassantTarget = enPassantTargetSquare;
    enPassantTargetSquare = null;

    // --- Update Castling Rights ---
    if (pieceType === 'K') {
        castlingRights[pieceColor].K = false;
        castlingRights[pieceColor].Q = false;
    }
    if (pieceType === 'R') {
        if (pieceColor === 'W') {
            if (fromCoords.row === 7 && fromCoords.col === 0) castlingRights.W.Q = false; // a1
            if (fromCoords.row === 7 && fromCoords.col === 7) castlingRights.W.K = false; // h1
        } else { // Black
            if (fromCoords.row === 0 && fromCoords.col === 0) castlingRights.B.Q = false; // a8
            if (fromCoords.row === 0 && fromCoords.col === 7) castlingRights.B.K = false; // h8
        }
    }
    if(capturedPieceCode) {
         const capturedColor = getPieceColor(capturedPieceCode);
         if (capturedPieceCode.toUpperCase() === 'R') {
              if (toCoords.row === 7 && toCoords.col === 0) castlingRights.W.Q = false; // a1 captured
              if (toCoords.row === 7 && toCoords.col === 7) castlingRights.W.K = false; // h1 captured
              if (toCoords.row === 0 && toCoords.col === 0) castlingRights.B.Q = false; // a8 captured
              if (toCoords.row === 0 && toCoords.col === 7) castlingRights.B.K = false; // h8 captured
         }
    }

    // --- Handle En Passant Capture ---
    if (pieceType === 'P' && toSquare.id === previousEnPassantTarget && !capturedPieceCode) {
        const capturedPawnRow = fromCoords.row;
        const capturedPawnCol = toCoords.col;
        enPassantCapturedPiece = boardState[capturedPawnRow][capturedPawnCol];
        boardState[capturedPawnRow][capturedPawnCol] = '';
    }

    // --- Update Captured Pieces List --- 
    const actualCapturedCode = capturedPieceCode || enPassantCapturedPiece;
    if (actualCapturedCode) {
        if (pieceColor === 'W') {
            capturedByWhite.push(actualCapturedCode);
        } else {
            capturedByBlack.push(actualCapturedCode);
        }
        console.log(`${pieceColor} captured ${actualCapturedCode}`);
        // TODO: Sort captured pieces later if desired
    }

    // Basic move
    boardState[toCoords.row][toCoords.col] = pieceCode;
    boardState[fromCoords.row][fromCoords.col] = '';

    // --- Set New En Passant Target ---
    if (pieceType === 'P' && Math.abs(toCoords.row - fromCoords.row) === 2) {
        const skippedRow = (fromCoords.row + toCoords.row) / 2;
        enPassantTargetSquare = getIdFromCoords(skippedRow, fromCoords.col);
    }

    // --- Check for Pawn Promotion (but don't add to history yet) ---
    const promotionRank = (pieceColor === 'W') ? 0 : 7;
    let isPromotion = false;
    if (pieceType === 'P' && toCoords.row === promotionRank && !awaitingPromotion) {
        isPromotion = true;
        // Don't modify history here, let caller handle it after choice/AI decision
    }

    // --- Handle Castling Move ---
    if (pieceType === 'K' && Math.abs(toCoords.col - fromCoords.col) === 2) {
        const rookFromCol = (toCoords.col > fromCoords.col) ? 7 : 0;
        const rookToCol = (toCoords.col > fromCoords.col) ? toCoords.col - 1 : toCoords.col + 1;
        boardState[fromCoords.row][rookToCol] = boardState[fromCoords.row][rookFromCol];
        boardState[fromCoords.row][rookFromCol] = '';
    }
    
    // --- Update Last Move --- 
    lastMove = { from: fromSquare.id, to: toSquare.id };

    // --- Update Move History (Only if not resulting in immediate promotion choice) ---
    if (!isPromotion) {
        moveHistory.push(`${fromSquare.id}${toSquare.id}`);
        console.log("Move History Updated:", moveHistory);
    }

    // Return flag for promotion
    return isPromotion ? 'promotion' : true;
}

function showPromotionChoice() {
    promotionChoiceEl.classList.remove('hidden');
    // Disable board interaction further?
}

function hidePromotionChoice() {
    promotionChoiceEl.classList.add('hidden');
}

function handlePromotionChoice(event) {
    if (!awaitingPromotion) return;
    const chosenPieceType = event.target.dataset.piece;
    if (!chosenPieceType) return;
    const pieceColor = currentPlayer;
    const newPieceCode = (pieceColor === 'W') ? chosenPieceType.toUpperCase() : chosenPieceType.toLowerCase();
    boardState[promotionCoords.row][promotionCoords.col] = newPieceCode;
    awaitingPromotion = false;
    promotionCoords = null;
    hidePromotionChoice();

    // Add promotion move to history (e.g., e7e8Q)
    const fromSquareId = getIdFromCoords(promotionCoords.row + (pieceColor === 'W' ? 1 : -1), promotionCoords.col); // Approx original square
    const toSquareId = getIdFromCoords(promotionCoords.row, promotionCoords.col);
    moveHistory.push(`${fromSquareId}${toSquareId}${chosenPieceType.toUpperCase()}`);
    console.log("Move History Updated (Promotion):", moveHistory);

    // Move is fully complete, check game status then switch player
    checkGameStatus(); // Check status BEFORE switching player
    if(gameActive) {
         switchPlayer(); // Switch player only if game continues
         renderBoard();
    } else {
         renderBoard(); // Render final board state if game ended
    }
}

// --- Game Status Check ---
function checkGameStatus() {
    const playerToMove = currentPlayer; // The player whose turn it is NOW
    const attackingPlayer = (playerToMove === 'W') ? 'B' : 'W'; // The player who just moved
    const playerKingSquare = findKing(playerToMove);
    let playerHasLegalMoves = false;

    console.log(`CHECK STATUS: Checking status for ${playerToMove} (Attacked by ${attackingPlayer})`);

    // Check if playerToMove has any legal moves
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const pieceCode = boardState[r][c];
            if (pieceCode && getPieceColor(pieceCode) === playerToMove) {
                const squareId = getIdFromCoords(r, c);
                // Pass mock square object { id: squareId }
                const moves = calculatePossibleMoves({ id: squareId }); 
                if (moves.length > 0) {
                    playerHasLegalMoves = true;
                    console.log(`CHECK STATUS: Found legal move for ${playerToMove}: ${squareId} -> ${moves[0]}...`);
                    break; // Found a legal move, no need to check further
                }
            }
        }
        if (playerHasLegalMoves) break;
    }

    if (!playerKingSquare) {
         console.error(`CHECK STATUS: Could not find king for ${playerToMove}! Cannot determine check/mate.`);
         // Maybe end the game abnormally or just return
         return; 
    }
    
    const isInCheck = isSquareAttacked(playerKingSquare, attackingPlayer);

    if (!playerHasLegalMoves) {
        if (isInCheck) {
            // Checkmate! The attacking player wins.
            console.log(`GAME END DETECTED: Checkmate! ${attackingPlayer} wins.`);
            endGame(`Checkmate! ${attackingPlayer === 'W' ? 'White' : 'Black'} wins.`);
        } else {
            // Stalemate! It's a draw.
            console.log("GAME END DETECTED: Stalemate! It's a draw.");
            endGame("Stalemate! It's a draw.");
        }
        gameActive = false; // Ensure game stops immediately on mate/stalemate
    } else if (isInCheck) {
        // Just Check
        console.log(`CHECK DETECTED: ${playerToMove} is in check!`);
        gameStatusEl.textContent = `${playerToMove === 'W' ? 'White' : 'Black'} is in Check!`;
    } else {
        // Game continues
         gameStatusEl.textContent = ""; 
         console.log(`CHECK STATUS: Game continues for ${playerToMove}. No check, mate, or stalemate.`);
    }

     // TODO: Add checks for insufficient material, three-fold repetition etc.
}

// --- Placeholder for move calculation ---
function calculatePossibleMoves(square) {
    const pieceId = square.id;
    const coords = getCoordsFromId(pieceId);
    const pieceCode = boardState[coords.row][coords.col];
    if (!pieceCode) return [];

    const color = getPieceColor(pieceCode);
    const opponentColor = (color === 'W') ? 'B' : 'W';
    let potentialMoves = []; // Store raw moves before filtering

    // --- Generate potential moves based on piece type --- 
    const pieceType = pieceCode.toUpperCase();

    const addMove = (targetRow, targetCol) => {
        if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
            const targetPieceCode = boardState[targetRow][targetCol];
            const targetPieceColor = getPieceColor(targetPieceCode);
            if (targetPieceColor !== color) {
                potentialMoves.push(getIdFromCoords(targetRow, targetCol));
            }
            return targetPieceColor === null;
        }
        return false;
    };

    const addSlidingMoves = (directions) => {
        directions.forEach(([dr, dc]) => {
            let currentRow = coords.row + dr;
            let currentCol = coords.col + dc;
            while (addMove(currentRow, currentCol)) { // Keep sliding if the square was empty
                currentRow += dr;
                currentCol += dc;
            }
        });
    };

    switch (pieceType) {
        case 'P':
             const direction = (color === 'W') ? -1 : 1;
             const startRow = (color === 'W') ? 6 : 1;
             const nextRow = coords.row + direction;

             // Forward move
             if (nextRow >= 0 && nextRow < 8 && !boardState[nextRow][coords.col]) {
                  potentialMoves.push(getIdFromCoords(nextRow, coords.col));
                  // Initial double move
                  if (coords.row === startRow) {
                      const doubleNextRow = coords.row + 2 * direction;
                      if (!boardState[doubleNextRow][coords.col]) {
                           potentialMoves.push(getIdFromCoords(doubleNextRow, coords.col));
                      }
                  }
             }
             // Diagonal capture & En Passant
             [-1, 1].forEach(fileOffset => {
                 const captureCol = coords.col + fileOffset;
                 if (captureCol >= 0 && captureCol < 8) {
                     const targetSquareId = getIdFromCoords(nextRow, captureCol);
                     // Standard Capture
                     const targetPieceCode = boardState[nextRow]?.[captureCol];
                     if (targetPieceCode && getPieceColor(targetPieceCode) !== color) {
                          potentialMoves.push(targetSquareId);
                     }
                     // En Passant Capture
                     if (targetSquareId === enPassantTargetSquare) {
                         potentialMoves.push(targetSquareId);
                     }
                 }
             });
             break;
        case 'R': addSlidingMoves([[-1, 0], [1, 0], [0, -1], [0, 1]]); break;
        case 'N':
             const knightMoves = [
                 [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                 [1, -2], [1, 2], [2, -1], [2, 1]
             ];
             knightMoves.forEach(([dr, dc]) => {
                 const targetRow = coords.row + dr;
                 const targetCol = coords.col + dc;
                 // Knight doesn't check path, only destination
                 if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8) {
                     const targetPieceCode = boardState[targetRow][targetCol];
                     if (getPieceColor(targetPieceCode) !== color) {
                         potentialMoves.push(getIdFromCoords(targetRow, targetCol));
                     }
                 }
             });
             break;
        case 'B': addSlidingMoves([[-1, -1], [-1, 1], [1, -1], [1, 1]]); break;
        case 'Q': addSlidingMoves([[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]); break;
        case 'K':
            const kingMoves = [
                 [-1, -1], [-1, 0], [-1, 1],
                 [0, -1],           [0, 1],
                 [1, -1], [1, 0], [1, 1]
            ];
            kingMoves.forEach(([dr, dc]) => {
                 const targetRow = coords.row + dr;
                 const targetCol = coords.col + dc;
                 addMove(targetRow, targetCol); // Use addMove for basic king moves
            });

            // --- Check Castling --- 
            const kingRow = coords.row;
            const canCastle = castlingRights[color];
            // Check if King is currently in check
            if (!isSquareAttacked(pieceId, opponentColor)) {
                // Kingside (O-O)
                if (canCastle.K) {
                    const square1 = getIdFromCoords(kingRow, coords.col + 1);
                    const square2 = getIdFromCoords(kingRow, coords.col + 2);
                    if (!boardState[kingRow][coords.col + 1] && !boardState[kingRow][coords.col + 2]) {
                         if (!isSquareAttacked(square1, opponentColor) && !isSquareAttacked(square2, opponentColor)) {
                             potentialMoves.push(square2); // Add castling move (king moves 2 squares)
                         }
                    }
                }
                // Queenside (O-O-O)
                if (canCastle.Q) {
                    const square1 = getIdFromCoords(kingRow, coords.col - 1);
                    const square2 = getIdFromCoords(kingRow, coords.col - 2);
                    const square3 = getIdFromCoords(kingRow, coords.col - 3);
                     if (!boardState[kingRow][coords.col - 1] && !boardState[kingRow][coords.col - 2] && !boardState[kingRow][coords.col - 3]) {
                         if (!isSquareAttacked(square1, opponentColor) && !isSquareAttacked(square2, opponentColor)) {
                             potentialMoves.push(square2); // Add castling move
                         }
                     }
                 }
            }
            break;
    }

    // --- Filter out moves that leave the king in check --- 
    // console.log(`FILTER CHECK [${pieceId}]: Checking ${potentialMoves.length} potential moves:`, potentialMoves);
    const legalMoves = potentialMoves.filter((targetSquareId, index) => {
        console.log(`FILTER CB [${pieceId}]: Testing move ${index + 1}/${potentialMoves.length}: ${targetSquareId}`); // Log which move is tested
        
        // --- 1. Save State --- 
        let originalBoardState, originalEnPassant, originalCastlingRights;
        try {
             console.log(`FILTER CB [${pieceId} -> ${targetSquareId}]: Saving state...`);
             originalBoardState = JSON.stringify(boardState);
             originalEnPassant = enPassantTargetSquare;
             originalCastlingRights = JSON.stringify(castlingRights);
             console.log(`FILTER CB [${pieceId} -> ${targetSquareId}]: State saved.`);
        } catch (e) {
            console.error(`FILTER CB [${pieceId} -> ${targetSquareId}]: ERROR saving state!`, e);
            return false; // Treat as illegal if state saving fails
        }

        // --- 2. Simulate Move --- 
        let kingSquareId = null;
        let isKingInCheck = true; // Default to illegal if simulation fails
        try {
            console.log(`FILTER CB [${pieceId} -> ${targetSquareId}]: Simulating move...`);
            const fromCoordsTemp = getCoordsFromId(pieceId);
            const toCoordsTemp = getCoordsFromId(targetSquareId);
            if (!fromCoordsTemp || !toCoordsTemp) throw new Error("Invalid coordinates in filter");
            
            const movingPiece = boardState[fromCoordsTemp.row][fromCoordsTemp.col];
            if (!movingPiece) throw new Error(`No piece found at source ${pieceId}`);
            const pieceType = movingPiece.toUpperCase();
            const color = getPieceColor(movingPiece);
            const opponentColor = (color === 'W') ? 'B' : 'W';

            const capturedPiece = boardState[toCoordsTemp.row][toCoordsTemp.col]; 
            boardState[toCoordsTemp.row][toCoordsTemp.col] = movingPiece;
            boardState[fromCoordsTemp.row][fromCoordsTemp.col] = '';

            // Simulate En Passant capture
            if (pieceType === 'P' && targetSquareId === originalEnPassant && !capturedPiece) {
                const capturedPawnRow = fromCoordsTemp.row;
                const capturedPawnCol = toCoordsTemp.col;
                 console.log(`FILTER CB [${pieceId} -> ${targetSquareId}]: Simulating EP capture at [${capturedPawnRow}, ${capturedPawnCol}]`);
                boardState[capturedPawnRow][capturedPawnCol] = '';
            }
            // Simulate Castling rook move
            if (pieceType === 'K' && Math.abs(toCoordsTemp.col - fromCoordsTemp.col) === 2) {
                const rookFromCol = (toCoordsTemp.col > fromCoordsTemp.col) ? 7 : 0;
                const rookToCol = (toCoordsTemp.col > fromCoordsTemp.col) ? toCoordsTemp.col - 1 : toCoordsTemp.col + 1;
                const rookRow = fromCoordsTemp.row;
                console.log(`FILTER CB [${pieceId} -> ${targetSquareId}]: Simulating castling rook move [${rookRow}, ${rookFromCol}] -> [${rookRow}, ${rookToCol}]`);
                boardState[rookRow][rookToCol] = boardState[rookRow][rookFromCol];
                boardState[rookRow][rookFromCol] = '';
            }
            console.log(`FILTER CB [${pieceId} -> ${targetSquareId}]: Move simulated.`);

            // --- 3. Check King Safety --- 
            console.log(`FILTER CB [${pieceId} -> ${targetSquareId}]: Finding king ${color}...`);
            kingSquareId = findKing(color);
            if (!kingSquareId) {
                 console.error(`FILTER CB [${pieceId} -> ${targetSquareId}]: KING ${color} NOT FOUND after simulating!`);
                 isKingInCheck = true; // Treat as illegal
            } else {
                 console.log(`FILTER CB [${pieceId} -> ${targetSquareId}]: King found at ${kingSquareId}. Checking if attacked by ${opponentColor}...`);
                 isKingInCheck = isSquareAttacked(kingSquareId, opponentColor);
                 console.log(`FILTER CB [${pieceId} -> ${targetSquareId}]: isSquareAttacked result: ${isKingInCheck}`);
            }

        } catch(e) {
            console.error(`FILTER CB [${pieceId} -> ${targetSquareId}]: ERROR during simulation or check!`, e);
            isKingInCheck = true; // Treat as illegal if error occurs
        }
        
        // --- 4. Restore State --- 
        try {
             console.log(`FILTER CB [${pieceId} -> ${targetSquareId}]: Restoring state...`);
             boardState = JSON.parse(originalBoardState);
             enPassantTargetSquare = originalEnPassant;
             castlingRights = JSON.parse(originalCastlingRights);
             console.log(`FILTER CB [${pieceId} -> ${targetSquareId}]: State restored.`);
        } catch (e) {
             console.error(`FILTER CB [${pieceId} -> ${targetSquareId}]: ERROR restoring state!`, e);
             // This is bad, state might be corrupt now. 
             // We already decided legality based on isKingInCheck, but log the error.
        }

        // --- 5. Return Legality --- 
        const isLegal = !isKingInCheck;
        console.log(`FILTER CB [${pieceId} -> ${targetSquareId}]: Final decision: ${isLegal ? 'LEGAL' : 'ILLEGAL'}`);
        return isLegal;
    });

    // console.log(`FILTER CHECK [${pieceId}]: Found ${legalMoves.length} legal moves:`, legalMoves);
    return legalMoves;
}

// --- Core Chess Logic Helpers ---

function findKing(color) {
    const kingCode = (color === 'W') ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (boardState[r][c] === kingCode) {
                return getIdFromCoords(r, c);
            }
        }
    }
    return null; // Should not happen in a normal game
}

function isSquareAttacked(squareId, attackerColor) {
    const targetCoords = getCoordsFromId(squareId);
    if (!targetCoords) return false;
    const targetRow = targetCoords.row;
    const targetCol = targetCoords.col;
    const defenderColor = (attackerColor === 'W') ? 'B' : 'W';

    // Check for attacks from sliding pieces (Rook, Bishop, Queen)
    const checkLine = (directions) => {
        for (const [dr, dc] of directions) {
            let r = targetRow + dr;
            let c = targetCol + dc;
            while (r >= 0 && r < 8 && c >= 0 && c < 8) {
                const piece = boardState[r][c];
                if (piece) {
                    const pieceColor = getPieceColor(piece);
                    const pieceType = piece.toUpperCase();
                    if (pieceColor === attackerColor) {
                        // Check if the piece type matches the direction
                        const isRookMove = dr === 0 || dc === 0;
                        const isBishopMove = Math.abs(dr) === Math.abs(dc);
                        if ((pieceType === 'R' && isRookMove) ||
                            (pieceType === 'B' && isBishopMove) ||
                            (pieceType === 'Q')) {
                            return true; // Found attacker
                        }
                    }
                    break; // Path blocked by another piece (attacker or defender)
                }
                r += dr;
                c += dc;
            }
        }
        return false;
    };

    if (checkLine([[-1, 0], [1, 0], [0, -1], [0, 1]])) return true; // Rook/Queen lines
    if (checkLine([[-1, -1], [-1, 1], [1, -1], [1, 1]])) return true; // Bishop/Queen lines

    // Check for Knight attacks
    const knightMoves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightMoves) {
        const r = targetRow + dr;
        const c = targetCol + dc;
        if (r >= 0 && r < 8 && c >= 0 && c < 8) {
            const piece = boardState[r][c];
            if (piece && getPieceColor(piece) === attackerColor && piece.toUpperCase() === 'N') {
                return true;
            }
        }
    }

    // Check for Pawn attacks
    const pawnDirection = (attackerColor === 'W') ? 1 : -1; // Direction pawns move *towards* the target square
    const pawnAttackSources = [
        [targetRow + pawnDirection, targetCol - 1],
        [targetRow + pawnDirection, targetCol + 1]
    ];
    for (const [r, c] of pawnAttackSources) {
        if (r >= 0 && r < 8 && c >= 0 && c < 8) {
            const piece = boardState[r][c];
            if (piece && getPieceColor(piece) === attackerColor && piece.toUpperCase() === 'P') {
                return true;
            }
        }
    }

    // Check for King attacks (for castling checks and preventing king moving next to other king)
    const kingMoves = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];
     for (const [dr, dc] of kingMoves) {
        const r = targetRow + dr;
        const c = targetCol + dc;
         if (r >= 0 && r < 8 && c >= 0 && c < 8) {
             const piece = boardState[r][c];
             if (piece && getPieceColor(piece) === attackerColor && piece.toUpperCase() === 'K') {
                 return true;
             }
         }
     }

    return false; // Square is not attacked by the attackerColor
}

// --- AI Logic ---

function evaluateBoard() {
    let score = 0;
    let whiteMaterial = 0;
    let blackMaterial = 0;
    let numQueens = 0;
    let whiteKingPos = null;
    let blackKingPos = null;
    let fileHasWhitePawn = Array(8).fill(false);
    let fileHasBlackPawn = Array(8).fill(false);

    // First pass: Calculate material, find kings, note pawn files
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const pieceCode = boardState[r][c];
            if (pieceCode) {
                const pieceType = pieceCode.toUpperCase();
                const color = getPieceColor(pieceCode);
                const materialValue = pieceValues[pieceType] || 0;
                
                if (color === 'W') {
                    whiteMaterial += materialValue;
                    if (pieceType === 'K') whiteKingPos = { r, c };
                    if (pieceType === 'P') fileHasWhitePawn[c] = true;
                } else {
                    blackMaterial += materialValue;
                    if (pieceType === 'K') blackKingPos = { r, c };
                    if (pieceType === 'P') fileHasBlackPawn[c] = true;
                }
                 if(pieceType === 'Q') numQueens++;
            }
        }
    }
    
    const isEndGame = numQueens === 0 || (whiteMaterial + blackMaterial <= 10);

    // Second pass: Calculate positional scores, rook/king bonuses
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const pieceCode = boardState[r][c];
            if (pieceCode) {
                const pieceType = pieceCode.toUpperCase();
                const color = getPieceColor(pieceCode);
                const materialValue = pieceValues[pieceType] || 0;
                let positionScore = 0;
                let bonusScore = 0;

                // Positional score from tables
                const tableR = (color === 'W') ? r : 7 - r;
                switch (pieceType) {
                    case 'P': positionScore = pawnTable[tableR][c]; break;
                    case 'N': positionScore = knightTable[tableR][c]; break;
                    case 'B': positionScore = bishopTable[tableR][c]; break;
                    case 'K': positionScore = (isEndGame ? kingTableEndGame : kingTableMidGame)[tableR][c]; break;
                    case 'R': 
                        // Rook bonus for open/semi-open files
                        if (!fileHasWhitePawn[c] && !fileHasBlackPawn[c]) {
                             bonusScore += 10; // Open file bonus
                        } else if ((color === 'W' && !fileHasWhitePawn[c]) || (color === 'B' && !fileHasBlackPawn[c])) {
                             bonusScore += 5; // Semi-open file bonus
                        }
                        // Bonus for 7th rank could be added
                        break;
                    // Add Queen table if desired
                }
                
                // Simple King Safety (Midgame only)
                if (pieceType === 'K' && !isEndGame) {
                     const kingC = c;
                     const pawnDir = (color === 'W') ? -1 : 1;
                     let shieldScore = 0;
                     for (let dc = -1; dc <= 1; dc++) {
                          const checkC = kingC + dc;
                          const checkR = r + pawnDir;
                          if(checkC >= 0 && checkC < 8 && checkR >=0 && checkR < 8) {
                               const shieldPiece = boardState[checkR][checkC];
                               if(shieldPiece && getPieceColor(shieldPiece) === color && shieldPiece.toUpperCase() === 'P') {
                                    shieldScore += 5; // Bonus for pawn shield
                               } else {
                                    shieldScore -= 3; // Penalty for missing shield / open file near king
                               }
                          } else {
                                shieldScore -= 5; // Edge of board penalty?
                          }
                     }
                     bonusScore += shieldScore;
                }

                if (color === 'W') {
                    score += (materialValue * 100) + positionScore + bonusScore;
                } else {
                    score -= (materialValue * 100) + positionScore + bonusScore;
                }
            }
        }
    }
    return score; 
}

// --- Simulation with Undo --- 
function makeMoveSimulated(move) {
    const fromCoords = getCoordsFromId(move.from);
    const toCoords = getCoordsFromId(move.to);
    if (!fromCoords || !toCoords) return null; 

    const pieceCode = boardState[fromCoords.row][fromCoords.col];
    if (!pieceCode) {
         console.error(`makeMoveSimulated: No piece at ${move.from}`);
         return null; 
    }

    const pieceType = pieceCode.toUpperCase();
    const pieceColor = getPieceColor(pieceCode);
    const capturedPieceCode = boardState[toCoords.row][toCoords.col];
    const originalEnPassantTarget = enPassantTargetSquare;
    // Use structuredClone for castling rights if available, otherwise fallback
    const originalCastlingRights = typeof structuredClone === 'function' ? structuredClone(castlingRights) : JSON.parse(JSON.stringify(castlingRights));

    let undoInfo = {
        from: move.from,
        to: move.to,
        movedPiece: pieceCode,
        capturedPiece: capturedPieceCode,
        enPassantCapture: false,
        originalEnPassantTarget: originalEnPassantTarget,
        castlingMove: false,
        originalCastlingRights: originalCastlingRights, // Store the cloned object
        previousLastMove: lastMove // Also save lastMove for potential future use (not strictly needed for undo)
    };

    // --- Simulate Move on boardState ---
    boardState[toCoords.row][toCoords.col] = pieceCode;
    boardState[fromCoords.row][fromCoords.col] = '';

    // En Passant Capture
    if (pieceType === 'P' && move.to === originalEnPassantTarget && !capturedPieceCode) {
        const capturedPawnRow = fromCoords.row;
        const capturedPawnCol = toCoords.col;
        undoInfo.capturedPiece = boardState[capturedPawnRow][capturedPawnCol]; // Store the actual pawn captured
        boardState[capturedPawnRow][capturedPawnCol] = '';
        undoInfo.enPassantCapture = true;
        undoInfo.epCapturedPawnCoords = { r: capturedPawnRow, c: capturedPawnCol };
    }

    // Castling Move (Rook part)
    if (pieceType === 'K' && Math.abs(toCoords.col - fromCoords.col) === 2) {
        const rookFromCol = (toCoords.col > fromCoords.col) ? 7 : 0;
        const rookToCol = (toCoords.col > fromCoords.col) ? toCoords.col - 1 : toCoords.col + 1;
        const rookRow = fromCoords.row;
        const rookPiece = boardState[rookRow][rookFromCol];
        boardState[rookRow][rookToCol] = rookPiece;
        boardState[rookRow][rookFromCol] = '';
        undoInfo.castlingMove = true;
        undoInfo.castlingRookFrom = { r: rookRow, c: rookFromCol };
        undoInfo.castlingRookTo = { r: rookRow, c: rookToCol };
        undoInfo.castlingRookPiece = rookPiece;
    }

    // --- Update State Variables (enPassantTargetSquare, castlingRights) --- 
    // Update En Passant Target
    enPassantTargetSquare = null; 
    if (pieceType === 'P' && Math.abs(toCoords.row - fromCoords.row) === 2) {
        const skippedRow = (fromCoords.row + toCoords.row) / 2;
        enPassantTargetSquare = getIdFromCoords(skippedRow, fromCoords.col);
    }

    // Update Castling Rights (Needs to modify the *current* castlingRights object)
    if (pieceType === 'K') {
        if (castlingRights[pieceColor]) { // Check if rights exist for the color
             castlingRights[pieceColor].K = false;
             castlingRights[pieceColor].Q = false;
        }
    }
    if (pieceType === 'R') {
         if (castlingRights[pieceColor]) {
             if (fromCoords.row === 7 && fromCoords.col === 0) castlingRights.W.Q = false; // a1
             if (fromCoords.row === 7 && fromCoords.col === 7) castlingRights.W.K = false; // h1
             if (fromCoords.row === 0 && fromCoords.col === 0) castlingRights.B.Q = false; // a8
             if (fromCoords.row === 0 && fromCoords.col === 7) castlingRights.B.K = false; // h8
         }
    }
     // Handle Rook capture affecting opponent's rights
     if (capturedPieceCode && capturedPieceCode.toUpperCase() === 'R') {
         const capturedColor = getPieceColor(capturedPieceCode);
         const opponentColor = (pieceColor === 'W') ? 'B' : 'W';
         if (capturedColor === opponentColor && castlingRights[opponentColor]) {
             if (toCoords.row === 7 && toCoords.col === 0) castlingRights.W.Q = false; // a1 captured
             if (toCoords.row === 7 && toCoords.col === 7) castlingRights.W.K = false; // h1 captured
             if (toCoords.row === 0 && toCoords.col === 0) castlingRights.B.Q = false; // a8 captured
             if (toCoords.row === 0 && toCoords.col === 7) castlingRights.B.K = false; // h8 captured
         }
     }

    // Note: Promotion is NOT handled in simulation for simplicity
    // lastMove is NOT updated here, only saved in undoInfo

    return undoInfo;
}

function undoMoveSimulated(undoInfo) {
    if (!undoInfo) return;

    const fromCoords = getCoordsFromId(undoInfo.from);
    const toCoords = getCoordsFromId(undoInfo.to);

    // --- Revert Board State --- 
    boardState[fromCoords.row][fromCoords.col] = undoInfo.movedPiece;
    boardState[toCoords.row][toCoords.col] = undoInfo.enPassantCapture ? '' : undoInfo.capturedPiece;
    if (undoInfo.enPassantCapture) {
        boardState[undoInfo.epCapturedPawnCoords.r][undoInfo.epCapturedPawnCoords.c] = undoInfo.capturedPiece;
    }
    if (undoInfo.castlingMove) {
         boardState[undoInfo.castlingRookFrom.r][undoInfo.castlingRookFrom.c] = undoInfo.castlingRookPiece;
         boardState[undoInfo.castlingRookTo.r][undoInfo.castlingRookTo.c] = '';
    }

    // --- Restore State Variables --- 
    enPassantTargetSquare = undoInfo.originalEnPassantTarget;
    // Restore castling rights from the cloned object
    castlingRights = undoInfo.originalCastlingRights; 
    // lastMove = undoInfo.previousLastMove; // Restore if needed elsewhere
}

// --- Update Search Functions to Use Make/Undo --- 

function minimaxAlphaBeta(depth, alpha, beta, isMaximizingPlayer) {
    const playerColor = isMaximizingPlayer ? 'W' : 'B';
    const opponentColor = isMaximizingPlayer ? 'B' : 'W';
    console.log(`AB Enter: Depth=${depth}, Player=${playerColor}, Alpha=${alpha}, Beta=${beta}`);

    // Check transposition table here (if implemented)

    // Base case: depth 0 -> call Quiescence Search
    if (depth === 0) {
        const quiescenceScore = quiescenceSearch(alpha, beta, isMaximizingPlayer);
        // console.log(`AB Base D0 -> Quiescence: Depth=${depth}, Player=${playerColor}, Score=${quiescenceScore}`);
        return quiescenceScore;
    }

    let allMoves = [];
    // Generate all legal moves for the current player
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const pieceCode = boardState[r][c];
            if (pieceCode && getPieceColor(pieceCode) === playerColor) {
                const legalMovesForPiece = calculatePossibleMoves({ id: getIdFromCoords(r, c) });
                legalMovesForPiece.forEach(toSquareId => {
                    allMoves.push({ from: getIdFromCoords(r, c), to: toSquareId });
                });
            }
        }
    }
    // console.log(`AB Moves: Depth=${depth}, Player=${playerColor}, Found ${allMoves.length} moves`);

    // If no legal moves, it's checkmate or stalemate
    if (allMoves.length === 0) {
        const kingSquareId = findKing(playerColor);
        if (!kingSquareId) {
             console.error(`AB Base Mate: King ${playerColor} not found!`);
             return 0;
        }
        if (isSquareAttacked(kingSquareId, opponentColor)) {
             const mateScore = isMaximizingPlayer ? -Infinity : Infinity;
             console.log(`AB Base Mate: CHECKMATE detected for ${playerColor}. Score: ${mateScore}`);
             return mateScore; 
        } else {
             console.log(`AB Base Mate: STALEMATE detected for ${playerColor}. Score: 0`);
             return 0; 
        }
    }
    
    // Order moves for better pruning (MVV-LVA)
    allMoves.sort((a, b) => { const pieceA = boardState[getCoordsFromId(a.from).row][getCoordsFromId(a.from).col]; const pieceB = boardState[getCoordsFromId(b.from).row][getCoordsFromId(b.from).col]; const victimA = boardState[getCoordsFromId(a.to).row][getCoordsFromId(a.to).col]; const victimB = boardState[getCoordsFromId(b.to).row][getCoordsFromId(b.to).col]; const valueAttackerA = pieceA ? (pieceValues[pieceA.toUpperCase()] || 0) : 0; const valueAttackerB = pieceB ? (pieceValues[pieceB.toUpperCase()] || 0) : 0; const valueVictimA = victimA ? (pieceValues[victimA.toUpperCase()] || 0) : 0; const valueVictimB = victimB ? (pieceValues[victimB.toUpperCase()] || 0) : 0; const scoreA = (valueVictimA > 0) ? (10 * valueVictimA - valueAttackerA + 1000) : 0; const scoreB = (valueVictimB > 0) ? (10 * valueVictimB - valueAttackerB + 1000) : 0; return scoreB - scoreA; });

    let bestValue = isMaximizingPlayer ? -Infinity : Infinity;

    for (const move of allMoves) {
        console.log(`AB Loop: Depth=${depth}, Player=${playerColor}, Considering move ${move.from}->${move.to}`);
        
        // Simulate move (state saving/restoring)
        let originalBoardState, originalEnPassant, originalCastlingRights;
        try { originalBoardState = JSON.stringify(boardState); originalEnPassant = enPassantTargetSquare; originalCastlingRights = JSON.stringify(castlingRights); simulateMove(move.from, move.to); } catch (e) { console.error(`AB Loop: ERROR simulating move ${move.from}->${move.to}`, e); continue; }
        
        // Recursive call
        let value;
        try { value = minimaxAlphaBeta(depth - 1, alpha, beta, !isMaximizingPlayer); } catch (e) { console.error(`AB Loop: ERROR during recursive call for ${move.from}->${move.to}`, e); value = isMaximizingPlayer ? -Infinity : Infinity; }
        
        // Restore state
        try { boardState = JSON.parse(originalBoardState); enPassantTargetSquare = originalEnPassant; castlingRights = JSON.parse(originalCastlingRights); } catch (e) { console.error(`AB Loop: CRITICAL ERROR restoring state after ${move.from}->${move.to}. State may be corrupt!`, e); }

        // Alpha-Beta Pruning logic
        if (isMaximizingPlayer) {
            bestValue = Math.max(bestValue, value);
            alpha = Math.max(alpha, bestValue);
            if (beta <= alpha) {
                console.log(`AB Pruning (Max): Depth=${depth}, Beta (${beta}) <= Alpha (${alpha}). Breaking loop.`);
                break; // Beta cut-off
            }
        } else { // Minimizing player
            bestValue = Math.min(bestValue, value);
            beta = Math.min(beta, bestValue);
            if (beta <= alpha) {
                console.log(`AB Pruning (Min): Depth=${depth}, Beta (${beta}) <= Alpha (${alpha}). Breaking loop.`);
                break; // Alpha cut-off
            }
        }
    }
    // Store value in transposition table here (if implemented)
    console.log(`AB Exit: Depth=${depth}, Player=${playerColor}, Returning BestValue=${bestValue}`);
    return bestValue;
}

function quiescenceSearch(alpha, beta, isMaximizingPlayer) {
    const playerColor = isMaximizingPlayer ? 'W' : 'B';
    // console.log(`Quiescence Enter: Player=${playerColor}, Alpha=${alpha}, Beta=${beta}`);

    // Standing pat score (evaluate current position)
    const standPatScore = evaluateBoard();
    // console.log(`Quiescence StandPat: Player=${playerColor}, Score=${standPatScore}`);

    // Update alpha/beta based on standing pat
    if (isMaximizingPlayer) {
        alpha = Math.max(alpha, standPatScore);
    } else {
        beta = Math.min(beta, standPatScore);
    }
    // Check for cutoff based on standing pat score alone
    if (beta <= alpha) {
        // console.log(`Quiescence StandPat Prune: Beta (${beta}) <= Alpha (${alpha})`);
        return standPatScore; // Or maybe return alpha/beta depending on who caused the cutoff?
                              // Returning standPatScore is simpler.
    }

    let captureMoves = [];
    // Generate ONLY capture moves (potentially checks/promotions too later)
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const pieceCode = boardState[r][c];
            if (pieceCode && getPieceColor(pieceCode) === playerColor) {
                const legalMovesForPiece = calculatePossibleMoves({ id: getIdFromCoords(r, c) });
                legalMovesForPiece.forEach(toSquareId => {
                    const targetCoords = getCoordsFromId(toSquareId);
                    if (boardState[targetCoords.row][targetCoords.col]) { // It's a capture
                        captureMoves.push({ from: getIdFromCoords(r, c), to: toSquareId });
                    }
                    // Add checks/promotions here if desired
                });
            }
        }
    }

    // If no captures, return the static evaluation
    if (captureMoves.length === 0) {
        // console.log(`Quiescence Quiet: Player=${playerColor}, No captures found. Returning StandPat=${standPatScore}`);
        return standPatScore;
    }

    // Order capture moves (MVV-LVA)
    captureMoves.sort((a, b) => { const pieceA = boardState[getCoordsFromId(a.from).row][getCoordsFromId(a.from).col]; const pieceB = boardState[getCoordsFromId(b.from).row][getCoordsFromId(b.from).col]; const victimA = boardState[getCoordsFromId(a.to).row][getCoordsFromId(a.to).col]; const victimB = boardState[getCoordsFromId(b.to).row][getCoordsFromId(b.to).col]; const valueAttackerA = pieceA ? (pieceValues[pieceA.toUpperCase()] || 0) : 0; const valueAttackerB = pieceB ? (pieceValues[pieceB.toUpperCase()] || 0) : 0; const valueVictimA = victimA ? (pieceValues[victimA.toUpperCase()] || 0) : 0; const valueVictimB = victimB ? (pieceValues[victimB.toUpperCase()] || 0) : 0; const scoreA = (valueVictimA > 0) ? (10 * valueVictimA - valueAttackerA + 1000) : 0; const scoreB = (valueVictimB > 0) ? (10 * valueVictimB - valueAttackerB + 1000) : 0; return scoreB - scoreA; });
    // console.log(`Quiescence Captures (${playerColor}):`, captureMoves.map(m=>m.from+m.to));

    for (const move of captureMoves) {
        // Simulate move
        let originalBoardState, originalEnPassant, originalCastlingRights;
        try { originalBoardState = JSON.stringify(boardState); originalEnPassant = enPassantTargetSquare; originalCastlingRights = JSON.stringify(castlingRights); simulateMove(move.from, move.to); } catch (e) { console.error(`Quiescence ERROR simulating capture ${move.from}->${move.to}`, e); continue; }

        // Recursive call (pass negated alpha/beta)
        let score = quiescenceSearch(alpha, beta, !isMaximizingPlayer);

        // Restore state
        try { boardState = JSON.parse(originalBoardState); enPassantTargetSquare = originalEnPassant; castlingRights = JSON.parse(originalCastlingRights); } catch (e) { console.error(`Quiescence CRITICAL ERROR restoring state after ${move.from}->${move.to}.`, e); }

        // Update alpha/beta (like regular minimax node)
        if (isMaximizingPlayer) {
            alpha = Math.max(alpha, score);
        } else {
            beta = Math.min(beta, score);
        }
        // Pruning
        if (beta <= alpha) {
             // console.log(`Quiescence Pruning: Player=${playerColor}, Beta (${beta}) <= Alpha (${alpha}). Breaking loop.`);
            break; 
        }
    }

    // Return the appropriate bound
    const returnValue = isMaximizingPlayer ? alpha : beta;
    // console.log(`Quiescence Exit: Player=${playerColor}, Returning ${returnValue}`);
    return returnValue;
}

// Root function to call minimaxAlphaBeta and find the best move
function findBestMoveAlphaBeta(depth) {
     console.log(`ALPHA-BETA: Finding best move with depth ${depth}`);
     let bestValue = Infinity; // Black (AI) wants to minimize the score
     let bestMove = null;
     let allMoves = [];
     const playerColor = 'B'; // AI is Black

     // Generate all legal moves for AI
     for (let r = 0; r < 8; r++) {
         for (let c = 0; c < 8; c++) {
             const pieceCode = boardState[r][c];
             if (pieceCode && getPieceColor(pieceCode) === playerColor) {
                 const moves = calculatePossibleMoves({ id: getIdFromCoords(r, c) });
                 moves.forEach(toSquareId => {
                     allMoves.push({ from: getIdFromCoords(r, c), to: toSquareId });
                 });
             }
         }
     }
     
     if(allMoves.length === 0) return null; // No moves available

     // Shuffle or order moves might help pruning
      allMoves.sort(() => Math.random() - 0.5);
     // Could also sort by heuristic score of resulting position

     let alpha = -Infinity;
     let beta = Infinity;

     for (const move of allMoves) {
        let undoData = null;
        try {
             // Replace simulateMove with makeMoveSimulated
             // simulateMove(move.from, move.to); // Old call
             undoData = makeMoveSimulated(move);
             if (!undoData) throw new Error("MakeMoveSimulated failed at root");
        } catch (e) {
             console.error(`FindBest ERROR making simulated move ${move.from}->${move.to}`, e);
             // Attempt to restore state if possible
             try { if(undoData) undoMoveSimulated(undoData); } catch (re) {console.error("Error during recovery undo:", re);}
             continue;
        }

        // Call minimax for opponent (Maximizing player White)
        let value = minimaxAlphaBeta(depth - 1, alpha, beta, true); 

        try {
            undoMoveSimulated(undoData);
        } catch (e) {
            console.error(`FindBest CRITICAL ERROR undoing move ${move.from}->${move.to}. Skipping move.`, e);
            continue; // Skip considering this move if undo failed
        }

        console.log(`ALPHA-BETA: Move ${move.from}->${move.to} evaluated to score: ${value}`);
        if (value < bestValue) {
            bestValue = value;
            bestMove = move;
            beta = Math.min(beta, bestValue); // Update beta for pruning in subsequent calls if needed
            console.log(`ALPHA-BETA: New best move found: ${bestMove.from}->${bestMove.to} (Score: ${bestValue})`);
        }
        // No alpha update needed at root for minimizing player
    }
    console.log("ALPHA-BETA: Finished search. Best move:", bestMove, "Value:", bestValue);
    return bestMove;
}

function startGame(difficulty) {
     console.log(`Starting game with difficulty: ${difficulty}`);
     aiDifficultyLevel = difficulty;
     difficultySelectionEl.classList.add('hidden');
     gameAreaEl.classList.remove('hidden');
     document.body.style.justifyContent = 'center'; // Re-center body content
     resetGame(); // Initialize the game state and board for the first time
}

// --- Initial Setup & Event Listeners --- 

// Hide game area initially (already done by classList)
// renderBoard(); // Don't render board initially

// Add event listeners for difficulty buttons
difficultySelectionEl.addEventListener('click', (event) => {
    if (event.target.tagName === 'BUTTON' && event.target.dataset.difficulty) {
        startGame(event.target.dataset.difficulty);
    }
});

// Add event listeners for promotion buttons
promotionChoiceEl.addEventListener('click', handlePromotionChoice);

// Add event listener for New Game button
newGameButton.addEventListener('click', () => {
    // Option 1: Go back to difficulty selection (implementing this)
    console.log("New Game button clicked, returning to difficulty selection.");
    gameOverDialogEl.classList.add('hidden');
    gameAreaEl.classList.add('hidden');
    difficultySelectionEl.classList.remove('hidden');
    // Adjust layout back if needed (e.g., if justify-content was changed)
    // document.body.style.justifyContent = 'flex-start'; // Reset if needed
    // Resetting isBoardRendered ensures squares are recreated properly next time
    isBoardRendered = false; 
    // Stop timer definitively in case it was somehow running
    stopTimer();

    // Option 2: Restart with same difficulty (old behavior)
    // resetGame(); 
});

// Add event listener for Resign button
resignButton.addEventListener('click', () => {
    if (gameActive) {
        console.log("Player resigned.");
        endGame("White resigns. Black wins!"); // Call endGame with appropriate message
    }
});

// --- Evaluation Bar Update ---
function updateEvaluationDisplay() {
    const score = evaluateBoard(); // Get score (includes material + position)
    // Convert score to a percentage for the bar width (needs tuning)
    // Let's map a score range (e.g., -500 to +500 centipawns) to 0-100% width
    // Score is already scaled by 100 in evaluateBoard, so range is -50000 to +50000 approx
    // Let's use a simpler approach for now: cap score and scale
    const maxScoreAbs = 1000; // Cap absolute score at ~10 pawns advantage for bar
    const cappedScore = Math.max(-maxScoreAbs, Math.min(maxScoreAbs, score / 100)); // Scale down and cap
    
    // Map capped score [-10, +10] to width [0%, 100%]
    // 0 score = 50% width
    const widthPercent = 50 + (cappedScore / maxScoreAbs) * 50; 
    
    evalBar.style.width = `${Math.max(0, Math.min(100, widthPercent))}%`; // Ensure width is 0-100

    // Display the score (e.g., +1.2 or -0.5)
    const displayScore = (score / 100).toFixed(1);
    evalScoreEl.textContent = (displayScore >= 0 ? '+' : '') + displayScore;
} 