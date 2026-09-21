// ---------- Blackjack game logic (ported from the Python CLI version) ----------

const SUITS = [
  { name: "Hearts", symbol: "♥", color: "red" },
  { name: "Diamonds", symbol: "♦", color: "red" },
  { name: "Spades", symbol: "♠", color: "black" },
  { name: "Clubs", symbol: "♣", color: "black" },
];

const RANKS = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "Jack", "Queen", "King", "Ace",
];

const RANK_VALUES = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
  Jack: 10, Queen: 10, King: 10, Ace: 11,
};

const STARTING_MONEY = 5000;
const STORAGE_KEY = "blackjack_bankroll";

let deck = [];
let playerHand = [];
let dealerHand = [];
let money = loadMoney();
let bet = 0;
let firstPlay = true;
let roundOver = true;
let dealerHoleHidden = false;

// ---------- DOM references ----------

const moneyDisplay = document.getElementById("moneyDisplay");
const messageEl = document.getElementById("message");
const dealerCardsEl = document.getElementById("dealerCards");
const playerCardsEl = document.getElementById("playerCards");
const dealerTotalEl = document.getElementById("dealerTotal");
const playerTotalEl = document.getElementById("playerTotal");

const betControls = document.getElementById("betControls");
const actionControls = document.getElementById("actionControls");
const nextControls = document.getElementById("nextControls");

const betInput = document.getElementById("betInput");
const dealBtn = document.getElementById("dealBtn");
const hitBtn = document.getElementById("hitBtn");
const standBtn = document.getElementById("standBtn");
const doubleBtn = document.getElementById("doubleBtn");
const nextRoundBtn = document.getElementById("nextRoundBtn");
const resetBtn = document.getElementById("resetBtn");
const chipRow = document.getElementById("chipRow");

// ---------- Persistence ----------

function loadMoney() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const parsed = saved === null ? NaN : parseInt(saved, 10);
  return Number.isFinite(parsed) ? parsed : STARTING_MONEY;
}

function saveMoney() {
  localStorage.setItem(STORAGE_KEY, String(money));
}

// ---------- Deck helpers ----------

function buildDeck() {
  const newDeck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      newDeck.push({ rank, suit: suit.name, symbol: suit.symbol, color: suit.color });
    }
  }
  return newDeck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function drawCard() {
  if (deck.length === 0) {
    deck = buildDeck();
    shuffle(deck);
  }
  return deck.pop();
}

function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === "Ace") aces += 1;
    total += RANK_VALUES[card.rank];
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}

// ---------- Rendering ----------

function formatMoney(n) {
  return `£${n.toLocaleString("en-GB")}`;
}

function renderMoney(flash) {
  moneyDisplay.textContent = formatMoney(money);
  moneyDisplay.classList.remove("flash-win", "flash-lose");
  if (flash) {
    moneyDisplay.classList.add(flash === "win" ? "flash-win" : "flash-lose");
  }
}

function cardEl(card, hidden) {
  const el = document.createElement("div");
  if (hidden) {
    el.className = "card card-back";
    return el;
  }
  el.className = `card ${card.color}`;
  const topRank = document.createElement("div");
  topRank.className = "card-rank";
  topRank.textContent = card.rank === "10" ? "10" : card.rank[0] === "1" ? card.rank : card.rank[0];
  topRank.textContent = shortRank(card.rank);

  const suitCenter = document.createElement("div");
  suitCenter.className = "card-suit-center";
  suitCenter.textContent = card.symbol;

  const bottomRank = document.createElement("div");
  bottomRank.className = "card-rank bottom";
  bottomRank.textContent = shortRank(card.rank);

  el.append(topRank, suitCenter, bottomRank);
  return el;
}

function shortRank(rank) {
  if (rank === "10") return "10";
  if (["Jack", "Queen", "King", "Ace"].includes(rank)) return rank[0];
  return rank;
}

function renderHands({ hideDealerHole } = {}) {
  playerCardsEl.innerHTML = "";
  playerHand.forEach((c) => playerCardsEl.appendChild(cardEl(c)));
  playerTotalEl.textContent = playerHand.length ? handValue(playerHand) : "";

  dealerCardsEl.innerHTML = "";
  dealerHand.forEach((c, i) => {
    const hide = hideDealerHole && i === 1;
    dealerCardsEl.appendChild(cardEl(c, hide));
  });
  dealerTotalEl.textContent =
    dealerHand.length === 0 ? "" : hideDealerHole ? handValue([dealerHand[0]]) : handValue(dealerHand);
}

function setMessage(text, isResult) {
  messageEl.textContent = text;
  messageEl.classList.toggle("is-result", Boolean(isResult));
}

function showBetControls() {
  betControls.hidden = false;
  actionControls.hidden = true;
  nextControls.hidden = true;
}

function showActionControls() {
  betControls.hidden = true;
  actionControls.hidden = false;
  nextControls.hidden = true;
}

function showNextControls() {
  betControls.hidden = true;
  actionControls.hidden = true;
  nextControls.hidden = false;
}

// ---------- Game flow ----------

