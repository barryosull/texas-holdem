
var events = require('./events');
var SeatsProjection = require('./seats-projection');
var PlayersProjection = require('./players-projection');
var RoundProjection = require('./round-projection');
var DeckProjection = require('./deck-projection');

var Game = function(id)
{
    this.id = id;
    this.events = [];

    // Projections
    this.seats = new SeatsProjection(this);
    this.players = new PlayersProjection(this);
    this.round = new RoundProjection(this);
    this.deck = new DeckProjection(this);
};

Game.prototype.push = function(...args)
{
    this.events.push(...args);
    for (var i = 0; i< arguments.length; i++) {
        console.log(arguments[i]);
    }
};

const STARTING_CHIPS_COUNT = 1000;

Game.prototype.addPlayer = function(playerId, name)
{
    this.push(new events.PlayerNamed(playerId, name));

    var freeSeat = this.seats.getFreeSeat();

    if (freeSeat == null) {
        console.log("All seats taken, no room for player " + playerId);
    }

    this.push(new events.SeatTaken(freeSeat, playerId));

    if (isNewPlayer(this, playerId)) {
        this.push(new events.PlayerGivenChips(playerId, STARTING_CHIPS_COUNT))
    }
};

/**
 * @param game {Game}
 * @param playerId {string}
 * @returns {boolean}
 */
function isNewPlayer(game, playerId)
{
    return game.seats.getPlayerChips(playerId) === 0;
}

Game.prototype.removePlayer = function(playerId)
{
    var seat = this.seats.getPlayersSeat(playerId);
    this.push(new events.SeatEmptied(seat));

    var winnerByDefaultGand = getWinnerDyDefaultHand(this);
    if (winnerByDefaultGand) {
        announceWinner(this, winnerByDefaultGand);
    }

    return seat;
};

Game.prototype.startNewRound = function()
{
    var deckSeed = Math.random().toString(36);

    var dealer = this.seats.getNextDealer();

    this.push(new events.RoundStarted(deckSeed, dealer));

    this.seats.getActivePlayers().forEach(playerId => {
        var cards = this.deck.getCards(2);
        this.push(new events.HandDealt(playerId, cards));
    });
};

Game.prototype.hasPlayers = function()
{
    return this.seats.getActivePlayers().length !== 0;
};

Game.prototype.foldHand = function(playerId)
{
    var playerHand = this.round.getPlayerHand(playerId);
    if (!playerHand) {
        return;
    }
    this.push(new events.HandFolded(playerId));

    var winnerByDefaultGand = getWinnerDyDefaultHand(this);
    if (winnerByDefaultGand) {
        return announceWinner(this, winnerByDefaultGand);
    }
};

function getWinnerDyDefaultHand(game)
{
    var activeHands = game.round.activeHands();
    if (activeHands.length > 1) {
        return null;
    }
    return activeHands[0];
}

function announceWinner(game, winningHand)
{
    var handWonEvent = new events.HandWon(winningHand.playerId);
    var pot = game.round.getPot();
    var playerGivenChipsEvent = new events.PlayerGivenChips(winningHand.playerId, pot);
    game.push(handWonEvent, playerGivenChipsEvent);
    return [handWonEvent, playerGivenChipsEvent];
}

Game.prototype.dealFlop = function()
{
    var cards = this.deck.getCards(3);
    var event = new events.FlopDealt(cards);
    this.push(event);
    return event;
};

Game.prototype.dealTurn = function()
{
    var card = this.deck.getCards(1)[0];
    var event = new events.TurnDealt(card);
    this.push(event);
    return event;
};

Game.prototype.dealRiver = function()
{
    var card = this.deck.getCards(1)[0];
    var event = new events.RiverDealt(card);
    this.push(event);
    return event;
};

Game.prototype.announceWinner = function()
{
    var winningHand = this.round.chooseWinningHand();
    return announceWinner(this, winningHand);
};

Game.prototype.announceLosers = function()
{
    this.round.getPlayersBankrupedInRound().forEach(playerId => {
        this.push(new events.PlayerBankrupted(playerId));
    });
};

Game.prototype.closeRoundOfBetting = function()
{
    var event = new events.BettingRoundClosed();
    this.push(event);
    return event;
};

Game.prototype.placeBet = function(playerId, amount)
{
    var playerChips = this.seats.getPlayerChips(playerId);
    amount = (amount > playerChips) ? playerChips : amount;
    this.push(new events.BetPlaced(playerId, amount));
};

module.exports = Game;