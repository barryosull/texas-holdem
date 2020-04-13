
var Game = require('../domain/game');
var events = require('../domain/events');

/**
 * @param game {Game}
 */
var RoundProjection = function(game)
{
    this.game = game;
};

RoundProjection.prototype.getHands = function()
{
    let hands = this.game.events.reduce((hands, e) => {
        if (e instanceof events.RoundStarted) {
            hands = {};
        }
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
        return hands;
    }, {});

    return Object.values(hands);
};

RoundProjection.prototype.getPlayerHand = function(playerId)
{
    return this.getHands().filter(hand => {
        return hand.playerId === playerId;
    }).pop();
};

RoundProjection.prototype.getCommunityCards = function()
{
    return this.game.events.reduce((cards, e) => {
        if (e instanceof events.FlopDealt) {
            cards = e.cards;
        }
        if (e instanceof events.TurnDealt) {
            cards.push(e.card);
        }
        if (e instanceof events.RiverDealt) {
            cards.push(e.card);
        }
        if (e instanceof events.RoundStarted) {
            cards = [];
        }
        return cards;
    }, []);
};

RoundProjection.prototype.getWinner = function()
{
    return this.game.events.reduce((playerId, e) => {
        if (e instanceof events.RoundStarted) {
            playerId = null;
        }
        if (e instanceof events.HandWon) {
            playerId = e.playerId;
        }
        return playerId;
    }, null);
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

RoundProjection.prototype.getPlayerBet = function(playerId)
{
    return this.game.events.reduce((bet, e) => {
        if (e instanceof events.BettingRoundClosed) {
            return 0;
        }
        if (e instanceof events.HandWon) {
            return 0;
        }
        if (e instanceof events.BetPlaced) {
            if (e.playerId === playerId) {
                return bet + e.amount;
            }
        }
        return bet;
    }, 0);
};

RoundProjection.prototype.bankruptedInLastRound = function()
{
    let bankrupted = this.game.events.reduce((bankrupted, e) => {
        if (e instanceof events.HandWon) {
            bankrupted = {};
        }
        if (e instanceof events.PlayerBankrupted) {
            bankrupted[e.playerId] = true;
        }
        return bankrupted;
    }, {});

    return Object.keys(bankrupted);
};

module.exports = RoundProjection;