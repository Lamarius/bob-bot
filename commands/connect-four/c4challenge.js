const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, userMention, SlashCommandBuilder, MessageFlags } = require('discord.js');

const empty = ':white_circle:';
const red = ':red_circle:';
const black = ':black_circle:';
const games = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('c4challenge')
        .setDescription('Challenge someone to Connect 4')
        .addMentionableOption(option => option.setName('opponent').setDescription('The person you\'d like to challenge as your opponent. Your opponent always goes first.').setRequired(true)),
    async execute(interaction) {
        const opponentId = interaction.options.getUser('opponent')?.id;
        const challengerId = interaction.user.id;
        const gameId = `${challengerId}~${opponentId}`;

        if (!opponentId) {
            interaction.reply({ content: 'You should probably actually challenge someone.', flags: MessageFlags.Ephemeral });
            return;
        }

        if (games.has(gameId) || games.has(`${opponentId}~${challengerId}`)) {
            const guildId = interaction.guildId;
            interaction.reply({ content: `You already have a game in progress with ${userMention(opponentId)}. I would like to be able to print the game out again but idk how to do that yet. Rip.`, flags: MessageFlags.Ephemeral });
            return;
        }

        games.set(gameId, []);

        const rows = 6;
        const columns = 7;
        const board = Array(6).fill(empty).map(() => Array(7).fill(empty));

        const reply = printBoard(challengerId, opponentId, red, board);

        const one = new ButtonBuilder().setCustomId('0').setEmoji('1️⃣').setStyle(ButtonStyle.Secondary);
        const two = new ButtonBuilder().setCustomId('1').setEmoji('2️⃣').setStyle(ButtonStyle.Secondary);
        const three = new ButtonBuilder().setCustomId('2').setEmoji('3️⃣').setStyle(ButtonStyle.Secondary);
        const four = new ButtonBuilder().setCustomId('3').setEmoji('4️⃣').setStyle(ButtonStyle.Secondary);
        const five = new ButtonBuilder().setCustomId('4').setEmoji('5️⃣').setStyle(ButtonStyle.Secondary);
        const six = new ButtonBuilder().setCustomId('5').setEmoji('6️⃣').setStyle(ButtonStyle.Secondary);
        const seven = new ButtonBuilder().setCustomId('6').setEmoji('7️⃣').setStyle(ButtonStyle.Secondary);

        const undo = new ButtonBuilder().setCustomId('undo').setLabel('Undo').setEmoji('↩️').setStyle(ButtonStyle.Secondary);

        const actions = new ActionRowBuilder().addComponents(one, two, three, four, five);
        const actions2 = new ActionRowBuilder().addComponents(six, seven);
        const actions3 = new ActionRowBuilder().addComponents(undo);
        const components = [actions, actions2];
        const response = await interaction.reply({ content: reply, components: components, withResponse: true });

        const collectorFilter = i => [opponentId, challengerId].includes(i);

        const collector = response.resource.message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 2_147_483_647
        });

        let currentTurn = red;

        collector.on('collect', async (i) => {
            if (i.user.id !== challengerId && i.user.id !== opponentId) {
                i.reply({ content: 'You\'re not participating in this game. If you would like to play, challenge someone using the \`/c4challenge\` command!', flags: MessageFlags.Ephemeral });
            }
            const game = games.get(gameId);
            const newComponents = [...components, actions3];
            let boardState = false;
            let lastMove = null;
            if (i.customId === 'undo') {
                const previousPlayer = currentTurn === red ? challengerId : opponentId;
                if (i.user.id !== previousPlayer) {
                    i.reply({ content: 'You cannot undo your opponent\'s previous move.', flags: MessageFlags.Ephemeral });
                    return;
                }

                if (!game?.length) {
                    return;
                }

                const removed = game.pop();
                if (!game.length) {
                    newComponents.pop();
                } else {
                    lastMove = getLastMove(game[game.length - 1])
                }
                undoLastAction(removed, currentTurn === red ? black : red, board);
            } else {
                const currentPlayer = currentTurn === red ? opponentId : challengerId;
                if (i.user.id !== currentPlayer) {
                    i.reply({ content: 'It\'s not your turn.', flags: MessageFlags.Ephemeral });
                    return;
                }

                const column = Number(i.customId);
                game.push(column);
                lastMove = getLastMove(column);
                boardState = drop(column, currentTurn, board);
            }

            if (boardState === null) {
                i.update({ content: printBoard(challengerId, opponentId, currentTurn, board, false, true), components: newComponents });
            } else if (boardState === true) {
                // victory
                i.update({ content: printBoard(challengerId, opponentId, currentTurn, board, true, false, lastMove), components: [], withResponse: false });
                games.delete(gameId);
            } else {
                currentTurn = currentTurn === red ? black : red;
                i.update( {content: printBoard(challengerId, opponentId, currentTurn, board, false, false, lastMove), components: newComponents });
            }
        });
    },
}