function startRound() {
  const requested = parseInt(betInput.value, 10);

  if (!Number.isFinite(requested) || requested <= 0) {
    setMessage("Enter a valid bet amount.");
    return;
  }
  if (requested > money) {
    setMessage("You can't bet more than your bankroll.");
    return;
  }

  bet = requested;
  firstPlay = true;
  roundOver = false;
  playerHand = [];
  dealerHand = [];

  if (deck.length < 15) {
    deck = buildDeck();
    shuffle(deck);
  }

  playerHand.push(drawCard(), drawCard());
  dealerHand.push(drawCard(), drawCard());

  renderHands({ hideDealerHole: true });

  if (isBlackjack(playerHand)) {
    finishBlackjack();
    return;
  }

  setMessage(`Bet £${bet.toLocaleString("en-GB")} in play. Hit, stand, or double down.`);
  doubleBtn.disabled = requested * 2 > money;
  showActionControls();
}

function finishBlackjack() {
  const winnings = Math.floor((bet * 3) / 2);
  money += winnings;
  saveMoney();
  renderHands({ hideDealerHole: false });
  setMessage(`Blackjack! You win £${winnings.toLocaleString("en-GB")}.`, true);
  renderMoney("win");
  showNextControls();
}

function playerHit() {
  firstPlay = false;
  playerHand.push(drawCard());
  renderHands({ hideDealerHole: true });

  const total = handValue(playerHand);
  if (total > 21) {
    money -= bet;
    saveMoney();
    renderMoney("lose");
    setMessage(`Bust at ${total}. You lose £${bet.toLocaleString("en-GB")}.`, true);
    showNextControls();
    roundOver = true;
  } else {
    setMessage(`You have ${total}. Hit, stand, or double down.`);
    doubleBtn.disabled = true;
  }
}

function playerStand() {
  dealerPlay();
}

function playerDoubleDown() {
  if (!firstPlay) return;
  if (bet * 2 > money) {
    setMessage("Not enough bankroll to double down.");
    return;
  }
  bet *= 2;
  playerHand.push(drawCard());
  renderHands({ hideDealerHole: true });

  const total = handValue(playerHand);
  if (total > 21) {
    money -= bet;
    saveMoney();
    renderMoney("lose");
    setMessage(`Bust at ${total} on a doubled £${bet.toLocaleString("en-GB")} bet.`, true);
    showNextControls();
    roundOver = true;
    return;
  }
  dealerPlay();
}

function dealerPlay() {
  renderHands({ hideDealerHole: false });
  setMessage(`Dealer reveals ${handValue(dealerHand)}.`);
  actionControls.hidden = true;

  const step = () => {
    if (handValue(dealerHand) < 17) {
      dealerHand.push(drawCard());
      renderHands({ hideDealerHole: false });
      setMessage(`Dealer draws, now at ${handValue(dealerHand)}.`);
      setTimeout(step, 700);
    } else {
      resolveRound();
    }
  };
  setTimeout(step, 700);
}

function resolveRound() {
  const playerTotal = handValue(playerHand);
  const dealerTotal = handValue(dealerHand);
  roundOver = true;

  if (dealerTotal > 21) {
    money += bet;
    saveMoney();
    renderMoney("win");
    setMessage(`Dealer busts at ${dealerTotal}. You win £${bet.toLocaleString("en-GB")}.`, true);
  } else if (playerTotal > dealerTotal) {
    money += bet;
    saveMoney();
    renderMoney("win");
    setMessage(`You win, ${playerTotal} beats ${dealerTotal}. +£${bet.toLocaleString("en-GB")}.`, true);
  } else if (dealerTotal > playerTotal) {
    money -= bet;
    saveMoney();
    renderMoney("lose");
    setMessage(`Dealer wins, ${dealerTotal} beats ${playerTotal}. -£${bet.toLocaleString("en-GB")}.`, true);
  } else {
    renderMoney();
    setMessage(`Push at ${playerTotal}. Your bet is returned.`, true);
  }

  showNextControls();
}

function nextRound() {
  if (money <= 0) {
    setMessage("You're out of money. Reset your bankroll to keep playing.");
    showBetControls();
    dealBtn.disabled = true;
    return;
  }
  betInput.max = String(money);
  if (parseInt(betInput.value, 10) > money) {
    betInput.value = String(money);
  }
  setMessage("Place a bet to begin the next hand.");
  showBetControls();
}

function resetBankroll() {
  money = STARTING_MONEY;
  saveMoney();
  renderMoney();
  dealBtn.disabled = false;
  playerHand = [];
  dealerHand = [];
  renderHands({});
  setMessage("Bankroll reset. Place a bet to begin.");
  showBetControls();
}

// ---------- Event wiring ----------

dealBtn.addEventListener("click", startRound);
hitBtn.addEventListener("click", playerHit);
standBtn.addEventListener("click", playerStand);
doubleBtn.addEventListener("click", playerDoubleDown);
nextRoundBtn.addEventListener("click", nextRound);
resetBtn.addEventListener("click", resetBankroll);

chipRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  const value = btn.dataset.value;
  betInput.value = value === "max" ? String(money) : value;
});

betInput.addEventListener("change", () => {
  const v = parseInt(betInput.value, 10);
  if (!Number.isFinite(v) || v < 1) betInput.value = "1";
  if (v > money) betInput.value = String(money);
});

// ---------- Init ----------

deck = buildDeck();
shuffle(deck);
renderMoney();
renderHands({});
betInput.max = String(money);
showBetControls();
