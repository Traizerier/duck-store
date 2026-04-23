# #!/bin/bash
# # PostToolUse hook: After Write/Edit on non-test Runtime source files,
# # remind Claude to follow TDD (write tests first).

# INPUT=$(cat)
# FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# # Skip if no file path
# [ -z "$FILE_PATH" ] && exit 0

# # Skip non-C# files (settings, docs, meta, configs, UI markup)
# if echo "$FILE_PATH" | grep -qiE '\.(md|json|meta|asmdef|asset|prefab|unity|uxml|uss|shader|cginc|txt|xml|yaml|yml|sh)$'; then
#   exit 0
# fi

# # Skip files inside any Tests directory (test files and test helpers)
# if echo "$FILE_PATH" | grep -qi '/Tests/\|\\Tests\\'; then
#   exit 0
# fi

# # Skip files inside .claude directory
# if echo "$FILE_PATH" | grep -qi '/\.claude/\|\\\.claude\\'; then
#   exit 0
# fi

# # For Runtime C# source files, inject a TDD reminder
# echo '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"TDD CHECK: You just wrote/edited a Runtime source file. If this is new functionality, verify that a failing test was written BEFORE this implementation. If no corresponding test exists yet, STOP and write one now before continuing."}}'
# exit 0
