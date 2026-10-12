#!/usr/bin/env python3
"""
expand_dictionary.py
Expands english.txt with a comprehensive wordlist and compiles english.bin and bangla.bin.
"""

import os
import sys
import compile_dictionaries

DICTIONARY_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'dictionaries')
ENGLISH_TXT = os.path.join(DICTIONARY_DIR, 'english.txt')

COMMON_WORDS = [
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with",
    "he", "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her",
    "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what", "so", "up",
    "out", "if", "about", "who", "get", "which", "go", "me", "when", "make", "can", "like", "time",
    "no", "just", "him", "know", "take", "people", "into", "year", "your", "good", "some", "could",
    "them", "see", "other", "than", "then", "now", "look", "only", "come", "its", "over", "think",
    "also", "back", "after", "use", "two", "how", "our", "work", "first", "well", "way", "even",
    "new", "want", "because", "any", "these", "give", "day", "most", "us", "is", "was", "are",
    "kite", "kites", "kiting", "kitten", "kittens", "kitchen", "kitchens", "kick", "kicks", "kicked", "kicking",
    "key", "keys", "keyboard", "keyboards", "kid", "kids", "kidding", "kill", "kills", "killed", "killing",
    "killer", "kind", "kinds", "king", "kings", "kingdom", "kiss", "kisses", "kissed", "kissing",
    "knee", "knees", "knife", "knives", "knight", "knit", "knitting", "knock", "knocks", "knocked", "knocking",
    "knot", "knots", "know", "knows", "knew", "known", "knowing", "knowledge", "kudos", "ketchup",
    "kettle", "keep", "keeps", "kept", "keeping", "keeper", "keen", "kennel", "kernel", "kayak",
    "about", "above", "across", "act", "action", "activity", "actually", "add", "address", "admit",
    "adult", "affect", "after", "again", "against", "age", "agency", "agent", "ago", "agree",
    "agreement", "ahead", "air", "all", "allow", "almost", "alone", "along", "already", "also",
    "although", "always", "american", "among", "amount", "analysis", "and", "animal", "another", "answer",
    "any", "anyone", "anything", "appear", "apply", "approach", "area", "argue", "arm", "around",
    "arrive", "art", "article", "artist", "as", "ask", "assume", "at", "attack", "attention",
    "attorney", "audience", "author", "authority", "available", "avoid", "away", "baby", "back", "bad",
    "bag", "ball", "bank", "bar", "base", "be", "beat", "beautiful", "because", "become",
    "bed", "before", "begin", "behavior", "behind", "believe", "benefit", "best", "better", "between",
    "beyond", "big", "bill", "billion", "bit", "black", "blood", "blue", "board", "body",
    "book", "born", "both", "box", "boy", "break", "bring", "brother", "budget", "build",
    "building", "business", "but", "buy", "by", "call", "camera", "campaign", "can", "cancer",
    "candidate", "capital", "car", "card", "care", "career", "carry", "case", "catch", "cause",
    "cell", "center", "central", "century", "certain", "certainly", "chair", "challenge", "chance", "change",
    "character", "charge", "check", "child", "choice", "choose", "church", "citizen", "city", "civil",
    "claim", "class", "clear", "clearly", "close", "coach", "cold", "collection", "college", "color",
    "come", "commercial", "common", "community", "company", "compare", "computer", "concern", "condition", "conference",
    "congress", "consider", "consumer", "contain", "continue", "control", "cost", "could", "country", "couple",
    "course", "court", "cover", "create", "crime", "cultural", "culture", "cup", "current", "customer",
    "cut", "dark", "data", "daughter", "day", "dead", "deal", "death", "debate", "decade",
    "decide", "decision", "deep", "defense", "degree", "democrat", "democratic", "describe", "design", "despite",
    "detail", "determine", "develop", "development", "device", "differ", "difference", "different", "difficult", "dinner",
    "direction", "director", "discover", "discuss", "discussion", "disease", "do", "doctor", "dog", "door",
    "down", "draw", "dream", "drive", "drop", "drug", "during", "each", "early", "east",
    "easy", "eat", "economic", "economy", "edge", "education", "effect", "effort", "eight", "either",
    "election", "else", "employee", "end", "energy", "enjoy", "enough", "enter", "entire", "environment",
    "environmental", "especially", "establish", "even", "evening", "event", "ever", "every", "everybody", "everyone",
    "everything", "evidence", "exactly", "example", "executive", "exist", "expect", "experience", "expert", "explain",
    "eye", "face", "fact", "factor", "fail", "fall", "family", "far", "fast", "father",
    "fear", "feature", "federal", "feel", "feeling", "few", "field", "fight", "figure", "fill",
    "film", "final", "finally", "financial", "find", "fine", "finger", "finish", "fire", "firm",
    "first", "fish", "five", "floor", "fly", "focus", "follow", "food", "foot", "for",
    "force", "foreign", "forget", "form", "former", "forward", "four", "free", "friend", "from",
    "front", "full", "fund", "future", "game", "garden", "gas", "general", "generation", "get",
    "girl", "give", "glass", "go", "goal", "good", "government", "great", "green", "ground",
    "group", "grow", "growth", "guess", "gun", "guy", "hair", "half", "hand", "hang",
    "happen", "happy", "hard", "have", "he", "head", "health", "hear", "heart", "heat",
    "heavy", "help", "her", "here", "herself", "high", "him", "himself", "his", "history",
    "hit", "hold", "home", "hope", "hospital", "hot", "hotel", "hour", "house", "how",
    "however", "huge", "human", "hundred", "husband", "i", "idea", "identify", "if", "image",
    "imagine", "impact", "important", "improve", "in", "include", "including", "increase", "indeed", "indicate",
    "individual", "industry", "information", "inside", "instead", "institution", "interest", "interesting", "international", "interview",
    "into", "investment", "involve", "issue", "it", "item", "its", "itself", "job", "join",
    "just", "keep", "key", "kid", "kill", "kind", "kitchen", "know", "knowledge", "land",
    "language", "large", "last", "late", "later", "laugh", "law", "lawyer", "lay", "lead",
    "leader", "learn", "least", "leave", "left", "leg", "legal", "less", "let", "letter",
    "level", "lie", "life", "light", "like", "likely", "line", "list", "listen", "little",
    "live", "local", "long", "look", "lose", "loss", "lot", "love", "low", "machine",
    "magazine", "main", "maintain", "major", "majority", "make", "man", "manage", "management", "manager",
    "many", "market", "marriage", "material", "matter", "may", "maybe", "me", "mean", "measure",
    "media", "medical", "meet", "meeting", "member", "memory", "mention", "message", "method", "middle",
    "might", "military", "million", "mind", "minute", "miss", "mission", "model", "modern", "moment",
    "money", "month", "more", "morning", "most", "mother", "mouth", "move", "movement", "movie",
    "mr", "mrs", "much", "music", "must", "my", "myself", "name", "nation", "national",
    "natural", "nature", "near", "nearly", "necessary", "need", "network", "never", "new", "news",
    "newspaper", "next", "nice", "night", "no", "none", "nor", "north", "not", "note",
    "nothing", "notice", "now", "number", "occur", "of", "off", "offer", "office", "officer",
    "official", "often", "oh", "oil", "ok", "okay", "old", "on", "once", "one",
    "only", "onto", "open", "operation", "opportunity", "option", "or", "order", "organization", "other",
    "others", "our", "out", "outside", "over", "own", "owner", "page", "pain", "painting",
    "paper", "parent", "part", "participant", "particular", "particularly", "partner", "party", "pass", "past",
    "patient", "pattern", "pay", "peace", "people", "per", "perform", "performance", "perhaps", "period",
    "person", "personal", "phone", "physical", "pick", "picture", "piece", "place", "plan", "plant",
    "play", "player", "point", "police", "policy", "political", "politics", "poor", "popular", "population",
    "position", "positive", "possible", "power", "practice", "prepare", "present", "president", "pressure", "pretty",
    "prevent", "price", "private", "probably", "problem", "process", "produce", "product", "production", "professional",
    "professor", "program", "project", "property", "protect", "prove", "provide", "public", "pull", "purpose",
    "push", "put", "quality", "question", "quickly", "quite", "race", "radio", "raise", "range",
    "rate", "rather", "reach", "read", "ready", "real", "reality", "realize", "really", "reason",
    "receive", "recent", "recently", "recognize", "record", "red", "reduce", "reflect", "region", "relate",
    "relationship", "religious", "remain", "remember", "remove", "report", "represent", "republican", "require", "research",
    "resource", "respond", "response", "responsibility", "rest", "result", "return", "reveal", "rich", "right",
    "rise", "risk", "road", "rock", "role", "room", "rule", "run", "safe", "same",
    "save", "say", "scene", "school", "science", "scientist", "score", "sea", "season", "seat",
    "second", "section", "security", "see", "seek", "seem", "sell", "send", "senior", "sense",
    "series", "serious", "serve", "service", "set", "seven", "several", "sex", "sexual", "shake",
    "share", "she", "shoot", "short", "shot", "should", "shoulder", "show", "side", "sign",
    "significant", "similar", "simple", "simply", "since", "sing", "single", "sister", "sit", "site",
    "situation", "six", "size", "skill", "skin", "small", "smile", "so", "social", "society",
    "soldier", "some", "somebody", "someone", "something", "sometimes", "son", "song", "soon", "sort",
    "sound", "source", "south", "southern", "space", "speak", "special", "specific", "speech", "spend",
    "sport", "spring", "staff", "stage", "stand", "standard", "star", "start", "state", "statement",
    "station", "stay", "step", "still", "stock", "stop", "store", "story", "strategy", "street",
    "strong", "structure", "student", "study", "stuff", "style", "subject", "success", "successful", "such",
    "suddenly", "suffer", "suggest", "summer", "support", "sure", "surface", "system", "table", "take",
    "talk", "task", "tax", "teach", "teacher", "team", "technology", "television", "tell", "ten",
    "tend", "term", "test", "than", "thank", "thanks", "that", "the", "their", "them",
    "themselves", "then", "theory", "there", "these", "they", "thing", "think", "third", "this",
    "those", "though", "thought", "thousand", "threat", "three", "through", "throughout", "throw", "thus",
    "time", "to", "today", "together", "tonight", "too", "top", "total", "tough", "toward",
    "town", "trade", "traditional", "training", "travel", "treat", "treatment", "tree", "trial", "trip",
    "trouble", "true", "truth", "try", "turn", "tv", "two", "type", "under", "understand",
    "unit", "until", "up", "upon", "us", "use", "usually", "value", "various", "very",
    "victim", "view", "violence", "visit", "voice", "vote", "wait", "walk", "wall", "want",
    "war", "watch", "water", "way", "we", "weapon", "wear", "week", "weight", "well",
    "west", "western", "what", "whatever", "when", "where", "whether", "which", "while", "white",
    "who", "whole", "whom", "whose", "why", "wide", "wife", "will", "win", "wind",
    "window", "wish", "with", "within", "without", "woman", "wonder", "word", "work", "worker",
    "world", "worry", "would", "write", "writer", "wrong", "yard", "yeah", "year", "yes",
    "yet", "you", "young", "your", "yourself"
]

