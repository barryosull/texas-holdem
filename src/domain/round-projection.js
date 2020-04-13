
var Game = require('./game');
var events = require('./events');
var pokerTools = require('poker-tools');
var SeatsProjection = require('./seats-projection');

/**
 * @param game {Game}
 */
var RoundProjection = function(game)
{
    this.game = game;
};

RoundProjection.prototype.getHands = function()
{
    var hands = {};
    this.game.events.forEach(e => {
        if (e instanceof events.HandDealt) {
            hands[e.playerId] = {
                playerId: e.playerId,
                cards: e.cards,
                hasFolded: false
            };
        }
        if (e instanceof events.HandFolded) {
            hands[e.playerId].hasFolded = true;
        }
    });

    var seatsProjection = new SeatsProjection(this.game);

    var activePlayers = seatsProjection.getActivePlayers();

    return Object.values(hands).filter(hand => {
        return activePlayers.indexOf(hand.playerId) !== -1;
    });
};

RoundProjection.prototype.activeHands = function()
{
    return this.getHands().filter(hand => {
        return !hand.hasFolded;
    });
};

RoundProjection.prototype.getPlayerHand = function(playerId)
{
    return this.getHands().filter(hand => {
        return hand.playerId === playerId;
    }).pop();
};

RoundProjection.prototype.getCommunityCards = function()
{
    var flop = [], turn = null, river = null;
    this.game.events.forEach(e => {
        if (e instanceof events.FlopDealt) {
            flop = e.cards;
        }
        if (e instanceof events.TurnDealt) {
            turn = e.card;
        }
        if (e instanceof events.RiverDealt) {
            river = e.card;
        }
        if (e instanceof events.RoundStarted) {
            flop = [], turn = null, river = null;
        }
    });

    var cards = flop.concat([turn, river]);

    return cards.filter(card => {
        return card != null;
    });
};

RoundProjection.prototype.chooseWinningHand = function()
{
    var hands = this.activeHands();
    var communityCards = this.getCommunityCards();

    var pokerToolsHands = hands.map(hand => {
        return pokerTools.CardGroup.fromString(
            PokerToolsAdapter.convertToPokerToolsString(hand.cards)
        );
    });
    var board = pokerTools.CardGroup.fromString(
        PokerToolsAdapter.convertToPokerToolsString(communityCards)
    );

    const result = pokerTools.OddsCalculator.calculateWinner(pokerToolsHands, board);

    var winnerIndex = result[0][0].index;

    return hands[winnerIndex];
};

RoundProjection.prototype.getWinner = function()
{
    return this.game.events.reduce((playerId, e) => {
        if (e instanceof events.HandWon) {
            return e.playerId;
        }
        return playerId;
    }, null);
};

RoundProjection.prototype.getWinnerByDefaultHand = function()
{
    var activeHands = this.activeHands();
    if (activeHands.length > 1) {
        return null;
    }
    return activeHands[0];
};

RoundProjection.prototype.getPot = function()
{
    return this.game.events.reduce((pot, e) => {
        if (e instanceof events.HandWon) {
            return 0;
        }
        if (e instanceof events.RoundStarted) {
            return 0;
        }
        if (e instanceof events.BetPlaced) {
            return pot + e.amount;
        }
        return pot;
    }, 0);
};

RoundProjection.prototype.getPlayersBankrupedInRound = function()
{
    var playersToChips = {};
    this.game.events.forEach(e => {

        if (e instanceof events.PlayerGivenChips) {
            playersToChips[e.playerId] = playersToChips[e.playerId] || 0;
            playersToChips[e.playerId] += e.amount;
        }
        if (e instanceof events.BetPlaced) {
            playersToChips[e.playerId] -= e.amount;
        }
        if (e instanceof events.PlayerBankrupted) {
            delete playersToChips[e.playerId];
        }
    });

    var bankruptPlayers = [];
    Object.keys(playersToChips).forEach(playerId => {
        if (playersToChips[playerId] === 0) {
            bankruptPlayers.push(playerId);
        }
    });

    return bankruptPlayers;
};

var PokerToolsAdapter = {};

PokerToolsAdapter.convertToPokerToolsString = function(cards)
{
    var convertedCards = cards.map(card => {
        var parts = card.split('_of_');
        var number = parts[0];
        if (number === "10") {
            number = "T";
        }
        if (PokerToolsAdapter.isFaceCard(number)) {
            number = number.charAt(0);
        }

        var suit = parts[1].charAt(0);
        return number.toUpperCase().concat(suit);
    });

    return convertedCards.join("");
};

PokerToolsAdapter.isFaceCard = function(number)
{
    return number.length > 2;
};

module.exports = RoundProjection;