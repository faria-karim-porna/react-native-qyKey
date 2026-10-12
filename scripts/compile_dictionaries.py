#!/usr/bin/env python3
"""
compile_dictionaries.py
Compiles QyKey word list (.txt) files into binary Trie (.bin) files.

Usage:
    python3 scripts/compile_dictionaries.py

Input:  assets/dictionaries/english.txt
        assets/dictionaries/bangla.txt

Output: assets/dictionaries/english.bin
        assets/dictionaries/bangla.bin

Word list format (one word per line):
    word<TAB>frequency
    hello<TAB>98234
    world<TAB>72100
    ...
Lines starting with '#' are comments and are ignored.
"""

import struct
import os
import sys
from dataclasses import dataclass, field
from typing import Optional, Dict, List

MAGIC = b'TRIE'
VERSION = 1
NODE_SIZE = 20   # bytes per node in the binary file

@dataclass
class TrieNode:
    char: str = ''
    frequency: int = 0
    children: Dict[str, 'TrieNode'] = field(default_factory=dict)


def build_trie(words: List[tuple]) -> TrieNode:
    """Build an in-memory Trie from a list of (word, frequency) tuples."""
    root = TrieNode(char='', frequency=0)
    for word, freq in words:
        node = root
        for ch in word:
            if ch not in node.children:
                node.children[ch] = TrieNode(char=ch)
            node = node.children[ch]
        node.frequency = max(node.frequency, freq)
    return root


def flatten_trie(root: TrieNode) -> List[TrieNode]:
    """BFS traversal — returns all nodes in breadth-first order."""
    result = []
    queue = [root]
    while queue:
        node = queue.pop(0)
        result.append(node)
        for child in node.children.values():
            queue.append(child)
    return result


def write_binary_trie(nodes: List[TrieNode], output_path: str):
    """
    Write nodes to binary file.
    Each node stores its first-child index and next-sibling index
    to form a left-child right-sibling tree (compact linked structure).
    """
    # Assign indices
    index_map = {id(n): i for i, n in enumerate(nodes)}

    # Pre-compute sibling indices
    sibling_map: Dict[int, int] = {}
    for node in nodes:
        children_list = list(node.children.values())
        for i, child in enumerate(children_list):
            sibling = index_map[id(children_list[i + 1])] if i + 1 < len(children_list) else -1
            sibling_map[id(child)] = sibling

    with open(output_path, 'wb') as f:
        # Header
        f.write(MAGIC)
        f.write(struct.pack('>I', VERSION))
        f.write(struct.pack('>I', len(nodes)))

        for node in nodes:
            children_list = list(node.children.values())

            # First child index
            first_child = index_map[id(children_list[0])] if children_list else -1
            # Sibling index
            sibling_idx = sibling_map.get(id(node), -1)

            char_codepoint = ord(node.char) if node.char else 0
            f.write(struct.pack('>i', first_child))
            f.write(struct.pack('>i', sibling_idx))
            f.write(struct.pack('>I', node.frequency))
            f.write(struct.pack('>I', char_codepoint))
            f.write(struct.pack('>I', 0))  # reserved

    print(f"  Written {len(nodes)} nodes -> {output_path}")


def load_word_list(path: str) -> List[tuple]:
    """Load word list from tab-separated file."""
    words = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            word = parts[0].strip().lower()
            freq = int(parts[1]) if len(parts) > 1 else 1
            if word:
                words.append((word, freq))
    return words


def compile_dictionary(input_path: str, output_path: str):
    print(f"Compiling {input_path} ...")
    words = load_word_list(input_path)
    print(f"  Loaded {len(words)} words")
    # Normalize frequencies to fit within 32-bit unsigned int
    # Google Ngram frequencies can be billions, but we only need relative ranking
    if words:
        max_freq = max(f for _, f in words)
        if max_freq > 4_000_000_000:
            scale = max_freq / 100_000
            # Scale to ~1M max, preserving relative ordering
            words = [(w, max(1, int(f / scale))) for w, f in words]
            print(f"  Frequencies normalized (max freq was {max_freq}, scaled by {scale:.0f})")
    root = build_trie(words)
    nodes = flatten_trie(root)
    print(f"  Trie has {len(nodes)} nodes")
    write_binary_trie(nodes, output_path)


def main():
    base = os.path.join(os.path.dirname(__file__), '..', 'assets', 'dictionaries')
    pairs = [
        ('english.txt', 'english.bin'),
        ('bangla.txt',  'bangla.bin'),
    ]
    for src, dst in pairs:
        inp = os.path.join(base, src)
        out = os.path.join(base, dst)
        if not os.path.exists(inp):
            print(f"WARNING: {inp} not found - skipping")
            continue
        compile_dictionary(inp, out)
    print("Done.")


if __name__ == '__main__':
    main()