def main():
    existing_words = {}
    if os.path.exists(ENGLISH_TXT):
        with open(ENGLISH_TXT, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                parts = line.split('\t')
                word = parts[0].strip().lower()
                freq = int(parts[1]) if len(parts) > 1 else 1000
                if word:
                    existing_words[word] = freq

    # Add common words
    default_freq = 50000000
    for w in COMMON_WORDS:
        w_clean = w.strip().lower()
        if w_clean and w_clean not in existing_words:
            existing_words[w_clean] = default_freq

    # Write expanded english.txt
    with open(ENGLISH_TXT, 'w', encoding='utf-8') as f:
        f.write("# QyKey English dictionary\n# Format: word<TAB>frequency\n")
        for word, freq in sorted(existing_words.items(), key=lambda x: -x[1]):
            f.write(f"{word}\t{freq}\n")

    print(f"Expanded english.txt with {len(existing_words)} words.")

    # Recompile binary trie
    compile_dictionaries.main()

    # Also copy to android/app/src/main/assets/dictionaries
    android_asset_dir = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'assets', 'dictionaries')
    if os.path.exists(android_asset_dir):
        import shutil
        for fn in ['english.bin', 'bangla.bin']:
            src = os.path.join(DICTIONARY_DIR, fn)
            dst = os.path.join(android_asset_dir, fn)
            if os.path.exists(src):
                shutil.copy2(src, dst)
                print(f"Copied {src} -> {dst}")

if __name__ == '__main__':
    main()
