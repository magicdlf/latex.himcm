/**
 * Chess game logic implementation
 */
class Chess {
    constructor() {
        this.board = this.createNewBoard();
        this.currentPlayer = 'white';
        this.gameHistory = [];
        this.selectedPiece = null;
        this.validMoves = [];
        this.kingPositions = {
            white: { row: 7, col: 4 },
            black: { row: 0, col: 4 }
        };
        this.castlingRights = {
            white: { kingSide: true, queenSide: true },
            black: { kingSide: true, queenSide: true }
        };
        this.enPassantTarget = null;
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
        this.isCheck = false;
        this.isCheckmate = false;
        this.isStalemate = false;
        this.isDraw = false;
        this.positionHistory = {};
    }

    createNewBoard() {
        const board = Array(8).fill().map(() => Array(8).fill(null));
        
        // Place pawns
        for (let col = 0; col < 8; col++) {
            board[1][col] = { type: 'pawn', color: 'black', hasMoved: false };
            board[6][col] = { type: 'pawn', color: 'white', hasMoved: false };
        }
        
        // Place other pieces
        const backRow = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
        for (let col = 0; col < 8; col++) {
            board[0][col] = { type: backRow[col], color: 'black', hasMoved: false };
            board[7][col] = { type: backRow[col], color: 'white', hasMoved: false };
        }
        
        return board;
    }

    getValidMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece || piece.color !== this.currentPlayer) return [];
        
        let moves = [];
        
        switch (piece.type) {
            case 'pawn':
                moves = this.getPawnMoves(row, col, piece);
                break;
            case 'rook':
                moves = this.getRookMoves(row, col, piece);
                break;
            case 'knight':
                moves = this.getKnightMoves(row, col, piece);
                break;
            case 'bishop':
                moves = this.getBishopMoves(row, col, piece);
                break;
            case 'queen':
                moves = this.getQueenMoves(row, col, piece);
                break;
            case 'king':
                moves = this.getKingMoves(row, col, piece);
                break;
        }
        
        // Filter out moves that would leave the king in check
        return moves.filter(move => !this.wouldBeInCheck(row, col, move.row, move.col));
    }
    
    getPawnMoves(row, col, piece) {
        const moves = [];
        const direction = piece.color === 'white' ? -1 : 1;
        const startingRow = piece.color === 'white' ? 6 : 1;
        
        // Forward move
        if (this.isInBounds(row + direction, col) && !this.board[row + direction][col]) {
            moves.push({ row: row + direction, col: col });
            
            // Double forward move from starting position
            if (row === startingRow && !this.board[row + 2 * direction][col]) {
                moves.push({ row: row + 2 * direction, col: col, enPassantTarget: { row: row + direction, col: col } });
            }
        }
        
        // Captures
        const captureDirections = [{ row: direction, col: -1 }, { row: direction, col: 1 }];
        for (const dir of captureDirections) {
            const newRow = row + dir.row;
            const newCol = col + dir.col;
            
            if (this.isInBounds(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                
                // Regular capture
                if (targetPiece && targetPiece.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
                
                // En passant capture
                if (!targetPiece && this.enPassantTarget && 
                    newRow === this.enPassantTarget.row && 
                    newCol === this.enPassantTarget.col) {
                    moves.push({ 
                        row: newRow, 
                        col: newCol,
                        isEnPassant: true,
                        captureRow: row,
                        captureCol: newCol
                    });
                }
            }
        }
        
        return moves;
    }
    
    getRookMoves(row, col, piece) {
        const directions = [
            { row: -1, col: 0 }, // up
            { row: 1, col: 0 },  // down
            { row: 0, col: -1 }, // left
            { row: 0, col: 1 }   // right
        ];
        
        return this.getSlidingMoves(row, col, piece, directions);
    }
    
    getKnightMoves(row, col, piece) {
        const offsets = [
            { row: -2, col: -1 }, { row: -2, col: 1 },
            { row: -1, col: -2 }, { row: -1, col: 2 },
            { row: 1, col: -2 }, { row: 1, col: 2 },
            { row: 2, col: -1 }, { row: 2, col: 1 }
        ];
        
        const moves = [];
        
        for (const offset of offsets) {
            const newRow = row + offset.row;
            const newCol = col + offset.col;
            
            if (this.isInBounds(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                if (!targetPiece || targetPiece.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
        
        return moves;
    }
    
    getBishopMoves(row, col, piece) {
        const directions = [
            { row: -1, col: -1 }, // up-left
            { row: -1, col: 1 },  // up-right
            { row: 1, col: -1 },  // down-left
            { row: 1, col: 1 }    // down-right
        ];
        
        return this.getSlidingMoves(row, col, piece, directions);
    }
    
    getQueenMoves(row, col, piece) {
        // Queen moves combine rook and bishop moves
        const rookMoves = this.getRookMoves(row, col, piece);
        const bishopMoves = this.getBishopMoves(row, col, piece);
        return [...rookMoves, ...bishopMoves];
    }
    
    getKingMoves(row, col, piece) {
        const directions = [
            { row: -1, col: -1 }, { row: -1, col: 0 }, { row: -1, col: 1 },
            { row: 0, col: -1 }, { row: 0, col: 1 },
            { row: 1, col: -1 }, { row: 1, col: 0 }, { row: 1, col: 1 }
        ];
        
        const moves = [];
        
        // Regular king moves
        for (const dir of directions) {
            const newRow = row + dir.row;
            const newCol = col + dir.col;
            
            if (this.isInBounds(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                if (!targetPiece || targetPiece.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
        
        // Castling moves
        if (!piece.hasMoved && !this.isCheck) {
            const castlingRights = this.castlingRights[piece.color];
            
            // King-side castling
            if (castlingRights.kingSide) {
                const rookCol = 7;
                const rookPiece = this.board[row][rookCol];
                
                if (rookPiece && rookPiece.type === 'rook' && !rookPiece.hasMoved) {
                    let canCastle = true;
                    
                    // Check if squares between king and rook are empty
                    for (let c = col + 1; c < rookCol; c++) {
                        if (this.board[row][c]) {
                            canCastle = false;
                            break;
                        }
                    }
                    
                    // Check if king passes through check during castling
                    if (canCastle) {
                        canCastle = !this.isSquareAttacked(row, col + 1, piece.color) && 
                                    !this.isSquareAttacked(row, col + 2, piece.color);
                    }
                    
                    if (canCastle) {
                        moves.push({ 
                            row: row, 
                            col: col + 2, 
                            isCastling: true,
                            rookFromRow: row,
                            rookFromCol: rookCol,
                            rookToRow: row,
                            rookToCol: col + 1
                        });
                    }
                }
            }
            
            // Queen-side castling
            if (castlingRights.queenSide) {
                const rookCol = 0;
                const rookPiece = this.board[row][rookCol];
                
                if (rookPiece && rookPiece.type === 'rook' && !rookPiece.hasMoved) {
                    let canCastle = true;
                    
                    // Check if squares between king and rook are empty
                    for (let c = col - 1; c > rookCol; c--) {
                        if (this.board[row][c]) {
                            canCastle = false;
                            break;
                        }
                    }
                    
                    // Check if king passes through check during castling
                    if (canCastle) {
                        canCastle = !this.isSquareAttacked(row, col - 1, piece.color) && 
                                    !this.isSquareAttacked(row, col - 2, piece.color);
                    }
                    
                    if (canCastle) {
                        moves.push({ 
                            row: row, 
                            col: col - 2, 
                            isCastling: true,
                            rookFromRow: row,
                            rookFromCol: rookCol,
                            rookToRow: row,
                            rookToCol: col - 1
                        });
                    }
                }
            }
        }
        
        return moves;
    }
    
    getSlidingMoves(row, col, piece, directions) {
        const moves = [];
        
        for (const dir of directions) {
            let newRow = row + dir.row;
            let newCol = col + dir.col;
            
            while (this.isInBounds(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                
                if (!targetPiece) {
                    // Empty square
                    moves.push({ row: newRow, col: newCol });
                } else {
                    // If piece is opponent's, can capture it
                    if (targetPiece.color !== piece.color) {
                        moves.push({ row: newRow, col: newCol });
                    }
                    break; // Stop in this direction after hitting a piece
                }
                
                newRow += dir.row;
                newCol += dir.col;
            }
        }
        
        return moves;
    }
    
    isInBounds(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }
    
    wouldBeInCheck(fromRow, fromCol, toRow, toCol) {
        // Create a temporary board to simulate the move
        const tempBoard = JSON.parse(JSON.stringify(this.board));
        const piece = tempBoard[fromRow][fromCol];
        
        // Update king position if the king is being moved
        let kingPos = { ...this.kingPositions[this.currentPlayer] };
        if (piece.type === 'king') {
            kingPos = { row: toRow, col: toCol };
        }
        
        // Simulate the move
        tempBoard[toRow][toCol] = piece;
        tempBoard[fromRow][fromCol] = null;
        
        // Check if the king would be in check after the move
        return this.isSquareAttacked(kingPos.row, kingPos.col, this.currentPlayer, tempBoard);
    }
    
    isSquareAttacked(row, col, color, board = this.board) {
        const opponentColor = color === 'white' ? 'black' : 'white';
        
        // Check pawn attacks
        const pawnDirection = color === 'white' ? 1 : -1;
        const pawnAttackCols = [col - 1, col + 1];
        
        for (const attackCol of pawnAttackCols) {
            const attackRow = row + pawnDirection;
            
            if (this.isInBounds(attackRow, attackCol)) {
                const attackingPiece = board[attackRow][attackCol];
                if (attackingPiece && 
                    attackingPiece.type === 'pawn' && 
                    attackingPiece.color === opponentColor) {
                    return true;
                }
            }
        }
        
        // Check knight attacks
        const knightOffsets = [
            { row: -2, col: -1 }, { row: -2, col: 1 },
            { row: -1, col: -2 }, { row: -1, col: 2 },
            { row: 1, col: -2 }, { row: 1, col: 2 },
            { row: 2, col: -1 }, { row: 2, col: 1 }
        ];
        
        for (const offset of knightOffsets) {
            const attackRow = row + offset.row;
            const attackCol = col + offset.col;
            
            if (this.isInBounds(attackRow, attackCol)) {
                const attackingPiece = board[attackRow][attackCol];
                if (attackingPiece && 
                    attackingPiece.type === 'knight' && 
                    attackingPiece.color === opponentColor) {
                    return true;
                }
            }
        }
        
        // Check sliding piece attacks (bishop, rook, queen)
        const bishopDirections = [
            { row: -1, col: -1 }, { row: -1, col: 1 },
            { row: 1, col: -1 }, { row: 1, col: 1 }
        ];
        
        const rookDirections = [
            { row: -1, col: 0 }, { row: 1, col: 0 },
            { row: 0, col: -1 }, { row: 0, col: 1 }
        ];
        
        // Check bishop and queen attacks (diagonal)
        for (const dir of bishopDirections) {
            let attackRow = row + dir.row;
            let attackCol = col + dir.col;
            
            while (this.isInBounds(attackRow, attackCol)) {
                const attackingPiece = board[attackRow][attackCol];
                
                if (attackingPiece) {
                    if (attackingPiece.color === opponentColor && 
                        (attackingPiece.type === 'bishop' || attackingPiece.type === 'queen')) {
                        return true;
                    }
                    break; // Stop in this direction after hitting a piece
                }
                
                attackRow += dir.row;
                attackCol += dir.col;
            }
        }
        
        // Check rook and queen attacks (orthogonal)
        for (const dir of rookDirections) {
            let attackRow = row + dir.row;
            let attackCol = col + dir.col;
            
            while (this.isInBounds(attackRow, attackCol)) {
                const attackingPiece = board[attackRow][attackCol];
                
                if (attackingPiece) {
                    if (attackingPiece.color === opponentColor && 
                        (attackingPiece.type === 'rook' || attackingPiece.type === 'queen')) {
                        return true;
                    }
                    break; // Stop in this direction after hitting a piece
                }
                
                attackRow += dir.row;
                attackCol += dir.col;
            }
        }
        
        // Check king attacks
        const kingOffsets = [
            { row: -1, col: -1 }, { row: -1, col: 0 }, { row: -1, col: 1 },
            { row: 0, col: -1 }, { row: 0, col: 1 },
            { row: 1, col: -1 }, { row: 1, col: 0 }, { row: 1, col: 1 }
        ];
        
        for (const offset of kingOffsets) {
            const attackRow = row + offset.row;
            const attackCol = col + offset.col;
            
            if (this.isInBounds(attackRow, attackCol)) {
                const attackingPiece = board[attackRow][attackCol];
                if (attackingPiece && 
                    attackingPiece.type === 'king' && 
                    attackingPiece.color === opponentColor) {
                    return true;
                }
            }
        }
        
        // If we made it here, the square is not under attack
        return false;
    }
    
    makeMove(fromRow, fromCol, toRow, toCol, promotionType = null) {
        const piece = this.board[fromRow][fromCol];
        if (!piece || piece.color !== this.currentPlayer) return false;
        
        // Get valid moves for the selected piece
        const validMoves = this.getValidMoves(fromRow, fromCol);
        
        // Find if the target square is in the valid moves
        const moveInfo = validMoves.find(move => move.row === toRow && move.col === toCol);
        if (!moveInfo) return false;
        
        // Store the move information for history
        const historyEntry = {
            piece: { ...piece },
            fromRow,
            fromCol,
            toRow,
            toCol,
            capturedPiece: this.board[toRow][toCol] ? { ...this.board[toRow][toCol] } : null,
            enPassantTarget: this.enPassantTarget,
            castlingRights: JSON.parse(JSON.stringify(this.castlingRights)),
            halfMoveClock: this.halfMoveClock,
            fullMoveNumber: this.fullMoveNumber,
            isEnPassant: moveInfo.isEnPassant,
            isCastling: moveInfo.isCastling,
            isPromotion: false
        };
        
        // Reset en passant target for the next move
        const newEnPassantTarget = moveInfo.enPassantTarget || null;
        
        // Update half-move clock (reset on pawn move or capture)
        if (piece.type === 'pawn' || this.board[toRow][toCol]) {
            this.halfMoveClock = 0;
        } else {
            this.halfMoveClock++;
        }
        
        // Handle castling
        if (moveInfo.isCastling) {
            // Move the rook
            this.board[moveInfo.rookToRow][moveInfo.rookToCol] = this.board[moveInfo.rookFromRow][moveInfo.rookFromCol];
            this.board[moveInfo.rookFromRow][moveInfo.rookFromCol] = null;
            this.board[moveInfo.rookToRow][moveInfo.rookToCol].hasMoved = true;
        }
        
        // Handle en passant capture
        if (moveInfo.isEnPassant) {
            historyEntry.enPassantCapturedPiece = { ...this.board[moveInfo.captureRow][moveInfo.captureCol] };
            this.board[moveInfo.captureRow][moveInfo.captureCol] = null;
        }
        
        // Move the piece
        this.board[toRow][toCol] = { ...piece, hasMoved: true };
        this.board[fromRow][fromCol] = null;
        
        // Handle pawn promotion
        if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
            if (promotionType && ['queen', 'rook', 'bishop', 'knight'].includes(promotionType)) {
                this.board[toRow][toCol].type = promotionType;
                historyEntry.isPromotion = true;
                historyEntry.promotionType = promotionType;
            } else {
                // If no promotion type provided but promotion is required, default to queen
                this.board[toRow][toCol].type = 'queen';
                historyEntry.isPromotion = true;
                historyEntry.promotionType = 'queen';
            }
        }
        
        // Update king position if the king moved
        if (piece.type === 'king') {
            this.kingPositions[piece.color] = { row: toRow, col: toCol };
            
            // Update castling rights
            this.castlingRights[piece.color].kingSide = false;
            this.castlingRights[piece.color].queenSide = false;
        }
        
        // Update castling rights if a rook moved
        if (piece.type === 'rook') {
            if (fromCol === 0) { // Queen-side rook
                this.castlingRights[piece.color].queenSide = false;
            } else if (fromCol === 7) { // King-side rook
                this.castlingRights[piece.color].kingSide = false;
            }
        }
        
        // Update en passant target
        this.enPassantTarget = newEnPassantTarget;
        
        // Add move to history
        this.gameHistory.push(historyEntry);
        
        // Update full move number (increments after Black's move)
        if (this.currentPlayer === 'black') {
            this.fullMoveNumber++;
        }
        
        // Switch player
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        
        // Check for check, checkmate, stalemate
        this.updateGameState();
        
        return true;
    }
    
    updateGameState() {
        const currentColor = this.currentPlayer;
        const hasValidMoves = this.hasAnyValidMoves(currentColor);
        
        // Check for check
        this.isCheck = this.isKingInCheck(currentColor);
        
        // Check for checkmate
        this.isCheckmate = this.isCheck && !hasValidMoves;
        
        // Check for stalemate
        this.isStalemate = !this.isCheck && !hasValidMoves;
        
        // Check for draw by fifty-move rule
        this.isDraw = this.halfMoveClock >= 100; // 50 moves = 100 half-moves
        
        // Check for threefold repetition
        if (!this.isDraw) {
            this.isDraw = this.checkThreefoldRepetition();
        }
        
        // Check for insufficient material
        if (!this.isDraw) {
            this.isDraw = this.checkInsufficientMaterial();
        }
        
        // Check for special failure condition: king and queen are both lost
        this.checkRoyalLoss();
    }
    
    checkThreefoldRepetition() {
        // Generate a string representation of the current board state
        const positionString = this.getPositionString();
        
        // Update position history
        if (!this.positionHistory[positionString]) {
            this.positionHistory[positionString] = 1;
        } else {
            this.positionHistory[positionString]++;
        }
        
        // Check if threefold repetition occurs
        return this.positionHistory[positionString] >= 3;
    }
    
    getPositionString() {
        let str = '';
        
        // Add board state
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    str += piece.type + piece.color + row + col;
                }
            }
        }
        
        // Add castling rights
        str += JSON.stringify(this.castlingRights);
        
        // Add en passant target
        if (this.enPassantTarget) {
            str += this.enPassantTarget.row + this.enPassantTarget.col;
        }
        
        // Add current player
        str += this.currentPlayer;
        
        return str;
    }
    
    checkInsufficientMaterial() {
        // Calculate piece counts
        let pieces = {
            'white': { 'king': 0, 'queen': 0, 'rook': 0, 'bishop': 0, 'knight': 0, 'pawn': 0 },
            'black': { 'king': 0, 'queen': 0, 'rook': 0, 'bishop': 0, 'knight': 0, 'pawn': 0 }
        };
        
        // Count pieces on the board
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    pieces[piece.color][piece.type]++;
                }
            }
        }
        
        // King vs King
        if (this.onlyKings(pieces)) {
            return true;
        }
        
        // King and Bishop vs King
        if (this.kingAndBishopVsKing(pieces)) {
            return true;
        }
        
        // King and Knight vs King
        if (this.kingAndKnightVsKing(pieces)) {
            return true;
        }
        
        // King and Bishop vs King and Bishop (same-colored bishops)
        if (this.kingsAndSameColoredBishops(pieces)) {
            return true;
        }
        
        return false;
    }
    
    onlyKings(pieces) {
        return pieces.white.king === 1 && pieces.black.king === 1 &&
               this.noOtherPieces(pieces.white) && this.noOtherPieces(pieces.black);
    }
    
    kingAndBishopVsKing(pieces) {
        const whiteBishopOnly = pieces.white.king === 1 && pieces.white.bishop === 1 && 
                               this.noOtherPiecesExcept(pieces.white, 'bishop') &&
                               pieces.black.king === 1 && this.noOtherPieces(pieces.black);
                               
        const blackBishopOnly = pieces.black.king === 1 && pieces.black.bishop === 1 && 
                               this.noOtherPiecesExcept(pieces.black, 'bishop') &&
                               pieces.white.king === 1 && this.noOtherPieces(pieces.white);
                               
        return whiteBishopOnly || blackBishopOnly;
    }
    
    kingAndKnightVsKing(pieces) {
        const whiteKnightOnly = pieces.white.king === 1 && pieces.white.knight === 1 && 
                               this.noOtherPiecesExcept(pieces.white, 'knight') &&
                               pieces.black.king === 1 && this.noOtherPieces(pieces.black);
                               
        const blackKnightOnly = pieces.black.king === 1 && pieces.black.knight === 1 && 
                               this.noOtherPiecesExcept(pieces.black, 'knight') &&
                               pieces.white.king === 1 && this.noOtherPieces(pieces.white);
                               
        return whiteKnightOnly || blackKnightOnly;
    }
    
    kingsAndSameColoredBishops(pieces) {
        // This check is complex, as it depends on knowing the color of the bishops
        // Simplified implementation, considering each side having one bishop
        if (pieces.white.king === 1 && pieces.white.bishop === 1 && 
            pieces.black.king === 1 && pieces.black.bishop === 1 &&
            this.noOtherPiecesExcept(pieces.white, 'bishop') &&
            this.noOtherPiecesExcept(pieces.black, 'bishop')) {
            
            // Check if two bishops are on the same colored squares
            let whiteBishopSquareColor = null;
            let blackBishopSquareColor = null;
            
            // Find bishop positions and determine square color
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    const piece = this.board[row][col];
                    if (piece && piece.type === 'bishop') {
                        const squareColor = (row + col) % 2 === 0 ? 'light' : 'dark';
                        if (piece.color === 'white') {
                            whiteBishopSquareColor = squareColor;
                        } else {
                            blackBishopSquareColor = squareColor;
                        }
                    }
                }
            }
            
            // If two bishops are on the same colored squares, it's impossible to checkmate
            return whiteBishopSquareColor === blackBishopSquareColor;
        }
        
        return false;
    }
    
    noOtherPieces(colorPieces) {
        return colorPieces.queen === 0 && colorPieces.rook === 0 && 
               colorPieces.bishop === 0 && colorPieces.knight === 0 && 
               colorPieces.pawn === 0;
    }
    
    noOtherPiecesExcept(colorPieces, exceptType) {
        const temp = {...colorPieces};
        temp[exceptType] = 0;
        return this.noOtherPieces(temp);
    }

    hasAnyValidMoves(color) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === color) {
                    const moves = this.getValidMoves(row, col);
                    if (moves.length > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    isKingInCheck(color) {
        const kingPos = this.kingPositions[color];
        return this.isSquareAttacked(kingPos.row, kingPos.col, color);
    }
    
    undoLastMove() {
        if (this.gameHistory.length === 0) return false;
        
        const lastMove = this.gameHistory.pop();
        
        // Switch back to previous player
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        
        // Restore piece to original position
        this.board[lastMove.fromRow][lastMove.fromCol] = { ...lastMove.piece };
        
        // If it was a capture, restore the captured piece
        if (lastMove.isEnPassant) {
            this.board[lastMove.toRow][lastMove.toCol] = null;
            this.board[lastMove.captureRow][lastMove.captureCol] = lastMove.enPassantCapturedPiece;
        } else {
            this.board[lastMove.toRow][lastMove.toCol] = lastMove.capturedPiece;
        }
        
        // If it was castling, restore the rook
        if (lastMove.isCastling) {
            const kingCol = lastMove.fromCol;
            const rookFromCol = lastMove.toCol > kingCol ? 7 : 0;
            const rookToCol = lastMove.toCol > kingCol ? kingCol + 1 : kingCol - 1;
            
            // Move rook back
            this.board[lastMove.fromRow][rookFromCol] = this.board[lastMove.fromRow][rookToCol];
            this.board[lastMove.fromRow][rookToCol] = null;
            this.board[lastMove.fromRow][rookFromCol].hasMoved = false;
        }
        
        // Restore king position if king was moved
        if (lastMove.piece.type === 'king') {
            this.kingPositions[lastMove.piece.color] = { row: lastMove.fromRow, col: lastMove.fromCol };
        }
        
        // Restore en passant target
        this.enPassantTarget = lastMove.enPassantTarget;
        
        // Restore castling rights
        this.castlingRights = JSON.parse(JSON.stringify(lastMove.castlingRights));
        
        // Restore half move clock and full move number
        this.halfMoveClock = lastMove.halfMoveClock;
        this.fullMoveNumber = lastMove.fullMoveNumber;
        
        // Update game state
        this.updateGameState();
        
        return true;
    }
    
    getMoveNotation(historyEntry) {
        const { piece, fromRow, fromCol, toRow, toCol, isEnPassant, isCastling, isPromotion, promotionType, capturedPiece } = historyEntry;
        
        // Handle castling notation
        if (isCastling) {
            return toCol > fromCol ? 'O-O' : 'O-O-O';
        }
        
        let notation = '';
        
        // Add piece letter (except for pawns)
        if (piece.type !== 'pawn') {
            notation += piece.type.charAt(0).toUpperCase();
        }
        
        // For captures
        if (capturedPiece || isEnPassant) {
            // For pawn captures, add the file (column) from which the pawn moved
            if (piece.type === 'pawn') {
                notation += String.fromCharCode('a'.charCodeAt(0) + fromCol);
            }
            notation += 'x';
        }
        
        // Add target square
        notation += String.fromCharCode('a'.charCodeAt(0) + toCol);
        notation += 8 - toRow;
        
        // Add promotion piece
        if (isPromotion) {
            notation += '=' + promotionType.charAt(0).toUpperCase();
        }
        
        return notation;
    }
    
    getGameStatus() {
        if (this.isCheckmate) {
            return `Checkmate! ${this.currentPlayer === 'white' ? 'Black' : 'White'} wins.`;
        } else if (this.isStalemate) {
            return `Stalemate! The game is a draw.`;
        } else if (this.isDraw) {
            if (this.halfMoveClock >= 100) {
                return `Draw by fifty-move rule.`;
            } else if (this.checkThreefoldRepetition()) {
                return `Draw by threefold repetition.`;
            } else if (this.checkInsufficientMaterial()) {
                return `Draw by insufficient material.`;
            }
            return `Draw.`;
        } else if (this.isCheck) {
            return `${this.currentPlayer} is in check.`;
        } else {
            return `${this.currentPlayer}'s turn.`;
        }
    }
    
    // Check for special failure condition: king and queen are both lost
    checkRoyalLoss() {
        // If one side's king and queen are both lost, the other side wins
        // Note: Kings are usually not lost, but we still check for special rules

        const whitePieces = this.countPiecesByType('white');
        const blackPieces = this.countPiecesByType('black');
        
        // If white king and queen are both lost, white loses
        if (whitePieces.king === 0 && whitePieces.queen === 0) {
            // Set to black win
            this.isCheckmate = true;
            this.currentPlayer = 'white'; // Set current player to white, indicating white is checkmated
            return;
        }
        
        // If black king and queen are both lost, black loses
        if (blackPieces.king === 0 && blackPieces.queen === 0) {
            // Set to white win
            this.isCheckmate = true;
            this.currentPlayer = 'black'; // Set current player to black, indicating black is checkmated
            return;
        }
    }
    
    // Count pieces of a certain type for a given color
    countPiecesByType(color) {
        const pieceCount = {
            'king': 0, 'queen': 0, 'rook': 0, 'bishop': 0, 'knight': 0, 'pawn': 0
        };
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === color) {
                    pieceCount[piece.type]++;
                }
            }
        }
        
        return pieceCount;
    }
}

// Make the Chess class available globally
window.Chess = Chess; 