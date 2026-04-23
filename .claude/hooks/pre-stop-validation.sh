# #!/bin/bash
# # Pre-stop validation script
# # Tests block on failure; linters are informational only

# cd "$CLAUDE_PROJECT_DIR" || exit 2

# # --- Resolve RENPY_SDK ---
# if [ -z "${RENPY_SDK:-}" ]; then
#     echo "WARNING: RENPY_SDK not set - skipping tests"
#     echo "Set it in your environment, e.g.:"
#     echo "  export RENPY_SDK=\"/path/to/renpy-8.5.2-sdk\"   (Linux/macOS, add to ~/.bashrc)"
#     echo "  setx RENPY_SDK \"C:\\path\\to\\renpy-8.5.2-sdk\"  (Windows, then restart terminal)"
#     exit 0
# fi
# if [ ! -f "$RENPY_SDK/renpy.py" ]; then
#     echo "ERROR: RENPY_SDK points to \"$RENPY_SDK\" but renpy.py was not found there."
#     exit 2
# fi

# # --- Detect platform Python ---
# detect_renpy_python() {
#     local sdk="$1"
#     case "$(uname -s)" in
#         MINGW*|MSYS*|CYGWIN*)
#             echo "$sdk/lib/py3-windows-x86_64/python.exe" ;;
#         Darwin)
#             echo "$sdk/lib/py3-mac-universal/python" ;;
#         *)
#             echo "$sdk/lib/py3-linux-x86_64/python" ;;
#     esac
# }

# PYTHON="$(detect_renpy_python "$RENPY_SDK")"

# # --- Unit Tests (blocking) ---
# echo "=== Running Unit Tests ==="

# export RENPY_RUN_TESTS="unit"

# if [ -f "$PYTHON" ]; then
#     TEST_OUTPUT=$("$PYTHON" "$RENPY_SDK/renpy.py" "$CLAUDE_PROJECT_DIR" 2>&1)
# elif [ -f "$RENPY_SDK/renpy.sh" ]; then
#     TEST_OUTPUT=$("$RENPY_SDK/renpy.sh" "$CLAUDE_PROJECT_DIR" 2>&1)
# else
#     TEST_OUTPUT=$(python3 "$RENPY_SDK/renpy.py" "$CLAUDE_PROJECT_DIR" 2>&1)
# fi
# TEST_EXIT=$?
# echo "$TEST_OUTPUT"

# # Check exit code file
# EXIT_CODE_FILE="$CLAUDE_PROJECT_DIR/game/test_logs/.autotest_exit_code"
# if [ -f "$EXIT_CODE_FILE" ]; then
#     RESULT="$(cat "$EXIT_CODE_FILE" | tr -d '[:space:]')"
#     rm -f "$EXIT_CODE_FILE"
#     if [ "$RESULT" != "0" ]; then
#         echo "" >&2
#         echo "Pre-stop validation FAILED. Tests have errors — fix before stopping." >&2
#         echo "See: game/test_logs/autotest_summary.log" >&2
#         exit 2
#     fi
#     echo "Unit tests passed."
# elif [ "$TEST_EXIT" -ne 0 ]; then
#     echo "" >&2
#     echo "Pre-stop validation FAILED. Tests have errors — fix before stopping." >&2
#     echo "See: game/test_logs/autotest_summary.log" >&2
#     exit 2
# fi

# # --- Linters (informational only) ---
# echo ""
# echo "=== Running Ruff on .py files (informational) ==="
# ruff check . 2>&1 || true

# echo ""
# echo "=== Running Ren'Py Linter (informational) ==="
# python3 tools/lint_renpy.py 2>&1 || true

# echo ""
# echo "All checks passed!"
# exit 0
