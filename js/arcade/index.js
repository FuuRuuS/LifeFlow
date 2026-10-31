/**
 * LifeFlow Arcade — the game registry.
 *
 * Every game speaks the same small language:
 *   create()                → a JSON-safe state
 *   turn(state)             → whose seat it is (0 | 1)
 *   apply(state, move)      → the next state, or null when the move is illegal
 *   outcome(state)          → { over, winner, draw }
 *   auto(state)             → a move the game makes for you, e.g. flipping cards back
 *   ai(state, seat, level)  → the computer's move
 *   view(state, ctx)        → HTML for the board
 *   bind(root, state, ctx, play)
 */
import * as tictactoe from './games/tictactoe.js';
import * as memory from './games/memory.js';
import * as dame from './games/dame.js';
import * as connect4 from './games/connect4.js';
import * as reversi from './games/reversi.js';
import * as dots from './games/dots.js';

export const GAMES = [tictactoe, connect4, reversi, dots, memory, dame];

export function gameById(id) {
  return GAMES.find((g) => g.meta.id === id) || null;
}

export const GAME_IDS = GAMES.map((g) => g.meta.id);
