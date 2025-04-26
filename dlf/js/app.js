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
        difficulty: 'normal', // 改为normal作为默认难度
        lastMoveTime: {
            white: 0,
            black: 0
        },
        // --- 新增：存储玩家预定的移动 ---
        pendingPlayerMove: null, // { fromRow, fromCol, toRow, toCol, moveCost, timeoutId }
        // --- 新增：存储当前激活的冷却动画 interval ID ---
        cooldownIntervals: {}, // key: 'row-col', value: intervalId
        aiStrategy: 'simayi',
        aiColor: 'black',
        // --- 新增：AI行动间隔和行动力恢复参数 ---
        aiActionInterval: 300, // 默认AI两次行动间隔(毫秒)
        apRegenMultiplier: 1.0 // 行动力恢复速度倍率
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
    
    // 添加显示预测移动的变量
    var showPredictions = false;
    var counteredMoves = 0;
    
    // --- 新增：清理冷却视觉效果的函数 ---
    function clearCooldownVisual(row, col) {
        const key = `${row}-${col}`;
        if (gameState.cooldownIntervals[key]) {
            clearInterval(gameState.cooldownIntervals[key]);
            delete gameState.cooldownIntervals[key];
            const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
            const pieceElement = square?.querySelector('.piece');
            const overlay = pieceElement?.querySelector('.cooldown-overlay');
            if (overlay) {
                overlay.remove();
            }
        }
    }

    // --- 新增：启动冷却视觉效果的函数 ---
    function startCooldownVisual(pieceElement, duration) {
        const square = pieceElement.closest('.square');
        if (!square) return; // Sanity check
        const row = square.dataset.row;
        const col = square.dataset.col;
        const key = `${row}-${col}`;

        // 清理可能存在的旧计时器
        clearCooldownVisual(row, col);

        // 创建覆盖层
        const overlay = document.createElement('div');
        overlay.className = 'cooldown-overlay';
        // Ensure the piece itself has position:relative for overlay positioning
        if (window.getComputedStyle(pieceElement).position === 'static') {
             pieceElement.style.position = 'relative';
        }
        pieceElement.appendChild(overlay);

        const startTime = Date.now();

        // 使用 setInterval 更新角度
        const intervalId = setInterval(() => {
            const elapsedTime = Date.now() - startTime;
            const progress = Math.min(1, elapsedTime / duration);
            const angle = 360 * progress;

            overlay.style.backgroundImage = `conic-gradient(rgba(255, 255, 255, 0.6) ${angle}deg, transparent ${angle}deg)`;

            if (progress >= 1) {
                clearCooldownVisual(row, col); // 清理自身
            }
        }, 50); // 每 50ms 更新一次，比较平滑

        gameState.cooldownIntervals[key] = intervalId;
    }

    // --- 新增：清理预定移动状态和视觉效果 ---
    function clearPendingPlayerMove() {
        if (gameState.pendingPlayerMove) {
            // 清除延迟执行
            clearTimeout(gameState.pendingPlayerMove.timeoutId);
            // 清除目标高亮
            const { toRow, toCol } = gameState.pendingPlayerMove;
            const targetSquare = document.querySelector(`.square[data-row="${toRow}"][data-col="${toCol}"]`);
            if (targetSquare) {
                targetSquare.classList.remove('pending-move-target');
            }
            gameState.pendingPlayerMove = null;
        }
    }
    
    // 初始化棋盘
    function initializeBoard() {
        const board = document.getElementById('chess-board');
        board.innerHTML = '';
        gameState.board = [];
        // --- 清理所有冷却计时器 ---
        Object.keys(gameState.cooldownIntervals).forEach(key => {
            clearInterval(gameState.cooldownIntervals[key]);
        });
        gameState.cooldownIntervals = {};
        // --- 清理预定移动 ---
        clearPendingPlayerMove();
        
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
        gameState.board[row][col] = { type, color, lastMovedTime: 0 };
    }
    
    // --- 新增：更新所有玩家棋子的AP状态视觉效果 ---
    function updatePieceAPStatus() {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const pieceData = gameState.board[row][col];
                if (pieceData && pieceData.color === 'white') {
                    const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
                    const pieceElement = square?.querySelector('.piece');
                    if (pieceElement) {
                        const cost = moveCosts[pieceData.type];
                        if (gameState.playerAP < cost) {
                            pieceElement.classList.add('insufficient-ap');
                        } else {
                            pieceElement.classList.remove('insufficient-ap');
                        }
                    }
                }
            }
        }
    }

    // 处理方格点击
    function handleSquareClick(row, col) {
        if (!gameState.gameActive) {
            updateGameStatus('请先点击"新游戏"开始');
            return;
        }

        const clickedSquare = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
        const clickedPieceData = gameState.board[row][col];
        const now = Date.now();

        // --- 1. 如果当前有预定的移动，任何点击都取消它 ---
        if (gameState.pendingPlayerMove) {
             updateGameStatus('预定移动已取消。');
             clearPendingPlayerMove();
             // Note: We don't return here, allowing immediate new selection/action
        }

        // --- 2. 处理选择/移动 ---
        if (gameState.selectedPiece) {
            const { selectedRow, selectedCol } = gameState.selectedPiece;
            // --- 获取最新的棋子数据，因为它可能在选择后发生变化（虽然在此逻辑中不太可能） ---
            const movingPieceData = gameState.board[selectedRow][selectedCol];

            // --- 防御性检查 ---
            if (!movingPieceData) {
                console.error("Selected piece data missing from board state:", gameState.selectedPiece);
                unselectPiece(); // Clear invalid selection state
                return;
            }

            // --- 2a. 点击了另一个自己的棋子：切换选择 ---
            if (clickedPieceData && clickedPieceData.color === 'white') {
                unselectPiece(); // This clears any pending move implicitly
                selectPiece(row, col);
                return;
            }

            // --- 2b. 点击了空地或对方棋子：尝试移动 ---
            if (isValidMove(selectedRow, selectedCol, row, col)) {
                const moveCost = moveCosts[movingPieceData.type];

                // Check AP
                if (gameState.playerAP < moveCost) {
                    updateGameStatus(`行动点数不足! 需要 ${moveCost} 点，剩余 ${gameState.playerAP.toFixed(1)} 点`);
                    unselectPiece();
                    return;
                }

                // Check global cooldown (0.5s)
                const globalCooldown = 500;
                const timeSinceLastMove = now - gameState.lastMoveTime.white;
                if (timeSinceLastMove < globalCooldown) {
                    const remainingTime = ((globalCooldown - timeSinceLastMove) / 1000).toFixed(1);
                    updateGameStatus(`全局冷却中！请等待 ${remainingTime} 秒`);
                    // Don't unselect, allow retry after wait
                    return;
                }

                // Check piece cooldown (1s)
                const pieceCooldown = 1000;
                const timeSincePieceMoved = now - (movingPieceData.lastMovedTime || 0); // Default to 0 if undefined
                if (timeSincePieceMoved < pieceCooldown) {
                    // --- Piece is on cooldown -> Schedule move ---
                    const remainingCooldown = pieceCooldown - timeSincePieceMoved;
                    updateGameStatus(`棋子冷却中... 将在 ${(remainingCooldown / 1000).toFixed(1)} 秒后移动至 ${String.fromCharCode(97 + col)}${8 - row}`);

                    // Store pending move info
                    gameState.pendingPlayerMove = {
                        fromRow: selectedRow,
                        fromCol: selectedCol,
                        toRow: row,
                        toCol: col,
                        moveCost: moveCost, // Store the cost
                        timeoutId: setTimeout(() => {
                            // --- Execute after cooldown ---
                            const pendingMove = gameState.pendingPlayerMove; // Use captured closure value

                            // Check if it was cancelled while waiting
                            if (!pendingMove || pendingMove.fromRow !== selectedRow || pendingMove.fromCol !== selectedCol || pendingMove.toRow !== row || pendingMove.toCol !== col) {
                                 console.log("Pending move was cancelled or overwritten.");
                                 // If gameState.pendingPlayerMove is null or different, do nothing.
                                 // If it's different, the new pending move's timeout will handle it.
                                return;
                            }

                            // Re-check AP (might have been spent by AI or regenerated)
                             if (gameState.playerAP < pendingMove.moveCost) {
                                updateGameStatus(`移动取消：行动点数不足 (需要 ${pendingMove.moveCost}, 剩余 ${gameState.playerAP.toFixed(1)})`);
                                clearPendingPlayerMove(); // Clear the failed pending move
                                return;
                            }
                            // Re-check if target square is still valid (using current board state)
                            if (!isValidMove(pendingMove.fromRow, pendingMove.fromCol, pendingMove.toRow, pendingMove.toCol)) {
                                updateGameStatus(`移动取消：目标位置 ${String.fromCharCode(97 + pendingMove.toCol)}${8 - pendingMove.toRow} 不再有效`);
                                clearPendingPlayerMove(); // Clear the failed pending move
                                return;
                            }

                            // All checks passed, execute the move
                            movePiece(pendingMove.fromRow, pendingMove.fromCol, pendingMove.toRow, pendingMove.toCol);
                            gameState.playerAP -= pendingMove.moveCost; // Deduct AP
                            updateStats();
                            checkGameEnd();
                            // Clear the successfully executed pending move AFTER execution
                            clearPendingPlayerMove();

                        }, remainingCooldown)
                    };

                    // Add visual cue to target square
                    clickedSquare.classList.add('pending-move-target');
                    unselectPiece(); // Unselect current piece (selection highlight), but keep pending move state

                } else {
                    // --- Piece not on cooldown -> Move immediately ---
                    movePiece(selectedRow, selectedCol, row, col);
                    gameState.playerAP -= moveCost;
                    updateStats();
                    unselectPiece(); // Unselect after successful move
                    checkGameEnd();
                }

            } else {
                // Invalid move clicked
                 updateGameStatus('无效移动。'); // Give feedback
                unselectPiece(); // Just unselect
            }

        }
        // --- 3. Clicked empty square or opponent piece (when no piece selected) ---
        else if (!clickedPieceData || clickedPieceData.color === 'black') {
            // If a pending move existed, it was cleared in step 1.
            // Clicking here does nothing if nothing is selected.
            unselectPiece(); // Ensure no selection artifacts remain
        }
        // --- 4. Clicked own piece (when no piece selected) ---
        else if (clickedPieceData && clickedPieceData.color === 'white') {
             // If a pending move existed, it was cleared in step 1.
             // --- 新增：检查是否有足够AP选择该棋子 ---
             const pieceElement = clickedSquare.querySelector('.piece');
             if (pieceElement && pieceElement.classList.contains('insufficient-ap')) {
                updateGameStatus(`行动点数不足 (需要 ${moveCosts[clickedPieceData.type]}，剩余 ${gameState.playerAP.toFixed(1)})，无法选择 ${clickedPieceData.type}`);
                return; // 不执行选择
             }
             // --- AP足够，执行选择 ---
            selectPiece(row, col);
        }
    }
    
    // 选择棋子
    function selectPiece(row, col) {
        // --- 先取消之前的选择和高亮 (包括预定移动的高亮) ---
        unselectPiece(); // This now calls clearPendingPlayerMove

        const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
        square.classList.add('selected');
        gameState.selectedPiece = { selectedRow: row, selectedCol: col };
        
        // 显示可行移动
        highlightValidMoves(row, col);
    }
    
    // 取消选择棋子
    function unselectPiece() {
        // --- 清理预定移动 ---
        clearPendingPlayerMove();

        document.querySelectorAll('.square').forEach(square => {
            square.classList.remove('selected');
            square.classList.remove('valid-move');
            // 不在这里移除 pending-move-target，由 clearPendingPlayerMove 负责
        });
        gameState.selectedPiece = null;
    }
    
    // 高亮显示可行移动
    function highlightValidMoves(row, col) {
        const pieceData = gameState.board[row][col];
        if (!pieceData) return;
        const pieceType = pieceData.type;
        const moveCost = moveCosts[pieceType];

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                // --- 修改：同时检查移动有效性和AP ---
                if (isValidMove(row, col, r, c) && gameState.playerAP >= moveCost) {
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
        if (!piece) {
             console.error(`Attempted to move non-existent piece from ${fromRow},${fromCol}`);
             return; // 防御性编程
        }
        const target = gameState.board[toRow][toCol];
        const moveCost = moveCosts[piece.type]; // 注意: 如果升变，成本按升变前计算
        const now = Date.now();
        let promotionOccurred = false;

        // --- 清理起点可能存在的旧冷却动画 ---
        clearCooldownVisual(fromRow, fromCol);

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
        undoBtn.disabled = false;
        
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
        gameState.board[toRow][toCol] = piece; // 移动数据
        gameState.board[fromRow][fromCol] = null;
        
        // 更新DOM
        const fromSquare = document.querySelector(`.square[data-row="${fromRow}"][data-col="${fromCol}"]`);
        const toSquare = document.querySelector(`.square[data-row="${toRow}"][data-col="${toCol}"]`);
        const pieceElement = fromSquare.querySelector('.piece');

        if (!pieceElement) {
             console.error(`Could not find piece element at ${fromRow},${fromCol}`);
             return; // 防御性编程
        }

        // 清除目标方格内容并移动棋子元素
        toSquare.innerHTML = '';
        toSquare.appendChild(pieceElement);
        fromSquare.innerHTML = ''; // 确保旧格子清空
        
        // --- 检查并处理兵升变 ---
        if (piece.type === 'pawn') {
            if ((piece.color === 'white' && toRow === 0) || (piece.color === 'black' && toRow === 7)) {
                piece.type = 'queen'; // 改变数据
                pieceElement.classList.remove('pawn'); // 更新外观
                pieceElement.classList.add('queen');
                promotionOccurred = true;
            }
        }

        // --- 更新移动时间和全局冷却时间 ---
        piece.lastMovedTime = now;
        gameState.lastMoveTime[piece.color] = now;

        // --- 启动冷却视觉效果 ---
        startCooldownVisual(pieceElement, 1000); // 持续 1 秒

        // 更新状态信息
        const playerText = piece.color === 'white' ? '白方' : '黑方';
        let statusMessage = `${playerText}移动了 ${promotionOccurred ? '兵升变为后' : piece.type}，消耗 ${moveCost} 点`;
        if (target) {
            statusMessage += `，吃掉对方 ${target.type}`;
        }
        updateGameStatus(statusMessage);
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

        // --- 新增：更新棋子AP状态 ---
        updatePieceAPStatus();
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
    
    // --- 新增 AI 思考状态锁 ---
    let isAiThinking = false;

    // AI行动函数
    async function aiAction() {
        if (isAiThinking) return;
        if (!gameState.gameActive) return;

        const now = Date.now();
        const globalCooldown = 500; // 基础全局冷却 0.5 秒
        
        // --- 检查 AI 全局冷却：使用配置的行动间隔 ---
        // 取基础全局冷却和配置的行动间隔中的较大值
        const actualCooldown = Math.max(globalCooldown, gameState.aiActionInterval);
        if (now - gameState.lastMoveTime.black < actualCooldown) {
            return;
        }

        // --- 检查 AI 行动点数 (基础点数检查) ---
        // 至少需要1点才能移动最便宜的兵
        if (gameState.opponentAP < 1) return;

        isAiThinking = true;
        try {
            // 根据难度选择 AI 策略 (会过滤掉冷却中的棋子)
            let bestMove;
            if (gameState.aiStrategy === 'simayi') {
                bestMove = findSimaYiMove('black');
            } else {
                bestMove = findWeiYanMove('black');
            }

            if (bestMove) {
                const piece = gameState.board[bestMove.fromRow][bestMove.fromCol];
                // --- 防御性检查 ---
                if (!piece || piece.color !== 'black') {
                    console.error("AI Logic Error: Selected non-existent or wrong color piece:", bestMove, piece);
                    updateGameStatus('AI 内部逻辑错误，请稍候...');
                    return;
                }

                const moveCost = moveCosts[piece.type];

                // --- 检查 AP 是否足够执行选定的移动 ---
                if (gameState.opponentAP >= moveCost) {
                    // --- 根据难度级别处理棋子冷却 ---
                    const pieceCooldown = 1000; // 基础棋子冷却时间 1 秒
                    
                    // 地狱难度下，无视或减少棋子冷却
                    let reducedPieceCooldown = pieceCooldown;
                    if (gameState.difficulty === 'hell') {
                        reducedPieceCooldown = 300; // 地狱难度棋子只需冷却0.3秒
                    } else if (gameState.difficulty === 'hard') {
                        reducedPieceCooldown = 600; // 困难难度棋子冷却0.6秒
                    }
                    
                    if (now - piece.lastMovedTime < reducedPieceCooldown) {
                        // 棋子还在冷却中
                        return;
                    }

                    // --- 执行移动 ---
                    movePiece(bestMove.fromRow, bestMove.fromCol, bestMove.toRow, bestMove.toCol);
                    gameState.opponentAP -= moveCost;
                    updateStats();
                    checkGameEnd();
                }
            } else {
                checkGameEnd(); // 即使无棋可走也要检查结束条件
            }
        } catch (error) {
            console.error("Error during AI action:", error);
            updateGameStatus('AI 发生错误，尝试恢复...');
        } finally {
            isAiThinking = false;
        }
    }
    
    // 获取所有可能的移动
    function getAllPossibleMoves(color) {
        const moves = [];
        const now = Date.now();
        const pieceCooldown = 1000; // 棋子冷却时间 1 秒

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = gameState.board[row][col];
                // --- 增加棋子冷却检查 ---
                if (piece && piece.color === color && (now - piece.lastMovedTime >= pieceCooldown)) {
                    // 查找该棋子的所有可行移动
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
        // 初始化游戏状态
        gameState.gameActive = true;
        gameState.selectedPiece = null;
        gameState.playerAP = 10;
        gameState.opponentAP = 10;
        gameState.playerScore = 0;
        gameState.opponentScore = 0;
        gameState.playerCaptured = 0;
        gameState.opponentCaptured = 0;
        gameState.moveHistory = [];
        gameState.lastMoveTime = {
            white: 0,
            black: 0
        };
        gameState.pendingPlayerMove = null;
        
        // 获取难度设置
        const difficultySelect = document.getElementById('difficulty');
        if (difficultySelect) {
            gameState.difficulty = difficultySelect.value;
            
            // 根据难度设置AI参数
            if (gameState.difficulty === 'easy') {
                // 简单难度 - 行动间隔长，行动力恢复慢
                gameState.aiStrategy = 'simayi';
                gameState.aiActionInterval = 1000; // 1秒行动间隔
                gameState.apRegenMultiplier = 0.5; // 行动力恢复慢一倍
            } 
            else if (gameState.difficulty === 'normal') {
                // 普通难度 - 标准参数
                gameState.aiStrategy = 'simayi';
                gameState.aiActionInterval = 300; // 0.3秒行动间隔
                gameState.apRegenMultiplier = 1.0; // 正常行动力恢复
            }
            else if (gameState.difficulty === 'hard') {
                // 困难难度 - 行动间隔短，行动力恢复快
                gameState.aiStrategy = 'simayi';
                gameState.aiActionInterval = 100; // 0.1秒行动间隔
                gameState.apRegenMultiplier = 1.5; // 行动力恢复快50%
            }
            else if (gameState.difficulty === 'hell') {
                // 地狱难度 - 几乎无行动间隔，行动力恢复极快
                gameState.aiStrategy = 'simayi';
                gameState.aiActionInterval = 0; // 无行动间隔
                gameState.apRegenMultiplier = 2.0; // 行动力恢复快一倍
            }
            else if (gameState.difficulty === 'weiyan') {
                // 魏延难度
                gameState.aiStrategy = 'weiyan';
                gameState.aiActionInterval = 300; // 0.3秒行动间隔
                gameState.apRegenMultiplier = 1.0; // 正常行动力恢复
            }
        }
        
        // 清理冷却计时器
        Object.keys(gameState.cooldownIntervals).forEach(key => {
            clearInterval(gameState.cooldownIntervals[key]);
        });
        gameState.cooldownIntervals = {};
        
        // 初始化棋盘
        initializeBoard();
        
        // 显示游戏状态
        updateGameStatus('新游戏开始！白方先行');
        
        // 更新UI状态
        updateStats();
        updateMoveHistory();
        
        // 禁用撤销按钮
        document.getElementById('undo-btn').disabled = true;
        
        // 清理预测标记
        clearPredictionMarkers();
        updateCounterDisplay();
        
        // 确保当前玩家设置
        gameState.currentPlayer = 'white';

        console.log(`游戏开始！AI策略: ${gameState.aiStrategy}, 难度: ${gameState.difficulty}, 行动间隔: ${gameState.aiActionInterval}ms, AP恢复倍率: ${gameState.apRegenMultiplier}x`);
    }
    
    // 撤销最后一步移动
    function undoLastMove() {
        if (!gameState.gameActive || gameState.moveHistory.length === 0) return;
        
        // 获取最后一次移动
        const lastMove = gameState.moveHistory.pop();
        updateMoveHistory();
        
        // TODO: 实现撤销逻辑（较为复杂，需要保存完整状态）
        updateGameStatus('撤销功能尚未完全实现');
        
        // 如果历史记录为空，禁用撤销
        if (gameState.moveHistory.length === 0) {
            undoBtn.disabled = true;
        }
    }
    
    // 设置事件监听器
    function setupEventListeners() {
        newGameBtn.addEventListener('click', startNewGame);
        undoBtn.addEventListener('click', undoLastMove);
        
        // 难度选择变化时，只更新状态，不重开游戏
        document.getElementById('difficulty').addEventListener('change', (e) => {
            gameState.difficulty = e.target.value;
            // 提示难度变更
            updateGameStatus(`难度已设置为: ${getChineseDifficultyName(e.target.value)}, 将在新游戏生效`);
            console.log("Difficulty changed to:", gameState.difficulty, "(effective next game)");
        });
    }
    
    // 获取难度的中文名称
    function getChineseDifficultyName(difficultyValue) {
        switch(difficultyValue) {
            case 'easy': return '简单(司马懿)';
            case 'normal': return '普通(司马懿)';
            case 'hard': return '困难(司马懿)';
            case 'hell': return '地狱(司马懿)';
            case 'weiyan': return '魏延';
            default: return difficultyValue;
        }
    }
    
    // 初始化游戏
    setupEventListeners();
    // --- 不再自动开始游戏，等待按钮点击 ---
    // startNewGame(); 
    // --- 初始化棋盘用于显示，但不激活游戏 ---
    initializeBoard(); 
    updateStats(); // 更新初始 AP 显示
    updateGameStatus('选择难度点击"新游戏". 简单/普通/困难/地狱(司马懿策略,行动间隔和AP恢复不同) 或 魏延(双线攻击).');
    // --- 新增：初始化棋子AP状态 ---
    updatePieceAPStatus();
    
    // 启动行动点数恢复和AI行动的计时器
    setInterval(() => {
        if (!gameState.gameActive) return;

        // 行动点数恢复
        if (gameState.playerAP < 10) {
            gameState.playerAP = Math.min(10, gameState.playerAP + 0.1);
        }
        if (gameState.opponentAP < 10) {
            gameState.opponentAP = Math.min(10, gameState.opponentAP + 0.1 * gameState.apRegenMultiplier);
        }
        updateStats();

        // AI尝试行动 (现在会检查全局和棋子冷却)
        aiAction();
    }, 100); // 保持 100ms 的间隔，允许 AP 恢复和 AI 决策

    // 简化版的 AI 移动决策 (普通难度)
    function findBestMove(color) {
        const possibleMoves = getAllPossibleMoves(color);
        if (possibleMoves.length === 0) return null;

        let bestScore = -Infinity;
        let bestMoves = [];

        for (const move of possibleMoves) {
            // --- 修正这里的属性访问 ---
            const fromPiece = gameState.board[move.fromRow][move.fromCol];
            const targetPiece = gameState.board[move.toRow][move.toCol];
            let score = 0;

            // 优先吃子
            if (targetPiece) {
                score = pieceValues[targetPiece.type] || 0;
            }

            // 稍微鼓励向前移动兵 (简化)
            // --- 修正这里的属性访问 ---
            if (fromPiece.type === 'pawn' && color === 'black' && move.toRow > move.fromRow) {
                score += 0.1;
            } else if (fromPiece.type === 'pawn' && color === 'white' && move.toRow < move.fromRow) {
                score += 0.1;
            }

            // 添加一点随机性，避免总走一样的棋
            score += Math.random() * 0.05; // 增加随机性影响

            if (score > bestScore) {
                bestScore = score;
                bestMoves = [move];
            } else if (Math.abs(score - bestScore) < 0.001) { // 处理浮点数比较
                bestMoves.push(move);
            }
        }

        // 从最佳得分的移动中随机选择一个
        if (bestMoves.length > 0) {
            return bestMoves[Math.floor(Math.random() * bestMoves.length)];
        } else {
            // 如果没有找到最佳移动（理论上不应发生，除非 possibleMoves 为空）
            // 则从所有可能的移动中随机选一个
            return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        }
    }

    // --- 新增：检查格子是否被指定颜色攻击 ---
    function isSquareThreatened(targetRow, targetCol, attackerColor, excludeRow = -1, excludeCol = -1) {
        // 检查是否指定位置被指定颜色的棋子攻击
        // 可选参数：excludeRow/excludeCol 可以用来忽略特定位置的攻击者（用于检查吃掉威胁棋子的情况）
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                // 忽略排除的位置（如果指定）
                if (row === excludeRow && col === excludeCol) continue;
                
                const piece = gameState.board[row][col];
                if (piece && piece.color === attackerColor) {
                    // 检查该棋子是否能够移动到目标位置
                    if (isValidMove(row, col, targetRow, targetCol)) {
                        if (excludeRow >= 0 && excludeCol >= 0) {
                            // 如果是检查特定威胁，返回true表示找到了威胁来源
                            return true;
                        }
                        // 否则，任何攻击都使格子受到威胁
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    // --- 威胁检查结束 ---

    // --- 重命名 AI 函数，并修正内部属性访问 ---
    // --- 大幅修改评分逻辑以实现防守反击 ---
    function findSimaYiMove(color) {
        const possibleMoves = getAllPossibleMoves(color);
        if (possibleMoves.length === 0) return null;

        const opponentColor = (color === 'white') ? 'black' : 'white';
        let bestMoves = [];
        let highestScore = -Infinity;

        // 修正棋子价值，确保王的价值极高
        const pieceValues = {
            'pawn': 1,
            'knight': 3,
            'bishop': 3,
            'rook': 5,
            'queen': 9,
            'king': 100  // 王的价值设为极高，确保优先保护王和吃掉对方的王
        };

        // 行动力保护阈值 - 即使执行高优先级移动也应保留的最小行动力
        const MIN_AP_RESERVE = 3;
        
        // 如果当前行动力已经很低，大幅增加消耗惩罚系数
        const getApCostPenalty = (currentAP, cost) => {
            // 当行动力小于等于MIN_AP_RESERVE时，大幅增加消耗惩罚
            if (currentAP - cost <= MIN_AP_RESERVE) {
                return cost * 5; // 大幅增加消耗惩罚
            } else if (currentAP < 6) {
                return cost * 2; // 中度增加消耗惩罚
            } else {
                return cost * 0.5; // 默认消耗惩罚
            }
        };

        // 1. 评估每个移动
        for (const move of possibleMoves) {
            const fromRow = move.fromRow;
            const fromCol = move.fromCol;
            const toRow = move.toRow;
            const toCol = move.toCol;
            const piece = gameState.board[fromRow][fromCol];
            const targetPiece = gameState.board[toRow][toCol]; // 被吃的棋子 (可能为 null)
            const moveCost = moveCosts[piece.type];
            let score = 0;

            // --- 行动力消耗惩罚，根据当前行动力动态调整 ---
            score -= getApCostPenalty(gameState.opponentAP, moveCost);

            // --- 检查移动后的位置是否安全 ---
            const isToSquareSafe = !isSquareThreatened(toRow, toCol, opponentColor);

            // --- 检查当前位置是否真的受到威胁（使用正确的威胁判断函数）---
            const isFromSquareThreatened = isSquareThreatened(fromRow, fromCol, opponentColor);

            // --- 特殊情况：当王受到威胁时的紧急处理 ---
            if (piece.type === 'king' && isFromSquareThreatened) {
                score += 50; // 王受威胁，尝试移动的紧急优先级
                if (isToSquareSafe) {
                    score += 30; // 额外奖励移动到安全位置
                }
            }

            // --- A. 高优先级：处理对我方高价值棋子的威胁 ---
            // 真正受到威胁的棋子才需要解救，且移动后应该安全
            if (isFromSquareThreatened && isToSquareSafe) {
                score += 8 + (pieceValues[piece.type] || 0); // 降低基础解救分数，更依赖于棋子价值
            }

            // --- 处理吃子逻辑 ---
            if (targetPiece) {
                // 特殊处理：吃王
                if (targetPiece.type === 'king') {
                    score += 1000; // 吃王极高优先级
                } else {
                    // 普通吃子评分
                    score += (pieceValues[targetPiece.type] || 0) * 1.5;
                    
                    // 检查是否吃掉威胁棋子
                    const targetThreateningPiece = isSquareThreatened(fromRow, fromCol, opponentColor, toRow, toCol);
                    if (targetThreateningPiece) {
                        score += 5; // 吃掉威胁棋子的额外奖励
                    }
                    
                    // 额外考虑吃子的行动力效率
                    if (pieceValues[targetPiece.type] > moveCost) {
                        score += 2; // 当吃到的棋子价值大于消耗行动力时的额外奖励
                    }
                }
            }

            // --- B. 中优先级：位置改善 ---
            // 避免移动到不安全位置 (除非是为了吃高价值棋子)
            if (!isToSquareSafe && (!targetPiece || (pieceValues[targetPiece.type] || 0) < (pieceValues[piece.type] || 0))) {
                 score -= 15 + (pieceValues[piece.type] || 0); // 降低惩罚，但仍然显著
            }

            // --- C. 低优先级：保守发展 (降低行动力阈值要求) ---
            if (!targetPiece && isToSquareSafe && gameState.opponentAP > 4) { // 行动力阈值从6降低到4
                // 鼓励小兵安全前进
                if (piece.type === 'pawn') {
                    // 根据推进距离给奖励
                    const advanceReward = color === 'black' ? (fromRow - toRow) : (toRow - fromRow);
                    if (advanceReward > 0) {
                        score += 0.5 * advanceReward;
                    }
                    
                    // 特别鼓励推进到对方半场
                    if ((color === 'black' && toRow < 4) || (color === 'white' && toRow > 3)) {
                        score += 0.3;
                    }
                }
                
                // 鼓励马象移动到安全的中心区域
                else if ((piece.type === 'knight' || piece.type === 'bishop') && (toRow >= 2 && toRow <= 5 && toCol >= 2 && toCol <= 5)) {
                    score += 0.4;
                }
                
                // 不鼓励王、后、车在早期无目的地移动 - 但降低惩罚
                if (piece.type === 'king') score -= 0.3;
                if (piece.type === 'queen' || piece.type === 'rook') score -= 0.1;
            }
            
            // 添加微小的随机性，以区分评分相同的移动
            score += Math.random() * 0.01;

            // 2. 更新最佳移动列表
            if (score > highestScore) {
                highestScore = score;
                bestMoves = [move];
            } else if (Math.abs(score - highestScore) < 0.001) { // 处理浮点数比较
                bestMoves.push(move);
            }
        }

        // 3. 从最佳移动中选择
        if (bestMoves.length > 0) {
            console.log(`SimaYi AI: Found ${bestMoves.length} best moves with score ${highestScore.toFixed(2)}. Choosing one.`);
            // 可以增加日志看具体选择了哪个类型的移动 (吃子/解围/发展)
            const chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
            console.log("Chosen move:", chosenMove);
            return chosenMove;
        } else {
            // 理论上不应发生，除非 getAllPossibleMoves 返回空列表
            console.log("SimaYi AI: No best move found, choosing randomly from all possible moves.");
            return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        }
    }
    // --- 司马懿 AI 结束 ---

    // 添加在棋盘上显示预测移动的函数
    function displayPredictedMoves() {
        if (!showPredictions) return;
        
        // 清除之前的预测标记
        clearPredictionMarkers();
        
        // 获取当前玩家颜色
        const playerColor = chess.turn === 'w' ? 'white' : 'black';
        
        // 预测玩家可能的移动
        const predictedMoves = chess.predictPlayerMoves(playerColor);
        
        // 显示预测移动
        predictedMoves.forEach((move, index) => {
            const fromSquare = document.querySelector(`.square[data-row="${move.fromRow}"][data-col="${move.fromCol}"]`);
            const toSquare = document.querySelector(`.square[data-row="${move.toRow}"][data-col="${move.toCol}"]`);
            
            if (fromSquare && toSquare) {
                // 创建预测标记
                const marker = document.createElement('div');
                marker.className = 'prediction-marker';
                marker.textContent = (index + 1).toString();
                marker.style.backgroundColor = ['gold', 'silver', '#cd7f32'][index]; // 金、银、铜
                
                // 添加标记到目标方格
                toSquare.appendChild(marker);
                
                // 添加出发点标记
                const fromMarker = document.createElement('div');
                fromMarker.className = 'prediction-marker from-marker';
                fromMarker.textContent = (index + 1).toString();
                fromMarker.style.backgroundColor = ['gold', 'silver', '#cd7f32'][index];
                fromSquare.appendChild(fromMarker);
            }
        });
    }

    // 清除预测标记
    function clearPredictionMarkers() {
        const markers = document.querySelectorAll('.prediction-marker');
        markers.forEach(marker => marker.remove());
    }

    // 更新计数器显示
    function updateCounterDisplay() {
        document.getElementById('counter-count').textContent = counteredMoves;
    }

    // 创建计数器UI
    function createCounterUI() {
        const uiContainer = document.createElement('div');
        uiContainer.id = 'game-ui-container';
        uiContainer.innerHTML = `
            <div class="ui-panel">
                <div class="ui-toggle">
                    <label for="predictions-toggle">显示预测移动:</label>
                    <input type="checkbox" id="predictions-toggle">
                </div>
                <div class="counter-display">
                    <span>被阻止的移动:</span>
                    <span id="counter-count">0</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(uiContainer);
        
        // 添加切换预测显示的事件监听器
        document.getElementById('predictions-toggle').addEventListener('change', function(e) {
            showPredictions = e.target.checked;
            if (showPredictions) {
                displayPredictedMoves();
            } else {
                clearPredictionMarkers();
            }
        });
    }

    // 初始化UI
    function initUI() {
        createCounterUI();
        updateCounterDisplay();
        
        // 添加CSS样式
        const style = document.createElement('style');
        style.textContent = `
            #game-ui-container {
                position: absolute;
                top: 10px;
                right: 10px;
                z-index: 1000;
            }
            
            .ui-panel {
                background-color: rgba(255, 255, 255, 0.9);
                border: 1px solid #ccc;
                border-radius: 5px;
                padding: 10px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                margin-bottom: 10px;
            }
            
            .ui-toggle {
                margin-bottom: 10px;
            }
            
            .counter-display {
                font-weight: bold;
            }
            
            .prediction-marker {
                position: absolute;
                top: 5px;
                right: 5px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                display: flex;
                justify-content: center;
                align-items: center;
                color: black;
                font-weight: bold;
                font-size: 12px;
                z-index: 10;
            }
            
            .from-marker {
                top: auto;
                right: auto;
                bottom: 5px;
                left: 5px;
                opacity: 0.6;
            }

            /* 难度选择器样式 */
            #difficulty-container {
                display: flex;
                justify-content: center;
                margin-bottom: 10px;
            }
            
            #difficulty {
                padding: 5px;
                border-radius: 5px;
                border: 1px solid #ccc;
                font-size: 15px;
                margin-left: 10px;
            }
            
            .difficulty-label {
                font-weight: bold;
                line-height: 30px;
            }
        `;
        document.head.appendChild(style);

        // 更新难度选择器
        updateDifficultySelector();
    }

    // 更新难度选择器
    function updateDifficultySelector() {
        const difficultySelect = document.getElementById('difficulty');
        if (difficultySelect) {
            // 清空现有选项
            difficultySelect.innerHTML = '';
            
            // 创建并添加新选项
            const difficulties = [
                { value: 'easy', text: '简单(司马懿)' },
                { value: 'normal', text: '普通(司马懿)' },
                { value: 'hard', text: '困难(司马懿)' },
                { value: 'hell', text: '地狱(司马懿)' },
                { value: 'weiyan', text: '魏延(标准)' }
            ];
            
            difficulties.forEach(diff => {
                const option = document.createElement('option');
                option.value = diff.value;
                option.textContent = diff.text;
                difficultySelect.appendChild(option);
            });
            
            // 设置默认值为'normal'
            difficultySelect.value = 'normal';
        } else {
            console.error("难度选择器元素未找到");
        }
    }

    // 初始化UI界面
    initUI();

    // 修改AI移动函数以检查并记录阻止的移动
    function aiMove() {
        if (!gameState.isAIThinking && gameState.currentPlayer === 'black') {
            gameState.isAIThinking = true;
            
            // 短暂延迟，给UI更新的时间
            setTimeout(() => {
                const move = gameState.chessAI.calculateBestMove(chess);
                
                if (move) {
                    const aiMoveObj = {
                        fromRow: move.fromRow,
                        fromCol: move.fromCol,
                        toRow: move.toRow,
                        toCol: move.toCol
                    };
                    
                    // 检查AI移动是否阻止了玩家的预期移动
                    const playerColor = 'white'; // 玩家总是白色
                    const counteredMovesList = chess.checkMovesCountered(aiMoveObj, playerColor);
                    
                    // 执行移动
                    makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                    
                    // 更新计数器
                    if (counteredMovesList && counteredMovesList.length > 0) {
                        counteredMoves += counteredMovesList.length;
                        updateCounterDisplay();
                        
                        // 显示被阻止的移动的视觉提示
                        counteredMovesList.forEach(move => {
                            const fromSquare = document.querySelector(`.square[data-row="${move.fromRow}"][data-col="${move.fromCol}"]`);
                            const toSquare = document.querySelector(`.square[data-row="${move.toRow}"][data-col="${move.toCol}"]`);
                            
                            if (fromSquare && toSquare) {
                                // 添加"被阻止"的视觉效果
                                fromSquare.classList.add('countered-move');
                                toSquare.classList.add('countered-move');
                                
                                // 2秒后移除效果
                                setTimeout(() => {
                                    fromSquare.classList.remove('countered-move');
                                    toSquare.classList.remove('countered-move');
                                }, 2000);
                            }
                        });
                    }
                    
                    // 更新预测移动显示
                    displayPredictedMoves();
                }
                
                gameState.isAIThinking = false;
            }, 500);
        }
    }

    // 修改onDomContentLoaded函数以初始化UI
    document.addEventListener('DOMContentLoaded', function() {
        // ... existing code ...
        
        // 初始化UI界面
        initUI();
    });

    // 魏延AI - 积累行动力后同时在两路发起进攻
    function findWeiYanMove(color) {
        const opponentColor = color === 'white' ? 'black' : 'white';
        const currentAP = color === 'white' ? gameState.playerAP : gameState.opponentAP;
        const weiyanThreshold = 8; // 行动力达到8点时进入进攻阶段
        
        // 阶段判断 - 积累或进攻
        const isAttackPhase = currentAP >= weiyanThreshold;
        
        // 获取所有可能的移动
        const allMoves = getAllPossibleMoves(color);
        if (allMoves.length === 0) return null;
        
        // 评估每个移动
        const evaluatedMoves = allMoves.map(move => {
            const { fromRow, fromCol, toRow, toCol } = move;
            const piece = gameState.board[fromRow][fromCol];
            
            // 基础评分
            let score = 0;
            
            // 目标位置有敌方棋子时的得分(吃子)
            const targetPiece = gameState.board[toRow][toCol];
            if (targetPiece && targetPiece.color !== color) {
                score += pieceValues[targetPiece.type] * 10;
            }
            
            // 移动消耗的行动点数
            const moveCost = moveCosts[piece.type];
            
            // 在准备阶段，优先考虑低成本、防御性的移动
            if (!isAttackPhase) {
                // 防御评分 - 避免把自己的高价值棋子暴露在危险中
                if (isSquareThreatened(toRow, toCol, opponentColor)) {
                    score -= pieceValues[piece.type] * 5;
                }
                
                // 偏好低成本移动
                score -= moveCost * 2;
                
                // 偏好中心控制和发展
                if ((toRow >= 2 && toRow <= 5) && (toCol >= 2 && toCol <= 5)) {
                    score += 2;
                }
                
                // 避免移动王，除非必要
                if (piece.type === 'king') {
                    score -= 5;
                }
                
                // 避免过早出动后
                if (piece.type === 'queen' && currentAP < 6) {
                    score -= 4;
                }
            } 
            // 进攻阶段 - 寻找两路攻击的机会
            else {
                // 确保有足够的行动点进行移动
                if (moveCost > currentAP) {
                    return { ...move, score: -1000 }; // 无法执行的移动
                }
                
                // 攻击评分
                if (targetPiece) {
                    // 吃子的价值
                    score += pieceValues[targetPiece.type] * 15;
                    
                    // 如果能吃掉无防护的棋子，优先级更高
                    if (!isSquareThreatened(toRow, toCol, color)) {
                        score += 10;
                    }
                }
                
                // 检查移动后是否能威胁对手重要棋子
                const simulatedBoard = JSON.parse(JSON.stringify(gameState.board));
                // 模拟移动
                simulatedBoard[toRow][toCol] = simulatedBoard[fromRow][fromCol];
                simulatedBoard[fromRow][fromCol] = null;
                
                // 计算该移动能威胁多少敌方棋子
                let threatenedPieces = 0;
                for (let r = 0; r < 8; r++) {
                    for (let c = 0; c < 8; c++) {
                        const p = simulatedBoard[r][c];
                        if (p && p.color === opponentColor) {
                            // 检查是否受到威胁
                            // 简化版检查：如果目标位置直接威胁敌方棋子
                            if ((piece.type === 'queen' || piece.type === 'rook') && 
                                (r === toRow || c === toCol)) {
                                threatenedPieces++;
                                score += pieceValues[p.type] * 2;
                            } else if (piece.type === 'bishop' && 
                                      Math.abs(r - toRow) === Math.abs(c - toCol)) {
                                threatenedPieces++;
                                score += pieceValues[p.type] * 2;
                            } else if (piece.type === 'knight' && 
                                      ((Math.abs(r - toRow) === 2 && Math.abs(c - toCol) === 1) || 
                                       (Math.abs(r - toRow) === 1 && Math.abs(c - toCol) === 2))) {
                                threatenedPieces++;
                                score += pieceValues[p.type] * 2;
                            }
                        }
                    }
                }
                
                // 偏好能同时威胁多个棋子的移动
                score += threatenedPieces * 8;
                
                // 进攻性棋子优先
                if (piece.type === 'queen' || piece.type === 'rook' || piece.type === 'bishop') {
                    score += 5;
                }
                
                // 确保安全 - 避免把自己的高价值棋子暴露在危险中
                if (isSquareThreatened(toRow, toCol, opponentColor, fromRow, fromCol)) {
                    score -= pieceValues[piece.type] * 10;
                }
            }
            
            return { ...move, score, moveCost };
        });
        
        // 移动排序
        evaluatedMoves.sort((a, b) => b.score - a.score);
        
        // 进攻阶段 - 如果有足够行动力，尝试执行两步移动
        if (isAttackPhase && evaluatedMoves.length >= 2) {
            const firstMove = evaluatedMoves[0];
            
            // 查找第二个最佳移动（与第一个不冲突）
            let secondMoveIndex = 1;
            while (secondMoveIndex < evaluatedMoves.length) {
                const secondMove = evaluatedMoves[secondMoveIndex];
                
                // 检查两个移动是否冲突（不能是同一个棋子）
                const isSamePiece = firstMove.fromRow === secondMove.fromRow && 
                                  firstMove.fromCol === secondMove.fromCol;
                
                // 检查两个移动的行动力总和是否超出可用行动力
                const totalCost = firstMove.moveCost + secondMove.moveCost;
                const enoughAP = totalCost <= currentAP;
                
                // 不冲突且有足够行动力执行两个移动
                if (!isSamePiece && enoughAP && secondMove.score > 0) {
                    console.log("魏延策略: 找到两路进攻机会!");
                    
                    // 将第一个移动标记为"连招"，主要目的是为了视觉效果
                    firstMove.isWeiyanCombo = true;
                    firstMove.nextMove = secondMove;
                    return firstMove;
                }
                
                secondMoveIndex++;
            }
        }
        
        // 如果没有找到双路进攻或者在准备阶段，返回单个最佳移动
        return evaluatedMoves[0];
    }

    // 修改AI策略选择部分，添加魏延AI
    function aiMove() {
        if (!gameState.isAIThinking && gameState.currentPlayer === 'black') {
            gameState.isAIThinking = true;
            
            // 短暂延迟，给UI更新的时间
            setTimeout(() => {
                let bestMove;
                if (gameState.aiStrategy === 'weiyuan') {
                    bestMove = findWeiYanMove('black');
                } else if (gameState.aiStrategy === 'simayi') {
                    bestMove = findSimaYiMove('black');
                } else {
                    bestMove = findBestMove('black');
                }
                
                if (bestMove) {
                    // 处理魏延的连招特殊情况
                    if (bestMove.isWeiyanCombo && bestMove.nextMove) {
                        const nextMove = bestMove.nextMove;
                        
                        // 执行第一步移动
                        movePiece(bestMove.fromRow, bestMove.fromCol, bestMove.toRow, bestMove.toCol);
                        
                        // 短暂延迟后执行第二步移动
                        setTimeout(() => {
                            if (gameState.gameActive) {
                                movePiece(nextMove.fromRow, nextMove.fromCol, nextMove.toRow, nextMove.toCol);
                            }
                        }, 300); // 300毫秒后执行第二步移动
                    } else if (bestMove) {
                        movePiece(bestMove.fromRow, bestMove.fromCol, bestMove.toRow, bestMove.toCol);
                    }
                    
                    // 更新预测移动显示
                    displayPredictedMoves();
                }
                
                gameState.isAIThinking = false;
            }, 500);
        }
    }

}); 