
/************************************
 * Game interface, calls the HTTP API
 ************************************/
var Game = {
    gameId: null,
    socketId: null
};

Game.bootClient = function(gameId, socketId)
{
    Game.gameId = gameId;
    Game.socketId = socketId;

    $.ajaxSetup({
        beforeSend: function(xhr)
        {
            xhr.setRequestHeader("Authorization", "Bearer " + socketId);
        }
    });
};

Game.join = function(playerId, playerName)
{
    return $.post(
        "api/game/" + Game.gameId + "/join",
        {
            playerId: playerId,
            playerName: playerName
        },
        d => {},
        "json"
    );
};

Game.setSmallBlind = function(amount)
{
    return $.post(
        "api/game/" + Game.gameId + "/set-small-blind",
        {
            amount: amount,
        },
        d => {},
        "json"
    );
};

Game.dealHands = function()
{
    $.post("api/game/" + Game.gameId + "/deal");
};

Game.dealFlop = function()
{
    $.post("api/game/" + Game.gameId + "/flop");
};

Game.dealTurn = function()
{
    $.post("api/game/" + Game.gameId + "/turn");
};

Game.dealRiver = function()
{
    $.post("api/game/" + Game.gameId + "/river");
};

Game.finishRound = function()
{
    $.post("api/game/" + Game.gameId + "/announceWinners/");
};

Game.giveChipsToPlayer = function(playerId, amount)
{
    return $.post(
        "api/game/" + Game.gameId + "/give-chips-to-player",
        {
            playerId: playerId,
            amount: amount
        },
        d => {},
        "json"
    );
};

Game.foldHand = function(playerId)
{
    $.post("api/game/" + Game.gameId + "/fold/" + playerId);
};

Game.makeBet = function(playerId, amount)
{
    $.post(
        "/api/game/" + Game.gameId + "/bet/" + playerId,
        {
            amount: amount
        },
        d => {},
        "json"
    );
};

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

var Controller = {
    playerId: null,
    eventHandlers: {}
};

Controller.startGame = function()
{
    Game.dealHands();
    //View.showFlopButton();
};

Controller.dealFlop = function()
{
    Game.dealFlop();
    View.showTurnButton();
};

Controller.dealTurn = function()
{
    Game.dealTurn();
    View.showRiverButton();
};

Controller.dealRiver = function()
{
    Game.dealRiver();
    View.showFinishButton();
};

Controller.finishRound = function()
{
    Game.finishRound();
};

Controller.foldHand = function()
{
    Game.foldHand(Controller.playerId);
    View.disableFoldButton();
};

Controller.foldPlayerHand = function()
{
    var playerId = $('#player_ids').val();
    if (playerId === "" || playerId === "all"){
        return;
    }
    Game.foldHand(playerId);
};

Controller.checkPlayerHand = function()
{
    var playerId = $('#player_ids').val();
    if (playerId === "" || playerId === "all"){
        return;
    }
    Game.makeBet(playerId, 0);
};

Controller.placeBet = function()
{
    var $amount = $('#amount');
    var amount = $amount.val() === "" ? 0 : parseInt($amount.val());
    Game.makeBet(Controller.playerId, amount);
    View.resetAmount();
    View.disableBetting();
    View.disableFoldButton();
};

Controller.check = function()
{
    var $amount = $('#amount');
    var minAmount = parseInt($amount.attr('min'));
    if (minAmount !== 0) {
        alert("Can't check, min amount is "+minAmount);
        return;
    }
    Game.makeBet(Controller.playerId, 0);
    $amount.val('');
    View.disableBetting();
    View.disableFoldButton();
};

Controller.setSmallBlind = function()
{
    var amount = $('#small-blind').val();
    Game.setSmallBlind(amount);
};

Controller.joinGame = function()
{
    var isValidName = false;
    var wantsToChangeName = Controller.wantsToChangeName();
    var playerName = Controller.getPlayerName();

    while ((!playerName || wantsToChangeName) && !isValidName) {
        playerName = prompt("What is your screen name?");

        if (playerName.length !== 0) {
            Cookies.set('playerName', playerName);
            break;
        }
        alert("Name cannot be empty.")
    }

    Controller.playerId = Controller.getPlayerId() || Controller.createPlayerId();

    Game.join(Controller.playerId, playerName).done(Controller.replayNotifications)
        .fail(function() {
            View.existingSession();
        });

    View.hideCommunityCardsButtons();
    View.disableBetting();
    View.emptyPot();
    View.showDealButton();
};

Controller.replayNotifications = function(notificationList)
{
    for (var i in notificationList) {
        let type = notificationList[i].type;
        let notification = notificationList[i].notification;
        Controller.eventHandlers[type](notification);
    }
};

Controller.getPlayerName = function()
{
    return Controller.getPlayerNameFromUrl() || Controller.getPlayerNameFromCookie();
};

