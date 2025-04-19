/**
 * 国际象棋AI模块 - 基于Stockfish引擎
 * 实现类似AlphaGo级别的AI对弈功能
 */
class ChessAI {
    constructor(depth = 15) {
        this.engine = null;
        this.depth = depth; // 搜索深度，越高AI越强
        this.isReady = false;
        this.moveReady = false;
        this.bestMove = null;
        this.thinking = false;
        this.initEngine();
    }

    // 初始化Stockfish引擎
    initEngine() {
        if (typeof Stockfish !== 'undefined') {
            console.log('正在加载Stockfish引擎...');
            this.engine = Stockfish();
            
            this.engine.onmessage = (event) => {
                this.processEngineMessage(event.data);
            };
            
            this.engine.postMessage('uci');
            this.engine.postMessage('isready');
        } else {
            console.error('Stockfish引擎无法加载！请确保已正确引入stockfish.js');
            this.simulateEngine(); // 如果无法加载真实引擎，则使用模拟引擎
        }
    }
    
    // 处理引擎消息
    processEngineMessage(message) {
        console.log('引擎消息:', message);
        
        if (message === 'readyok') {
            this.isReady = true;
            console.log('Stockfish引擎已准备就绪');
        } else if (message.startsWith('bestmove')) {
            const parts = message.split(' ');
            if (parts.length >= 2) {
                this.bestMove = this.parseEngineMove(parts[1]);
                this.moveReady = true;
                this.thinking = false;
            }
        }
    }
    
    // 从FEN表示法解析棋盘
    setBoardFromFEN(fen) {
        if (this.engine && this.isReady) {
            this.engine.postMessage('position fen ' + fen);
        }
    }
    
    // 从当前棋盘状态获取最佳走法
    getBestMove(board, currentPlayer, callback) {
        if (!this.engine || !this.isReady) {
            // 如果引擎未准备好，使用模拟的AI移动
            setTimeout(() => {
                const move = this.getSimulatedBestMove(board, currentPlayer);
                callback(move);
            }, 500);
            return;
        }
        
        // 转换棋盘为FEN表示法
        const fen = this.boardToFEN(board, currentPlayer);
        this.engine.postMessage('position fen ' + fen);
        
        // 设置思考时间和难度
        this.engine.postMessage('setoption name Skill Level value 20');
        this.moveReady = false;
        this.thinking = true;
        
        // 告诉引擎开始思考
        this.engine.postMessage(`go depth ${this.depth}`);
        
        // 等待引擎返回最佳移动
        const checkInterval = setInterval(() => {
            if (this.moveReady) {
                clearInterval(checkInterval);
                callback(this.bestMove);
            }
        }, 100);
    }
    
    // 将棋盘转换为FEN表示法
    boardToFEN(board, currentPlayer) {
        let fen = '';
        
        // 添加棋盘位置
        for (let row = 0; row < 8; row++) {
            let emptyCount = 0;
            
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                
                if (piece) {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    
                    let pieceChar = '';
                    switch (piece.type) {
                        case 'pawn': pieceChar = 'p'; break;
                        case 'rook': pieceChar = 'r'; break;
                        case 'knight': pieceChar = 'n'; break;
                        case 'bishop': pieceChar = 'b'; break;
                        case 'queen': pieceChar = 'q'; break;
                        case 'king': pieceChar = 'k'; break;
                    }
                    
                    if (piece.color === 'white') {
                        pieceChar = pieceChar.toUpperCase();
                    }
                    
                    fen += pieceChar;
                } else {
                    emptyCount++;
                }
            }
            
            if (emptyCount > 0) {
                fen += emptyCount;
            }
            
            if (row < 7) {
                fen += '/';
            }
        }
        
        // 添加轮到哪方走
        fen += ' ' + (currentPlayer === 'white' ? 'w' : 'b');
        
        // 简化处理：假设仍有王车易位权利和没有吃过路兵目标
        fen += ' KQkq - 0 1';
        
