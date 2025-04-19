/**
 * Chess App UI Interaction
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the chess game
    const chess = new Chess();
    let selectedSquare = null;
    let promotionCallback = null;
    let gameStarted = false;
    let timers = {
        white: 600, // 10 minutes in seconds
        black: 600,
        interval: null,
        active: null
    };
    
    // 鎻愮ず鐩稿叧鍙橀噺
    let lastMoveTime = null;
    let hintTimeout = null;
    const HINT_DELAY = 15000; // 15绉掑悗鏄剧ず鎻愮ず
    
    // 鍙兘鐨勬彁绀轰俊鎭?
    const possibleHints = [
        "璁板緱灏嗗啗锛圕heck锛夋槸鐩存帴鏀诲嚮瀵规柟鐨勭帇锛屽繀椤荤珛鍗宠В闄ゃ€?,
        "椹紙Knight锛夋槸鍞竴鑳借烦杩囧叾浠栨瀛愮殑妫嬪瓙銆?,
        "璞★紙Bishop锛夊彧鑳藉湪瀵硅绾夸笂绉诲姩锛屾墍浠ュ畠浠案杩滀笉浼氭敼鍙樻柟鏍奸鑹层€?,
        "杞︼紙Rook锛夊湪鍨傜洿鍜屾按骞虫柟鍚戠Щ鍔紝闈炲父閫傚悎鍦ㄥ紑闃旂殑鍖哄煙鎿嶄綔銆?,
        "鍚庯紙Queen锛夌粨鍚堜簡杞﹀拰璞＄殑绉诲姩鑳藉姏锛屾槸鏈€寮哄ぇ鐨勬瀛愩€?,
        "鐜嬶紙King锛夋瘡娆″彧鑳界Щ鍔ㄤ竴鏍硷紝浣嗘柟鍚戜笉闄愩€?,
        "鍏碉紙Pawn锛夊彧鑳藉悜鍓嶇Щ鍔紝浣嗗彲浠ユ枩鍚戝悆瀛愩€?,
        "璁板緱鐜嬭溅鏄撲綅鍙互鍚屾椂淇濇姢浣犵殑鐜嬪苟婵€娲讳綘鐨勮溅銆?,
        "鎺у埗妫嬬洏涓績瀵硅幏鑳滆嚦鍏抽噸瑕併€?,
        "鍙戝睍浣犵殑杞诲瓙锛堥┈鍜岃薄锛夋瘮閲嶅瓙锛堝悗鍜岃溅锛夋洿鏃┿€?,
        "鍦ㄦ父鎴忕殑寮€灞€闃舵锛岄伩鍏嶈繃鏃╁嚭鍔ㄤ綘鐨勫悗銆?,
        "灏介噺涓嶈鍦ㄦ病鏈夋敮鎻寸殑鎯呭喌涓嬭繘鏀汇€?,
        "娉ㄦ剰"鍚冭繃璺叺"瑙勫垯锛氬綋瀵规墜鐨勫叺绗竴娆＄Щ鍔ㄤ袱鏍肩粡杩囦綘鐨勫叺鎺у埗鐨勬牸瀛愭椂銆?,
        "褰撳叺鍒拌揪瀵规柟搴曠嚎鏃讹紝鍙互鍗囧彉涓轰换浣曢珮绾ф瀛愶紙閫氬父鏄悗锛夈€?
        "尽量不要在没有支援的情况下进攻。",
        "注意"吃过路兵"规则：当对手的兵第一次移动两格经过你的兵控制的格子时。",
        "当兵到达对方底线时，可以升变为任何高级棋子（通常是后）。"
    ];

    // Get DOM elements
    const chessboard = document.getElementById('chessboard');
    const movesContainer = document.getElementById('moves-container');
    const whiteTimer = document.querySelector('.white-timer');
    const blackTimer = document.querySelector('.black-timer');
    const newGameBtn = document.getElementById('new-game-btn');
    const undoBtn = document.getElementById('undo-btn');
    const promotionDialog = document.getElementById('promotion-dialog');
    const whiteCaptured = document.querySelector('.white-captured');
    const blackCaptured = document.querySelector('.black-captured');
    
    // 瑙勫垯鍜屾彁绀哄厓绱?
    const toggleRulesBtn = document.getElementById('rules-icon');
    const rulesDialog = document.getElementById('rules-dialog');
    const closeRulesBtn = document.getElementById('close-rules-btn');
    const hintContainer = document.getElementById('hint-container');
    const hintText = document.getElementById('hint-text');

    // Initialize the board
    initializeBoard();
    renderBoard();

    // Event listeners
    newGameBtn.addEventListener('click', startNewGame);
    undoBtn.addEventListener('click', undoMove);
    promotionDialog.querySelectorAll('.promotion-piece').forEach(piece => {
        piece.addEventListener('click', handlePromotion);
    });
    
    // 瑙勫垯鎸夐挳浜嬩欢鐩戝惉
    toggleRulesBtn.addEventListener('click', toggleRulesDialog);
    closeRulesBtn.addEventListener('click', toggleRulesDialog);
    
    // 褰撶偣鍑昏鍒欏璇濇鑳屾櫙鏃跺叧闂畠
    rulesDialog.addEventListener('click', (e) => {
        if (e.target === rulesDialog) {
            toggleRulesDialog();
        }
    });

    // Initialize the board with squares and coordinates
    function initializeBoard() {
        // Clear any existing content
        chessboard.innerHTML = '';
        
        // Create 64 squares
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                square.addEventListener('click', () => handleSquareClick(row, col));
                chessboard.appendChild(square);
            }
        }
    }

    // Render the current state of the board
    function renderBoard() {
        // Update each square with its piece
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = chessboard.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                
                // Clear existing piece
                square.innerHTML = '';
                
                // Add piece if there is one
                const piece = chess.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = 'piece';
                    pieceElement.style.backgroundImage = `url('img/${piece.color}_${piece.type}.svg')`;
                    square.appendChild(pieceElement);
                }
                
                // Remove any previous classes
                square.classList.remove('selected', 'valid-move', 'check');
                
                // Highlight the selected square
                if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
                    square.classList.add('selected');
                }
                
                // Highlight valid moves
                if (chess.validMoves && chess.validMoves.some(move => move.row === row && move.col === col)) {
                    square.classList.add('valid-move');
                }
                
                // Highlight king in check
                if (chess.isCheck && 
                    chess.kingPositions[chess.currentPlayer].row === row && 
                    chess.kingPositions[chess.currentPlayer].col === col) {
                    square.classList.add('check');
                }
            }
        }
        
        // Update game status
        updateGameStatus();
    }

    // Handle square click
    function handleSquareClick(row, col) {
        // 鍙栨秷涔嬪墠鐨勬彁绀鸿鏃跺櫒
        clearHintTimeout();
        
        // 闅愯棌鎻愮ず
        hideHint();
        
        const piece = chess.board[row][col];
        
        // If we have a piece selected and clicked on a valid move destination
        if (selectedSquare && chess.validMoves.some(move => move.row === row && move.col === col)) {
            // Check if it's a pawn promotion
            const selectedPiece = chess.board[selectedSquare.row][selectedSquare.col];
            if (selectedPiece.type === 'pawn' && (row === 0 || row === 7)) {
                showPromotionDialog(row, col);
                return;
            }
            
            // Make the move
            makeMove(selectedSquare.row, selectedSquare.col, row, col);
            return;
        }
        
        // Clear selection if clicking on empty square or opponent's piece
        if (!piece || piece.color !== chess.currentPlayer) {
            selectedSquare = null;
            chess.validMoves = [];
            renderBoard();
            return;
        }
        
        // Select the piece and show valid moves
        selectedSquare = { row, col };
        chess.validMoves = chess.getValidMoves(row, col);
        renderBoard();
        
        // 璁剧疆鎻愮ず璁℃椂鍣?
        if (gameStarted) {
            lastMoveTime = Date.now();
            startHintTimeout();
        }
    }
    
    // Make a move
    function makeMove(fromRow, fromCol, toRow, toCol, promotionType = null) {
        // Store the move before making it
        const prevHistory = [...chess.gameHistory];
        const prevColor = chess.currentPlayer;
        
        // Attempt to make the move
        const moveSuccess = chess.makeMove(fromRow, fromCol, toRow, toCol, promotionType);
        
        if (moveSuccess) {
            // Start timers if not already started
            if (!gameStarted) {
                startGame();
            }
            
            // Switch active timer
            timers.active = chess.currentPlayer;
            
            // Clear selection and valid moves
            selectedSquare = null;
            chess.validMoves = [];
            
            // Update move history
            const lastMove = chess.gameHistory[chess.gameHistory.length - 1];
            updateMoveHistory(lastMove, prevColor);
            
            // Update captured pieces
            if (lastMove.capturedPiece || lastMove.isEnPassant) {
                updateCapturedPieces(lastMove, prevColor);
            }
            
            // Re-render the board
            renderBoard();
            
            // 璁剧疆鎻愮ず璁℃椂鍣?
            lastMoveTime = Date.now();
            startHintTimeout();
        }
    }
    
    // Show promotion dialog
    function showPromotionDialog(toRow, toCol) {
        const promotionPieces = promotionDialog.querySelectorAll('.promotion-piece');
        const color = chess.currentPlayer;
        
        // Set the images for promotion pieces
        promotionPieces.forEach(piece => {
            const pieceType = piece.dataset.piece;
            piece.style.backgroundImage = `url('img/${color}_${pieceType}.svg')`;
        });
        
        // Store the callback for when a piece is selected
        promotionCallback = (promotionType) => {
            makeMove(selectedSquare.row, selectedSquare.col, toRow, toCol, promotionType);
        };
        
        // Show the dialog
        promotionDialog.classList.remove('hidden');
    }
    
    // Handle promotion piece selection
    function handlePromotion(event) {
        const pieceType = event.currentTarget.dataset.piece;
        
        // Hide the dialog
        promotionDialog.classList.add('hidden');
        
        // Call the callback with the selected promotion type
        if (promotionCallback) {
            promotionCallback(pieceType);
            promotionCallback = null;
        }
    }
    
    // Update the move history display
    function updateMoveHistory(lastMove, playerColor) {
        const notation = chess.getMoveNotation(lastMove);
        
        if (playerColor === 'white') {
            // White's move
            const moveNumber = Math.floor((chess.gameHistory.length + 1) / 2);
            
            // Create a new row for the move
            const moveNumberElement = document.createElement('div');
            moveNumberElement.className = 'move-number';
            moveNumberElement.textContent = moveNumber + '.';
            
            const whiteMoveElement = document.createElement('div');
            whiteMoveElement.className = 'move white-move';
            whiteMoveElement.textContent = notation;
            
            const blackMoveElement = document.createElement('div');
            blackMoveElement.className = 'move black-move';
            blackMoveElement.textContent = '';
            
            movesContainer.appendChild(moveNumberElement);
            movesContainer.appendChild(whiteMoveElement);
            movesContainer.appendChild(blackMoveElement);
        } else {
            // Black's move - update the last black move cell
            const lastRow = movesContainer.querySelectorAll('.black-move');
            if (lastRow.length > 0) {
                lastRow[lastRow.length - 1].textContent = notation;
            }
        }
        
        // Scroll to bottom
        movesContainer.scrollTop = movesContainer.scrollHeight;
    }
    
    // Update captured pieces display
    function updateCapturedPieces(lastMove, playerColor) {
        let capturedPiece;
        
        if (lastMove.isEnPassant) {
            capturedPiece = lastMove.enPassantCapturedPiece;
        } else {
            capturedPiece = lastMove.capturedPiece;
        }
        
        if (!capturedPiece) return;
        
        const capturedContainer = playerColor === 'white' ? blackCaptured : whiteCaptured;
        
        const pieceElement = document.createElement('div');
        pieceElement.className = 'captured-piece';
        pieceElement.style.backgroundImage = `url('img/${capturedPiece.color}_${capturedPiece.type}.svg')`;
        capturedContainer.appendChild(pieceElement);
    }
    
    // Update game status display
    function updateGameStatus() {
        const status = chess.getGameStatus();
        
        // If game is over, stop the timers
        if (status.includes('Checkmate') || status.includes('Stalemate') || status.includes('Draw')) {
            stopTimers();
            clearHintTimeout();
        }
    }
    
    // Undo the last move
    function undoMove() {
        if (chess.undoLastMove()) {
            // Switch active timer if game is in progress
            if (gameStarted) {
                timers.active = chess.currentPlayer;
            }
            
            // Remove the last move from the history display
            if (chess.currentPlayer === 'black') {
                // Removed white's move, so clear the last white move
                const whiteMoves = movesContainer.querySelectorAll('.white-move');
                if (whiteMoves.length > 0) {
                    whiteMoves[whiteMoves.length - 1].textContent = '';
                }
            } else {
                // Removed black's move, so remove the last row
                const lastMoveNumber = movesContainer.querySelector('.move-number:last-child');
                const lastWhiteMove = movesContainer.querySelector('.white-move:last-child');
                const lastBlackMove = movesContainer.querySelector('.black-move:last-child');
                
                if (lastBlackMove) {
                    movesContainer.removeChild(lastBlackMove);
                }
                if (lastWhiteMove) {
                    movesContainer.removeChild(lastWhiteMove);
                }
                if (lastMoveNumber) {
                    movesContainer.removeChild(lastMoveNumber);
                }
            }
            
            // Clear selection and valid moves
            selectedSquare = null;
            chess.validMoves = [];
            
            // Re-render the board
            renderBoard();
            
            // Also clear captured pieces (simplified implementation - just reset them)
            whiteCaptured.innerHTML = '';
            blackCaptured.innerHTML = '';
            
            // Re-add captured pieces from current game history
            chess.gameHistory.forEach(move => {
                if (move.capturedPiece || move.isEnPassant) {
                    let capturedPiece;
                    if (move.isEnPassant) {
                        capturedPiece = move.enPassantCapturedPiece;
                    } else {
                        capturedPiece = move.capturedPiece;
                    }
                    
                    if (capturedPiece) {
                        const capturedContainer = capturedPiece.color === 'white' ? blackCaptured : whiteCaptured;
                        
                        const pieceElement = document.createElement('div');
                        pieceElement.className = 'captured-piece';
                        pieceElement.style.backgroundImage = `url('img/${capturedPiece.color}_${capturedPiece.type}.svg')`;
                        capturedContainer.appendChild(pieceElement);
                    }
                }
            });
            
            // 閲嶇疆鎻愮ず璁℃椂鍣?
            clearHintTimeout();
            hideHint();
            if (gameStarted) {
                lastMoveTime = Date.now();
                startHintTimeout();
            }
        }
    }
    
    // Start a new game
    function startNewGame() {
        // Reset chess game
        chess.board = chess.createNewBoard();
        chess.currentPlayer = 'white';
        chess.gameHistory = [];
        chess.selectedPiece = null;
        chess.validMoves = [];
        chess.kingPositions = {
            white: { row: 7, col: 4 },
            black: { row: 0, col: 4 }
        };
        chess.castlingRights = {
            white: { kingSide: true, queenSide: true },
            black: { kingSide: true, queenSide: true }
        };
        chess.enPassantTarget = null;
        chess.halfMoveClock = 0;
        chess.fullMoveNumber = 1;
        chess.isCheck = false;
        chess.isCheckmate = false;
        chess.isStalemate = false;
        
        // Reset UI
        selectedSquare = null;
        movesContainer.innerHTML = '';
        whiteCaptured.innerHTML = '';
        blackCaptured.innerHTML = '';
        
        // Reset timers
        stopTimers();
        timers.white = 600;
        timers.black = 600;
        updateTimerDisplay('white');
        updateTimerDisplay('black');
        
        // Reset game started flag
        gameStarted = false;
        
        // Render the new board
        renderBoard();
        
        // 娓呴櫎鎻愮ず
        clearHintTimeout();
        hideHint();
    }
    
    // Start the game timers
    function startGame() {
        gameStarted = true;
        timers.active = 'white';
        
        // Start the timer interval
        if (!timers.interval) {
            timers.interval = setInterval(updateTimers, 1000);
        }
        
        // 璁剧疆鎻愮ず璁℃椂鍣?
        lastMoveTime = Date.now();
        startHintTimeout();
    }
    
    // Update timers every second
    function updateTimers() {
        if (timers.active && !chess.isCheckmate && !chess.isStalemate) {
            timers[timers.active]--;
            
            // Check for time out
            if (timers[timers.active] <= 0) {
                timers[timers.active] = 0;
                stopTimers();
                clearHintTimeout();
                alert(`${timers.active.charAt(0).toUpperCase() + timers.active.slice(1)} has run out of time! ${timers.active === 'white' ? 'Black' : 'White'} wins!`);
            }
            
            updateTimerDisplay(timers.active);
        }
    }
    
    // Update timer display
    function updateTimerDisplay(color) {
        const minutes = Math.floor(timers[color] / 60);
        const seconds = timers[color] % 60;
        const display = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        
        if (color === 'white') {
            whiteTimer.textContent = display;
        } else {
            blackTimer.textContent = display;
        }
    }
    
    // Stop timers
    function stopTimers() {
        if (timers.interval) {
            clearInterval(timers.interval);
            timers.interval = null;
        }
    }
    
    // 鍒囨崲瑙勫垯瀵硅瘽妗嗙殑鏄剧ず鍜岄殣钘?
    function toggleRulesDialog() {
        rulesDialog.classList.toggle('hidden');
    }
    
    // 寮€濮嬫彁绀鸿鏃跺櫒
    function startHintTimeout() {
        // 娓呴櫎涔嬪墠鐨勮鏃跺櫒
        clearHintTimeout();
        
        // 璁剧疆鏂扮殑璁℃椂鍣?
        hintTimeout = setTimeout(() => {
            if (Date.now() - lastMoveTime >= HINT_DELAY) {
                showRandomHint();
            }
        }, HINT_DELAY);
    }
    
    // 娓呴櫎鎻愮ず璁℃椂鍣?
    function clearHintTimeout() {
        if (hintTimeout) {
            clearTimeout(hintTimeout);
            hintTimeout = null;
        }
    }
    
    // 鏄剧ず闅忔満鎻愮ず
    function showRandomHint() {
        // 閫夋嫨闅忔満鎻愮ず
        const randomIndex = Math.floor(Math.random() * possibleHints.length);
        const hint = possibleHints[randomIndex];
        
        // 鏄剧ず鎻愮ず
        hintText.textContent = hint;
        hintContainer.classList.remove('hidden');
    }
    
    // 闅愯棌鎻愮ず
    function hideHint() {
        hintContainer.classList.add('hidden');
    }
    
    // Initial setup
    updateTimerDisplay('white');
    updateTimerDisplay('black');
}); 
