// 象棋游戏主要逻辑
document.addEventListener('DOMContentLoaded', () => {
    // 游戏基本设置
    const chessBoard = document.getElementById('chess-board');
    const startBtn = document.getElementById('start-btn');
    const resetBtn = document.getElementById('reset-btn');
    const timerDisplay = document.getElementById('timer');
    const currentPlayerDisplay = document.getElementById('current-player');
    const playerScoreDisplay = document.getElementById('player-score');
    const aiScoreDisplay = document.getElementById('ai-score');
    const moveList = document.getElementById('move-list');
    const redCaptures = document.getElementById('red-captures');
    const blackCaptures = document.getElementById('black-captures');
    const playerTimeDisplay = document.getElementById('player-time');
    const aiTimeDisplay = document.getElementById('ai-time');
    const playerTimer = document.getElementById('player-timer');
    const aiTimer = document.getElementById('ai-timer');

    // 游戏状态
    let gameActive = false;
    let playerTurn = true; // true为玩家回合，false为AI回合
    let selectedPiece = null;
    let gameTimer = null;
    let playerCountdownTimer = null;
    let aiCountdownTimer = null;
    let timeElapsed = 0;
    let playerTime = 600; // 10分钟
    let aiTime = 600; // 10分钟
    let playerScore = 0;
    let aiScore = 0;
    let validMoves = [];
    let moveHistory = [];
    let redCaptureCount = 0;
    let blackCaptureCount = 0;
    let capturedPieces = {
        red: [],   // 被黑方吃掉的红方棋子
        black: []  // 被红方吃掉的黑方棋子
    };

    // 棋子初始位置配置
    const initialBoardSetup = {
        // 红方（玩家）
        'R0_C0': { type: 'chariot', side: 'red', text: '车' },
        'R0_C1': { type: 'horse', side: 'red', text: '马' },
        'R0_C2': { type: 'elephant', side: 'red', text: '相' },
        'R0_C3': { type: 'advisor', side: 'red', text: '士' },
        'R0_C4': { type: 'general', side: 'red', text: '帅' },
        'R0_C5': { type: 'advisor', side: 'red', text: '士' },
        'R0_C6': { type: 'elephant', side: 'red', text: '相' },
        'R0_C7': { type: 'horse', side: 'red', text: '马' },
        'R0_C8': { type: 'chariot', side: 'red', text: '车' },
        'R2_C1': { type: 'cannon', side: 'red', text: '炮' },
        'R2_C7': { type: 'cannon', side: 'red', text: '炮' },
        'R3_C0': { type: 'soldier', side: 'red', text: '兵' },
        'R3_C2': { type: 'soldier', side: 'red', text: '兵' },
        'R3_C4': { type: 'soldier', side: 'red', text: '兵' },
        'R3_C6': { type: 'soldier', side: 'red', text: '兵' },
        'R3_C8': { type: 'soldier', side: 'red', text: '兵' },

        // 黑方（AI）
        'R9_C0': { type: 'chariot', side: 'black', text: '车' },
        'R9_C1': { type: 'horse', side: 'black', text: '马' },
        'R9_C2': { type: 'elephant', side: 'black', text: '象' },
        'R9_C3': { type: 'advisor', side: 'black', text: '士' },
        'R9_C4': { type: 'general', side: 'black', text: '将' },
        'R9_C5': { type: 'advisor', side: 'black', text: '士' },
        'R9_C6': { type: 'elephant', side: 'black', text: '象' },
        'R9_C7': { type: 'horse', side: 'black', text: '马' },
        'R9_C8': { type: 'chariot', side: 'black', text: '车' },
        'R7_C1': { type: 'cannon', side: 'black', text: '炮' },
        'R7_C7': { type: 'cannon', side: 'black', text: '炮' },
        'R6_C0': { type: 'soldier', side: 'black', text: '卒' },
        'R6_C2': { type: 'soldier', side: 'black', text: '卒' },
        'R6_C4': { type: 'soldier', side: 'black', text: '卒' },
        'R6_C6': { type: 'soldier', side: 'black', text: '卒' },
        'R6_C8': { type: 'soldier', side: 'black', text: '卒' }
    };

    // 当前棋盘状态
    let currentBoardState = {};

    // 初始化棋盘
    function initializeBoard() {
        chessBoard.innerHTML = '';

        // 创建棋盘格子
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const cell = document.createElement('div');
                cell.classList.add('chess-cell');
                cell.dataset.row = row;
                cell.dataset.col = col;
                cell.dataset.position = `R${row}_C${col}`;
                
                // 特殊格子标记（九宫格）
                if ((row < 3 || row > 6) && (col > 2 && col < 6)) {
                    if ((row === 0 || row === 9) && col === 4) {
                        // 将/帅位置
                    } else if ((row === 0 && col === 3) || (row === 0 && col === 5) ||
                               (row === 1 && col === 4) ||
                               (row === 2 && col === 3) || (row === 2 && col === 5) ||
                               (row === 7 && col === 3) || (row === 7 && col === 5) ||
                               (row === 8 && col === 4) ||
                               (row === 9 && col === 3) || (row === 9 && col === 5)) {
                        // 士/相位置
                    }
                }

                cell.addEventListener('click', handleCellClick);
                chessBoard.appendChild(cell);
            }
        }

        // 放置棋子
        resetBoardState();
        renderPieces();
    }

    // 重置棋盘状态
    function resetBoardState() {
        currentBoardState = JSON.parse(JSON.stringify(initialBoardSetup));
    }

    // 渲染棋子
    function renderPieces() {
        // 清除所有棋子
        const existingPieces = document.querySelectorAll('.piece');
        existingPieces.forEach(piece => piece.remove());

        // 渲染当前状态的棋子
        Object.keys(currentBoardState).forEach(position => {
            const piece = currentBoardState[position];
            const [row, col] = position.match(/R(\d+)_C(\d+)/).slice(1).map(Number);
            createPiece(piece.type, piece.side, piece.text, row, col);
        });
    }

    // 创建棋子元素
    function createPiece(type, side, text, row, col) {
        const piece = document.createElement('div');
        piece.classList.add('piece', `${side}-piece`);
        piece.dataset.type = type;
        piece.dataset.side = side;
        piece.dataset.position = `R${row}_C${col}`;
        piece.textContent = text;

        // 计算位置
        const cellWidth = chessBoard.offsetWidth / 9;
        const cellHeight = chessBoard.offsetHeight / 10;
        
        // 使棋子居中且大小适中
        const pieceSize = Math.min(cellWidth, cellHeight) * 0.85;
        const pieceLeft = col * cellWidth + cellWidth / 2 - pieceSize / 2;
        const pieceTop = row * cellHeight + cellHeight / 2 - pieceSize / 2;
        
        piece.style.width = `${pieceSize}px`;
        piece.style.height = `${pieceSize}px`;
        piece.style.left = `${pieceLeft}px`;
        piece.style.top = `${pieceTop}px`;
        piece.style.fontSize = `${pieceSize * 0.6}px`;

        // 添加点击事件
        piece.addEventListener('click', handlePieceClick);
        chessBoard.appendChild(piece);
    }

    // 处理棋子点击
    function handlePieceClick(event) {
        if (!gameActive || !playerTurn) return;

        const piece = event.target;
        const side = piece.dataset.side;
        const position = piece.dataset.position;

        // 如果点击的是敌方棋子，并且已经选中了己方棋子，尝试吃子
        if (side !== 'red' && selectedPiece) {
            const fromPosition = selectedPiece.dataset.position;
            // 检查是否是有效移动
            if (validMoves.includes(position)) {
                movePiece(fromPosition, position);
                clearSelection();
                
                // 切换回合到AI
                playerTurn = false;
                currentPlayerDisplay.textContent = '电脑';
                
                // 切换活动计时器
                switchActiveTimer();

                // AI回合
                setTimeout(aiTurn, 500);
                return;
            }
        }

        // 只能选择自己的棋子
        if (side !== 'red') return;

        // 如果已经选中棋子，先取消之前的选择
        clearSelection();

        // 选中当前棋子
        piece.classList.add('selected');
        selectedPiece = piece;

        // 计算并显示有效移动位置
        validMoves = calculateValidMoves(position);
        showValidMoves(validMoves);
    }

    // 处理棋盘格子点击
    function handleCellClick(event) {
        if (!gameActive || !playerTurn || !selectedPiece) return;

        // 获取点击的位置
        let targetPosition;
        const target = event.target;
        
        // 如果点击的是棋子
        if (target.classList.contains('piece')) {
            targetPosition = target.dataset.position;
            // 如果点击的是敌方棋子，尝试吃子
            if (target.dataset.side !== 'red' && validMoves.includes(targetPosition)) {
                const fromPosition = selectedPiece.dataset.position;
                movePiece(fromPosition, targetPosition);
                clearSelection();
                
                // 切换回合到AI
                playerTurn = false;
                currentPlayerDisplay.textContent = '电脑';
                
                // 切换活动计时器
                switchActiveTimer();

                // AI回合
                setTimeout(aiTurn, 500);
                return;
            }
            
            // 如果点击的是己方棋子，重新选择
            if (target.dataset.side === 'red') {
                clearSelection();
                target.classList.add('selected');
                selectedPiece = target;
                validMoves = calculateValidMoves(targetPosition);
                showValidMoves(validMoves);
                return;
            }
        }
        // 如果点击的是格子
        else if (target.classList.contains('chess-cell')) {
            targetPosition = target.dataset.position;
        } 
        // 如果点击的是移动提示
        else if (target.classList.contains('move-hint')) {
            // 从样式中提取位置
            const style = target.style;
            const left = parseFloat(style.left);
            const top = parseFloat(style.top);
            
            // 计算格子坐标
            const cellWidth = chessBoard.offsetWidth / 9;
            const cellHeight = chessBoard.offsetHeight / 10;
            const col = Math.floor((left + 15) / cellWidth);
            const row = Math.floor((top + 15) / cellHeight);
            
            targetPosition = `R${row}_C${col}`;
        }
        // 如果点击的是棋盘的空白区域，找最近的有效移动位置
        else if (target === chessBoard) {
            const rect = chessBoard.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            const cellWidth = chessBoard.offsetWidth / 9;
            const cellHeight = chessBoard.offsetHeight / 10;
            const col = Math.floor(x / cellWidth);
            const row = Math.floor(y / cellHeight);
            
            targetPosition = `R${row}_C${col}`;
            
            // 如果点击位置不是有效移动，找最近的有效移动位置
            if (!validMoves.includes(targetPosition)) {
                // 找到最近的有效移动位置
                let closestMove = null;
                let minDistance = Infinity;
                
                for (const move of validMoves) {
                    const [moveRow, moveCol] = move.match(/R(\d+)_C(\d+)/).slice(1).map(Number);
                    const centerX = (moveCol + 0.5) * cellWidth;
                    const centerY = (moveRow + 0.5) * cellHeight;
                    
                    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestMove = move;
                    }
                }
                
                // 如果距离小于半个格子的对角线距离，使用最近的有效移动位置
                const thresholdDistance = Math.sqrt(Math.pow(cellWidth/2, 2) + Math.pow(cellHeight/2, 2));
                if (minDistance < thresholdDistance) {
                    targetPosition = closestMove;
                }
            }
        }

        // 检查是否是有效移动
        if (validMoves.includes(targetPosition)) {
            // 执行移动
            const fromPosition = selectedPiece.dataset.position;
            movePiece(fromPosition, targetPosition);

            // 清除选中状态和有效移动提示
            clearSelection();

            // 切换回合到AI
            playerTurn = false;
            currentPlayerDisplay.textContent = '电脑';
            
            // 切换活动计时器
            switchActiveTimer();

            // AI回合
            setTimeout(aiTurn, 500);
        }
    }

    // 清除选中状态和有效移动提示
    function clearSelection() {
        // 清除选中状态
        const selectedPieces = document.querySelectorAll('.piece.selected');
        selectedPieces.forEach(piece => piece.classList.remove('selected'));
        selectedPiece = null;

        // 清除有效移动提示
        const moveHints = document.querySelectorAll('.move-hint');
        moveHints.forEach(hint => hint.remove());
        validMoves = [];
        
        console.log('Selection cleared');
    }

    // 显示有效移动位置
    function showValidMoves(moves) {
        // 先清除所有现有提示
        const existingHints = document.querySelectorAll('.move-hint');
        existingHints.forEach(hint => hint.remove());
        
        moves.forEach(position => {
            const [row, col] = position.match(/R(\d+)_C(\d+)/).slice(1).map(Number);
            const moveHint = document.createElement('div');
            moveHint.classList.add('move-hint');
            moveHint.dataset.position = position;
            
            // 检查是否是吃子位置
            if (currentBoardState[position]) {
                moveHint.classList.add('capture-hint');
            }

            // 计算位置
            const cellWidth = chessBoard.offsetWidth / 9;
            const cellHeight = chessBoard.offsetHeight / 10;
            moveHint.style.left = `${col * cellWidth + cellWidth / 2 - 15}px`;
            moveHint.style.top = `${row * cellHeight + cellHeight / 2 - 15}px`;
            
            // 添加点击事件
            moveHint.addEventListener('click', handleHintClick);

            chessBoard.appendChild(moveHint);
        });
    }
    
    // 处理提示点击
    function handleHintClick(event) {
        if (!gameActive || !playerTurn || !selectedPiece) return;
        
        const hint = event.target;
        const targetPosition = hint.dataset.position;
        
        if (validMoves.includes(targetPosition)) {
            // 执行移动
            const fromPosition = selectedPiece.dataset.position;
            movePiece(fromPosition, targetPosition);

            // 清除选中状态和有效移动提示
            clearSelection();

            // 切换回合到AI
            playerTurn = false;
            currentPlayerDisplay.textContent = '电脑';
            
            // 切换活动计时器
            switchActiveTimer();

            // AI回合
            setTimeout(aiTurn, 500);
        }
    }

    // 移动棋子
    function movePiece(fromPosition, toPosition) {
        const fromRow = parseInt(fromPosition.match(/R(\d+)/).at(1));
        const fromCol = parseInt(fromPosition.match(/C(\d+)/).at(1));
        const toRow = parseInt(toPosition.match(/R(\d+)/).at(1));
        const toCol = parseInt(toPosition.match(/C(\d+)/).at(1));
        
        const movingSide = currentBoardState[fromPosition].side;
        const movingPieceType = currentBoardState[fromPosition].type;
        const movingPieceText = currentBoardState[fromPosition].text;
        
        console.log(`Moving from ${fromPosition} to ${toPosition}`);
        console.log(`Current board state:`, currentBoardState);

        // 检查是否吃子
        let capturedPiece = null;
        if (currentBoardState[toPosition]) {
            capturedPiece = {...currentBoardState[toPosition]};
            console.log(`Capturing piece:`, capturedPiece);
            
            // 添加吃子动画
            const capturedElement = document.querySelector(`.piece[data-position="${toPosition}"]`);
            if (capturedElement) {
                capturedElement.classList.add('captured');
                
                // 等待动画完成后再移除
                setTimeout(() => {
                    capturedElement.remove();
                }, 500);
            }
            
            // 更新吃子统计
            if (movingSide === 'red') {
                redCaptureCount++;
                redCaptures.textContent = redCaptureCount;
                capturedPieces.black.push(capturedPiece);
            } else {
                blackCaptureCount++;
                blackCaptures.textContent = blackCaptureCount;
                capturedPieces.red.push(capturedPiece);
            }
            
            // 如果吃掉的是将/帅，游戏结束
            if (capturedPiece.type === 'general') {
                gameActive = false;
                if (capturedPiece.side === 'black') {
                    playerScore++;
                    playerScoreDisplay.textContent = playerScore;
                    alert('恭喜！你赢了！');
                } else {
                    aiScore++;
                    aiScoreDisplay.textContent = aiScore;
                    alert('电脑赢了！再接再厉！');
                }
                clearTimers();
                return;
            }
        }
        
        // 更新棋盘状态 - 深拷贝确保不引用原对象
        currentBoardState[toPosition] = {...currentBoardState[fromPosition]};
        delete currentBoardState[fromPosition];
        
        // 添加到移动历史
        const captureText = capturedPiece ? `(吃${capturedPiece.text})` : '';
        const moveNotation = `${movingPieceText}:${fromPosition}→${toPosition}${captureText}`;
        const moveRecord = {
            piece: movingPieceText,
            from: fromPosition,
            to: toPosition,
            captured: capturedPiece,
            side: movingSide,
            notation: moveNotation
        };
        moveHistory.push(moveRecord);
        
        // 更新移动历史显示
        const moveItem = document.createElement('li');
        moveItem.classList.add(movingSide === 'red' ? 'red-move' : 'black-move');
        moveItem.textContent = `${moveHistory.length}. ${moveNotation}`;
        moveList.appendChild(moveItem);
        moveList.scrollTop = moveList.scrollHeight; // 滚动到底部
        
        // 重新渲染棋盘
        renderPieces();
        
        // 为新移动的棋子添加动画
        const movedPiece = document.querySelector(`.piece[data-position="${toPosition}"]`);
        if (movedPiece) {
            movedPiece.classList.add('moved');
            setTimeout(() => {
                movedPiece.classList.remove('moved');
            }, 400);
        }
    }

    // 计算有效移动位置
    function calculateValidMoves(position) {
        const moves = [];
        const piece = currentBoardState[position];
        if (!piece) return moves;

        const [row, col] = position.match(/R(\d+)_C(\d+)/).slice(1).map(Number);
        const side = piece.side;

        switch (piece.type) {
            case 'chariot': // 车
                // 横向移动
                for (let c = col + 1; c < 9; c++) {
                    const targetPos = `R${row}_C${c}`;
                    if (currentBoardState[targetPos]) {
                        if (currentBoardState[targetPos].side !== side) {
                            moves.push(targetPos);
                        }
                        break;
                    }
                    moves.push(targetPos);
                }
                for (let c = col - 1; c >= 0; c--) {
                    const targetPos = `R${row}_C${c}`;
                    if (currentBoardState[targetPos]) {
                        if (currentBoardState[targetPos].side !== side) {
                            moves.push(targetPos);
                        }
                        break;
                    }
                    moves.push(targetPos);
                }
                // 纵向移动
                for (let r = row + 1; r < 10; r++) {
                    const targetPos = `R${r}_C${col}`;
                    if (currentBoardState[targetPos]) {
                        if (currentBoardState[targetPos].side !== side) {
                            moves.push(targetPos);
                        }
                        break;
                    }
                    moves.push(targetPos);
                }
                for (let r = row - 1; r >= 0; r--) {
                    const targetPos = `R${r}_C${col}`;
                    if (currentBoardState[targetPos]) {
                        if (currentBoardState[targetPos].side !== side) {
                            moves.push(targetPos);
                        }
                        break;
                    }
                    moves.push(targetPos);
                }
                break;

            case 'horse': // 马
                const horseDirections = [
                    [-2, -1], [-2, 1], // 上两格，左右
                    [2, -1], [2, 1],   // 下两格，左右
                    [-1, -2], [1, -2], // 左两格，上下
                    [-1, 2], [1, 2]    // 右两格，上下
                ];
                
                for (const [dr, dc] of horseDirections) {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    
                    // 检查是否在棋盘内
                    if (newRow >= 0 && newRow < 10 && newCol >= 0 && newCol < 9) {
                        // 检查马腿是否被绊
                        const legRow = dr === -2 || dr === 2 ? row + dr / 2 : row;
                        const legCol = dc === -2 || dc === 2 ? col + dc / 2 : col;
                        const legPos = `R${legRow}_C${legCol}`;
                        
                        if (!currentBoardState[legPos]) {
                            const targetPos = `R${newRow}_C${newCol}`;
                            if (!currentBoardState[targetPos] || currentBoardState[targetPos].side !== side) {
                                moves.push(targetPos);
                            }
                        }
                    }
                }
                break;

            case 'elephant': // 相/象
                const elephantDirections = [
                    [-2, -2], [-2, 2], [2, -2], [2, 2]
                ];
                
                // 象不能过河
                const riverBoundary = side === 'red' ? 5 : 4;
                
                for (const [dr, dc] of elephantDirections) {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    
                    // 检查是否在棋盘内和是否过河
                    if (newRow >= 0 && newRow < 10 && newCol >= 0 && newCol < 9 && 
                        (side === 'red' ? newRow < riverBoundary : newRow >= riverBoundary)) {
                        
                        // 检查象眼是否被塞
                        const eyeRow = row + dr / 2;
                        const eyeCol = col + dc / 2;
                        const eyePos = `R${eyeRow}_C${eyeCol}`;
                        
                        if (!currentBoardState[eyePos]) {
                            const targetPos = `R${newRow}_C${newCol}`;
                            if (!currentBoardState[targetPos] || currentBoardState[targetPos].side !== side) {
                                moves.push(targetPos);
                            }
                        }
                    }
                }
                break;

            case 'advisor': // 士
                const advisorDirections = [
                    [-1, -1], [-1, 1], [1, -1], [1, 1]
                ];
                
                for (const [dr, dc] of advisorDirections) {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    
                    // 检查是否在九宫格内
                    if ((side === 'red' && newRow >= 0 && newRow <= 2 && newCol >= 3 && newCol <= 5) ||
                        (side === 'black' && newRow >= 7 && newRow <= 9 && newCol >= 3 && newCol <= 5)) {
                        
                        const targetPos = `R${newRow}_C${newCol}`;
                        if (!currentBoardState[targetPos] || currentBoardState[targetPos].side !== side) {
                            moves.push(targetPos);
                        }
                    }
                }
                break;

            case 'general': // 将/帅
                const generalDirections = [
                    [-1, 0], [1, 0], [0, -1], [0, 1]
                ];
                
                for (const [dr, dc] of generalDirections) {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    
                    // 检查是否在九宫格内
                    if ((side === 'red' && newRow >= 0 && newRow <= 2 && newCol >= 3 && newCol <= 5) ||
                        (side === 'black' && newRow >= 7 && newRow <= 9 && newCol >= 3 && newCol <= 5)) {
                        
                        const targetPos = `R${newRow}_C${newCol}`;
                        if (!currentBoardState[targetPos] || currentBoardState[targetPos].side !== side) {
                            moves.push(targetPos);
                        }
                    }
                }
                
                // 将帅对面特殊规则
                const oppositeGeneralCol = col;
                let pieceCount = 0;
                
                // 检查是否有棋子在中间
                if (side === 'red') {
                    for (let r = row + 1; r < 10; r++) {
                        const checkPos = `R${r}_C${oppositeGeneralCol}`;
                        if (currentBoardState[checkPos]) {
                            pieceCount++;
                            if (currentBoardState[checkPos].type === 'general' && 
                                currentBoardState[checkPos].side !== side && 
                                pieceCount === 1) {
                                moves.push(checkPos);
                            }
                        }
                    }
                } else {
                    for (let r = row - 1; r >= 0; r--) {
                        const checkPos = `R${r}_C${oppositeGeneralCol}`;
                        if (currentBoardState[checkPos]) {
                            pieceCount++;
                            if (currentBoardState[checkPos].type === 'general' && 
                                currentBoardState[checkPos].side !== side && 
                                pieceCount === 1) {
                                moves.push(checkPos);
                            }
                        }
                    }
                }
                break;

            case 'cannon': // 炮
                // 横向移动（不吃子）
                for (let c = col + 1; c < 9; c++) {
                    const targetPos = `R${row}_C${c}`;
                    if (currentBoardState[targetPos]) {
                        break;
                    }
                    moves.push(targetPos);
                }
                for (let c = col - 1; c >= 0; c--) {
                    const targetPos = `R${row}_C${c}`;
                    if (currentBoardState[targetPos]) {
                        break;
                    }
                    moves.push(targetPos);
                }
                // 纵向移动（不吃子）
                for (let r = row + 1; r < 10; r++) {
                    const targetPos = `R${r}_C${col}`;
                    if (currentBoardState[targetPos]) {
                        break;
                    }
                    moves.push(targetPos);
                }
                for (let r = row - 1; r >= 0; r--) {
                    const targetPos = `R${r}_C${col}`;
                    if (currentBoardState[targetPos]) {
                        break;
                    }
                    moves.push(targetPos);
                }

                // 横向移动（吃子）
                let jumpCount = 0;
                for (let c = col + 1; c < 9; c++) {
                    const targetPos = `R${row}_C${c}`;
                    if (currentBoardState[targetPos]) {
                        jumpCount++;
                        if (jumpCount === 1) {
                            // 第一个棋子，作为炮架
                            continue;
                        } else if (jumpCount === 2) {
                            // 第二个棋子，如果是对方的棋子则可以吃
                            if (currentBoardState[targetPos].side !== side) {
                                moves.push(targetPos);
                            }
                            break;
                        }
                    }
                }

                jumpCount = 0;
                for (let c = col - 1; c >= 0; c--) {
                    const targetPos = `R${row}_C${c}`;
                    if (currentBoardState[targetPos]) {
                        jumpCount++;
                        if (jumpCount === 1) {
                            // 第一个棋子，作为炮架
                            continue;
                        } else if (jumpCount === 2) {
                            // 第二个棋子，如果是对方的棋子则可以吃
                            if (currentBoardState[targetPos].side !== side) {
                                moves.push(targetPos);
                            }
                            break;
                        }
                    }
                }

                // 纵向移动（吃子）
                jumpCount = 0;
                for (let r = row + 1; r < 10; r++) {
                    const targetPos = `R${r}_C${col}`;
                    if (currentBoardState[targetPos]) {
                        jumpCount++;
                        if (jumpCount === 1) {
                            // 第一个棋子，作为炮架
                            continue;
                        } else if (jumpCount === 2) {
                            // 第二个棋子，如果是对方的棋子则可以吃
                            if (currentBoardState[targetPos].side !== side) {
                                moves.push(targetPos);
                            }
                            break;
                        }
                    }
                }

                jumpCount = 0;
                for (let r = row - 1; r >= 0; r--) {
                    const targetPos = `R${r}_C${col}`;
                    if (currentBoardState[targetPos]) {
                        jumpCount++;
                        if (jumpCount === 1) {
                            // 第一个棋子，作为炮架
                            continue;
                        } else if (jumpCount === 2) {
                            // 第二个棋子，如果是对方的棋子则可以吃
                            if (currentBoardState[targetPos].side !== side) {
                                moves.push(targetPos);
                            }
                            break;
                        }
                    }
                }
                break;

            case 'soldier': // 兵/卒
                const direction = side === 'red' ? 1 : -1;
                
                // 前进
                const frontRow = row + direction;
                if (frontRow >= 0 && frontRow < 10) {
                    const frontPos = `R${frontRow}_C${col}`;
                    if (!currentBoardState[frontPos] || currentBoardState[frontPos].side !== side) {
                        moves.push(frontPos);
                    }
                }
                
                // 过河后可以左右移动
                const riverLine = side === 'red' ? 5 : 4;
                if ((side === 'red' && row >= riverLine) || (side === 'black' && row < riverLine)) {
                    // 左移
                    if (col > 0) {
                        const leftPos = `R${row}_C${col - 1}`;
                        if (!currentBoardState[leftPos] || currentBoardState[leftPos].side !== side) {
                            moves.push(leftPos);
                        }
                    }
                    // 右移
                    if (col < 8) {
                        const rightPos = `R${row}_C${col + 1}`;
                        if (!currentBoardState[rightPos] || currentBoardState[rightPos].side !== side) {
                            moves.push(rightPos);
                        }
                    }
                }
                break;
        }

        return moves;
    }

    // 格式化时间显示
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 更新计时器
    function updateTimer() {
        timeElapsed++;
        timerDisplay.textContent = formatTime(timeElapsed);
    }

    // 更新玩家倒计时
    function updatePlayerCountdown() {
        if (playerTime > 0) {
            playerTime--;
            playerTimeDisplay.textContent = formatTime(playerTime);
            
            // 时间少于30秒时显示红色警告
            if (playerTime <= 30) {
                playerTimeDisplay.style.color = '#ff0000';
            }
            
            // 时间用完
            if (playerTime === 0) {
                clearTimers();
                gameActive = false;
                aiScore++;
                aiScoreDisplay.textContent = aiScore;
                alert('时间用完！电脑获胜！');
            }
        }
    }

    // 更新AI倒计时
    function updateAiCountdown() {
        if (aiTime > 0) {
            aiTime--;
            aiTimeDisplay.textContent = formatTime(aiTime);
            
            // 时间少于30秒时显示红色警告
            if (aiTime <= 30) {
                aiTimeDisplay.style.color = '#ff0000';
            }
            
            // 时间用完
            if (aiTime === 0) {
                clearTimers();
                gameActive = false;
                playerScore++;
                playerScoreDisplay.textContent = playerScore;
                alert('电脑时间用完！你获胜了！');
            }
        }
    }

    // 清除所有计时器
    function clearTimers() {
        if (gameTimer) clearInterval(gameTimer);
        if (playerCountdownTimer) clearInterval(playerCountdownTimer);
        if (aiCountdownTimer) clearInterval(aiCountdownTimer);
    }

    // 切换活动计时器
    function switchActiveTimer() {
        if (playerTurn) {
            playerTimer.classList.add('active-timer');
            aiTimer.classList.remove('active-timer');
            
            // 暂停AI倒计时，启动玩家倒计时
            if (aiCountdownTimer) clearInterval(aiCountdownTimer);
            playerCountdownTimer = setInterval(updatePlayerCountdown, 1000);
        } else {
            aiTimer.classList.add('active-timer');
            playerTimer.classList.remove('active-timer');
            
            // 暂停玩家倒计时，启动AI倒计时
            if (playerCountdownTimer) clearInterval(playerCountdownTimer);
            aiCountdownTimer = setInterval(updateAiCountdown, 1000);
        }
    }

    // AI回合
    function aiTurn() {
        if (!gameActive || playerTurn) return;

        // 获取所有黑方棋子
        const blackPieces = Object.keys(currentBoardState)
            .filter(pos => currentBoardState[pos].side === 'black')
            .map(pos => ({
                position: pos,
                piece: currentBoardState[pos]
            }));

        // 简单AI策略：随机选择一个棋子和一个有效移动
        let validMoves = [];
        let selectedPiece = null;

        // 尝试找到有效移动的棋子
        while (validMoves.length === 0 && blackPieces.length > 0) {
            const randomIndex = Math.floor(Math.random() * blackPieces.length);
            selectedPiece = blackPieces[randomIndex];
            validMoves = calculateValidMoves(selectedPiece.position);
            
            // 如果没有有效移动，从列表中移除该棋子
            if (validMoves.length === 0) {
                blackPieces.splice(randomIndex, 1);
            }
        }

        if (validMoves.length > 0) {
            // 识别可以吃子的移动
            const captureMoves = validMoves.filter(move => currentBoardState[move]);
            
            // 优先吃将/帅
            const captureGeneral = captureMoves.find(move => 
                currentBoardState[move] && currentBoardState[move].type === 'general');
                
            // 其次优先吃其他子
            const otherCapture = captureMoves.length > 0 ? captureMoves[0] : null;
            
            // 决定最终移动
            const moveTarget = captureGeneral || otherCapture || validMoves[Math.floor(Math.random() * validMoves.length)];
            
            console.log(`AI moving from ${selectedPiece.position} to ${moveTarget}`);
            if (currentBoardState[moveTarget]) {
                console.log(`AI capturing: ${currentBoardState[moveTarget].text}`);
            }
            
            // 执行移动
            movePiece(selectedPiece.position, moveTarget);
        } else {
            console.log("AI has no valid moves!");
        }

        // 切换回合到玩家
        playerTurn = true;
        currentPlayerDisplay.textContent = '玩家';
        
        // 切换活动计时器
        switchActiveTimer();
    }

    // 开始游戏
    function startGame() {
        // 初始化棋盘
        initializeBoard();
        
        // 重置游戏状态
        gameActive = true;
        playerTurn = true;
        timeElapsed = 0;
        playerTime = 600; // 10分钟
        aiTime = 600; // 10分钟
        moveHistory = [];
        redCaptureCount = 0;
        blackCaptureCount = 0;
        capturedPieces = { red: [], black: [] };
        
        // 重置显示
        currentPlayerDisplay.textContent = '玩家';
        timerDisplay.textContent = formatTime(0);
        playerTimeDisplay.textContent = formatTime(playerTime);
        aiTimeDisplay.textContent = formatTime(aiTime);
        playerTimeDisplay.style.color = '';
        aiTimeDisplay.style.color = '';
        redCaptures.textContent = '0';
        blackCaptures.textContent = '0';
        moveList.innerHTML = '';
        
        // 设置活动计时器
        playerTimer.classList.add('active-timer');
        aiTimer.classList.remove('active-timer');
        
        // 清除旧计时器
        clearTimers();
        
        // 启动计时器
        gameTimer = setInterval(updateTimer, 1000);
        playerCountdownTimer = setInterval(updatePlayerCountdown, 1000);
    }

    // 重新开始游戏
    function resetGame() {
        // 清除计时器
        clearTimers();
        
        // 开始新游戏
        startGame();
    }

    // 添加按钮事件监听
    startBtn.addEventListener('click', startGame);
    resetBtn.addEventListener('click', resetGame);

    // 初始化游戏
    initializeBoard();
});