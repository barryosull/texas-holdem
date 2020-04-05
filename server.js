var express = require('express');
var app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var pokerTools = require("poker-tools");


/*******************************
 * Domain concepts
 *******************************/

var denominations = [
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    'jack',
    'queen',
    'king',
    'ace',
];

var suits = [
    'clubs',
    'diamonds',
    'hearts',
    'spades'
];

var Deck = function(cards)
{
    this.cards = cards;
};

Deck.makeNew = function()
{
    var cards = [];

    suits.forEach(suit => {
        denominations.forEach(denomination => {
            cards.push(denomination + '_of_' + suit);
        });
    });

    var deck = new Deck(cards);
    deck.shuffle();
    return deck;
};

Deck.prototype.shuffle = function()
{
    var array = this.cards;

    var currentIndex = array.length;
    var temporaryValue, randomIndex;

    while (0 !== currentIndex) {
        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    this.cards = array;
};

Deck.prototype.dealHand = function()
{
    var card1 = this.cards.pop();
    var card2 = this.cards.pop();
    return [card1, card2];
};

Deck.prototype.dealFlop = function()
{
    var card1 = this.cards.pop();
    var card2 = this.cards.pop();
    var card3 = this.cards.pop();
    return [card1, card2, card3];
};

Deck.prototype.dealTurn = function()
{
    return this.cards.pop();
};

Deck.prototype.dealRiver = function()
{
    return this.cards.pop();
};

var Seats = {
    seats: [
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
    ],
    playerNames: {}
};

Seats.takeSeat = function(playerId, playerName)
{
    for (var index in Seats.seats) {
        if (Seats.seats[index] === playerId) {
            return index;
        }
        if (Seats.seats[index] === false) {
            Seats.seats[index] = playerId;
            Seats.playerNames[index] = playerName;
            return index;
        }
    }
    console.log("All seats taken, no room for player " + playerId);
    return false;
};

Seats.getSeat = function(playerId)
{
    for (var index in Seats.seats) {
        if (Seats.seats[index] === playerId) {
            return parseInt(index);
        }
    }
    return false;
};

Seats.freeUpSeat = function(seat)
{
    if (seat === false) {
        return;
    }
    Seats.seats[seat] = false;
    delete Seats.playerNames[seat];
};

Seats.activePlayers = function()
{
    return Seats.seats.filter(seatOccupant => {
        return seatOccupant !== false
    });
};

Seats.makeSeatsViewModel = function()
{
    var viewModel = [];
    Seats.seats.forEach((playerId, seat) => {
        viewModel.push({
            playerId: playerId,
            playerName: Seats.playerNames[seat],
            seat: seat
        });
    });
    return viewModel;
};


/**
 * @param deck {Deck}
 * @constructor
 */
var Round = function(deck)
{
    this.deck = deck;
    this.communityCards = [];
    this.hands = [];
};

Round.prototype.start = function(players)
{
    var hands = [];
    var deck = this.deck;
    players.forEach(playerId => {
        hands.push({
            playerId: playerId,
            cards: deck.dealHand(),
            hasFolded: false
        });
    });
    this.hands = hands;
};

Round.prototype.dealFlop = function()
{
    var flop = this.deck.dealFlop();
    this.communityCards = flop;
    return flop;
};

Round.prototype.dealTurn = function()
{
    var turn = this.deck.dealTurn();
    this.communityCards.push(turn);
    return turn;
};

Round.prototype.dealRiver = function()
{
    var river = this.deck.dealRiver();
    this.communityCards.push(river);
    return river;
};

Round.prototype.foldHand = function(playerId)
{
    var playerHand = this.hands.filter(hand => {
        return hand.playerId === playerId;
    }).pop();

    if (!playerHand) {
        return;
    }

    playerHand.hasFolded = true;
};

Round.prototype.activeHands = function()
{
    return this.hands.filter(hand => {
        return !hand.hasFolded;
    });
};

Round.prototype.getPlayerHand = function(playerId)
{
    return this.hands.filter(hand => {
        return hand.playerId === playerId;
    }).pop();
};

Round.prototype.chooseWinningHand = function()
{
    var hands = this.activeHands();
    var communityCards = this.communityCards;

    var pokerToolsHands = hands.map(hand => {
       return pokerTools.CardGroup.fromString(
            convertToPokerToolsString(hand.cards)
       );
    });
    var board = pokerTools.CardGroup.fromString(
        convertToPokerToolsString(communityCards)
    );

    const result = pokerTools.OddsCalculator.calculateWinner(pokerToolsHands, board);

    var winnerIndex = result[0][0].index;

    return hands[winnerIndex];
};

function convertToPokerToolsString(cards)
{
    var convertedCards = cards.map(card => {
       var parts = card.split('_of_');
       var number = parts[0];
        if (number === "10") {
            number = "T";
        }
       if (isFaceCard(number)) {
           number = number.charAt(0);
       }

       var suit = parts[1].charAt(0);
       return number.toUpperCase().concat(suit);
    });

    return convertedCards.join("");
}

function isFaceCard(number)
{
    return number.length > 2;
}


/*******************************
 * Scoket.io controller adapter
 *******************************/
var SocketsToPlayersMap =
{
    map: {},

    associate: function(socketId, playerId)
    {
        SocketsToPlayersMap.map[socketId] = playerId;
    },

    deassociate: function(socketId)
    {
        delete SocketsToPlayersMap.map[socketId];
    },

    getPlayerIdForSocket: function(socketId)
    {
        return SocketsToPlayersMap.map[socketId];
    },

    getSocketIdForPlayer: function(playerId)
    {
        for (var socketId in SocketsToPlayersMap.map) {
            if (SocketsToPlayersMap.map[socketId] === playerId) {
                return socketId;
            }
        }
        return undefined;
    }
};


/*******************************
 * Controller
 *******************************/

var Controller = {
    round: null,
};

Controller.dealCards = function (req, res)
{
    var deck = Deck.makeNew();

    Controller.round = new Round(deck);

    Controller.round.start(Seats.activePlayers());

    Controller.round.hands.forEach(hand => {
        var socketId = SocketsToPlayersMap.getSocketIdForPlayer(hand.playerId);
        io.sockets.to(socketId).emit('roundStarted', hand);
    });

    res.send('');
};

Controller.dealFlop = function (req, res)
{
    io.emit('flop', Controller.round.dealFlop());
    res.send('');
};

Controller.dealTurn = function (req, res)
{
    io.emit('turn', Controller.round.dealTurn());
    res.send('');
};

Controller.dealRiver = function (req, res)
{
    io.emit('river', Controller.round.dealRiver());
    res.send('');
};

Controller.finish = function(req, res)
{
    var winningHand = Controller.round.chooseWinningHand();
    io.emit('winningHand', winningHand);
    res.send('');
};

Controller.addPlayer = function(player)
{
    var socketId = this.id;
    var playerId = player.playerId;
    var playerName = player.playerName;

    console.log('player "' + playerName + '" (' + playerId + ') connected');

    var existingSocketId = SocketsToPlayersMap.getSocketIdForPlayer(playerId);

    if (existingSocketId) {
        io.sockets.to(socketId).emit('existingSession');
        return;
    }

    SocketsToPlayersMap.associate(socketId, playerId);

    Seats.takeSeat(playerId, playerName);

    io.emit('seatFilled', Seats.makeSeatsViewModel());

    if (!Controller.round) {
        return;
    }

    Controller.broadcastInProgressRound(socketId, playerId);
};

Controller.broadcastInProgressRound = function(socketId, playerId)
{
    var playerHand = Controller.round.getPlayerHand(playerId);

    if (playerHand) {
        io.sockets.to(socketId).emit('roundStarted', playerHand);
    }

    var cards = Controller.round.communityCards;
    if (cards.length > 2) {
        io.sockets.to(socketId).emit('flop', [cards[0], cards[1], cards[2]]);
    }
    if (cards.length > 3) {
        io.sockets.to(socketId).emit('turn', cards[3]);
    }
    if (cards.length > 4) {
        io.sockets.to(socketId).emit('river', cards[4]);
    }
};

Controller.removePlayer = function()
{
    var socketId = this.id;
    var playerId = SocketsToPlayersMap.getPlayerIdForSocket(socketId);

    if (!playerId) {
        return;
    }

    console.log('playerId ' + playerId + ' disconnected');

    var seat = Seats.getSeat(playerId);
    Seats.freeUpSeat(seat);

    SocketsToPlayersMap.deassociate(socketId);

    io.emit('seatEmptied', {
        seats: Seats.makeSeatsViewModel(),
        emptiedSeat: seat,
    });
};

Controller.foldHand = function(req, res)
{
    var playerId = req.params.playerId;

    Controller.round.foldHand(playerId);

    console.log(Controller.round.hands);

    io.emit('playerFolded', playerId);

    var activeHands = Controller.round.activeHands();
    if (activeHands.length === 1) {
        io.emit('winnerByDefault', activeHands[0].playerId);
    }

    res.send('');
};


/************************************
 * Boot Incoming Message Handlers
 ************************************/
io.on('connection', function(socket)
{
    socket.on('newPlayer', Controller.addPlayer);
    socket.on('disconnect', Controller.removePlayer);
});


/*******************************
 * Boot HTTP Routes
 *******************************/

// Serve public files
app.use(express.static('public'));

app.post('/api/deal', Controller.dealCards);

app.post('/api/flop', Controller.dealFlop);

app.post('/api/turn', Controller.dealTurn);

app.post('/api/river', Controller.dealRiver);

app.post('/api/finish', Controller.finish);

app.post('/api/fold/:playerId', Controller.foldHand);

/*******************************
 * Launch the Webserver
 *******************************/
var port = 3000;
http.listen(port, () => console.log("Texas holdem server running at http://localhost:" + port));