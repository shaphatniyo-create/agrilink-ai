#!/usr/bin/env python3
"""Heuristic brace/paren balance checker across backend/src (string/comment aware)."""
import os
import sys

SRC = os.path.join(os.path.dirname(__file__), '..', 'src')

def check(path):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    stack = []
    pairs = {'{': '}', '(': ')', '[': ']'}
    closers = {v: k for k, v in pairs.items()}
    i = 0
    n = len(text)
    in_str = None
    in_line_comment = False
    in_block_comment = False
    in_template = 0
    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ''
        if in_line_comment:
            if c == '\n':
                in_line_comment = False
            i += 1
            continue
        if in_block_comment:
            if c == '*' and nxt == '/':
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue
        if in_str:
            if c == '\\':
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c == '/' and nxt == '/':
            in_line_comment = True
            i += 2
            continue
        if c == '/' and nxt == '*':
            in_block_comment = True
            i += 2
            continue
        if c in ('"', "'", '`'):
            in_str = c
            i += 1
            continue
        if c in pairs:
            stack.append((c, path, i))
        elif c in closers:
            if not stack or stack[-1][0] != closers[c]:
                return f"MISMATCH in {path} at offset {i}: found '{c}' but stack top is {stack[-1] if stack else None}"
            stack.pop()
        i += 1
    if stack:
        return f"UNCLOSED in {path}: {stack}"
    return None

errors = 0
count = 0
for root, _, files in os.walk(SRC):
    for fn in files:
        if fn.endswith('.ts') or fn.endswith('.tsx'):
            count += 1
            full = os.path.join(root, fn)
            err = check(full)
            if err:
                print(err)
                errors += 1

print(f"Checked {count} files, {errors} balance error(s).")
sys.exit(1 if errors else 0)
