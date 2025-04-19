/**
 * 国际象棋引擎
 */
class Chess {
    constructor() {
        this.reset();
    }

    // 重置棋盘到初始状态
    reset() {
        // 棋盘表示：用一个8x8的二维数组
        this.board = [
            ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
            ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
        ];

        this.turn = 'w'; // 白方(w)先行，但同时下棋模式下此变量不再控制轮流
        this.history = []; // 移动历史
        this.capturedPieces = { w: [], b: [] }; // 被吃掉的棋子
        
        // 用于王车易位的状态
        this.castling = {
            w: { kingSide: true, queenSide: true },
            b: { kingSide: true, queenSide: true }
        };
        
        // 过路兵目标位置
        this.enPassantTarget = null;
        
        // 记录王的位置
        this.kings = {
            w: { row: 7, col: 4 },
            b: { row: 0, col: 4 }
        };
        
        // 50步规则计数器
        this.halfMoveClock = 0;
        
        // 完整移动计数
        this.fullMoveNumber = 1;
        
        // 游戏状态
        this.gameOver = false;
        this.checkmate = false;
        this.stalemate = false;
        this.draw = false;
        
        // 行动点数
        this.actionPoints = {
            w: 10, // 初始10点
            b: 10  // 初始10点
        };
        
        // 行动冷却时间（毫秒）
        this.lastMoveTime = {
            w: 0,
            b: 0
        };
        
        // 每个棋子移动消耗的点数
        this.moveCost = {
            'p': 1, // 兵：1点
            'n': 2, // 马：2点
            'b': 2, // 象：2点
            'r': 3, // 车：3点
            'q': 4, // 后：4点
            'k': 2  // 王：2点
        };
    }

    // 获取棋子颜色
    getPieceColor(piece) {
        if (!piece) return null;
        return (piece === piece.toUpperCase()) ? 'w' : 'b';
    }

