/* Words on screen, in English and Traditional Chinese. One table, one lookup. */

const KEY = 'triop.lang.v1';

function detect() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch { /* private mode */ }
  const nav = (globalThis.navigator && (navigator.language || '')) || '';
  return /^zh/i.test(nav) ? 'zh' : 'en';
}

let current = detect();
const listeners = [];

export const lang = () => current;
export function setLang(l) {
  current = l === 'zh' ? 'zh' : 'en';
  try { localStorage.setItem(KEY, current); } catch { /* ignore */ }
  if (globalThis.document && document.documentElement) {
    document.documentElement.lang = current === 'zh' ? 'zh-Hant' : 'en';
  }
  listeners.forEach((f) => f(current));
}
export const onLang = (f) => listeners.push(f);

const S = {
  /* chrome */
  title: ['TriOp', 'TriOp'],
  mode_daily: ['Daily', '每日'],
  mode_ladder: ['Ladder', '階梯'],
  mode_classic: ['Classic', '經典'],
  mode_sprint: ['Sprint', '衝刺'],
  mode_deduce: ['Deduce', '推理'],
  modes: ['Modes', '玩法'],
  more: ['More', '更多'],
  close: ['Close', '關閉'],
  difficulty: ['Difficulty', '難度'],
  easy: ['Easy', '簡單'], normal: ['Normal', '普通'], hard: ['Hard', '困難'],
  sound_on: ['Sound on', '聲音 開'],
  sound_off: ['Sound off', '聲音 關'],
  language: ['中文', 'English'],
  records: ['Your records', '你的紀錄'],
  feed: ['What happened', '剛剛發生'],
  rules_title: ['Rules', '規則'],
  first_again: ['Play the first minute again', '再玩一次入門'],
  daily_line: ['Daily #{n}: same board for everyone today.', '每日 #{n}：今天大家同一盤。'],
  best: ['Best', '最佳'], plays: ['Plays', '次數'],
  streak: ['Daily streak', '連續天數'], dailies: ['Dailies played', '每日已玩'],
  mode_ladder_sub: ['walk one number to the target', '一步步走到目標'],
  mode_classic_sub: ['find the three-tile combos', '找出三牌組合'],
  mode_sprint_sub: ['one combo per target, against the clock', '計時，每個目標一組'],
  mode_deduce_sub: ['guess the hidden three', '猜出藏起來的三張'],
  mode_daily_sub: ['today: {mode}', '今天：{mode}'],

  /* goals, one sentence per mode */
  goal_ladder: ['Tap tiles to walk your number to the target.', '點牌，把數字一步步走到目標。'],
  goal_classic: ['Pick three tiles that make the target.', '選三張牌，湊出目標數字。'],
  goal_sprint: ['Pick three tiles that make the target, fast.', '選三張牌湊出目標，越快越好。'],
  goal_deduce: ['Find the hidden three tiles. Each guess gives clues.', '找出藏起來的三張牌，每猜一次給線索。'],

  /* new-rule callouts, shown the first time a mode opens */
  rule_ladder: ['Grey tiles would leave a fraction.', '灰色的牌會變成分數，不能走。'],
  rule_classic: ['The first tile gives only its number.', '第一張牌只取數字，符號不算。'],
  rule_sprint: ['The board never changes. Only the target does.', '牌不會變，只有目標會換。'],
  rule_deduce: ['✓ right place. ↔ wrong place. · not in it.', '✓ 位置對　↔ 位置錯　· 不在裡面'],

  /* HUD */
  hud_now: ['Now', '現在'], hud_target: ['Target', '目標'], hud_tiles: ['Tiles / par', '步／標準'],
  hud_time: ['Time', '時間'], hud_found: ['Found', '找到'], hud_score: ['Score', '分數'],
  hud_cleared: ['Cleared', '過關'], hud_timeleft: ['Time left', '剩餘'],
  hud_hidden: ['Hidden', '藏著'], hud_left: ['Guesses left', '剩幾次'],
  hud_possible: ['Still possible', '還可能'], hud_guessed: ['Guessed', '已猜'],
  par_sub: ['best {opt}', '最佳 {opt}'],
  exist_sub: ['{n} exist', '共 {n} 組'],
  chain_sub: ['chain ×{n}', '連擊 ×{n}'],

  /* controls */
  undo: ['Undo', '復原'], reset: ['Reset', '重來'], hint: ['Hint', '提示'], giveup: ['Give up', '放棄'],
  new_ladder: ['New ladder', '新的一盤'], new_board: ['New board', '新的一盤'],
  new_run: ['New run', '再跑一次'], new_puzzle: ['New puzzle', '新的一盤'],
  reveal: ['Reveal', '看答案'], skip: ['Skip', '跳過'], guess: ['Guess', '猜'],
  play_again: ['Play again', '再玩一次'], copy_result: ['Copy result', '複製成績'],
  copied: ['Copied', '已複製'], copy_fail: ['Press Ctrl+C to copy', '請手動複製'],
  next_daily: ['Practice {mode}', '練習{mode}'],

  /* stage */
  pick_start: ['Pick a tile to start', '先選一張牌'],
  any_combo: ['Any one combo clears it', '任一組合就過關'],
  press_guess: ['then Guess', '再按「猜」'],
  deduce_idle: ['Pick three tiles, then Guess.', '選三張牌，再按「猜」。'],
  arrived: ['arrived', '到了'],

  /* feed: ladder */
  l_walk: ['Walk {start} to {target}. Par {par}, best {opt}.', '從 {start} 走到 {target}。標準 {par} 步，最佳 {opt} 步。'],
  l_fraction: ['{k} would leave a fraction.', '{k} 會變成分數。'],
  l_stuck: ['No short route from here. Undo a step.', '這裡走不到了，退一步。'],
  l_hint: ['Hint: play {k} next, {n} left from here. −{cost}', '提示：下一步走 {k}，還差 {n} 步。−{cost}'],
  l_noroute: ['No route from here. Undo first.', '這裡沒有路，先退一步。'],
  l_win: ['Reached {target} in {n} tiles, {verdict}. Score {score}.', '{n} 步到達 {target}，{verdict}。得分 {score}。'],
  l_perfect: ['the best line', '最佳路線'], l_onpar: ['on par', '剛好標準'], l_over: ['{n} over par', '超過 {n} 步'],
  l_gaveup: ['Gave up. From {v} the shortest finish was {route}.', '放棄了。從 {v} 最短是 {route}。'],
  gaveup: ['Gave up.', '放棄了。'],

  /* feed: classic */
  c_new: ['Find {need} of the {n} combos that make {target}.', '{n} 組裡找出 {need} 組等於 {target}。'],
  c_new_all: ['Find all {need} combos that make {target}.', '找出全部 {need} 組等於 {target}。'],
  tried: ['{k} already tried', '{k} 試過了'],
  hit: ['{k} = {target}  +{p}', '{k} = {target}　+{p}'],
  miss: ['{k} = {v}{off}  −{p}', '{k} = {v}{off}　−{p}'],
  off_by: [' (off by {n})', '（差 {n}）'],
  c_hint: ['Hint: a combo starts {k}_  −{cost}', '提示：有一組以 {k} 開頭　−{cost}'],
  c_clear: ['Cleared in {time}. Score {score}.', '{time} 過關。得分 {score}。'],
  c_flawless: ['No misses, no hints. +{p}', '零失誤零提示。+{p}'],
  c_others: ['Also worked: {list}', '其他可行：{list}'],
  c_reveal: ['Revealed. Missed: {list}', '答案：{list}'],

  /* feed: sprint */
  s_new: ['{s}s on the clock. Nothing adds time.', '{s} 秒，不會加時。'],
  s_skip: ['Skipped {target}  −{p}', '跳過 {target}　−{p}'],
  s_over: ['Time. {n} cleared, score {score}.', '時間到。過 {n} 關，得分 {score}。'],
  s_need: ['{n} combos work. You need one.', '有 {n} 組可行，找到一組就好。'],

  /* feed: deduce */
  d_new: ['Three tiles are hidden. {n} guesses.', '藏了三張牌，可以猜 {n} 次。'],
  d_already: ['{k} already guessed', '{k} 猜過了'],
  d_clue: ['{k} = {v}: {hits} right place, {moved} wrong place. Hidden value is {dir}.', '{k} = {v}：{hits} 個位置對，{moved} 個位置錯。答案{dir}。'],
  d_higher: ['higher', '比較大'], d_lower: ['lower', '比較小'], d_same: ['the same', '一樣大'],
  d_win: ['Found in {n} guesses. Score {score}.', '猜了 {n} 次就找到。得分 {score}。'],
  d_lose: ['Out of guesses. It was {k} = {v}.', '次數用完。答案是 {k} = {v}。'],
  mark_hit: ['right place', '位置對'], mark_moved: ['wrong place', '位置錯'], mark_off: ['not in it', '不在裡面'],

  sum_tiles: ['{n}/{par} tiles', '{n}/{par} 步'],
  sum_targets: ['{n} targets', '{n} 個目標'],

  /* result sheet */
  res_win: ['Done', '完成'], res_over: ['Round over', '這盤結束'],

  /* lesson (first minute): under 12 words a step */
  ls_premise: ['A triops hatches. Feed it the right number.', '三眼恐龍蝦孵出來了，餵牠對的數字。'],
  ls_1: ['Tap the lit tile.', '點亮著的那張牌。'],
  ls_2: ['Make it 4. Try ÷5 first.', '把它變成 4。先試試 ÷5。'],
  ls_2b: ['Not whole. Grey tiles stay shut. Try ÷3.', '不是整數，灰牌不能走。試 ÷3。'],
  ls_3: ['Your turn: reach the target in two tiles.', '換你：兩步走到目標。'],
  ls_done: ['Fed. That is Ladder.', '餵飽了。這就是階梯。'],
  ls_skip: ['Skip', '跳過'],
  ls_go: ['Play', '開始'],
  ls_step: ['{n} of 3', '{n} / 3'],

  /* stats sheet, transfer */
  t_sum: ['Move your progress to another device', '把進度搬到另一台裝置'],
  t_note: ['Your streak lives in this browser. A restore code carries it.', '紀錄只存在這個瀏覽器，復原碼可以帶走。'],
  t_copy: ['Copy my restore code', '複製復原碼'],
  t_restore: ['Restore from code', '用復原碼還原'],
  t_paste: ['Paste a restore code here', '在這裡貼上復原碼'],
  t_none: ['Nothing to copy yet. Play a daily first.', '還沒有紀錄，先玩一次每日。'],
  t_copied: ['Copied: {d} day(s), {c} characters.', '已複製：{d} 天，{c} 字元。'],
  t_noclip: ['Could not copy. Select the code below.', '無法複製，請手動選取下方的碼。'],
  t_added: ['Restored {a} day(s). Kept {k}.', '還原 {a} 天，保留原有 {k} 天。'],
  t_nothing: ['Nothing new: all {k} day(s) were here.', '沒有新紀錄：{k} 天都已經在了。'],
};

