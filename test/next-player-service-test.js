
var NextPlayerToActService = require('../src/domain/next-player-to-act-service');
var assert = require('assert');

describe('Select the next player to act', () => {

    it ('finds the next player', () => {

        let player1 = 'player-1';
        let player2 = 'player-2';
        let player3 = 'player-3';
        let player4 = 'player-4';

        let playersInRound = [
            player1,
            player2,
            player3,
        ];

        let playersThatFolded = [
            player2
        ];

        let playersThatActed = [
            player1,
            player2,
            player3,
        ];

        let playersWithChips = [
            player1,
            player2,
            player3,
        ];

        let playersToAmountBet = {};
        playersToAmountBet[player1] = 300;
        playersToAmountBet[player3] = 200;

        let lastPlayerToAct = player1;

        let nextPlayer = NextPlayerToActService.selectPlayer(
            lastPlayerToAct,
            playersInRound,
            playersThatFolded,
            playersThatActed,
            playersWithChips,
            playersToAmountBet
        );

        assert.equal(nextPlayer, player3);
    });
});