    // 判断是否是合法位置
    isValidPosition(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    // 获取棋盘上特定位置的棋子
    getPiece(row, col) {
        if (this.isValidPosition(row, col)) {
            return this.board[row][col];
        }
        return null;
    }

    // 获取当前玩家
    getCurrentPlayer() {
        return this.turn;
    }

    // 切换玩家
    switchTurn() {
        this.turn = (this.turn === 'w') ? 'b' : 'w';
    }
    
    // 获取棋子移动消耗的点数
    getMoveCost(piece) {
        if (!piece) return 0;
        return this.moveCost[piece.toLowerCase()];
    }
    
    // 检查玩家是否有足够的行动点数
    hasEnoughActionPoints(pieceColor, piece) {
        const cost = this.getMoveCost(piece);
        return this.actionPoints[pieceColor] >= cost;
    }
    
    // 检查是否已经过了行动冷却时间
    isCooldownOver(pieceColor) {
        const now = Date.now();
        const cooldownTime = 500; // 0.5秒冷却时间
        return (now - this.lastMoveTime[pieceColor]) >= cooldownTime;
    }
    
    // 消耗行动点数
    consumeActionPoints(pieceColor, piece) {
        const cost = this.getMoveCost(piece);
        this.actionPoints[pieceColor] -= cost;
        
        // 更新最后行动时间
        this.lastMoveTime[pieceColor] = Date.now();
    }
    
    // 恢复行动点数（每秒1点，最多10点）
    regenerateActionPoints() {
        const colors = ['w', 'b'];
        for (const color of colors) {
            if (this.actionPoints[color] < 10) {
                this.actionPoints[color] = Math.min(10, this.actionPoints[color] + 1);
            }
        }
    }

    // 获取某个棋子所有可能的移动(不考虑将军检查)
    getMovesForPiece(row, col, includeCastling = true) {
        const piece = this.getPiece(row, col);
        if (!piece) return [];

        const pieceType = piece.toLowerCase();
        const pieceColor = this.getPieceColor(piece);
        const moves = [];

        switch (pieceType) {
            case 'p': // 兵
                this.getPawnMoves(row, col, pieceColor, moves);
                break;
            case 'r': // 车
                this.getRookMoves(row, col, pieceColor, moves);
                break;
            case 'n': // 马
                this.getKnightMoves(row, col, pieceColor, moves);
                break;
            case 'b': // 象
                this.getBishopMoves(row, col, pieceColor, moves);
                break;
            case 'q': // 后
                this.getQueenMoves(row, col, pieceColor, moves);
                break;
            case 'k': // 王
                this.getKingMoves(row, col, pieceColor, moves, includeCastling);
                break;
        }

        return moves;
    }

    // 获取兵的移动
    getPawnMoves(row, col, color, moves) {
        const direction = (color === 'w') ? -1 : 1;
        const startingRow = (color === 'w') ? 6 : 1;

        // 前进一步
        if (this.isValidPosition(row + direction, col) && !this.board[row + direction][col]) {
            moves.push({ row: row + direction, col: col });

            // 第一次移动可以前进两步
            if (row === startingRow && !this.board[row + 2 * direction][col]) {
                moves.push({ row: row + 2 * direction, col: col });
            }
        }

        // 吃子(左对角)
        if (this.isValidPosition(row + direction, col - 1)) {
            const targetPiece = this.board[row + direction][col - 1];
            if (targetPiece && this.getPieceColor(targetPiece) !== color) {
                moves.push({ row: row + direction, col: col - 1 });
            }

            // 过路兵
            if (this.enPassantTarget && 
                this.enPassantTarget.row === row + direction && 
                this.enPassantTarget.col === col - 1) {
                moves.push({ 
                    row: row + direction, 
                    col: col - 1,
                    isEnPassant: true,
                    capturedRow: row,
                    capturedCol: col - 1
                });
            }
        }

        // 吃子(右对角)
        if (this.isValidPosition(row + direction, col + 1)) {
            const targetPiece = this.board[row + direction][col + 1];
            if (targetPiece && this.getPieceColor(targetPiece) !== color) {
                moves.push({ row: row + direction, col: col + 1 });
            }

            // 过路兵
            if (this.enPassantTarget && 
                this.enPassantTarget.row === row + direction && 
                this.enPassantTarget.col === col + 1) {
                moves.push({ 
                    row: row + direction, 
                    col: col + 1,
                    isEnPassant: true,
                    capturedRow: row,
                    capturedCol: col + 1
                });
            }
        }
    }

    // 获取车的移动
    getRookMoves(row, col, color, moves) {
        // 水平方向
        this.getLineMoves(row, col, color, moves, 0, 1);
        this.getLineMoves(row, col, color, moves, 0, -1);
        
        // 垂直方向
        this.getLineMoves(row, col, color, moves, 1, 0);
        this.getLineMoves(row, col, color, moves, -1, 0);
    }

    // 获取象的移动
    getBishopMoves(row, col, color, moves) {
        // 对角线方向
        this.getLineMoves(row, col, color, moves, 1, 1);
        this.getLineMoves(row, col, color, moves, 1, -1);
        this.getLineMoves(row, col, color, moves, -1, 1);
        this.getLineMoves(row, col, color, moves, -1, -1);
    }

    // 获取后的移动
    getQueenMoves(row, col, color, moves) {
        // 水平+垂直+对角线方向(车+象的走法)
        this.getRookMoves(row, col, color, moves);
        this.getBishopMoves(row, col, color, moves);
    }

    // 获取马的移动
    getKnightMoves(row, col, color, moves) {
        const knightMoves = [
            { row: -2, col: -1 }, { row: -2, col: 1 },
            { row: -1, col: -2 }, { row: -1, col: 2 },
            { row: 1, col: -2 }, { row: 1, col: 2 },
            { row: 2, col: -1 }, { row: 2, col: 1 }
        ];

        for (const move of knightMoves) {
            const newRow = row + move.row;
            const newCol = col + move.col;

            if (this.isValidPosition(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                if (!targetPiece || this.getPieceColor(targetPiece) !== color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
    }

    // 获取王的移动
    getKingMoves(row, col, color, moves, includeCastling) {
        const kingMoves = [
            { row: -1, col: -1 }, { row: -1, col: 0 }, { row: -1, col: 1 },
            { row: 0, col: -1 }, { row: 0, col: 1 },
            { row: 1, col: -1 }, { row: 1, col: 0 }, { row: 1, col: 1 }
        ];

        for (const move of kingMoves) {
            const newRow = row + move.row;
            const newCol = col + move.col;

            if (this.isValidPosition(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                if (!targetPiece || this.getPieceColor(targetPiece) !== color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }

        // 王车易位
        if (includeCastling) {
            this.getCastlingMoves(row, col, color, moves);
        }
    }

    // 王车易位的移动
    getCastlingMoves(row, col, color, moves) {
        if (this.isInCheck(color)) return; // 被将军时不能易位
        
        const castlingRights = this.castling[color];
        const rookRow = (color === 'w') ? 7 : 0;
        
        // 王侧易位
        if (castlingRights.kingSide) {
            let canCastle = true;
            
            // 检查中间格子是否为空
            for (let c = col + 1; c < 7; c++) {
                if (this.board[rookRow][c]) {
                    canCastle = false;
                    break;
                }
            }
            
            // 检查王经过的格子是否被攻击
            if (canCastle) {
                for (let c = col; c <= col + 2; c++) {
                    // 模拟王走到该位置
                    const originalPiece = this.board[rookRow][c];
                    this.board[rookRow][c] = (color === 'w') ? 'K' : 'k';
                    
                    // 如果原来位置是王的位置，则清空
                    if (c === col) {
                        this.board[rookRow][col] = null;
                    }
                    
                    // 如果该位置会被将军，则不能易位
                    const inCheck = this.isSquareAttacked(rookRow, c, color);
                    
                    // 恢复棋盘
                    this.board[rookRow][c] = originalPiece;
                    if (c === col) {
                        this.board[rookRow][col] = (color === 'w') ? 'K' : 'k';
                    }
                    
                    if (inCheck) {
                        canCastle = false;
                        break;
                    }
                }
            }
            
            if (canCastle) {
                moves.push({ 
                    row: rookRow, 
                    col: col + 2, 
                    isCastling: true,
                    rookFromCol: 7,
                    rookToCol: col + 1
                });
            }
        }
        
        // 后侧易位
        if (castlingRights.queenSide) {
            let canCastle = true;
            
            // 检查中间格子是否为空
            for (let c = col - 1; c > 0; c--) {
                if (this.board[rookRow][c]) {
                    canCastle = false;
                    break;
                }
            }
            
            // 检查王经过的格子是否被攻击
            if (canCastle) {
                for (let c = col; c >= col - 2; c--) {
                    // 模拟王走到该位置
                    const originalPiece = this.board[rookRow][c];
                    this.board[rookRow][c] = (color === 'w') ? 'K' : 'k';
                    
                    // 如果原来位置是王的位置，则清空
                    if (c === col) {
                        this.board[rookRow][col] = null;
                    }
                    
                    // 如果该位置会被将军，则不能易位
                    const inCheck = this.isSquareAttacked(rookRow, c, color);
                    
                    // 恢复棋盘
                    this.board[rookRow][c] = originalPiece;
                    if (c === col) {
                        this.board[rookRow][col] = (color === 'w') ? 'K' : 'k';
                    }
                    
                    if (inCheck) {
                        canCastle = false;
                        break;
                    }
                }
            }
            
            if (canCastle) {
                moves.push({ 
                    row: rookRow, 
                    col: col - 2, 
                    isCastling: true,
                    rookFromCol: 0,
                    rookToCol: col - 1
                });
            }
        }
    }

    // 获取一条直线上的所有可能移动
    getLineMoves(row, col, color, moves, rowDirection, colDirection) {
        let newRow = row + rowDirection;
        let newCol = col + colDirection;

        while (this.isValidPosition(newRow, newCol)) {
            const targetPiece = this.board[newRow][newCol];
            
            if (!targetPiece) {
                // 空格，可以移动
                moves.push({ row: newRow, col: newCol });
            } else {
                // 有棋子
                if (this.getPieceColor(targetPiece) !== color) {
                    // 如果是敌方棋子，可以吃
                    moves.push({ row: newRow, col: newCol });
                }
                // 遇到任何棋子都停止
                break;
            }

            newRow += rowDirection;
            newCol += colDirection;
        }
    }

    // 判断是否将军
    isInCheck(color) {
        const king = this.kings[color];
        return this.isSquareAttacked(king.row, king.col, color);
    }

    // 判断一个格子是否被攻击
    isSquareAttacked(row, col, defendingColor) {
        const attackingColor = (defendingColor === 'w') ? 'b' : 'w';
        
        // 检查对方的所有棋子是否可以攻击到该格子
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.getPiece(r, c);
                if (piece && this.getPieceColor(piece) === attackingColor) {
                    const moves = this.getMovesForPiece(r, c, false);
                    for (const move of moves) {
                        if (move.row === row && move.col === col) {
                            return true;
                        }
                    }
                }
            }
        }
        
        return false;
    }

    // 获取考虑了将军检查的合法移动
    getLegalMovesForPiece(row, col) {
        const piece = this.getPiece(row, col);
        if (!piece) return [];

        const pieceColor = this.getPieceColor(piece);
        const allMoves = this.getMovesForPiece(row, col);
        const legalMoves = [];

        for (const move of allMoves) {
            // 模拟移动
            const result = this.makeMove(row, col, move.row, move.col, true);
            
            // 如果移动后不会导致己方被将军，则是合法移动
            if (!this.isInCheck(pieceColor)) {
                legalMoves.push(move);
            }
            
            // 恢复棋盘
            this.undoMove(result);
        }

        return legalMoves;
    }

    // 判断该走棋方是否无子可动
    isStalemate(color) {
        if (this.isInCheck(color)) return false;
        
        // 检查是否有合法移动
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                if (piece && this.getPieceColor(piece) === color) {
                    const moves = this.getLegalMovesForPiece(row, col);
                    if (moves.length > 0) {
                        return false;
                    }
                }
            }
        }
        
        return true;
    }

    // 判断是否将死
    isCheckmate(color) {
        if (!this.isInCheck(color)) return false;
        
        // 检查是否有合法移动来解除将军
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                if (piece && this.getPieceColor(piece) === color) {
                    const moves = this.getLegalMovesForPiece(row, col);
                    if (moves.length > 0) {
                        return false;
                    }
                }
            }
        }
        
        return true;
    }

    // 检查是否是绝杀局面(如两王对峙)
    isDeadPosition() {
        // 统计棋盘上的棋子
        const pieces = { w: {}, b: {} };
        let totalPieces = 0;
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                if (piece) {
                    const color = this.getPieceColor(piece);
                    const type = piece.toLowerCase();
                    
                    if (!pieces[color][type]) pieces[color][type] = 0;
                    pieces[color][type]++;
                    totalPieces++;
                }
            }
        }
        
        // 只剩两个王
        if (totalPieces === 2) return true;
        
        // 王和一个象或马对王
        if (totalPieces === 3 && (pieces['w']['b'] === 1 || pieces['w']['n'] === 1 ||
                                  pieces['b']['b'] === 1 || pieces['b']['n'] === 1)) {
            return true;
        }
        
        // 王和两个象(同色主教)对王
        if (totalPieces === 4 && pieces['w']['b'] === 2 && !pieces['w']['p'] && 
            !pieces['w']['r'] && !pieces['w']['q'] && !pieces['w']['n'] &&
            !pieces['b']['p'] && !pieces['b']['r'] && !pieces['b']['q'] && 
            !pieces['b']['n'] && !pieces['b']['b']) {
            return true;
        }
        
        if (totalPieces === 4 && pieces['b']['b'] === 2 && !pieces['b']['p'] && 
            !pieces['b']['r'] && !pieces['b']['q'] && !pieces['b']['n'] &&
            !pieces['w']['p'] && !pieces['w']['r'] && !pieces['w']['q'] && 
            !pieces['w']['n'] && !pieces['w']['b']) {
            return true;
        }
        
        return false;
    }

