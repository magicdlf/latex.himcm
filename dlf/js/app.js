/**
 * 国际象棋游戏应用程序
 */
document.addEventListener('DOMContentLoaded', () => {
    const chessBoard = document.getElementById('chess-board');
    const playerAP = document.getElementById('player-ap');
    const opponentAP = document.getElementById('opponent-ap');
    const playerAPProgress = document.getElementById('player-ap-progress');
    const opponentAPProgress = document.getElementById('opponent-ap-progress');
    const playerCaptures = document.getElementById('player-captured');
    const opponentCaptures = document.getElementById('opponent-captured');
    const gameStatus = document.getElementById('game-status');
    const historyContainer = document.getElementById('history-container');
    const newGameBtn = document.getElementById('new-game-btn');
    const undoBtn = document.getElementById('undo-btn');
    
    // 游戏状态
    const gameState = {
        board: null,
        selectedPiece: null,
        playerAP: 10,
        opponentAP: 10,
        playerScore: 0,
        opponentScore: 0,
        playerCaptured: 0,
        opponentCaptured: 0,
        gameActive: false,
        moveHistory: [],
        difficulty: 'medium',
        lastMoveTime: {
            white: 0,
            black: 0
        }
    };
    
    // 棋子价值
    const pieceValues = {
        'pawn': 1,
        'knight': 3,
        'bishop': 3,
        'rook': 5,
        'queen': 9,
        'king': 0
    };
    
    // 棋子移动消耗的行动点数
    const moveCosts = {
        'pawn': 1,
        'knight': 2,
        'bishop': 2,
        'rook': 3,
        'queen': 4,
        'king': 2
    };
    
    // 初始化棋盘
    function initializeBoard() {
        const board = document.getElementById('chess-board');
        board.innerHTML = '';
        gameState.board = [];
        
        // 创建8x8棋盘
        for (let row = 0; row < 8; row++) {
            gameState.board[row] = [];
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = 'square';
                square.dataset.row = row;
                square.dataset.col = col;
                
                // 黑白相间
                if ((row + col) % 2 === 0) {
                    square.classList.add('light');
                } else {
                    square.classList.add('dark');
                }
                
                // 添加点击事件
                square.addEventListener('click', () => handleSquareClick(row, col));
                
                board.appendChild(square);
                gameState.board[row][col] = null;
            }
        }
        
        // 放置棋子
        setupPieces();
        updateGameStatus('游戏开始！双方可以随时移动棋子');
    }
    
    // 设置所有棋子的初始位置
    function setupPieces() {
        // 放置兵
        for (let col = 0; col < 8; col++) {
            placePiece('pawn', 'black', 1, col);
            placePiece('pawn', 'white', 6, col);
        }
        
        // 放置车
        placePiece('rook', 'black', 0, 0);
        placePiece('rook', 'black', 0, 7);
        placePiece('rook', 'white', 7, 0);
        placePiece('rook', 'white', 7, 7);
        
        // 放置马
        placePiece('knight', 'black', 0, 1);
        placePiece('knight', 'black', 0, 6);
        placePiece('knight', 'white', 7, 1);
        placePiece('knight', 'white', 7, 6);
        
        // 放置象
        placePiece('bishop', 'black', 0, 2);
        placePiece('bishop', 'black', 0, 5);
        placePiece('bishop', 'white', 7, 2);
        placePiece('bishop', 'white', 7, 5);
        
        // 放置后
        placePiece('queen', 'black', 0, 3);
        placePiece('queen', 'white', 7, 3);
        
        // 放置王
        placePiece('king', 'black', 0, 4);
        placePiece('king', 'white', 7, 4);
    }
    
    // 放置一个棋子
    function placePiece(type, color, row, col) {
        const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
        const piece = document.createElement('div');
        piece.className = `piece ${type} ${color}`;
        
        square.appendChild(piece);
        gameState.board[row][col] = { type, color };
    }
    
    // 处理方格点击
    function handleSquareClick(row, col) {
        if (!gameState.gameActive) return;
        
        const clickedPiece = gameState.board[row][col];
        
        // 如果已选中棋子且点击了不同的方格
        if (gameState.selectedPiece) {
            const { selectedRow, selectedCol } = gameState.selectedPiece;
            
            // 如果点击了另一个自己的棋子，则选择新棋子
            if (clickedPiece && clickedPiece.color === 'white') {
                unselectPiece();
                selectPiece(row, col);
                return;
            }
            
            // 尝试移动棋子
            if (isValidMove(selectedRow, selectedCol, row, col)) {
                const piece = gameState.board[selectedRow][selectedCol];
                const moveCost = moveCosts[piece.type];
                
                // 检查是否有足够的行动点数
                if (gameState.playerAP >= moveCost) {
                    // 检查冷却时间
                    if (isCooldownOver('white')) {
                        movePiece(selectedRow, selectedCol, row, col);
                        gameState.playerAP -= moveCost;
                        gameState.lastMoveTime.white = Date.now();
                        updateStats();
                        unselectPiece();
                        
                        // 检查游戏结束条件
                        checkGameEnd();
                    } else {
                        updateGameStatus(`操作太快！请稍等片刻再移动`);
                    }
                } else {
                    updateGameStatus(`行动点数不足! 需要 ${moveCost} 点，剩余 ${gameState.playerAP.toFixed(1)} 点`);
                    unselectPiece();
                }
            } else {
                unselectPiece();
            }
        } 
        // 如果点击了自己的棋子，则选择
        else if (clickedPiece && clickedPiece.color === 'white') {
            selectPiece(row, col);
        }
    }
    
    // 检查是否已经过了行动冷却时间
    function isCooldownOver(color) {
        const now = Date.now();
        const cooldownTime = 500; // 0.5秒冷却时间
        return (now - gameState.lastMoveTime[color]) >= cooldownTime;
    }
    
    // 选择棋子
    function selectPiece(row, col) {
        const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
        square.classList.add('selected');
        gameState.selectedPiece = { selectedRow: row, selectedCol: col };
        
        // 显示可行移动
        highlightValidMoves(row, col);
    }
    
    // 取消选择棋子
    function unselectPiece() {
        document.querySelectorAll('.square').forEach(square => {
            square.classList.remove('selected');
            square.classList.remove('valid-move');
        });
        gameState.selectedPiece = null;
    }
    
    // 高亮显示可行移动
    function highlightValidMoves(row, col) {
        const piece = gameState.board[row][col];
        if (!piece) return;
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (isValidMove(row, col, r, c)) {
                    const targetSquare = document.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
                    targetSquare.classList.add('valid-move');
                }
            }
        }
    }
    
    // 检查移动是否有效（简化版本）
    function isValidMove(fromRow, fromCol, toRow, toCol) {
        const piece = gameState.board[fromRow][fromCol];
        const target = gameState.board[toRow][toCol];
        
        // 不能移动到自己的棋子上
        if (target && target.color === piece.color) return false;
        
        // 简化的走法检查（实际游戏中需要更复杂的逻辑）
        switch (piece.type) {
            case 'pawn':
                // 白方兵向上移动
                if (piece.color === 'white') {
                    // 直走
                    if (fromCol === toCol && !target) {
                        // 第一步可以走两格
                        if (fromRow === 6 && toRow === 4 && !gameState.board[5][toCol]) return true;
                        // 正常走一格
                        return toRow === fromRow - 1;
                    } 
                    // 吃子
                    else if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow - 1 && target) {
                        return true;
                    }
                } 
                // 黑方兵向下移动
                else {
                    // 直走
                    if (fromCol === toCol && !target) {
                        // 第一步可以走两格
                        if (fromRow === 1 && toRow === 3 && !gameState.board[2][toCol]) return true;
                        // 正常走一格
                        return toRow === fromRow + 1;
                    } 
                    // 吃子
                    else if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow + 1 && target) {
                        return true;
                    }
                }
                return false;
                
            case 'rook':
                // 车只能直走
                if (fromRow !== toRow && fromCol !== toCol) return false;
                // 检查路径上是否有其他棋子
                return !hasObstaclesBetween(fromRow, fromCol, toRow, toCol);
                
            case 'knight':
                // 马走"日"字
                return (Math.abs(fromRow - toRow) === 2 && Math.abs(fromCol - toCol) === 1) ||
                       (Math.abs(fromRow - toRow) === 1 && Math.abs(fromCol - toCol) === 2);
                
            case 'bishop':
                // 象只能走对角线
                if (Math.abs(fromRow - toRow) !== Math.abs(fromCol - toCol)) return false;
                // 检查路径上是否有其他棋子
                return !hasObstaclesBetween(fromRow, fromCol, toRow, toCol);
                
            case 'queen':
                // 后可以走直线或对角线
                if (fromRow !== toRow && fromCol !== toCol && 
                    Math.abs(fromRow - toRow) !== Math.abs(fromCol - toCol)) return false;
                // 检查路径上是否有其他棋子
                return !hasObstaclesBetween(fromRow, fromCol, toRow, toCol);
                
            case 'king':
                // 王只能走一格
                return Math.abs(fromRow - toRow) <= 1 && Math.abs(fromCol - toCol) <= 1;
        }
        
        return false;
    }
    
    // 检查两点之间是否有障碍物
    function hasObstaclesBetween(fromRow, fromCol, toRow, toCol) {
        const rowStep = fromRow === toRow ? 0 : (toRow > fromRow ? 1 : -1);
        const colStep = fromCol === toCol ? 0 : (toCol > fromCol ? 1 : -1);
        
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        
        while (currentRow !== toRow || currentCol !== toCol) {
            if (gameState.board[currentRow][currentCol]) {
                return true;
            }
            currentRow += rowStep;
            currentCol += colStep;
        }
        
        return false;
    }
    
    // 移动棋子
    function movePiece(fromRow, fromCol, toRow, toCol) {
        const piece = gameState.board[fromRow][fromCol];
        const target = gameState.board[toRow][toCol];
        
        // 记录移动历史
        const moveRecord = {
            piece: piece.type,
            color: piece.color,
            from: `${String.fromCharCode(97 + fromCol)}${8 - fromRow}`,
            to: `${String.fromCharCode(97 + toCol)}${8 - toRow}`,
            captured: target ? target.type : null
        };
        gameState.moveHistory.push(moveRecord);
        updateMoveHistory();
        
        // 如果吃子，更新分数和吃子数
        if (target) {
            if (piece.color === 'white') {
                gameState.playerScore += pieceValues[target.type];
                gameState.playerCaptured += 1;
            } else {
                gameState.opponentScore += pieceValues[target.type];
                gameState.opponentCaptured += 1;
            }
        }
        
        // 更新棋盘状态
        gameState.board[toRow][toCol] = piece;
        gameState.board[fromRow][fromCol] = null;
        
        // 更新DOM
        const fromSquare = document.querySelector(`.square[data-row="${fromRow}"][data-col="${fromCol}"]`);
        const toSquare = document.querySelector(`.square[data-row="${toRow}"][data-col="${toCol}"]`);
        
        // 清除目标方格上的任何棋子
        toSquare.innerHTML = '';
        
        // 移动棋子元素
        const pieceElement = fromSquare.querySelector('.piece');
        fromSquare.removeChild(pieceElement);
        toSquare.appendChild(pieceElement);
        
        // 更新状态信息
        updateGameStatus(`${piece.color === 'white' ? '白方' : '黑方'}移动了 ${piece.type}，消耗 ${moveCosts[piece.type]} 点`);
    }
    
    // 更新游戏状态显示
    function updateGameStatus(message) {
        document.getElementById('game-status').textContent = message;
    }
    
    // 更新统计信息
    function updateStats() {
        playerAP.textContent = gameState.playerAP.toFixed(1);
        opponentAP.textContent = gameState.opponentAP.toFixed(1);
        
        // 更新进度条
        const playerPercentage = (gameState.playerAP / 10) * 100;
        const opponentPercentage = (gameState.opponentAP / 10) * 100;
        
        playerAPProgress.style.width = `${Math.min(100, playerPercentage)}%`;
        opponentAPProgress.style.width = `${Math.min(100, opponentPercentage)}%`;
        
        document.getElementById('player-score').textContent = gameState.playerScore;
        document.getElementById('opponent-score').textContent = gameState.opponentScore;
        document.getElementById('player-captured').textContent = gameState.playerCaptured || 0;
        document.getElementById('opponent-captured').textContent = gameState.opponentCaptured || 0;
    }
    
    // 更新移动历史
    function updateMoveHistory() {
        historyContainer.innerHTML = '';
        
        gameState.moveHistory.forEach((move, index) => {
            const moveElement = document.createElement('div');
            moveElement.className = 'move';
            
            const captureText = move.captured ? ` x ${move.captured}` : '';
            const colorText = move.color === 'white' ? '白' : '黑';
            moveElement.textContent = `${index + 1}. ${colorText}${move.piece} ${move.from}${captureText} ${move.to}`;
            
            historyContainer.appendChild(moveElement);
        });
        
        // 滚动到底部
        historyContainer.scrollTop = historyContainer.scrollHeight;
    }
    
    // AI行动函数
    async function aiAction() {
        if (!gameState.gameActive) return;
        
        // 获取所有可能的移动
        const possibleMoves = getAllPossibleMoves('black');
        
        if (possibleMoves.length === 0) return;
        
        // 检查AI行动点数和冷却时间
        if (gameState.opponentAP < 1 || !isCooldownOver('black')) return;
        
        // 根据难度选择移动
        let selectedMove;
        if (gameState.difficulty === 'easy') {
            // 简单模式：随机移动
            selectedMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        } else if (gameState.difficulty === 'medium') {
            // 中等模式：优先吃子，否则随机
            const captureMoves = possibleMoves.filter(move => move.target);
            selectedMove = captureMoves.length > 0 
                ? captureMoves[Math.floor(Math.random() * captureMoves.length)]
                : possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        } else {
            // 困难模式：优先吃高价值棋子，考虑自身安全
            possibleMoves.sort((a, b) => {
                const aValue = a.target ? pieceValues[a.target.type] : 0;
                const bValue = b.target ? pieceValues[b.target.type] : 0;
                return bValue - aValue;
            });
            selectedMove = possibleMoves[0];
        }
        
        // 执行选中的移动
        const { fromRow, fromCol, toRow, toCol, piece, target } = selectedMove;
        
        // 检查行动点数是否足够
        const moveCost = moveCosts[piece.type];
        if (gameState.opponentAP < moveCost) return;
        
        // 执行AI移动
        movePiece(fromRow, fromCol, toRow, toCol);
        gameState.opponentAP -= moveCost;
        gameState.lastMoveTime.black = Date.now();
        updateStats();
        
        // 检查游戏结束条件
        checkGameEnd();
    }
    
    // 获取所有可能的移动
    function getAllPossibleMoves(color) {
        const moves = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece.color === color) {
                    for (let r = 0; r < 8; r++) {
                        for (let c = 0; c < 8; c++) {
                            if (isValidMove(row, col, r, c)) {
                                moves.push({
                                    fromRow: row,
                                    fromCol: col,
                                    toRow: r,
                                    toCol: c,
                                    piece: piece,
                                    target: gameState.board[r][c]
                                });
                            }
                        }
                    }
                }
            }
        }
        
        return moves;
    }
    
    // 检查游戏是否结束
    function checkGameEnd() {
        // 检查是否有王被吃掉
        let whiteKingExists = false;
        let blackKingExists = false;
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = gameState.board[row][col];
                if (piece && piece.type === 'king') {
                    if (piece.color === 'white') whiteKingExists = true;
                    if (piece.color === 'black') blackKingExists = true;
                }
            }
        }
        
        if (!whiteKingExists) {
            endGame('黑方胜利！白王被吃。');
            return true;
        }
        
        if (!blackKingExists) {
            endGame('白方胜利！黑王被吃。');
            return true;
        }
        
        return false;
    }
    
    // 结束游戏
    function endGame(message) {
        gameState.gameActive = false;
        updateGameStatus(message);
    }
    
    // 开始新游戏
    function startNewGame() {
        gameState.playerAP = 10;
        gameState.opponentAP = 10;
        gameState.playerScore = 0;
        gameState.opponentScore = 0;
        gameState.playerCaptured = 0;
        gameState.opponentCaptured = 0;
        gameState.gameActive = true;
        gameState.moveHistory = [];
        gameState.lastMoveTime = {
            white: 0,
            black: 0
        };
        
        initializeBoard();
        updateStats();
        updateMoveHistory();
        updateGameStatus('游戏开始！双方可以随时移动棋子');
    }
    
    // 撤销最后一步移动
    function undoLastMove() {
        // 只有在有历史记录的情况下才能撤销
        if (gameState.moveHistory.length === 0) return;
        
        // 获取最后一次移动
        const lastMove = gameState.moveHistory.pop();
        updateMoveHistory();
        
        // TODO: 实现撤销逻辑（较为复杂，需要保存完整状态）
        updateGameStatus('撤销功能尚未完全实现');
    }
    
    // 设置事件监听器
    function setupEventListeners() {
        newGameBtn.addEventListener('click', startNewGame);
        undoBtn.addEventListener('click', undoLastMove);
        
        document.getElementById('difficulty').addEventListener('change', (e) => {
            gameState.difficulty = e.target.value;
        });
    }
    
    // 初始化游戏
    setupEventListeners();
    startNewGame();
    
    // 启动行动点数恢复和AI行动的计时器
    setInterval(() => {
        if (!gameState.gameActive) return;
        
        // 行动点数恢复：每0.1秒恢复0.1点，最多10点
        if (gameState.playerAP < 10) {
            gameState.playerAP = Math.min(10, gameState.playerAP + 0.1);
        }
        if (gameState.opponentAP < 10) {
            gameState.opponentAP = Math.min(10, gameState.opponentAP + 0.1);
        }
        updateStats();
        
        // AI尝试行动
        aiAction();
    }, 100);
}); 