export function t(key, vars = {}) {
  const row = S[key];
  let s = row ? row[current === 'zh' ? 1 : 0] : key;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/* Rules sheet, per mode: short lines, one idea each. */
export const RULES = {
  ladder: [
    ['Each tile changes the number, left to right.', '每張牌依序改變數字，由左到右算。'],
    ['The number must stay whole. Grey tiles would break it.', '數字要保持整數，灰色的牌會破壞它。'],
    ['Each tile once. Undo is free.', '每張牌只能用一次，復原不扣分。'],
    ['Par is one more than the best route. Beat it for a bonus.', '標準步數比最佳多一步，打破它有加分。'],
  ],
  classic: [
    ['Pick three different tiles.', '選三張不同的牌。'],
    ['Tile 1 gives only its number.', '第一張只取數字。'],
    ['Tiles 2 and 3 use × and ÷ before + and −.', '第二、三張照先乘除後加減。'],
    ['Each miss costs points.', '猜錯會扣分。'],
  ],
  sprint: [
    ['Same three-tile sums as Classic. One combo clears a target.', '跟經典一樣三張牌，一組就過關。'],
    ['The board stays. Learn it as you go.', '牌不會變，邊玩邊記。'],
    ['The clock is fixed. Hits build a chain, misses break it.', '時間固定。連續答對有連擊，答錯就斷。'],
  ],
  deduce: [
    ['Three tiles are hidden, in order.', '藏了三張牌，有順序。'],
    ['✓ right tile, right place. ↔ right tile, wrong place. · not in it.', '✓ 牌對位置對　↔ 牌對位置錯　· 不在裡面'],
    ['The arrow says if the hidden value is higher or lower.', '箭頭告訴你答案的值比較大還是比較小。'],
  ],
};
export const rules = (id) => (RULES[id] || []).map((r) => r[current === 'zh' ? 1 : 0]);
