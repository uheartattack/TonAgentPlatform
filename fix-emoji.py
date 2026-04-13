#!/usr/bin/env python3
"""
Safe emoji → ce() replacement for bot.ts
Only replaces in safeReply, ctx.reply, editMessageText, answerCbQuery strings.
Converts single-quoted strings to template literals where needed.
"""
import re, sys

EMOJI_MAP = {
    '\U0001F9EA': ('lab', '\U0001F9EA'),       # 🧪
    '\u2705': ('check', '\u2705'),              # ✅
    '\u274C': ('cross', '\u274C'),              # ❌
    '\U0001F512': ('lock', '\U0001F512'),       # 🔒
    '\U0001F3AF': ('target', '\U0001F3AF'),     # 🎯
    '\U0001F4A1': ('bulb', '\U0001F4A1'),       # 💡
    '\U0001F41B': ('bug', '\U0001F41B'),        # 🐛
    '\U0001F525': ('fire', '\U0001F525'),       # 🔥
    '\U0001F680': ('rocket', '\U0001F680'),     # 🚀
    '\U0001F48E': ('diamond', '\U0001F48E'),    # 💎
    '\U0001F3C6': ('trophy', '\U0001F3C6'),     # 🏆
    '\U0001F451': ('crown', '\U0001F451'),      # 👑
    '\u2B50': ('star', '\u2B50'),               # ⭐
    '\U0001F91D': ('handshake', '\U0001F91D'),  # 🤝
    '\U0001F389': ('party', '\U0001F389'),      # 🎉
    '\U0001F514': ('bell', '\U0001F514'),       # 🔔
    '\U0001F511': ('key', '\U0001F511'),        # 🔑
    '\U0001F4E2': ('megaphone', '\U0001F4E2'),  # 📢
    '\U0001F6D2': ('cart', '\U0001F6D2'),       # 🛒
    '\u2728': ('sparkle', '\u2728'),            # ✨
    '\U0001F4DD': ('pencil', '\U0001F4DD'),     # 📝
    '\U0001FA99': ('coin', '\U0001FA99'),       # 🪙
    '\U0001F4A5': ('boom', '\U0001F4A5'),       # 💥
}

# Lines that should NOT be modified
SKIP_PATTERNS = [
    'bot.hears(', 'MENU_TEXTS', 'PROD_ZONES', 'LEVEL_TAGS', 'LEVEL_NAMES',
    'zoneNames', 'CAPABILITY_LABELS', 'icon_custom_emoji_id', '.repeat(',
    'typeEmoji', 'typeIcons', 'categoryIcons', 'statusIcons', 'console.log',
    'console.warn', 'console.error', 'PROVIDER_INFO', '// ', 'icon:',
    "emoji:", 'SHOP_ITEMS', 'TESTER_ROLES', 'CE:', "CE[", "ce(",
]

# Only modify lines containing these patterns (user-facing output)
TARGET_PATTERNS = [
    'safeReply', 'ctx.reply', 'editMessageText', 'answerCbQuery',
    'bot.telegram.sendMessage', 'announceToGroup', 'postAnnouncement',
    'text +=', 'text =', 'msg +=', 'msg =', 't +=', 't =', 't1 +=', 't1 =',
]

with open('apps/builder-bot/src/bot.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

changes = 0
for i, line in enumerate(lines):
    # Skip lines that shouldn't be modified
    stripped = line.strip()
    if any(p in line for p in SKIP_PATTERNS):
        continue
    # Only modify user-facing output lines
    if not any(p in line for p in TARGET_PATTERNS):
        continue

    new_line = line
    for emoji, (ce_name, fb) in EMOJI_MAP.items():
        if emoji not in new_line:
            continue
        # Already wrapped in ce()
        if f"ce('{ce_name}','{fb}')" in new_line:
            continue

        # Check if emoji is inside a template literal (backtick string)
        # If yes, replace with ${ce(...)}
        # If in single/double quote, convert to template literal first

        ce_replacement = f"${{ce('{ce_name}','{fb}')}}"

        # Strategy: find the emoji and check surrounding quote context
        idx = new_line.find(emoji)
        while idx >= 0:
            # Look backwards for quote type
            before = new_line[:idx]

            # Count unescaped quotes to determine context
            in_backtick = before.count('`') % 2 == 1
            in_single = False
            in_double = False

            if not in_backtick:
                # Check single/double
                # Simple heuristic: find last unmatched quote
                sq_count = 0
                dq_count = 0
                for ci, ch in enumerate(before):
                    if ch == '\\' and ci + 1 < len(before):
                        continue
                    if ch == "'" and not in_backtick:
                        sq_count += 1
                    elif ch == '"' and not in_backtick:
                        dq_count += 1
                in_single = sq_count % 2 == 1
                in_double = dq_count % 2 == 1

            if in_backtick:
                # Already in template literal — just replace
                new_line = new_line[:idx] + ce_replacement + new_line[idx+len(emoji):]
                changes += 1
            elif in_single:
                # In single-quoted string — need to convert to template literal
                # Find the opening single quote
                open_pos = before.rfind("'")
                # Find the closing single quote after emoji
                after = new_line[idx+len(emoji):]
                close_pos = -1
                escaped = False
                for ci, ch in enumerate(after):
                    if escaped:
                        escaped = False
                        continue
                    if ch == '\\':
                        escaped = True
                        continue
                    if ch == "'":
                        close_pos = idx + len(emoji) + ci
                        break

                if open_pos >= 0 and close_pos >= 0:
                    # Replace quotes with backticks and emoji with ce()
                    new_line = (new_line[:open_pos] + '`' +
                               new_line[open_pos+1:idx] + ce_replacement +
                               new_line[idx+len(emoji):close_pos] + '`' +
                               new_line[close_pos+1:])
                    changes += 1
            # else: not in string or in double quote — skip

            # Find next occurrence
            idx = new_line.find(emoji, idx + len(ce_replacement) if (in_backtick or in_single) else idx + len(emoji))

    lines[i] = new_line

with open('apps/builder-bot/src/bot.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Done: {changes} replacements")