function getLastMove(lastMove) {
    switch (lastMove) {
        case 0:
            return '1️⃣';
        case 1:
            return '2️⃣';
        case 2:
            return '3️⃣';
        case 3:
            return '4️⃣';
        case 4:
            return '5️⃣';
        case 5:
            return '6️⃣';
        case 6:
            return '7️⃣';
    }
}

function printBoard(challengerId, opponentId, currentTurn, board, victory = false, invalidMove = false, lastMove = null, undoRequest = null) {
    const opponent = `${red} ${userMention(opponentId)}`;
    const challenger = `${black} ${userMention(challengerId)}`;
    const currentPlayer = currentTurn === red ? opponent : challenger;
    const otherPlayer = currentTurn === red ? challenger : opponent;

    let visual = '';
    board.forEach(row => visual += row.join('') + '\n');
    visual += ':one::two::three::four::five::six::seven:';

    let message = `${opponent}, you have been challenged to Connect 4 by ${challenger}!`
    if (victory) {
        message += `\n${currentPlayer} won!`;
    } else {
        message += `\n${currentPlayer}'s turn`;
    }

    if (lastMove !== null) {
        message += ` (${victory ? currentPlayer : otherPlayer} placed in column ${lastMove})`;
    }

    if (invalidMove) {
        message += `\n${currentPlayer} invalid move! Try again.`;
    }
    message += `\n\n${visual}`;

    return message;
}

function drop(column, currentTurn, board) {
    if (board[0][column] !== empty) {
        return null;
    }

    for (var i = 5; i >= 0; i--) {
        if (board[i][column] === empty) {
            board[i][column] = currentTurn;
            return checkVictory(column, i, currentTurn, board);
        }
    }

    return false;
}

function undoLastAction(column, currentTurn, board) {
    for (var i = 0; i <= 5; i++) {
        if (board[i][column] === currentTurn) {
            board[i][column] = empty;
            return;
        }
    }
}

function checkVictory(column, row, currentTurn, board) {
    return checkVertical(column, row, currentTurn, board)
        || checkHorizontal(column, row, currentTurn, board)
        || checkDiagonalLeft(column, row, currentTurn, board)
        || checkDiagonalRight(column, row, currentTurn, board);
}

function checkVertical(column, row, currentTurn, board) {
    if (row > 2) {
        return false;
    }

    return board[row][column] === currentTurn 
        && board[row + 1][column] === currentTurn 
        && board[row + 2][column] === currentTurn 
        && board[row + 3][column] === currentTurn;
}

function checkHorizontal(column, row, currentTurn, board) {
    const amount = 1 + sumLeft(column - 1, row, currentTurn, board) + sumRight(column + 1, row, currentTurn, board);
    return amount >= 4;
}

function checkDiagonalLeft(column, row, currentTurn, board) {
    const amount = 1 + sumBottomRight(column + 1, row + 1, currentTurn, board) + sumTopLeft(column - 1, row - 1, currentTurn, board);
    return amount >= 4;
}

function checkDiagonalRight(column, row, currentTurn, board) {
    const amount = 1 + sumBottomLeft(column - 1, row + 1, currentTurn, board) + sumTopRight(column + 1, row - 1, currentTurn, board);
    return amount >= 4;
}

function sumLeft(column, row, currentTurn, board) {
    if (column < 0) {
        return 0;
    }

    if (board[row][column] !== currentTurn) {
        return 0;
    }

    return 1 + sumLeft(column - 1, row, currentTurn, board);
}

function sumRight(column, row, currentTurn, board) {
    if (column > 6) {
        return 0;
    }

    if (board[row][column] !== currentTurn) {
        return 0;
    }

    return 1 + sumRight(column + 1, row, currentTurn, board);
}

function sumBottomRight(column, row, currentTurn, board) {
    if (column > 6) {
        return 0;
    }

    if (row > 5) {
        return 0;
    }

    if (board[row][column] !== currentTurn) {
        return 0;
    }

    return 1 + sumBottomRight(column + 1, row + 1, currentTurn, board);
}

function sumTopLeft(column, row, currentTurn, board) {
    if (column < 0) {
        return 0;
    }

    if (row < 0) {
        return 0;
    }

    if (board[row][column] !== currentTurn) {
        return 0;
    }

    return 1 + sumTopLeft(column - 1, row - 1, currentTurn, board);
}

function sumBottomLeft(column, row, currentTurn, board) {
    if (column < 0) {
        return 0;
    }

    if (row > 5) {
        return 0;
    }

    if (board[row][column] !== currentTurn) {
        return 0;
    }

    return 1 + sumBottomLeft(column - 1, row + 1, currentTurn, board);
}

function sumTopRight(column, row, currentTurn, board) {
    if (column > 6) {
        return 0;
    }

    if (row < 0) {
        return 0;
    }

    if (board[row][column] !== currentTurn) {
        return 0;
    }

    return 1 + sumTopRight(column + 1, row - 1, currentTurn, board);
}