    // 检查是否50步规则触发
    isFiftyMoveRule() {
        return this.halfMoveClock >= 100; // 50步 = 100半步
    }

    // 检查是否三次重复局面
    isThreefoldRepetition() {
        // 简化版本 - 完整版本需要检查整个局面的历史
        return false;
    }

    // 执行一步移动（修改以支持行动点数和冷却时间）
    makeMove(fromRow, fromCol, toRow, toCol, isSimulation = false) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return null;
        
        const pieceColor = this.getPieceColor(piece);
        const pieceType = piece.toLowerCase();
        
        // 检查行动点数和冷却时间（仅在非模拟模式下）
        if (!isSimulation) {
            // 检查行动点数
            if (!this.hasEnoughActionPoints(pieceColor, piece)) {
                return { error: 'insufficient_points' };
            }
            
            // 检查冷却时间
            if (!this.isCooldownOver(pieceColor)) {
                return { error: 'cooldown' };
            }
        }
        
        // 存储当前状态用于撤销
        const moveResult = {
            piece: piece,
            fromRow: fromRow,
            fromCol: fromCol,
            toRow: toRow,
            toCol: toCol,
            capturedPiece: this.board[toRow][toCol],
            oldEnPassantTarget: this.enPassantTarget,
            oldCastling: JSON.parse(JSON.stringify(this.castling)),
            oldHalfMoveClock: this.halfMoveClock,
            isEnPassant: false,
            isCastling: false,
            isPromotion: false,
            promotedTo: null
        };
        
