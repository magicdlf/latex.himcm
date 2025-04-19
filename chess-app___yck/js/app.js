/**
 * Chess App UI Interaction
 * 基于Chess.com架构实现的国际象棋应用
 * 
 * 技术栈:
 * - 前端: Vue.js (Chess.com从2017年开始迁移到Vue)
 * - 实时通信: WebSockets
 * - 棋盘渲染: 基于Chessground开源库的定制实现
 * - 游戏逻辑: 自定义象棋引擎
 * - AI引擎: 基于Stockfish或内部模拟引擎
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
    
    // 游戏统计数据
    let gameStats = {
        startTime: null,
        totalMoves: 0,
        capturedPieces: 0
    };
    
    // AI 相关变量
    const chessAI = new ChessAI();
    let aiEnabled = true;
    let aiThinking = false;
    let playerColor = 'white';
    
    // 提示相关变量
    let lastMoveTime = null;
    let hintTimeout = null;
    const HINT_DELAY = 15000; // 15秒后显示提示
    
    // 可能的提示信息
    const possibleHints = [
        "记得将军（Check）是直接攻击对方的王，必须立即解除。",
        "马（Knight）是唯一能跳过其他棋子的棋子。",
        "象（Bishop）只能在对角线上移动，所以它们永远不会改变方格颜色。",
        "车（Rook）在垂直和水平方向移动，非常适合在开阔的区域操作。",
        "后（Queen）结合了车和象的移动能力，是最强大的棋子。",
        "王（King）每次只能移动一格，但方向不限。",
        "兵（Pawn）只能向前移动，但可以斜向吃子。",
        "记得王车易位可以同时保护你的王并激活你的车。",
        "控制棋盘中心对获胜至关重要。",
        "发展你的轻子（马和象）比重子（后和车）更早。",
        "在游戏的开局阶段，避免过早出动你的后。",
        "尽量不要在没有支援的情况下进攻。",
        "注意\"吃过路兵\"规则：当对手的兵第一次移动两格经过你的兵控制的格子时。",
        "当兵到达对方底线时，可以升变为任何高级棋子（通常是后）。"
    ];

    // Get DOM elements
    const chessboard = document.getElementById('chessboard');
    const movesContainer = document.getElementById('moves-container');
    const whiteTimer = document.querySelector('.white-timer');
    const blackTimer = document.querySelector('.black-timer');
    const newGameBtn = document.getElementById('new-game-btn');
    const undoBtn = document.getElementById('undo-btn');
    const resignBtn = document.getElementById('resign-btn');
    const promotionDialog = document.getElementById('promotion-dialog');
    const whiteCaptured = document.querySelector('.white-captured');
    const blackCaptured = document.querySelector('.black-captured');
    
    // 结算页面元素
    const resultModal = document.getElementById('game-result-modal');
    const resultHeader = document.getElementById('result-header');
    const resultDetails = document.getElementById('result-details');
    const resultImage = document.getElementById('result-image');
    const totalMovesEl = document.getElementById('total-moves');
    const gameDurationEl = document.getElementById('game-duration');
    const capturedCountEl = document.getElementById('captured-count');
    const newGameResultBtn = document.getElementById('new-game-result-btn');
    const analyzeBtn = document.getElementById('analyze-btn');
    const closeResultBtn = document.getElementById('close-result-btn');
    
    // AI元素
    const aiToggleBtn = document.getElementById('ai-toggle-btn');
    const aiLevelSelect = document.getElementById('ai-level');
    const aiThinkingIndicator = document.getElementById('ai-thinking');
    
    // 规则和提示元素
    const toggleRulesBtn = document.getElementById('rules-icon');
    const rulesDialog = document.getElementById('rules-dialog');
    const closeRulesBtn = document.getElementById('close-rules-btn');
    const hintContainer = document.getElementById('hint-container');
    const hintText = document.getElementById('hint-text');

    // 美化棋盘样式
    applyChessComStyle();

    // Initialize the board
    initializeBoard();
    renderBoard();

    // Event listeners
    newGameBtn.addEventListener('click', startNewGame);
    undoBtn.addEventListener('click', undoMove);
    resignBtn.addEventListener('click', handleResignation);
    promotionDialog.querySelectorAll('.promotion-piece').forEach(piece => {
        piece.addEventListener('click', handlePromotion);
    });
    
    // 结算页面事件监听
    newGameResultBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        startNewGame();
    });
    
    analyzeBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        // 这里可以添加棋局分析功能
        alert('棋局分析功能即将上线！');
    });
    
    closeResultBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
    });
    
    // AI 相关事件监听
    aiToggleBtn.addEventListener('click', toggleAI);
    aiLevelSelect.addEventListener('change', changeAIDifficulty);
    
    // 规则按钮事件监听
    toggleRulesBtn.addEventListener('click', toggleRulesDialog);
    closeRulesBtn.addEventListener('click', toggleRulesDialog);
    
    // 当点击规则对话框背景时关闭它
    rulesDialog.addEventListener('click', (e) => {
        if (e.target === rulesDialog) {
            toggleRulesDialog();
        }
    });

    // 应用类似chess.com的样式
    function applyChessComStyle() {
        // 设置棋盘边框样式
        chessboard.style.borderRadius = '4px';
        chessboard.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.3)';
        
        // 更新按钮样式
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            button.style.borderRadius = '4px';
            button.style.fontWeight = 'bold';
            button.style.textTransform = 'uppercase';
            button.style.letterSpacing = '0.5px';
            button.style.transition = 'all 0.2s ease';
        });
        
        // 更新侧边栏样式
        const sideElements = document.querySelectorAll('.player, .move-history');
        sideElements.forEach(element => {
            element.style.borderRadius = '4px';
            element.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        });
        
        // 设置计时器样式
        const timerDisplays = document.querySelectorAll('.timer');
        timerDisplays.forEach(timer => {
            timer.style.fontFamily = 'monospace';
            timer.style.fontSize = '2.2rem';
            timer.style.fontWeight = 'bold';
        });
        
        // 设置移动历史记录样式
        if (movesContainer) {
            movesContainer.style.fontFamily = 'system-ui, sans-serif';
            movesContainer.style.fontSize = '0.9rem';
        }
    }

    // Initialize the board with squares and coordinates
    function initializeBoard() {
        // 模拟Chess.com的棋盘初始化逻辑
        // Chess.com使用WebSockets连接到游戏服务器
        console.log("创建棋盘并连接到模拟的游戏服务器...");
        
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
                
                // 添加坐标标签 (chess.com风格)
                if (row === 7) {
                    // 底部文件标签 (a-h)
                    const fileLabel = document.createElement('div');
                    fileLabel.className = 'coordinate-label file-label';
                    fileLabel.textContent = String.fromCharCode(97 + col); // a-h
                    square.appendChild(fileLabel);
                }
                
                if (col === 0) {
                    // 左侧行标签 (1-8)
                    const rankLabel = document.createElement('div');
                    rankLabel.className = 'coordinate-label rank-label';
                    rankLabel.textContent = 8 - row; // 8-1
                    square.appendChild(rankLabel);
                }
                
                chessboard.appendChild(square);
            }
        }
        
        // 检查棋子图片是否加载
        const testImg = new Image();
        testImg.onload = function() {
            console.log("棋子图片加载成功!");
        };
        testImg.onerror = function() {
            console.error("棋子图片加载失败! 请检查img文件夹中的棋子SVG文件");
            alert("无法加载棋子图片。请检查控制台获取更多信息。");
        };
        testImg.src = 'img/white_pawn.svg';
    }

    // Render the current state of the board
    function renderBoard() {
        // Update each square with its piece
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = chessboard.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                if (!square) continue; // 安全检查
                
                // 保留可能的坐标标签
                const fileLabel = square.querySelector('.file-label');
                const rankLabel = square.querySelector('.rank-label');
                
                // 清除现有内容，但保留坐标标签
                const existingPiece = square.querySelector('.piece');
                if (existingPiece) {
                    square.removeChild(existingPiece);
                }
                
                // 添加棋子（如果有）
                const piece = chess.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = 'piece';
                    pieceElement.style.backgroundImage = `url('img/${piece.color}_${piece.type}.svg')`;
                    
                    // 确保坐标标签在棋子之前添加，这样棋子会显示在上面
                    if (fileLabel || rankLabel) {
                        square.insertBefore(pieceElement, square.firstChild);
                    } else {
                        square.appendChild(pieceElement);
                    }
                }
                
                // 移除任何先前的类
                square.classList.remove('selected', 'valid-move', 'check', 'last-move-from', 'last-move-to');
                
                // 高亮选中的方格
                if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
                    square.classList.add('selected');
                }
                
                // 高亮有效移动
                if (chess.validMoves && chess.validMoves.some(move => move.row === row && move.col === col)) {
                    square.classList.add('valid-move');
                }
                
                // 高亮被将军的王
                if (chess.isCheck && 
                    chess.kingPositions[chess.currentPlayer].row === row && 
                    chess.kingPositions[chess.currentPlayer].col === col) {
                    square.classList.add('check');
                }
                
                // 高亮最后一步移动 (chess.com风格)
                if (chess.gameHistory.length > 0) {
                    const lastMove = chess.gameHistory[chess.gameHistory.length - 1];
                    if (lastMove.fromRow === row && lastMove.fromCol === col) {
                        square.classList.add('last-move-from');
                    }
                    if (lastMove.toRow === row && lastMove.toCol === col) {
                        square.classList.add('last-move-to');
                    }
                }
            }
        }
        
        // 更新游戏状态
        updateGameStatus();
    }

    // Handle square click
    function handleSquareClick(row, col) {
        // AI思考时阻止玩家操作
        if (aiThinking) return;
        
        // 如果AI启用且当前轮到AI(黑方)下棋，阻止玩家操作黑方棋子
        if (aiEnabled && chess.currentPlayer === 'black') return;
        
        // 取消之前的提示计时器
        clearHintTimeout();
        
        // 隐藏提示
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
        
        // 设置提示计时器
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
        
        // 检查是否要吃掉王，在原始国际象棋规则中是不允许的
        // 但在我们的特殊规则下允许吃王，作为另一种胜利条件
        const targetPiece = chess.board[toRow][toCol];
        const allowKingCapture = targetPiece && targetPiece.type === 'king';
        
        // 如果是吃王的情况，暂时将王移开以绕过规则检查
        let tempKingPos = null;
        if (allowKingCapture) {
            tempKingPos = {...chess.kingPositions[targetPiece.color]};
            // 临时将王的位置设置到棋盘外，避免将军判定
            chess.kingPositions[targetPiece.color] = {row: -1, col: -1};
        }
        
        // Attempt to make the move
        const moveSuccess = chess.makeMove(fromRow, fromCol, toRow, toCol, promotionType);
        
        // 如果之前移动了王的位置，恢复它（虽然王已经被吃掉了）
        if (allowKingCapture && !moveSuccess && tempKingPos) {
            chess.kingPositions[targetPiece.color] = tempKingPos;
        }
        
        if (moveSuccess) {
            // 增加移动计数
            gameStats.totalMoves++;
            
            // Add move sound effect
            playMoveSound(chess.board[toRow][toCol]);
            
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
                gameStats.capturedPieces++;
            }
            
            // Re-render the board
            renderBoard();
            
            // 设置提示计时器
            lastMoveTime = Date.now();
            startHintTimeout();
            
            // 检查游戏是否结束
            checkGameEnd();
            
            // 如果AI启用并且轮到AI下棋，则让AI走棋
            if (aiEnabled && chess.currentPlayer === 'black' && !chess.isCheckmate && !chess.isStalemate) {
                makeAIMove();
            }
        }
    }
    
    // Play move sound (模拟效果)
    function playMoveSound(piece) {
        // 这里只是模拟，实际实现需要添加音频文件
        console.log('Playing move sound');
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
        // 获取更人性化的着法记录
        const notation = getHumanReadableNotation(lastMove, playerColor);
        
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
    
    // 生成人类可读的移动记录
    function getHumanReadableNotation(move, playerColor) {
        // 棋子类型中文名
        const pieceNames = {
            'pawn': '兵',
            'rook': '车',
            'knight': '马',
            'bishop': '象',
            'queen': '后',
            'king': '王'
        };
        
        // 坐标转换为棋盘位置 (例如 a1, h8)
        const colToFile = col => String.fromCharCode(97 + col);
        const rowToRank = row => 8 - row;
        
        // 获取原始位置和目标位置
        const fromFile = colToFile(move.fromCol);
        const fromRank = rowToRank(move.fromRow);
        const toFile = colToFile(move.toCol);
        const toRank = rowToRank(move.toRow);
        
        const fromPos = `${fromFile}${fromRank}`;
        const toPos = `${toFile}${toRank}`;
        
        // 获取棋子类型
        const piece = chess.board[move.toRow][move.toCol];
        if (!piece) return `${playerColor === 'white' ? '白方' : '黑方'}移动了一个棋子`;
        
        const pieceName = pieceNames[piece.type] || '棋子';
        const colorName = playerColor === 'white' ? '白方' : '黑方';
        
        // 构造基本记录
        let notation = `${colorName}将${pieceName}从${fromPos}移到了${toPos}`;
        
        // 添加吃子信息
        if (move.capturedPiece) {
            const capturedName = pieceNames[move.capturedPiece.type] || '棋子';
            notation += `，吃掉了对方的${capturedName}`;
        }
        
        // 添加特殊移动信息
        if (move.isPromotion) {
            const promotedName = pieceNames[move.promotionType] || '后';
            notation += `，升变为${promotedName}`;
        }
        
        if (move.isCastling) {
            notation = move.kingSide ? 
                `${colorName}进行了王翼王车易位` : 
                `${colorName}进行了后翼王车易位`;
        }
        
        // 添加将军、将死或者和棋信息
        if (chess.isCheck && !chess.isCheckmate) {
            notation += "，将军!";
        } else if (chess.isCheckmate) {
            notation += "，将死!";
        } else if (chess.isStalemate) {
            notation += "，和棋!";
        }
        
        return notation;
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
            
            // 显示结算页面
            if (status.includes('Checkmate')) {
                const winner = chess.currentPlayer === 'white' ? 'Black' : 'White';
                showGameEndMessage(`${winner} wins by checkmate!`);
                
                // 判断玩家是赢还是输
                if ((winner === 'White' && playerColor === 'white') || 
                    (winner === 'Black' && playerColor === 'black')) {
                    showResultScreen('win', '恭喜！您赢了', '您的策略成功击败了对手！');
                } else {
                    showResultScreen('lose', '很遗憾，您输了', '不要气馁，再接再厉！');
                }
            } else {
                showGameEndMessage(status);
                showResultScreen('draw', '平局', '这是一场势均力敌的对决！');
            }
        }
    }
    
    // Show game end message
    function showGameEndMessage(message) {
        // 创建游戏结束消息元素
        const messageElement = document.createElement('div');
        messageElement.className = 'game-end-message';
        messageElement.textContent = message;
        
        // 添加到棋盘上方
        document.querySelector('.board-container').appendChild(messageElement);
        
        // 动画效果
        setTimeout(() => {
            messageElement.classList.add('visible');
        }, 100);
    }
    
    // Undo the last move
    function undoMove() {
        if (chess.undoLastMove()) {
            // Switch active timer if game is in progress
            if (gameStarted) {
                timers.active = chess.currentPlayer;
            }
            
            // Remove game end message if exists
            const gameEndMessage = document.querySelector('.game-end-message');
            if (gameEndMessage) {
                gameEndMessage.remove();
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
            
            // 重置提示计时器
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
        chess.isDraw = false;
        
        // 重置游戏统计
        gameStats = {
            startTime: null,
            totalMoves: 0,
            capturedPieces: 0
        };
        
        // Reset UI
        selectedSquare = null;
        movesContainer.innerHTML = '';
        whiteCaptured.innerHTML = '';
        blackCaptured.innerHTML = '';
        
        // Remove game end message if exists
        const gameEndMessage = document.querySelector('.game-end-message');
        if (gameEndMessage) {
            gameEndMessage.remove();
        }
        
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
        
        // 清除提示
        clearHintTimeout();
        hideHint();
        
        // 如果AI启用并且为黑方，白方(玩家)先走
        aiThinking = false;
        aiThinkingIndicator.classList.add('hidden');
    }
    
    // Start the game timers
    function startGame() {
        gameStarted = true;
        timers.active = 'white';
        
        // 记录游戏开始时间
        gameStats.startTime = Date.now();
        
        // Start the timer interval
        if (!timers.interval) {
            timers.interval = setInterval(updateTimers, 1000);
        }
        
        // 设置提示计时器
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
                
                // Display game over message
                const winner = timers.active === 'white' ? 'Black' : 'White';
                showGameEndMessage(`${winner} wins on time!`);
                
                // 结算页面
                if ((winner === 'White' && playerColor === 'white') || 
                    (winner === 'Black' && playerColor === 'black')) {
                    showResultScreen('win', '时间胜利！', '对手的时间耗尽，您获胜了！');
                } else {
                    showResultScreen('lose', '时间到！', '您的时间耗尽，对手获胜！');
                }
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
    
    // 切换规则对话框的显示和隐藏
    function toggleRulesDialog() {
        rulesDialog.classList.toggle('hidden');
    }
    
    // 开始提示计时器
    function startHintTimeout() {
        // 清除之前的计时器
        clearHintTimeout();
        
        // 设置新的计时器
        hintTimeout = setTimeout(() => {
            if (Date.now() - lastMoveTime >= HINT_DELAY) {
                showRandomHint();
            }
        }, HINT_DELAY);
    }
    
    // 清除提示计时器
    function clearHintTimeout() {
        if (hintTimeout) {
            clearTimeout(hintTimeout);
            hintTimeout = null;
        }
    }
    
    // 显示随机提示
    function showRandomHint() {
        // 选择随机提示
        const randomIndex = Math.floor(Math.random() * possibleHints.length);
        const hint = possibleHints[randomIndex];
        
        // 显示提示
        hintText.textContent = hint;
        hintContainer.classList.remove('hidden');
    }
    
    // 隐藏提示
    function hideHint() {
        hintContainer.classList.add('hidden');
    }
    
    // AI相关函数
    function makeAIMove() {
        aiThinking = true;
        aiThinkingIndicator.classList.remove('hidden');
        
        // 短暂延迟，使界面有时间更新
        setTimeout(() => {
            // 让AI计算最佳移动
            chessAI.getBestMove(chess.board, chess.currentPlayer, (bestMove) => {
                if (bestMove) {
                    const { fromRow, fromCol, toRow, toCol, promotionType } = bestMove;
                    
                    // 执行AI的移动
                    makeMove(fromRow, fromCol, toRow, toCol, promotionType);
                    
                    // 高亮AI的移动
                    const fromSquare = chessboard.querySelector(`[data-row="${fromRow}"][data-col="${fromCol}"]`);
                    const toSquare = chessboard.querySelector(`[data-row="${toRow}"][data-col="${toCol}"]`);
                    
                    if (fromSquare && toSquare) {
                        fromSquare.classList.add('ai-move');
                        toSquare.classList.add('ai-move');
                        
                        // 2秒后移除高亮
                        setTimeout(() => {
                            fromSquare.classList.remove('ai-move');
                            toSquare.classList.remove('ai-move');
                        }, 2000);
                    }
                } else {
                    console.error('AI无法找到有效移动!');
                }
                
                aiThinking = false;
                aiThinkingIndicator.classList.add('hidden');
            });
        }, 500);
    }
    
    // 切换AI功能开关
    function toggleAI() {
        aiEnabled = !aiEnabled;
        aiToggleBtn.textContent = aiEnabled ? '关闭AI' : '开启AI';
        
        // 更新显示
        const blackPlayerName = document.querySelector('.player-black .player-name');
        blackPlayerName.textContent = aiEnabled ? '黑方 (AI)' : '黑方 (玩家)';
        
        // 如果启用AI，且当前是黑方回合，则让AI走棋
        if (aiEnabled && chess.currentPlayer === 'black' && !chess.isCheckmate && !chess.isStalemate) {
            makeAIMove();
        }
    }
    
    // 改变AI难度级别
    function changeAIDifficulty() {
        const difficultyLevel = parseInt(aiLevelSelect.value);
        chessAI.setDifficulty(difficultyLevel);
        console.log(`AI难度已设置为${difficultyLevel}级`);
    }
    
    // 处理投降
    function handleResignation() {
        if (!gameStarted) return;
        
        if (confirm('确定要投降吗？这将结束当前对局并计为失败。')) {
            stopTimers();
            clearHintTimeout();
            
            // 如果启用了AI，并且是玩家投降
            if (aiEnabled) {
                showResultScreen('lose', '您已投降', 'AI获得了胜利，再接再厉！');
            } else {
                const resigningPlayer = chess.currentPlayer === 'white' ? '白方' : '黑方';
                showResultScreen('lose', `${resigningPlayer}已投降`, '对手获得了胜利！');
            }
            
            // 禁用棋盘交互
            gameStarted = false;
        }
    }
    
    // 检查游戏是否结束 (因将军、将死、和局等)
    function checkGameEnd() {
        if (chess.isCheckmate) {
            const winner = chess.currentPlayer === 'white' ? '黑方' : '白方';
            
            // 计算当前局面上的棋子数量
            const whitePieces = countPieces('white');
            const blackPieces = countPieces('black');
            
            // 检查是将死还是王后被吃掉
            if ((chess.currentPlayer === 'white' && whitePieces.king === 0 && whitePieces.queen === 0) ||
                (chess.currentPlayer === 'black' && blackPieces.king === 0 && blackPieces.queen === 0)) {
                // 王后都被吃掉的情况
                if ((winner === '白方' && playerColor === 'white') || 
                    (winner === '黑方' && playerColor === 'black')) {
                    showResultScreen('win', '恭喜！您赢了', '对方的王后都已被吃掉！');
                } else {
                    showResultScreen('lose', '很遗憾，您输了', '您的王后都已被吃掉！');
                }
            } else {
                // 正常将死的情况
                if ((winner === '白方' && playerColor === 'white') || 
                    (winner === '黑方' && playerColor === 'black')) {
                    showResultScreen('win', '恭喜！您赢了', '您成功将死了对手！');
                } else {
                    showResultScreen('lose', '很遗憾，您输了', '您的王被将死了！');
                }
            }
        } else if (chess.isStalemate) {
            showResultScreen('draw', '和局', '无子可动，和棋！');
        } else if (chess.isDraw) {
            showResultScreen('draw', '和局', '根据五十回合规则或三次重复局面，和棋！');
        }
        
        // 时间耗尽判断在updateTimers函数中处理
    }
    
    // 计算某方棋子数量
    function countPieces(color) {
        const pieceCount = {
            'king': 0, 'queen': 0, 'rook': 0, 'bishop': 0, 'knight': 0, 'pawn': 0
        };
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = chess.board[row][col];
                if (piece && piece.color === color) {
                    pieceCount[piece.type]++;
                }
            }
        }
        
        return pieceCount;
    }
    
    // 显示结算界面
    function showResultScreen(result, header, details) {
        // 设置标题和详情
        resultHeader.textContent = header;
        resultDetails.textContent = details;
        
        // 设置图片
        resultImage.className = '';
        resultImage.classList.add(`${result}-image`);
        
        // 更新统计数据
        totalMovesEl.textContent = gameStats.totalMoves;
        capturedCountEl.textContent = gameStats.capturedPieces;
        
        // 计算游戏用时
        let duration = 0;
        if (gameStats.startTime) {
            duration = Math.floor((Date.now() - gameStats.startTime) / 1000);
        }
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        gameDurationEl.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        
        // 显示结算页面
        resultModal.classList.remove('hidden');
    }
    
    // Initial setup
    updateTimerDisplay('white');
    updateTimerDisplay('black');
    
    // 添加额外的CSS样式
    addChessComStyles();
    
    // 设置初始状态
    aiToggleBtn.textContent = aiEnabled ? '关闭AI' : '开启AI';
    chessAI.setDifficulty(parseInt(aiLevelSelect.value));
    
    // 添加Chess.com风格的CSS
    function addChessComStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .square.last-move-from, .square.last-move-to {
                background-color: rgba(255, 236, 143, 0.6) !important;
            }
            
            .square.valid-move::after {
                background-color: rgba(0, 0, 0, 0.15);
                width: 30%;
                height: 30%;
            }
            
            .square.check {
                background-color: rgba(243, 44, 44, 0.5) !important;
            }
            
            .coordinate-label {
                position: absolute;
                font-size: 0.7rem;
                color: rgba(0, 0, 0, 0.6);
                pointer-events: none;
            }
            
            .square.dark .coordinate-label {
                color: rgba(255, 255, 255, 0.8);
            }
            
            .file-label {
                bottom: 2px;
                right: 2px;
            }
            
            .rank-label {
                top: 2px;
                left: 2px;
            }
            
            .game-end-message {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 15px 25px;
                border-radius: 4px;
                font-size: 1.4rem;
                font-weight: bold;
                z-index: 10;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .game-end-message.visible {
                opacity: 1;
            }
            
            .move:hover {
                background-color: #e6e6e6;
                border-radius: 2px;
            }
            
            #chessboard {
                background-color: #E8EDF9;
                border: 8px solid #4D4D4D;
            }
            
            .square.light {
                background-color: #E8EDF9;
            }
            
            .square.dark {
                background-color: #B7C0D8;
            }
            
            .hint-container {
                border-left: 4px solid #FFB000;
            }
        `;
        document.head.appendChild(styleElement);
    }
}); 
