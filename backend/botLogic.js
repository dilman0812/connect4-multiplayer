const { dropDisc, checkWin } = require('./gameEngine');

// Returns column index for bot move
function getBotMove(board) {
    const BOT = 2;
    const HUMAN = 1;

    // 1. Try to win
    for (let col = 0; col < 7; col++) {
        const tempBoard = cloneBoard(board);
        if (dropDisc(tempBoard, col, BOT) !== -1) {
            if (checkWin(tempBoard, BOT)) {
                return col;
            }
        }
    }

    // 2. Try to block human win
    for (let col = 0; col < 7; col++) {
        const tempBoard = cloneBoard(board);
        if (dropDisc(tempBoard, col, HUMAN) !== -1) {
            if (checkWin(tempBoard, HUMAN)) {
                return col;
            }
        }
    }

    // 3. Prefer center column
    if (dropDisc(cloneBoard(board), 3, BOT) !== -1) {
        return 3;
    }

    // 4. First available column
    for (let col = 0; col < 7; col++) {
        if (dropDisc(cloneBoard(board), col, BOT) !== -1) {
            return col;
        }
    }

    return -1; // no move
}

function cloneBoard(board) {
    return board.map(row => [...row]);
}

module.exports = { getBotMove };