        // 检查是否是过路兵
        const isEnPassant = pieceType === 'p' && 
                            this.enPassantTarget && 
                            toRow === this.enPassantTarget.row && 
                            toCol === this.enPassantTarget.col;
        
        if (isEnPassant) {
            const capturedRow = fromRow;
            const capturedCol = toCol;
            moveResult.capturedPiece = this.board[capturedRow][capturedCol];
            moveResult.isEnPassant = true;
            moveResult.enPassantCapturedRow = capturedRow;
            moveResult.enPassantCapturedCol = capturedCol;
            
            // 移除被吃的兵
            this.board[capturedRow][capturedCol] = null;
        }
        
        // 50步规则计数器
        if (pieceType === 'p' || moveResult.capturedPiece) {
            this.halfMoveClock = 0;
        } else {
            this.halfMoveClock++;
        }
        
        // 重置过路兵目标
        this.enPassantTarget = null;
        
        // 兵前进两格时设置过路兵目标
        if (pieceType === 'p' && Math.abs(fromRow - toRow) === 2) {
            this.enPassantTarget = {
                row: (fromRow + toRow) / 2,
                col: fromCol
            };
        }
        
        // 王的移动更新状态
        if (pieceType === 'k') {
            this.kings[pieceColor] = { row: toRow, col: toCol };
            
            // 取消王车易位权
            this.castling[pieceColor].kingSide = false;
            this.castling[pieceColor].queenSide = false;
            
            // 检查是否是王车易位
            if (Math.abs(fromCol - toCol) === 2) {
                moveResult.isCastling = true;
                
                // 确定车的位置和移动
                const rookFromCol = (toCol > fromCol) ? 7 : 0;
                const rookToCol = (toCol > fromCol) ? fromCol + 1 : fromCol - 1;
                const rookPiece = this.board[fromRow][rookFromCol];
                
                moveResult.rookPiece = rookPiece;
                moveResult.rookFromRow = fromRow;
                moveResult.rookFromCol = rookFromCol;
                moveResult.rookToRow = fromRow;
                moveResult.rookToCol = rookToCol;
                
                // 移动车
                this.board[fromRow][rookToCol] = rookPiece;
                this.board[fromRow][rookFromCol] = null;
            }
        }
        
        // 车的移动更新王车易位状态
        if (pieceType === 'r') {
            if (fromRow === (pieceColor === 'w' ? 7 : 0)) {
                if (fromCol === 0) {
                    this.castling[pieceColor].queenSide = false;
                } else if (fromCol === 7) {
                    this.castling[pieceColor].kingSide = false;
                }
            }
        }
        
        // 如果吃掉对方的车，更新对方的王车易位权
        if (moveResult.capturedPiece) {
            const capturedType = moveResult.capturedPiece.toLowerCase();
            const capturedColor = this.getPieceColor(moveResult.capturedPiece);
            
            if (capturedType === 'r') {
                if (toRow === (capturedColor === 'w' ? 7 : 0)) {
                    if (toCol === 0) {
                        this.castling[capturedColor].queenSide = false;
                    } else if (toCol === 7) {
                        this.castling[capturedColor].kingSide = false;
                    }
                }
            }
            
            // 记录被吃棋子
            if (!isSimulation) {
                this.capturedPieces[pieceColor].push(moveResult.capturedPiece);
            }
            
            // 检查是否吃掉了国王
            if (capturedType === 'k') {
                this.gameOver = true;
                this.checkmate = true;
                moveResult.capturedKing = true;
            }
        }
        