Controller.getPlayerNameFromUrl = function()
{
    var urlString = window.location.href;
    var url = new URL(urlString);
    return url.searchParams.get("playerName");
};

Controller.getPlayerNameFromCookie = function()
{
    return Cookies.get('playerName');
};

Controller.getPlayerId = function()
{
    return Controller.getPlayerIdFromUrl() || Controller.getPlayerIdFromCookie();
};

Controller.getPlayerIdFromUrl = function()
{
    var url_string = window.location.href;
    var url = new URL(url_string);
    return url.searchParams.get("playerId");
};

Controller.getPlayerIdFromCookie = function()
{
    return Cookies.get('playerId');
};

Controller.createPlayerId = function()
{
    var playerId = uuidv4();
    Cookies.set('playerId', playerId);
    return playerId;
};

Controller.isFirstPlayer = function(seats)
{
    for (var index in seats) {
        var seat = seats[index];
        if (seat.playerId) {
            return seat.playerId === Controller.playerId;
        }
    }
    return false;
};

Controller.wantsToChangeName = function()
{
    var url_string = window.location.href;
    var url = new URL(url_string);
    var c = url.searchParams.get("changeName");
    return !!c;
};

Controller.getGameId = function()
{
    var urlString = window.location.href;
    var url = new URL(urlString);
    console.log(url);
    return url.searchParams.get("gameId");
};

Controller.playerAdded = function(playerAdded)
{
    View.renderPlayersForAdmin(playerAdded.players);
    View.renderPlayers([playerAdded.player], Controller.playerId);
    if (playerAdded.player.playerId !== Controller.playerId) {
        return;
    }
    if (playerAdded.isAdmin) {
        View.enableAdminControls();
    } else {
        View.disableAdminControls();
    }
};

Controller.roundStarted = function(round)
{
    View.clearTable();
    View.unhighlightWinner();
    View.renderPlayersForAdmin(round.players);
    View.renderPlayers(round.players, Controller.playerId);

    var playersWithChips = round.players.filter(player => {
       return player.chips > 0;
    });

    View.renderDownFacingHands(playersWithChips);
    View.highlightDealer(round.dealer);
};

Controller.playerDealtHand = function(playerDealtHand)
{
    View.renderPlayerHand(playerDealtHand.hand);
};

Controller.winnerByDefault = function(winnerByDefault)
{
    View.disableFoldButton();
    View.highlightWinner(winnerByDefault.playerId);
    View.emptyPot();
    View.disableBetting();
    View.showDealButton();
};

Controller.playerGivenChips = function(playerGivenChips)
{
    View.updatePlayerStack(playerGivenChips.playerId, playerGivenChips.chips);
};

Controller.winningHand = function(winner)
{
    View.renderPlayerHand(winner.hand);
    View.disableFoldButton();
    View.highlightWinner(winner.hand.playerId);
    View.emptyPot();
    View.disableBetting();
    View.showDealButton();
};

Controller.playersTurn = function(playersTurn)
{
    if (playersTurn.playerId === Controller.playerId) {
        View.enableFoldButton();
        View.enableBetting(playersTurn.amountToPlay, playersTurn.minBet);
    } else {
        View.disableFoldButton();
        View.disableBetting();
    }
    View.unhighlightPlayerToAct();
    View.highlightPlayerToAct(playersTurn.playerId);
};

Controller.givePlayerChips = function()
{
    var playerId = $('#player_ids').val();
    var amount = parseInt($('#chips-to-give').val());

    if (playerId === 'all') {
        $('#player_ids option').each(function(){
            var playerId = $(this).attr('value');
            if (playerId === 'all') {
                return;
            }
            Game.giveChipsToPlayer(playerId, amount);
        });
    } else {
        Game.giveChipsToPlayer(playerId, amount);
    }
    $('#chips-to-give').val('');
};

Controller.betMade = function(betMade)
{
    View.unhighlightPlayerToAct();
    View.showBet(betMade);
};

Controller.playerFolded = function(playerFolded)
{
    View.unhighlightPlayerToAct();
    View.foldPlayerHand(playerFolded);
};

var View = {};

View.renderPlayers = function(players, currentPlayerId)
{
    for (var index in players) {
        var player = players[index];
        if (player.playerId) {
            View.renderSeat(player.seat, player.playerId, player.playerName, player.chips, currentPlayerId);
        } else {
            View.renderEmptySeat(player.seat);
        }
    }
};

View.renderPlayersForAdmin = function(players)
{
    var $playerIds = $('#player_ids');
    $playerIds.html('<option value="">(Choose player)</option>');
    $playerIds.html('<option value="all">All Players</option>');
    for (var index in players) {
        var player = players[index];
        if (player.playerId) {
            $playerIds.append('<option value="' + player.playerId + '">' + player.playerName + '</option>');
        }
    }
};

