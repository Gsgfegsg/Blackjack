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

const STARTING_MONEY = 2000;
const STORAGE_KEY = "blackjack_bankroll";
const HIGHSCORE_KEY = "blackjack_highscore";
const THEME_KEY = "blackjack_theme";

// Pip positions (x%, y%, flip) for number cards, based on standard playing-card layouts.
// Kept inset from the edges so pips never overlap the corner rank/suit indices.
const PIP_LAYOUTS = {
  2: [[50, 24, false], [50, 76, true]],
  3: [[50, 24, false], [50, 50, false], [50, 76, true]],
  4: [[30, 24, false], [70, 24, false], [30, 76, true], [70, 76, true]],
  5: [[30, 24, false], [70, 24, false], [50, 50, false], [30, 76, true], [70, 76, true]],
  6: [[30, 22, false], [70, 22, false], [30, 50, false], [70, 50, false], [30, 78, true], [70, 78, true]],
  7: [[30, 20, false], [70, 20, false], [50, 35, false], [30, 50, false], [70, 50, false], [30, 80, true], [70, 80, true]],
  8: [[30, 18, false], [70, 18, false], [50, 32, false], [30, 50, false], [70, 50, false], [50, 68, true], [30, 82, true], [70, 82, true]],
  9: [[30, 17, false], [70, 17, false], [30, 38, false], [70, 38, false], [50, 50, false], [30, 62, true], [70, 62, true], [30, 83, true], [70, 83, true]],
  10: [[30, 15, false], [70, 15, false], [50, 26, false], [30, 40, false], [70, 40, false], [30, 60, true], [70, 60, true], [50, 74, true], [30, 85, true], [70, 85, true]],
};

let deck = [];
let playerHand = [];
let dealerHand = [];
let money = loadMoney();
let highscore = loadHighscore();
let bet = 0;
let firstPlay = true;
let roundOver = true;
let dealerHoleHidden = false;

// ---------- DOM references ----------

const moneyDisplay = document.getElementById("moneyDisplay");
const highscoreDisplay = document.getElementById("highscoreDisplay");
const themeToggle = document.getElementById("themeToggle");
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

const brokeModal = document.getElementById("brokeModal");
const modalResetBtn = document.getElementById("modalResetBtn");
const modalDismissBtn = document.getElementById("modalDismissBtn");
const brokeNote = document.getElementById("brokeNote");
const brokeResetLink = document.getElementById("brokeResetLink");

// ---------- Persistence ----------

function loadMoney() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const parsed = saved === null ? NaN : parseInt(saved, 10);
  return Number.isFinite(parsed) ? parsed : STARTING_MONEY;
}

function saveMoney() {
  localStorage.setItem(STORAGE_KEY, String(money));
  checkHighscore();
}

function loadHighscore() {
  const saved = localStorage.getItem(HIGHSCORE_KEY);
  const parsed = saved === null ? NaN : parseInt(saved, 10);
  return Number.isFinite(parsed) ? parsed : STARTING_MONEY;
}

function saveHighscore() {
  localStorage.setItem(HIGHSCORE_KEY, String(highscore));
}

function checkHighscore() {
  if (money > highscore) {
    highscore = money;
    saveHighscore();
    renderHighscore(true);
  }
}

// ---------- Theme ----------

function loadTheme() {
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "felt";
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  themeToggle.textContent = theme === "dark" ? "🌲" : "🌑";
  themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to green felt table" : "Switch to dark table"
  );
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

function renderHighscore(flash) {
  highscoreDisplay.textContent = formatMoney(highscore);
  highscoreDisplay.classList.remove("flash-win");
  if (flash) {
    // restart the animation even if it's already mid-flash
    void highscoreDisplay.offsetWidth;
    highscoreDisplay.classList.add("flash-win");
  }
}

function cardEl(card, hidden) {
  const el = document.createElement("div");
  if (hidden) {
    el.className = "card card-back";
    return el;
  }
  el.className = `card ${card.color}`;

  const topCorner = cornerIndex(card, false);
  const bottomCorner = cornerIndex(card, true);

  const pipLayout = PIP_LAYOUTS[Number(card.rank)];
  if (pipLayout) {
    const pipField = document.createElement("div");
    pipField.className = "card-pips";
    pipLayout.forEach(([x, y, flip]) => {
      const pip = document.createElement("span");
      pip.className = "pip";
      pip.textContent = card.symbol;
      pip.style.left = `${x}%`;
      pip.style.top = `${y}%`;
      pip.style.transform = flip
        ? "translate(-50%, -50%) rotate(180deg)"
        : "translate(-50%, -50%)";
      pipField.appendChild(pip);
    });
    el.append(topCorner, pipField, bottomCorner);
  } else {
    const suitCenter = document.createElement("div");
    suitCenter.className = "card-suit-center";
    suitCenter.textContent = card.symbol;
    el.append(topCorner, suitCenter, bottomCorner);
  }
  return el;
}

function cornerIndex(card, flipped) {
  const wrap = document.createElement("div");
  wrap.className = flipped ? "corner corner-bottom" : "corner corner-top";
  const rank = document.createElement("span");
  rank.className = "corner-rank";
  rank.textContent = shortRank(card.rank);
  const suit = document.createElement("span");
  suit.className = "corner-suit";
  suit.textContent = card.symbol;
  wrap.append(rank, suit);
  return wrap;
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

  const broke = money <= 0;
  dealBtn.disabled = broke;
  brokeNote.hidden = !broke;
  if (broke) {
    brokeModal.hidden = false;
  } else {
    brokeModal.hidden = true;
  }
}

function showActionControls() {
  betControls.hidden = true;
  actionControls.hidden = false;
  nextControls.hidden = true;
  hitBtn.disabled = false;
  standBtn.disabled = false;
}

function showNextControls() {
  betControls.hidden = true;
  actionControls.hidden = true;
  nextControls.hidden = false;
  hitBtn.disabled = true;
  standBtn.disabled = true;
  doubleBtn.disabled = true;
}

function clearTable() {
  playerHand = [];
  dealerHand = [];
  renderHands({});
  betInput.value = "";
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
  setMessage(`Blackjack! You win £${winnings.toLocaleString("en-GB")}.`, true);
  renderMoney("win");
  showNextControls();
}

function playerHit() {
  if (actionControls.hidden) return;
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
  if (actionControls.hidden) return;
  dealerPlay();
}

function playerDoubleDown() {
  if (actionControls.hidden || !firstPlay) return;
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
  hitBtn.disabled = true;
  standBtn.disabled = true;
  doubleBtn.disabled = true;

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
  clearTable();
  betInput.max = String(money);
  setMessage(
    money <= 0
      ? "You're out of money. Reset your bankroll to keep playing."
      : "Place a bet to begin the next hand."
  );
  showBetControls();
}

function resetBankroll() {
  money = STARTING_MONEY;
  saveMoney();
  renderMoney();
  clearTable();
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

themeToggle.addEventListener("click", () => {
  applyTheme(document.body.dataset.theme === "dark" ? "felt" : "dark");
});

modalResetBtn.addEventListener("click", () => {
  brokeModal.hidden = true;
  resetBankroll();
});

modalDismissBtn.addEventListener("click", () => {
  brokeModal.hidden = true;
});

brokeResetLink.addEventListener("click", resetBankroll);

// ---------- Init ----------

deck = buildDeck();
shuffle(deck);
applyTheme(loadTheme());
renderMoney();
renderHighscore();
renderHands({});
betInput.max = String(money);
showBetControls();