        // 移动棋子
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        // 兵升变
        if (pieceType === 'p' && (toRow === 0 || toRow === 7)) {
            moveResult.isPromotion = true;
            
            // 在模拟时默认升变为后
            if (isSimulation) {
                const promotedPiece = (pieceColor === 'w') ? 'Q' : 'q';
                this.board[toRow][toCol] = promotedPiece;
                moveResult.promotedTo = promotedPiece;
            }
        }
        
        // 在非模拟模式下消耗行动点数
        if (!isSimulation) {
            this.consumeActionPoints(pieceColor, piece);
        }
        
        // 切换回合
        if (!isSimulation) {
            if (pieceColor === 'b') {
                this.fullMoveNumber++;
            }
            
            // 不再切换玩家回合，因为现在是同时下棋
            // this.switchTurn();
            
            // 更新游戏状态
            this.updateGameState();
        }
        
        return moveResult;
    }
    
    // 撤销一步移动
    undoMove(moveResult) {
        if (!moveResult) return false;
        
        const { piece, fromRow, fromCol, toRow, toCol, capturedPiece } = moveResult;
        
        // 恢复棋子位置
        this.board[fromRow][fromCol] = piece;
        this.board[toRow][toCol] = capturedPiece;
        
        // 恢复过路兵状态
        if (moveResult.isEnPassant) {
            this.board[moveResult.enPassantCapturedRow][moveResult.enPassantCapturedCol] = capturedPiece;
            this.board[toRow][toCol] = null;
        }
        
        // 恢复王车易位状态
        if (moveResult.isCastling) {
            this.board[moveResult.rookFromRow][moveResult.rookFromCol] = moveResult.rookPiece;
            this.board[moveResult.rookToRow][moveResult.rookToCol] = null;
        }
        
        // 恢复兵升变状态
        if (moveResult.isPromotion) {
            this.board[fromRow][fromCol] = piece;
        }
        
        // 恢复王的位置
        if (piece.toLowerCase() === 'k') {
            const pieceColor = this.getPieceColor(piece);
            this.kings[pieceColor] = { row: fromRow, col: fromCol };
        }
        
        // 恢复过路兵目标
        this.enPassantTarget = moveResult.oldEnPassantTarget;
        
        // 恢复王车易位权
        this.castling = moveResult.oldCastling;
        
        // 恢复50步规则计数器
        this.halfMoveClock = moveResult.oldHalfMoveClock;
        
        return true;
    }
    
    // 执行兵的升变
    promotePawn(row, col, promoteTo) {
        if (!this.isValidPosition(row, col)) return false;
        
        const piece = this.board[row][col];
        if (!piece || piece.toLowerCase() !== 'p') return false;
        
        const pieceColor = this.getPieceColor(piece);
        
        // 检查是否在升变行
        if ((pieceColor === 'w' && row !== 0) || (pieceColor === 'b' && row !== 7)) {
            return false;
        }
        
        // 升变为指定的棋子类型
        const validPromotions = ['q', 'r', 'b', 'n'];
        const promotionType = promoteTo.toLowerCase();
        
        if (!validPromotions.includes(promotionType)) {
            return false;
        }
        
        // 设置升变后的棋子
        this.board[row][col] = pieceColor === 'w' ? promotionType.toUpperCase() : promotionType;
        
        // 更新游戏状态
        this.updateGameState();
        
        return true;
    }
    
    // 获取所有可移动的棋子
    getMovablePieces() {
        const currentPlayer = this.getCurrentPlayer();
        const movablePieces = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                if (piece && this.getPieceColor(piece) === currentPlayer) {
                    const legalMoves = this.getLegalMovesForPiece(row, col);
                    if (legalMoves.length > 0) {
                        movablePieces.push({ row, col, piece, moves: legalMoves });
                    }
                }
            }
        }
        
        return movablePieces;
    }
    
    // 更新游戏状态
    updateGameState() {
        const currentPlayer = this.getCurrentPlayer();
        
        // 检查是否将死
        if (this.isCheckmate(currentPlayer)) {
            this.gameOver = true;
            this.checkmate = true;
            return;
        }
        
        // 检查是否逼和
        if (this.isStalemate(currentPlayer)) {
            this.gameOver = true;
            this.stalemate = true;
            return;
        }
        
        // 检查是否死局
        if (this.isDeadPosition()) {
            this.gameOver = true;
            this.draw = true;
            return;
        }
        
        // 检查50步规则
        if (this.isFiftyMoveRule()) {
            this.gameOver = true;
            this.draw = true;
            return;
        }
        
        // 检查三次重复局面
        if (this.isThreefoldRepetition()) {
            this.gameOver = true;
            this.draw = true;
            return;
        }
    }
    
    // 获取游戏状态信息
    getGameStatus() {
        if (this.checkmate) {
            const winner = (this.turn === 'w') ? 'b' : 'w';
            return { gameOver: true, result: 'checkmate', winner: winner };
        }
        
        if (this.stalemate) {
            return { gameOver: true, result: 'stalemate', winner: null };
        }
        
        if (this.draw) {
            return { gameOver: true, result: 'draw', winner: null };
        }
        
        const inCheck = this.isInCheck(this.turn);
        return { 
            gameOver: false, 
            turn: this.turn, 
            inCheck: inCheck,
            canCastleKingSide: this.castling[this.turn].kingSide,
            canCastleQueenSide: this.castling[this.turn].queenSide
        };
    }
    
    // 将位置转换为代数记号
    positionToAlgebraic(row, col) {
        const files = 'abcdefgh';
        const ranks = '87654321';
        return files[col] + ranks[row];
    }
    
    // 将代数记号转换为位置
    algebraicToPosition(algebraic) {
        const files = 'abcdefgh';
        const ranks = '87654321';
        
        const col = files.indexOf(algebraic[0]);
        const row = ranks.indexOf(algebraic[1]);
        
        return { row, col };
    }
    
    // 获取移动的代数记号描述
    getMoveNotation(moveResult) {
        if (!moveResult) return '';
        
        const { piece, fromRow, fromCol, toRow, toCol } = moveResult;
        const pieceType = piece.toLowerCase();
        
        // 王车易位
        if (moveResult.isCastling) {
            return (toCol > fromCol) ? 'O-O' : 'O-O-O';
        }
        
        let notation = '';
        
        // 棋子类型(除了兵)
        if (pieceType !== 'p') {
            notation += pieceType.toUpperCase();
        }
        
        // 起始位置
        notation += this.positionToAlgebraic(fromRow, fromCol);
        
        // 吃子标记
        if (moveResult.capturedPiece || moveResult.isEnPassant) {
            notation += 'x';
        } else {
            notation += '-';
        }
        
        // 目标位置
        notation += this.positionToAlgebraic(toRow, toCol);
        
        // 升变
        if (moveResult.isPromotion) {
            notation += '=' + moveResult.promotedTo.toUpperCase();
        }
        
        // 将军或将杀
        const nextTurn = this.getPieceColor(piece) === 'w' ? 'b' : 'w';
        if (this.isCheckmate(nextTurn)) {
            notation += '#';
        } else if (this.isInCheck(nextTurn)) {
            notation += '+';
        }
        
        return notation;
    }
}

