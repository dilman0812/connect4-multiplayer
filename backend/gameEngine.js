// Creates an empty 6x7 Connect 4 board
function createEmptyBoard() {
    return Array.from({ length: 6 }, () => Array(7).fill(0));
}

module.exports = {
    createEmptyBoard,
    dropDisc,
    checkWin,
    checkDraw
};

function dropDisc(board, column, player) {
    for (let row = 5; row >= 0; row--) {
        if (board[row][column] === 0) {
            board[row][column] = player;
            return row;
        }
    }
    return -1; // column full
}

// win check
function checkWin(board, player) {
    const ROWS = 6;
    const COLS = 7;

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            if (
                board[r][c] === player &&
                board[r][c + 1] === player &&
                board[r][c + 2] === player &&
                board[r][c + 3] === player
            ) {
                return true;
            }
        }
    }

    // Vertical
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            if (
                board[r][c] === player &&
                board[r + 1][c] === player &&
                board[r + 2][c] === player &&
                board[r + 3][c] === player
            ) {
                return true;
            }
        }
    }

    // Diagonal ↘
    for (let r = 0; r < ROWS - 3; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            if (
                board[r][c] === player &&
                board[r + 1][c + 1] === player &&
                board[r + 2][c + 2] === player &&
                board[r + 3][c + 3] === player
            ) {
                return true;
            }
        }
    }

    // Diagonal ↗
    for (let r = 3; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            if (
                board[r][c] === player &&
                board[r - 1][c + 1] === player &&
                board[r - 2][c + 2] === player &&
                board[r - 3][c + 3] === player
            ) {
                return true;
            }
        }
    }

    return false;
}
function checkDraw(board) {
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7; col++) {
            if (board[row][col] === 0) {
                return false; // still empty space
            }
        }
    }
    return true; // board full
}