View.renderEmptySeats = function()
{
    for (var i = 0; i < 8; i++) {
        View.renderEmptySeat(i);
    }
};

View.renderSeat = function(seat, playerId, playerName, chips, currentPlayerId)
{
    var playerClass = (playerId === currentPlayerId) ? 'player' : '';

    var $seat = $(`#seat-${seat}`);
    if ($seat.length) {
        $seat.removeClass('empty');
        $seat.removeClass(playerClass).addClass(playerClass);
        $seat.find('.name').html(playerName);
        $seat.find('.cards').attr('id', 'player-' + playerId);
        $seat.removeClass('empty');
        $seat.find('.stack').show().text(chips);
        return;
    }

    var seatHtml =
        "<div id='seat-" + seat + "' class='seat " + playerClass + "'>" +
            "<div class='name'>" + playerName + "</div>" +
            "<span class='cards' id='player-" + playerId + "'></span>" +
            "<span class='chips stack'>" + chips + "</span>" +
        "</div>";

    View.getHandsDiv(seat).append(seatHtml);
};

View.renderEmptySeat = function(seat)
{
    var title = (seat + 1) + ": (empty)";

    var $seat = $(`#seat-${seat}`);
    if ($seat.length) {
        $seat.addClass('empty');
        $seat.find('.name').html(title);
        $seat.find('.cards').html('');
        $seat.find('.stack').hide();
        return;
    }

    var seatHtml =
        "<div id='seat-" + seat + "' class='seat empty'>" +
            "<div class='name'>" + title + "</div>" +
            "<span class='cards'></span>" +
            "<span class='chips stack' style='display: none'></span>" +
        "</div>";

    View.getHandsDiv(seat).append(seatHtml);
};

View.getHandsDiv = function(seat)
{
    if (seat < 4) {
        return $('#seats-1-to-4');
    }
    return $('#seats-5-to-8');
};

View.renderPlayerHand = function(hand)
{
    var handHtml = View.renderCards(hand.cards);
    $('#player-' + hand.playerId).html(handHtml);
};

View.removeCards = function(playerIds)
{
    playerIds.map(playerId => {
        $('#player-' + playerId + ' .card').remove();
    });
};

View.foldPlayerHand = function(playerFolded)
{
    $('#player-' + playerFolded.playerId + ' .card').each(function(){
        $(this).addClass('grey');
    });
};

View.renderDownFacingHands = function(players)
{
    players.map(player => {
        var hand = [View.renderDownFacingCard(), View.renderDownFacingCard()];
        $('#player-' + player.playerId).html(hand);
    });
};

View.attachCommunityCards = function(flopDealt)
{
    $('#cards').html(View.renderCards(flopDealt.cards));
};

View.attachTurn = function(turn)
{
    $('#cards').append(View.renderCards([turn.card]));
};

View.attachRiver = function(river)
{
    $('#cards').append(View.renderCards([river.card]));
};

View.clearTable = function()
{
    $('#cards').html('');
    $('.card').remove();
};

View.renderCards = function(cards)
{
    return cards.map(function(card){
        return View.renderCard(card);
    });
};

View.renderCard = function(card)
{
    return '<img src="images/' + card + '.png" class="card"/>';
};

View.renderDownFacingCard = function()
{
    return '<img src="/images/back.png" class="card"/>';
};

View.highlightWinner = function(playerId)
{
    $('.turn').removeClass('turn');
    var $seat = $('#player-' + playerId).parent('.seat');
    $seat.addClass('winner');
};

View.unhighlightWinner = function()
{
    $('.winner').removeClass('winner');
};

View.highlightDealer = function(playerId)
{
    $('.dealer').remove();
    var dealerHtml = "<div class='dealer'>D</div>";
    $('#player-' + playerId).parent('.seat').append(dealerHtml);
};

View.enableAdminControls = function()
{
    $("#admin-controls").show();
};

View.disableAdminControls = function()
{
    $("#admin-controls").hide();
};

View.showFlopButton = function()
{
    View.hideCommunityCardsButtons();
    $('#flop').show();
};

View.showTurnButton = function()
{
    View.hideCommunityCardsButtons();
    $('#turn').show();
};

View.showRiverButton = function()
{
    View.hideCommunityCardsButtons();
    $('#river').show();
};

View.showFinishButton = function()
{
    View.hideCommunityCardsButtons();
    $('#announceWinners').show();
};

View.showDealButton = function()
{
    View.hideCommunityCardsButtons();
    $('#deal').show();
};

View.hideCommunityCardsButtons = function()
{
    $('#community-cards button').hide();
};

View.disableFoldButton = function()
{
    $('#fold').attr('disabled', 'disabled');
};