/**
 * 国际象棋AI引擎
 */
class ChessAI {
    constructor(chess, difficulty = 'medium') {
        this.chess = chess;
        this.setDifficulty(difficulty);
        
        // 棋子价值表
        this.pieceValues = {
            'p': 100,
            'n': 320,
            'b': 330,
            'r': 500,
            'q': 900,
            'k': 20000
        };
        
        // 棋子位置评估表
        this.piecePositionValues = {
            'p': [
                [0,  0,  0,  0,  0,  0,  0,  0],
                [50, 50, 50, 50, 50, 50, 50, 50],
                [10, 10, 20, 30, 30, 20, 10, 10],
                [5,  5, 10, 25, 25, 10,  5,  5],
                [0,  0,  0, 20, 20,  0,  0,  0],
                [5, -5,-10,  0,  0,-10, -5,  5],
                [5, 10, 10,-20,-20, 10, 10,  5],
                [0,  0,  0,  0,  0,   0,  0,  0]
            ],
            'n': [
                [-50,-40,-30,-30,-30,-30,-40,-50],
                [-40,-20,  0,  0,  0,  0,-20,-40],
                [-30,  0, 10, 15, 15, 10,  0,-30],
                [-30,  5, 15, 20, 20, 15,  5,-30],
                [-30,  0, 15, 20, 20, 15,  0,-30],
                [-30,  5, 10, 15, 15, 10,  5,-30],
                [-40,-20,  0,  5,  5,  0,-20,-40],
                [-50,-40,-30,-30,-30,-30,-40,-50]
            ],
            'b': [
                [-20,-10,-10,-10,-10,-10,-10,-20],
                [-10,  0,  0,  0,  0,  0,  0,-10],
                [-10,  0, 10, 10, 10, 10,  0,-10],
                [-10,  5,  5, 10, 10,  5,  5,-10],
                [-10,  0,  5, 10, 10,  5,  0,-10],
                [-10,  5,  5,  5,  5,  5,  5,-10],
                [-10,  0,  5,  0,  0,  5,  0,-10],
                [-20,-10,-10,-10,-10,-10,-10,-20]
            ],
            'r': [
                [0,  0,  0,  0,  0,  0,  0,  0],
                [5, 10, 10, 10, 10, 10, 10,  5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [-5,  0,  0,  0,  0,  0,  0, -5],
                [0,  0,  0,  5,  5,  0,  0,  0]
            ],
            'q': [
                [-20,-10,-10, -5, -5,-10,-10,-20],
                [-10,  0,  0,  0,  0,  0,  0,-10],
                [-10,  0,  5,  5,  5,  5,  0,-10],
                [-5,  0,  5,  5,  5,  5,  0, -5],
                [0,  0,  5,  5,  5,  5,  0, -5],
                [-10,  5,  5,  5,  5,  5,  0,-10],
                [-10,  0,  5,  0,  0,  0,  0,-10],
                [-20,-10,-10, -5, -5,-10,-10,-20]
            ],
            'k': [
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-20,-30,-30,-40,-40,-30,-30,-20],
                [-10,-20,-20,-20,-20,-20,-20,-10],
                [20, 20,  0,  0,  0,  0, 20, 20],
                [20, 30, 10,  0,  0, 10, 30, 20]
            ],
            'k_endgame': [
                [-50,-40,-30,-20,-20,-30,-40,-50],
                [-30,-20,-10,  0,  0,-10,-20,-30],
                [-30,-10, 20, 30, 30, 20,-10,-30],
                [-30,-10, 30, 40, 40, 30,-10,-30],
                [-30,-10, 30, 40, 40, 30,-10,-30],
                [-30,-10, 20, 30, 30, 20,-10,-30],
                [-30,-30,  0,  0,  0,  0,-30,-30],
                [-50,-30,-30,-30,-30,-30,-30,-50]
            ]
        };
    }
    
