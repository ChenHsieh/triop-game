const ops = ['+', '-', '*', '/'];
const letters = 'qwerasdfzxcv'.split('');
const board = {};
const solutions = new Set();
const tried = new Set();

function randomBoard() {
  letters.forEach(l => {
    const op = ops[Math.floor(Math.random() * ops.length)];
    const num = Math.floor(Math.random() * 9) + 1;
    board[l] = op + num;
  });
}

function displayBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  letters.forEach(l => {
    const div = document.createElement('div');
    div.className = 'box';
    div.innerHTML = `<div>${l}</div><div>${board[l]}</div>`;
    // Add click event to append letter to input box
    div.addEventListener('click', () => {
      const input = document.getElementById('sequence');
      if (input.value.length < 3) input.value += l;
    });
    boardEl.appendChild(div);
  });
}

function applyOps(a, b, c) {
  if (!board[a] || !board[b] || !board[c]) return null;
  const v1 = parseInt(board[a].slice(1));
  const op2 = board[b][0];
  const n2 = parseInt(board[b].slice(1));
  const op3 = board[c][0];
  const n3 = parseInt(board[c].slice(1));
  try {
    const expression = `${v1} ${op2} ${n2} ${op3} ${n3}`;
    const result = Function('"use strict";return (' + expression + ')')();
    return Number.isInteger(result) ? result : null;
  } catch {
    return null;
  }
}

function generateTarget() {
  const combos = [];
  for (let i = 0; i < letters.length; i++) {
    for (let j = 0; j < letters.length; j++) {
      for (let k = 0; k < letters.length; k++) {
        if (i !== j && j !== k && i !== k) {
          const combo = [letters[i], letters[j], letters[k]];
          const val = applyOps(...combo);
          if (val !== null && Number.isFinite(val)) {
            combos.push({ combo: combo.join(''), val });
          }
        }
      }
    }
  }
  const choice = combos[Math.floor(Math.random() * combos.length)];
  document.getElementById('target').textContent = choice.val;
  combos.filter(c => c.val === choice.val).forEach(c => solutions.add(c.combo));
  document.getElementById('remaining').textContent = solutions.size;
}

function submitCombo() {
  const input = document.getElementById('sequence');
  const combo = input.value.toUpperCase();
  const lowerCombo = combo.toLowerCase();
  const log = document.getElementById('log');
  input.value = ''; // clear input after reading

  if (
    lowerCombo.length !== 3 ||
    new Set(lowerCombo).size !== 3 ||
    ![...lowerCombo].every(c => letters.includes(c))
  ) {
    log.innerHTML += `🚫 Invalid input: ${combo}<br>`;
    return;
  }
  if (tried.has(lowerCombo)) {
    log.innerHTML += `🌀 Already tried: ${combo}<br>`;
    return;
  }
  tried.add(lowerCombo);
  const result = applyOps(...lowerCombo);
  const resultDisplay = result === null ? 'Invalid' : result.toFixed(2).replace(/\.00$/, '');
  if (solutions.has(lowerCombo)) {
    log.innerHTML += `✅ Correct! ${combo} = ${resultDisplay}<br>`;
    solutions.delete(lowerCombo);
  } else {
    log.innerHTML += `❌ Incorrect: ${combo} = ${resultDisplay}<br>`;
  }
  document.getElementById('remaining').textContent = solutions.size;
  if (solutions.size === 0) {
    log.innerHTML += `<hr>🎉 Round Over! No more valid combinations.<br>`;
  }
}

function startNewGame() {
  Object.keys(board).forEach(k => delete board[k]);
  solutions.clear();
  tried.clear();
  document.getElementById('log').innerHTML = '';
  randomBoard();
  displayBoard();
  generateTarget();
  document.getElementById('sequence').focus();
}

// Init game on load
window.onload = () => {
  startNewGame();
  const input = document.getElementById('sequence');
  input.addEventListener('change', submitCombo);
  input.focus(); // focus input on load

  document.addEventListener('keydown', (e) => {
    if (document.activeElement !== input) return;
    const key = e.key.toLowerCase();
    if (letters.includes(key)) {
      if (input.value.length < 3) {
        input.value += key;
        if (input.value.length === 3) {
          submitCombo();
        }
      }
      e.preventDefault();
    } else if (e.key === 'Enter') {
      submitCombo();
    }
  });
};