import random

# ===== 設定 =====
SLOTS = 4        # 並べる場所の数(6色すべてを当てたいなら 6 に変更)
MAX_TURNS = 10   # 最大ターン数

COLORS = {
    "R": ("🔴"),
    "G": ("🟢"),
    "B": ("🔵"),
    "Y": ("🟡"),
    "O": ("🟠"),
    "P": ("🟣"),
}


def show(code):
    return " ".join(COLORS[c][1] for c in code)


def judge(answer, guess):
    """(hit, blow) を返す"""
    hit = sum(a == g for a, g in zip(answer, guess))
    blow = len(set(answer) & set(guess)) - hit
    return hit, blow


def read_guess():
    while True:
        s = input("予想> ").strip().upper()
        if len(s) != SLOTS:
            print(f"  {SLOTS}文字で入力してください")
        elif any(c not in COLORS for c in s):
            print(f"  使える文字: {' '.join(COLORS)}")
        elif len(set(s)) != len(s):
            print("  同じ色は使えません")
        else:
            return s


def main():
    answer = random.sample(list(COLORS), SLOTS)  # 重複なし

    print("=== ヒット&ブロー ===")
    print(f"{len(COLORS)}色から重複なしで{SLOTS}個並んでいます。当ててください!")
    print("  " + "  ".join(f"{k}={v[0]}{v[1]}" for k, v in COLORS.items()))
    print("  例: RGBY と入力")
    print("  HIT=色も位置も一致 / BLOW=色だけ一致\n")

    history = []
    for turn in range(1, MAX_TURNS + 1):
        print(f"--- {turn}/{MAX_TURNS} ターン目 ---")
        guess = list(read_guess())
        hit, blow = judge(answer, guess)
        history.append((guess, hit, blow))

        print()
        for i, (g, h, b) in enumerate(history, 1):
            print(f"{i:>2}: {show(g)}  HIT {h} / BLOW {b}")
        print()

        if hit == SLOTS:
            print(f"🎉 正解!{turn}ターンでクリア!")
            return

    print(f"😢 ゲームオーバー。正解は {show(answer)} でした")


if __name__ == "__main__":
    main()
