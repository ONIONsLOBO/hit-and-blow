const COLORS = [
  { name: "赤", hex: "#e03131" },
  { name: "緑", hex: "#2f9e44" },
  { name: "青", hex: "#1c7ed6" },
  { name: "黄", hex: "#fcc419" },
  { name: "橙", hex: "#fd7e14" },
  { name: "紫", hex: "#7048e8" },
  { name: "桃", hex: "#f06595" },
  { name: "水", hex: "#15aabf" },
  { name: "茶", hex: "#8d6e4c" },
  { name: "灰", hex: "#868e96" },
];
const MAX_TURNS = 10;

const $ = (id) => document.getElementById(id);
const slotsSelect = $("slots");
const limitSelect = $("limit");
const modeSelect = $("mode");
const CPU_DELAY = 800; // CPUが次の予想を出すまでの時間(ミリ秒)

let slots, colorCount, answer, guess, log, over;
let limitSec, remaining, endAt, timerId = null;
let secret, cpuLog, turn; // 対戦モード用(secret=自分の答え / cpuLog=CPUの予想履歴 / turn="player"か"cpu")
let mode, phase, candidates, cpuTimer; // CPUモード用(phase: "set"=答えを決める / "run"=CPUが予想中)

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ボールを1個作る(色の名前は画面に出さない)
function makeBall(index, tag = "span") {
  const b = document.createElement(tag);
  b.className = "ball";
  b.style.backgroundColor = COLORS[index].hex;
  if (tag === "button") {
    b.type = "button";
    b.setAttribute("aria-label", COLORS[index].name);
  }
  return b;
}

function makeSlot(text = "") {
  const s = document.createElement("span");
  s.className = "slot";
  s.textContent = text;
  return s;
}

// HIT=色も位置も一致 / BLOW=色だけ一致(同じ色を重ねた予想でも数え過ぎない)
function judge(ans, g) {
  const hit = g.filter((c, i) => c === ans[i]).length;
  let common = 0;
  for (let c = 0; c < COLORS.length; c++) {
    common += Math.min(
      ans.filter((x) => x === c).length,
      g.filter((x) => x === c).length
    );
  }
  return { hit, blow: common - hit };
}

function newGame() {
  mode = modeSelect.value;
  const cpu = mode === "cpu";
  const multi = mode !== "player"; // CPUが予想するモード(CPU・対戦)
  // CPUモードは候補を全部数え上げるので、ボールは8個まで
  [...slotsSelect.options].forEach((o) => { o.disabled = multi && Number(o.value) > 8; });
  if (multi && Number(slotsSelect.value) > 8) slotsSelect.value = "8";
  limitSelect.disabled = multi;
  clearTimeout(cpuTimer);
  phase = "set";

  slots = Number(slotsSelect.value);
  colorCount = Math.max(6, slots);
  const size = slots <= 6 ? 46 : slots <= 8 ? 40 : 34;
  document.documentElement.style.setProperty("--ball", size + "px");

  answer = cpu ? [] : shuffle([...Array(colorCount).keys()]).slice(0, slots);
  guess = [];
  log = [];
  cpuLog = [];
  secret = [];
  turn = "player";
  over = false;

  stopTimer();
  limitSec = multi ? 0 : Number(limitSelect.value) * 60;
  remaining = limitSec;
  $("timer").hidden = !limitSec;
  showTimer();

  $("message").textContent = "";
  $("restart").hidden = true;
  render();
}

function drawHistory(list, items) {
  list.replaceChildren();
  items.forEach((h, i) => {
    const li = document.createElement("li");
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = i + 1;
    li.append(n);
    h.guess.forEach((c) => li.append(makeBall(c)));
    const score = document.createElement("div");
    score.className = "score";
    score.innerHTML = `HIT <b>${h.hit}</b> / BLOW <b>${h.blow}</b>`;
    li.append(score);
    list.append(li);
  });
}

function render() {
  // 入力を止める場面: 終了後 / 対戦でCPUの番
  const lock = over || (mode === "versus" && phase === "play" && turn === "cpu");
  const setting = mode === "cpu" || (mode === "versus" && phase === "set"); // 自分の答えを決める場面
  $("answerTitle").textContent = mode === "versus" ? "CPUの答え(あなたが当てる)" : "答え";

  // 答え(終わるまで「?」)
  const ansRow = $("answer");
  ansRow.replaceChildren();
  const showAnswer = over || mode === "cpu"; // CPUモードの答えは自分で決めたものなので見せる
  for (let i = 0; i < slots; i++) {
    ansRow.append(showAnswer && answer[i] !== undefined ? makeBall(answer[i]) : makeSlot("?"));
  }

  // 履歴
  let turnText;
  if (over) turnText = `${log.length}回で終了`;
  else if (mode === "cpu") turnText = phase === "set" ? "履歴" : `CPUの予想(${log.length}回目まで)`;
  else if (mode === "versus") turnText = phase === "set" ? "あなたの予想の履歴" : `あなたの予想(${log.length}回目まで)`;
  else turnText = `${log.length + 1} / ${MAX_TURNS} 回目`;
  $("turn").textContent = turnText;

  $("play").hidden = mode === "cpu" && phase === "run";
  $("playTitle").textContent =
    setting ? "あなたの答えを並べてください(同じ色は使えません)" : "あなたの予想";
  drawHistory($("history"), log);

  // 対戦モード: 自分の答えとCPUの予想
  $("cpuBox").hidden = mode !== "versus";
  const secRow = $("secret");
  secRow.replaceChildren();
  for (let i = 0; i < slots; i++) secRow.append(secret[i] !== undefined ? makeBall(secret[i]) : makeSlot());
  drawHistory($("cpuHistory"), cpuLog);

  // 今の予想(ボールを押すと外せる)
  const gRow = $("guess");
  gRow.replaceChildren();
  for (let i = 0; i < slots; i++) {
    if (i < guess.length) {
      const b = makeBall(guess[i], "button");
      b.title = "クリックで外す";
      b.disabled = lock;
      b.onclick = () => { guess.splice(i, 1); render(); };
      gRow.append(b);
    } else {
      gRow.append(makeSlot());
    }
  }

  // パレット(同じ色を何回でも選べる)
  const pal = $("palette");
  pal.replaceChildren();
  for (let i = 0; i < colorCount; i++) {
    const b = makeBall(i, "button");
    b.disabled = lock || guess.length >= slots || (setting && guess.includes(i));
    b.onclick = () => { guess.push(i); startTimer(); render(); };
    pal.append(b);
  }

  $("submit").disabled = lock || guess.length !== slots;
  $("clear").disabled = lock || guess.length === 0;
}

