# #!/bin/bash
# # PostToolUse hook for Edit|Write
# # Warns if a .rpy file uses an init priority not documented in init_order.rpy
# # Non-blocking — always exits 0

# INPUT=$(cat)
# FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path')

# # Only check .rpy files
# [[ "$FILE_PATH" == *.rpy ]] || exit 0

# # Documented priorities from game/scripts/init_order.rpy
# KNOWN=(-100 -10 -9 -8 -7 -5 -3 -2 0)

# # Extract init priority values from the file (matches: init -5 python:, init -2:, etc.)
# FOUND=$(grep -oP '(?<=^init )-?\d+' "$FILE_PATH" 2>/dev/null | sort -un)

# [[ -z "$FOUND" ]] && exit 0

# WARNINGS=""
# for PRIORITY in $FOUND; do
#     MATCH=0
#     for K in "${KNOWN[@]}"; do
#         [[ "$PRIORITY" == "$K" ]] && MATCH=1 && break
#     done
#     if [[ $MATCH -eq 0 ]]; then
#         WARNINGS="${WARNINGS}  - init ${PRIORITY} (not in init_order.rpy)\n"
#     fi
# done

# if [[ -n "$WARNINGS" ]]; then
#     echo "Warning: Undocumented init priority in ${FILE_PATH}:"
#     echo -e "$WARNINGS"
#     echo "Documented priorities: ${KNOWN[*]}"
#     echo "See game/scripts/init_order.rpy for the load order reference."
# fi

# exit 0