    // 设置AI难度
    setDifficulty(difficulty) {
        switch(difficulty) {
            case 'easy':
                this.searchDepth = 2;
                this.randomFactor = 0.3;
                break;
            case 'medium':
                this.searchDepth = 2;
                this.randomFactor = 0.1;
                break;
            case 'hard':
                this.searchDepth = 3;
                this.randomFactor = 0;
                break;
            default:
                this.searchDepth = 2;
                this.randomFactor = 0.1;
        }
    }
    
    // 获取电脑的最佳移动
    getBestMove() {
        let bestMove = null;
        let bestScore = -Infinity;
        
        // 获取黑方可移动的棋子（这里假设AI总是黑方）
        const movablePieces = this.getAllMovablePieces('b');
        
        // 没有可移动的棋子
        if (movablePieces.length === 0) {
            return null;
        }
        
        // 随机排序以增加多样性
        this.shuffleArray(movablePieces);
        
        // 检查当前行动点数
        const currentActionPoints = this.chess.actionPoints['b'];
        
        // 筛选出当前点数可以移动的棋子
        const affordablePieces = movablePieces.filter(pieceInfo => {
            const piece = this.chess.getPiece(pieceInfo.row, pieceInfo.col);
            const cost = this.chess.getMoveCost(piece);
            return cost <= currentActionPoints;
        });
        
        // 如果没有可以消费得起的棋子，返回null
        if (affordablePieces.length === 0) {
            return null;
        }
        
        // 优先考虑能吃掉对方国王的移动
        for (const pieceInfo of affordablePieces) {
            const { row, col, moves } = pieceInfo;
            
            for (const move of moves) {
                const targetPiece = this.chess.getPiece(move.row, move.col);
                
                // 如果可以吃掉对方国王，立即选择这个移动
                if (targetPiece === 'K') {
                    return { from: { row, col }, to: move, promotion: 'q' };
                }
            }
        }
        
        // 按照棋子消耗的点数排序，优先使用低点数的棋子
        affordablePieces.sort((a, b) => {
            const pieceA = this.chess.getPiece(a.row, a.col);
            const pieceB = this.chess.getPiece(b.row, b.col);
            return this.chess.getMoveCost(pieceA) - this.chess.getMoveCost(pieceB);
        });
        
        // 随机选择前几个可用棋子中的一个来降低计算量
        const selectedPieces = affordablePieces.slice(0, Math.min(3, affordablePieces.length));
        
        for (const pieceInfo of selectedPieces) {
            const { row, col, moves } = pieceInfo;
            
            for (const move of moves) {
                // 模拟移动
                const moveResult = this.chess.makeMove(row, col, move.row, move.col, true);
                
                // 兵升变默认为后
                if (moveResult.isPromotion) {
                    this.chess.board[move.row][move.col] = 'q';
                }
                
                // 计算分数
                const score = this.minimax(this.searchDepth - 1, -Infinity, Infinity, true);
                
                // 撤销移动
                this.chess.undoMove(moveResult);
                
                // 添加随机因素
                const adjustedScore = score + (Math.random() * 2 - 1) * this.randomFactor * 100;
                
                // 更新最佳移动
                if (adjustedScore > bestScore) {
                    bestScore = adjustedScore;
                    bestMove = { from: { row, col }, to: move, promotion: 'q' };
                }
            }
        }
        
        return bestMove;
    }
    