// ===== 制限時間 =====
function showTimer() {
  const m = String(Math.floor(remaining / 60)).padStart(2, "0");
  const s = String(remaining % 60).padStart(2, "0");
  const t = $("timer");
  t.textContent = `残り ${m}:${s}` + (timerId || over ? "" : "(最初のボールを置くとスタート)");
  t.classList.toggle("warn", limitSec > 0 && remaining <= 10);
}

function startTimer() {
  if (!limitSec || timerId) return;
  endAt = Date.now() + remaining * 1000;
  timerId = setInterval(() => {
    remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    showTimer();
    if (remaining === 0) timeUp();
  }, 250);
  showTimer();
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function timeUp() {
  stopTimer();
  over = true;
  guess = [];
  $("message").textContent = "時間切れです。正解は上の答えでした";
  $("restart").hidden = false;
  render();
}

// ===== 決定 =====
// ===== CPUモード =====
// n色からk個を重ならないように並べた全パターン
function permutations(n, k) {
  const out = [], used = Array(n).fill(false), cur = [];
  (function go() {
    if (cur.length === k) { out.push([...cur]); return; }
    for (let c = 0; c < n; c++) {
      if (used[c]) continue;
      used[c] = true; cur.push(c);
      go();
      cur.pop(); used[c] = false;
    }
  })();
  return out;
}

function startCpu() {
  answer = [...guess];
  guess = [];
  phase = "run";
  candidates = permutations(colorCount, slots);
  render();
  cpuTimer = setTimeout(cpuStep, CPU_DELAY);
}

// 今までの結果と矛盾しない候補の中から、ランダムに1つ予想する
function cpuStep() {
  const vs = mode === "versus";
  const target = vs ? secret : answer; // CPUが当てる相手の答え
  const hist = vs ? cpuLog : log;      // CPUの予想履歴
  const g = candidates[Math.floor(Math.random() * candidates.length)];
  const r = judge(target, g);
  hist.push({ guess: g, hit: r.hit, blow: r.blow });

  if (r.hit === slots) {
    over = true;
    $("message").textContent = vs
      ? `CPUの勝ちです(CPUは${hist.length}回で当てました)`
      : `CPUは${hist.length}回で当てました`;
    $("restart").hidden = false;
  } else {
    // 「その候補が答えだったら、同じ結果になったか」で絞り込む
    candidates = candidates.filter((c) => {
      const x = judge(c, g);
      return x.hit === r.hit && x.blow === r.blow;
    });
    if (vs) {
      turn = "player";
      $("message").textContent = "あなたの番です";
    } else {
      cpuTimer = setTimeout(cpuStep, CPU_DELAY);
    }
  }
  render();
}

// 対戦モード: 自分の答えが決まったので開始(自分が先攻)
function startVersus() {
  secret = [...guess];
  guess = [];
  phase = "play";
  turn = "player";
  candidates = permutations(colorCount, slots);
  $("message").textContent = "あなたの番です";
  render();
}

function submit() {
  if (mode === "cpu") { startCpu(); return; }
  if (mode === "versus" && phase === "set") { startVersus(); return; }
  const { hit, blow } = judge(answer, guess);
  log.push({ guess: [...guess], hit, blow });
  guess = [];

  if (hit === slots) {
    over = true;
    $("message").textContent = mode === "versus"
      ? `あなたの勝ちです(${log.length}回で当てました)`
      : `正解です。${log.length}回でクリアしました`;
  } else if (mode === "versus") {
    turn = "cpu";
    $("message").textContent = "CPUが考え中…";
    cpuTimer = setTimeout(cpuStep, CPU_DELAY);
  } else if (log.length >= MAX_TURNS) {
    over = true;
    $("message").textContent = "ゲームオーバーです。正解は上の答えでした";
  }
  if (over) stopTimer();
  $("restart").hidden = !over;
  render();
}

$("submit").onclick = submit;
$("clear").onclick = () => { guess = []; render(); };
$("restart").onclick = newGame;
slotsSelect.onchange = newGame;
limitSelect.onchange = newGame;
modeSelect.onchange = newGame;

newGame();