        return fen;
    }
    
    // 解析引擎返回的移动（从代数记号转换为行列坐标）
    parseEngineMove(move) {
        if (move.length < 4) return null;
        
        const fromCol = move.charCodeAt(0) - 'a'.charCodeAt(0);
        const fromRow = 8 - parseInt(move[1]);
        const toCol = move.charCodeAt(2) - 'a'.charCodeAt(0);
        const toRow = 8 - parseInt(move[3]);
        
        let promotionType = null;
        if (move.length > 4) {
            switch (move[4]) {
                case 'q': promotionType = 'queen'; break;
                case 'r': promotionType = 'rook'; break;
                case 'b': promotionType = 'bishop'; break;
                case 'n': promotionType = 'knight'; break;
            }
        }
        
        return {
            fromRow, fromCol, toRow, toCol, promotionType
        };
    }

    // 模拟引擎（当真实引擎无法加载时使用）
    simulateEngine() {
        console.log('使用模拟AI引擎...');
        this.isReady = true;
    }
    
    // 模拟的AI走法逻辑（简单版）
    getSimulatedBestMove(board, currentPlayer) {
        console.log("AI正在思考最佳移动...");
        
        // 1. 收集当前所有可行的移动
        const allMoves = [];
        
        // 首先为每个棋子获取有效移动
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece && piece.color === currentPlayer) {
                    // 获取这个棋子的所有合法移动
                    let validMoves = [];
                    
                    // 根据棋子类型决定移动
                    switch(piece.type) {
                        case 'pawn':
                            validMoves = this.getPawnMoves(board, row, col, piece);
                            break;
                        case 'rook':
                            validMoves = this.getSlidingMoves(board, row, col, piece, [
                                {row: -1, col: 0}, {row: 1, col: 0}, 
                                {row: 0, col: -1}, {row: 0, col: 1}
                            ]);
                            break;
                        case 'knight':
                            validMoves = this.getKnightMoves(board, row, col, piece);
                            break;
                        case 'bishop':
                            validMoves = this.getSlidingMoves(board, row, col, piece, [
                                {row: -1, col: -1}, {row: -1, col: 1}, 
                                {row: 1, col: -1}, {row: 1, col: 1}
                            ]);
                            break;
                        case 'queen':
                            validMoves = this.getSlidingMoves(board, row, col, piece, [
                                {row: -1, col: 0}, {row: 1, col: 0}, 
                                {row: 0, col: -1}, {row: 0, col: 1},
                                {row: -1, col: -1}, {row: -1, col: 1}, 
                                {row: 1, col: -1}, {row: 1, col: 1}
                            ]);
                            break;
                        case 'king':
                            validMoves = this.getKingMoves(board, row, col, piece);
                            break;
                    }
                    
                    // 评估每个移动的分数
                    validMoves.forEach(move => {
                        allMoves.push({
                            fromRow: row,
                            fromCol: col,
                            toRow: move.row,
                            toCol: move.col,
                            score: this.evaluateMove(board, row, col, move.row, move.col, piece)
                        });
                    });
                }
            }
        }
        
        console.log(`AI找到了${allMoves.length}个可能的移动`);
        
        // 2. 按评分排序并选择最佳移动
        if (allMoves.length === 0) {
            console.log("AI没有找到有效移动!");
            return null;
        }
        
        allMoves.sort((a, b) => b.score - a.score);
        
        // 3. 如果有多个最高分，随机选择一个（增加变化）
        const topScore = allMoves[0].score;
        const topMoves = allMoves.filter(move => move.score === topScore);
        const selectedMove = topMoves[Math.floor(Math.random() * topMoves.length)];
        
        console.log(`AI选择了移动: 从(${selectedMove.fromRow},${selectedMove.fromCol})到(${selectedMove.toRow},${selectedMove.toCol}), 评分:${selectedMove.score}`);
        
        return selectedMove;
    }
    
    // 获取兵的有效移动
    getPawnMoves(board, row, col, piece) {
        const moves = [];
        const direction = piece.color === 'white' ? -1 : 1;
        const startingRow = piece.color === 'white' ? 6 : 1;
        
        // 前进一格
        if (this.isInBounds(row + direction, col) && !board[row + direction][col]) {
            moves.push({ row: row + direction, col: col });
            
            // 第一次移动可以前进两格
            if (row === startingRow && !board[row + 2 * direction][col]) {
                moves.push({ row: row + 2 * direction, col: col });
            }
        }
        
        // 斜向吃子
        for (let colOffset of [-1, 1]) {
            const newRow = row + direction;
            const newCol = col + colOffset;
            
            if (this.isInBounds(newRow, newCol)) {
                const targetPiece = board[newRow][newCol];
                if (targetPiece && targetPiece.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
        
        return moves;
    }
    
    // 获取滑动棋子(车/象/后)的有效移动
    getSlidingMoves(board, row, col, piece, directions) {
        const moves = [];
        
        for (const dir of directions) {
            let newRow = row + dir.row;
            let newCol = col + dir.col;
            
            while (this.isInBounds(newRow, newCol)) {
                const targetPiece = board[newRow][newCol];
                
                if (!targetPiece) {
                    // 空格，可以移动
                    moves.push({ row: newRow, col: newCol });
                } else if (targetPiece.color !== piece.color) {
                    // 对方棋子，可以吃掉然后停止
                    moves.push({ row: newRow, col: newCol });
                    break;
                } else {
                    // 自己的棋子，不能移动，停止
                    break;
                }
                
                newRow += dir.row;
                newCol += dir.col;
            }
        }
        
        return moves;
    }
    
    // 获取马的有效移动
    getKnightMoves(board, row, col, piece) {
        const moves = [];
        const offsets = [
            {row: -2, col: -1}, {row: -2, col: 1},
            {row: -1, col: -2}, {row: -1, col: 2},
            {row: 1, col: -2}, {row: 1, col: 2},
            {row: 2, col: -1}, {row: 2, col: 1}
        ];
        
        for (const offset of offsets) {
            const newRow = row + offset.row;
            const newCol = col + offset.col;
            
            if (this.isInBounds(newRow, newCol)) {
                const targetPiece = board[newRow][newCol];
                if (!targetPiece || targetPiece.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
        
        return moves;
    }
    
    // 获取王的有效移动
    getKingMoves(board, row, col, piece) {
        const moves = [];
        const offsets = [
            {row: -1, col: -1}, {row: -1, col: 0}, {row: -1, col: 1},
            {row: 0, col: -1}, {row: 0, col: 1},
            {row: 1, col: -1}, {row: 1, col: 0}, {row: 1, col: 1}
        ];
        
        for (const offset of offsets) {
            const newRow = row + offset.row;
            const newCol = col + offset.col;
            
            if (this.isInBounds(newRow, newCol)) {
                const targetPiece = board[newRow][newCol];
                if (!targetPiece || targetPiece.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
        
        return moves;
    }
    
    // 检查坐标是否在棋盘范围内
    isInBounds(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }
    
    // 评估移动的分数（简化版）
    evaluateMove(board, fromRow, fromCol, toRow, toCol, piece) {
        let score = 0;
        
        // 基本分数：移动到中心位置更好
        const centerDistance = Math.abs(toRow - 3.5) + Math.abs(toCol - 3.5);
        score += (4 - centerDistance) * 10;
        
        // 如果可以吃子，加分
        const targetPiece = board[toRow][toCol];
        if (targetPiece) {
            // 根据被吃的棋子类型给分
            switch (targetPiece.type) {
                case 'pawn': score += 100; break;
                case 'knight': score += 300; break;
                case 'bishop': score += 300; break;
                case 'rook': score += 500; break;
                case 'queen': score += 900; break;
                case 'king': score += 10000; break; // 将军/将死情况
            }
        }
        
        // 给一些随机性，使AI行为不太可预测
        score += Math.random() * 10;
        
        return score;
    }
    
    // 设置AI强度
    setDifficulty(level) {
        // 级别范围1-5，对应不同深度
        switch(level) {
            case 1: this.depth = 5; break;   // 简单
            case 2: this.depth = 10; break;  // 中等
            case 3: this.depth = 15; break;  // 困难
            case 4: this.depth = 20; break;  // 专家
            case 5: this.depth = 25; break;  // 大师
            default: this.depth = 15;
        }
    }
} 