View.enableFoldButton = function()
{
    $('#fold').removeAttr('disabled');
};

View.showBet = function(bet)
{
    var betTotal = bet.total === 0 ? "check" : bet.total;
    var $seat = $('#player-' + bet.playerId).parent('.seat');
    $seat.find('.stack').text(bet.remainingChips);
    $seat.find('.bet').remove();
    $seat.append('<div class="chips bet">' + betTotal + '</div>')
};

View.clearBet = function(playerId)
{
    var $seat = $('#player-' + playerId).parent('.seat');
    $seat.find('.bet').remove();
};

View.updatePlayerStack = function(playerId, chips)
{
    var $seat = $('#player-' + playerId).parent('.seat');
    $seat.find('.stack').text(chips);
};

View.clearBets = function()
{
    $('.seat .bet').remove();
};

View.potTotal = function(potTotal)
{
    View.clearBets();
    var chips = potTotal.pots.map(pot => {
        return '&nbsp;<span class="chips">' + pot + '</span>';
    });
    $('#pot').show().html(chips);
};

View.emptyPot = function()
{
    View.clearBets();
    $('#pot').hide();
};

View.highlightPlayerToAct = function(playerId)
{
    if (!playerId){
        return;
    }
    var $seat = $('#player-' + playerId).parent('.seat');
    $seat.addClass('turn');
};

View.unhighlightPlayerToAct = function()
{
    $('.turn').removeClass('turn');
};

View.disableBetting = function() {
    $('#bet').attr('disabled', 'disabled');
    $('#check').attr('disabled', 'disabled');
    View.disableFoldButton();
};

View.enableBetting = function(minAmount, minBet)
{
    var $amount = $('#amount');
    $amount.attr('min', minAmount);

    if (minAmount === 0) {
        $('#bet').text('Raise');
        $amount.val(minBet);
    } else {
        $('#bet').text('Bet');
        if ($amount.val() === "") {
            $('#amount').val(minAmount);
        }
    }

    $('#bet').removeAttr('disabled');

    if (minAmount === 0) {
        $('#check').removeAttr('disabled');
    } else {
        $('#check').attr('disabled', 'disabled');
    }
};

View.resetAmount = function()
{
    var $amount = $('#amount');
    $amount.val('');
};

View.existingSession = function()
{
    alert("Other tab/window already opened on this machine. Please go to the active tab/window to play.");
};

View.playerHandTitle = function(playerHandTitle)
{
    console.log('Hand title: ' + playerHandTitle.title);
};

var Bootstrapper = {};

Bootstrapper.boot = function()
{
    var gameId = Controller.getGameId();
    if (!gameId) {
        window.location.href = "/start.html";
        return;
    }

    var socket = io(window.location.href);

    Bootstrapper.attachHtmlEventListeners();
    Bootstrapper.attachSocketEventListeners(socket);
    View.renderEmptySeats();

    socket.on('connect', function() {
        Game.bootClient(gameId, socket.id);
        Controller.joinGame();
    });
};

Bootstrapper.attachHtmlEventListeners = function()
{
    $("#deal").click(function(){
        Controller.startGame();
    });
    $("#flop").click(function(){
        Controller.dealFlop();
    });
    $("#turn").click(function(){
        Controller.dealTurn();
    });
    $("#river").click(function(){
        Controller.dealRiver();
    });
    $("#announceWinners").click(function(){
        Controller.finishRound();
    });
    $("#fold").click(function(){
        Controller.foldHand();
    });
    $("#give-chips").click(function(){
        Controller.givePlayerChips();
    });
    $("#set-small-blind").click(function(){
        Controller.setSmallBlind();
    });
    $('#bet').click(function(){
        Controller.placeBet();
    });
    $('#check').click(function(){
        Controller.check();
    });
    $('#fold-player').click(function(){
        Controller.foldPlayerHand();
    });
    $('#check-player').click(function(){
        Controller.checkPlayerHand();
    });
};

Bootstrapper.attachSocketEventListeners = function(socket)
{
    Controller.eventHandlers = {
        'playerAdded': Controller.playerAdded,
        'playerGivenChips': Controller.playerGivenChips,
        'roundStarted': Controller.roundStarted,
        'playerDealtHand': Controller.playerDealtHand,
        'playerHandTitle': View.playerHandTitle,
        'winningHand': Controller.winningHand,
        'winnerByDefault': Controller.winnerByDefault,
        'flopDealt': View.attachCommunityCards,
        'turnDealt': View.attachTurn,
        'riverDealt': View.attachRiver,
        'playerFolded': Controller.playerFolded,
        'betMade': Controller.betMade,
        'potTotal': View.potTotal,
        'playersTurn': Controller.playersTurn
    };

    for (var event in Controller.eventHandlers) {
        socket.on(event, Controller.eventHandlers[event]);
    }
};