    // Minimax算法带Alpha-Beta剪枝
    minimax(depth, alpha, beta, isMaximizing) {
        // 到达搜索深度或游戏结束
        if (depth === 0 || this.chess.gameOver) {
            return this.evaluateBoard();
        }
        
        // 在同时下棋模式下，我们仍然需要模拟回合制
        // isMaximizing表示当前是白方（最大化评分）还是黑方（最小化评分）
        const currentPlayer = isMaximizing ? 'w' : 'b';
        const movablePieces = this.getAllMovablePieces(currentPlayer);
        
        // 如果没有可移动的棋子，提前返回评分
        if (movablePieces.length === 0) {
            return this.evaluateBoard();
        }
        
        if (isMaximizing) {
            let maxScore = -Infinity;
            
            for (const pieceInfo of movablePieces) {
                const { row, col, moves } = pieceInfo;
                
                for (const move of moves) {
                    // 模拟移动
                    const moveResult = this.chess.makeMove(row, col, move.row, move.col, true);
                    
                    // 兵升变默认为后
                    if (moveResult.isPromotion) {
                        this.chess.board[move.row][move.col] = 'Q';
                    }
                    
                    // 递归评估
                    const score = this.minimax(depth - 1, alpha, beta, false);
                    
                    // 撤销移动
                    this.chess.undoMove(moveResult);
                    
                    maxScore = Math.max(maxScore, score);
                    alpha = Math.max(alpha, score);
                    
                    if (beta <= alpha) {
                        break; // Beta剪枝
                    }
                }
                
                if (beta <= alpha) {
                    break; // Beta剪枝
                }
            }
            
            return maxScore;
        } else {
            let minScore = Infinity;
            
            for (const pieceInfo of movablePieces) {
                const { row, col, moves } = pieceInfo;
                
                for (const move of moves) {
                    // 模拟移动
                    const moveResult = this.chess.makeMove(row, col, move.row, move.col, true);
                    
                    // 兵升变默认为后
                    if (moveResult.isPromotion) {
                        this.chess.board[move.row][move.col] = 'q';
                    }
                    
                    // 递归评估
                    const score = this.minimax(depth - 1, alpha, beta, true);
                    
                    // 撤销移动
                    this.chess.undoMove(moveResult);
                    
                    minScore = Math.min(minScore, score);
                    beta = Math.min(beta, score);
                    
                    if (beta <= alpha) {
                        break; // Alpha剪枝
                    }
                }
                
                if (beta <= alpha) {
                    break; // Alpha剪枝
                }
            }
            
            return minScore;
        }
    }
    
    // 获取指定颜色的所有可移动棋子
    getAllMovablePieces(color) {
        const movablePieces = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.chess.getPiece(row, col);
                if (piece && this.chess.getPieceColor(piece) === color) {
                    const legalMoves = this.chess.getLegalMovesForPiece(row, col);
                    if (legalMoves.length > 0) {
                        movablePieces.push({ row, col, piece, moves: legalMoves });
                    }
                }
            }
        }
        
        return movablePieces;
    }
    
    // 评估当前棋盘状态
    evaluateBoard() {
        // 如果国王被吃掉，立即返回极值
        const whiteKingExists = this.chess.board.flat().some(piece => piece === 'K');
        const blackKingExists = this.chess.board.flat().some(piece => piece === 'k');
        
        if (!whiteKingExists) return -20000;
        if (!blackKingExists) return 20000;
        
        if (this.chess.checkmate) {
            // 如果是将死，返回极值
            return this.chess.turn === 'w' ? -10000 : 10000;
        }
        
        if (this.chess.stalemate || this.chess.draw) {
            // 如果是和棋，返回0
            return 0;
        }
        
        let score = 0;
        
        // 计算所有棋子的总价值和位置价值
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.chess.board[row][col];
                if (piece) {
                    const pieceType = piece.toLowerCase();
                    const pieceColor = this.chess.getPieceColor(piece);
                    
                    // 棋子基础价值
                    const value = this.pieceValues[pieceType];
                    
                    // 棋子位置价值(白方从下方看，黑方从上方看)
                    let positionValue = 0;
                    
                    if (pieceType === 'k' && this.isEndgame()) {
                        // 残局中的王使用不同的位置评估表
                        positionValue = pieceColor === 'w' ? 
                            this.piecePositionValues['k_endgame'][row][col] : 
                            this.piecePositionValues['k_endgame'][7-row][col];
                    } else {
                        positionValue = pieceColor === 'w' ? 
                            this.piecePositionValues[pieceType][row][col] : 
                            this.piecePositionValues[pieceType][7-row][col];
                    }
                    
                    // 累加分数
                    score += (pieceColor === 'w') ? (value + positionValue) : -(value + positionValue);
                }
            }
        }
        
        // 机动性评估(可移动的棋子数量)
        const whiteMovable = this.getAllMovablePieces('w').length;
        const blackMovable = this.getAllMovablePieces('b').length;
        score += (whiteMovable - blackMovable) * 10;
        
        // 检查威胁
        if (this.chess.isInCheck('w')) {
            score -= 50;
        }
        if (this.chess.isInCheck('b')) {
            score += 50;
        }
        
        // 行动点数差异
        const actionPointsDiff = this.chess.actionPoints['w'] - this.chess.actionPoints['b'];
        score += actionPointsDiff * 5; // 行动点数差异的权重
        
        return score;
    }
    
    // 判断是否是残局
    isEndgame() {
        // 当一方的主力棋子(车后)数量少于3个时，视为残局
        let majorPiecesWhite = 0;
        let majorPiecesBlack = 0;
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.chess.board[row][col];
                if (piece) {
                    const pieceType = piece.toLowerCase();
                    const pieceColor = this.chess.getPieceColor(piece);
                    
                    if (pieceType === 'q' || pieceType === 'r') {
                        if (pieceColor === 'w') {
                            majorPiecesWhite++;
                        } else {
                            majorPiecesBlack++;
                        }
                    }
                }
            }
        }
        
        return majorPiecesWhite < 3 || majorPiecesBlack < 3;
    }
    
    // 随机打乱数组顺序
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
} 