// Tiny stack VM, ISA v1. Reads MAKEFUN_INPUT_DIR/<id>/{program,input}.bin,
// writes MAKEFUN_OUTPUT_DIR/<id>/{stdout.bin,exit.txt}. Node 22, no deps.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const IN = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function run(P: Buffer, N: Buffer): [Buffer, number] {
  const s: number[] = [];
  const c: number[] = [];
  const m = new Int32Array(256);
  const o = Buffer.alloc(65536);
  let p = 0;
  let j = 0;
  let l = 0;
  let n = 0;
  let e = -1;
  const un = (k: number): boolean => { if (s.length < k) { e = 2; return true; } return false; };
  const ov = (k: number): boolean => { if (s.length + k > 256) { e = 3; return true; } return false; };
  while (e < 0) {
    if (n++ >= 1000000) { e = 10; break; }
    if (p < 0 || p >= P.length) { e = 9; break; }
    const op = P[p];
    const sz = op === 1 ? 2 : op === 2 ? 5 : op >= 48 && op <= 51 ? 3 : 1;
    if (p + sz > P.length) { e = 9; break; }
    const i8 = (): number => { const v = P[p + 1]; return v > 127 ? v - 256 : v; };
    const i32 = (): number => P[p + 1] | P[p + 2] << 8 | P[p + 3] << 16 | P[p + 4] << 24;
    const i16 = (): number => { const v = P[p + 1] | P[p + 2] << 8; return v > 32767 ? v - 65536 : v; };
    const u16 = (): number => P[p + 1] | P[p + 2] << 8;
    const pop = (): number => s.pop() as number;
    let a = 0, b = 0;
    switch (op) {
      case 0: e = 0; break; // HALT
      case 1: if (ov(1)) break; s.push(i8()); break; // PUSH8, sign-extended
      case 2: if (ov(1)) break; s.push(i32()); break; // PUSH32
      case 3: if (un(1)) break; s.pop(); break; // POP
      case 4: if (un(1) || ov(1)) break; s.push(s[s.length - 1]); break; // DUP
      case 5: if (un(2)) break; a = s[s.length - 1]; s[s.length - 1] = s[s.length - 2]; s[s.length - 2] = a; break; // SWAP
      case 6: if (un(2) || ov(1)) break; s.push(s[s.length - 2]); break; // OVER
      case 7: if (un(3)) break; a = s[s.length - 3]; s[s.length - 3] = s[s.length - 2]; s[s.length - 2] = s[s.length - 1]; s[s.length - 1] = a; break; // ROT
      case 16: if (un(2)) break; b = pop(); a = pop(); s.push(a + b | 0); break; // ADD
      case 17: if (un(2)) break; b = pop(); a = pop(); s.push(a - b | 0); break; // SUB
      case 18: if (un(2)) break; b = pop(); a = pop(); s.push(Math.imul(a, b)); break; // MUL, low 32 bits
      case 19: if (un(2)) break; b = pop(); a = pop(); if (b === 0) { e = 4; break; } s.push(a / b | 0); break; // DIV, trunc toward zero
      case 20: if (un(2)) break; b = pop(); a = pop(); if (b === 0) { e = 4; break; } s.push(a % b | 0); break; // MOD, sign of a
      case 21: if (un(2)) break; b = pop(); a = pop(); if (b === 0) { e = 4; break; } s.push((a >>> 0) / (b >>> 0) | 0); break; // DIVU
      case 22: if (un(2)) break; b = pop(); a = pop(); if (b === 0) { e = 4; break; } s.push((a >>> 0) % (b >>> 0) | 0); break; // MODU
      case 23: if (un(1)) break; s.push(-pop() | 0); break; // NEG
      case 24: if (un(2)) break; b = pop(); a = pop(); s.push(a & b); break; // AND
      case 25: if (un(2)) break; b = pop(); a = pop(); s.push(a | b); break; // OR
      case 26: if (un(2)) break; b = pop(); a = pop(); s.push(a ^ b); break; // XOR
      case 27: if (un(1)) break; s.push(~pop()); break; // NOT
      case 28: if (un(2)) break; b = pop(); a = pop(); s.push(a << (b & 31)); break; // SHL
      case 29: if (un(2)) break; b = pop(); a = pop(); s.push(a >> (b & 31)); break; // SHR, arithmetic
      case 30: if (un(2)) break; b = pop(); a = pop(); s.push(a >>> (b & 31) | 0); break; // SHRU, logical
      case 32: if (un(2)) break; b = pop(); a = pop(); s.push(a === b ? 1 : 0); break; // EQ
      case 33: if (un(2)) break; b = pop(); a = pop(); s.push(a < b ? 1 : 0); break; // LT
      case 34: if (un(2)) break; b = pop(); a = pop(); s.push((a >>> 0) < (b >>> 0) ? 1 : 0); break; // LTU
      case 48: p += sz + i16(); continue; // JMP
      case 49: if (un(1)) break; if (pop() === 0) { p += sz + i16(); continue; } break; // JZ
      case 50: if (un(1)) break; if (pop() !== 0) { p += sz + i16(); continue; } break; // JNZ
      case 51: if (c.length >= 64) { e = 7; break; } c.push(p + sz); p = u16(); continue; // CALL
      case 52: if (c.length === 0) { e = 8; break; } p = c.pop() as number; continue; // RET: pop return address from the CALL stack, not the data stack
      case 64: if (un(1)) break; a = pop(); if (a < 0 || a > 255) { e = 6; break; } s.push(m[a]); break; // LOAD
      case 65: if (un(2)) break; a = pop(); b = pop(); if (a < 0 || a > 255) { e = 6; break; } m[a] = b; break; // STORE
      case 80: if (un(1)) break; { const t = String(pop()); if (l + t.length > 65536) { e = 11; break; } o.write(t, l); l += t.length; } break; // PRINT
      case 81: if (un(1)) break; if (l >= 65536) { e = 11; break; } o[l++] = pop() & 255; break; // PUTC
      case 82: if (ov(1)) break; s.push(j < N.length ? N[j++] : -1); break; // IN
      case 83: if (un(1)) break; e = pop() & 255; break; // EXIT
      default: e = 5; // unknown opcode
    }
    p += sz;
  }
  return [o.subarray(0, l), e];
}

for (const id of readdirSync(IN).sort()) {
  const [o, e] = run(readFileSync(join(IN, id, 'program.bin')), readFileSync(join(IN, id, 'input.bin')));
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, 'stdout.bin'), o);
  writeFileSync(join(OUT, id, 'exit.txt'), e + '\n');
}
