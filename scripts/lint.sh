#!/bin/bash

set -eu

REPO_ROOT_DIR=$(git rev-parse --show-toplevel)

LINT_EXCLUDES=(
    'src/deps/.*'
    'src/game/assets/fonts/helvetiker_regular.typeface.js'
    'src/game/assets/fonts/helvetiker_bold.typeface.js'
    'src/common/VREffect.js'
    'src/common/VRControls.js'
    'src/common/PointerLockControls.js'
)

docker run \
    --rm \
    -e FILTER_REGEX_EXCLUDE=$( IFS=\| ; echo "${LINT_EXCLUDES[*]}" ) \
    -e OUTPUT_DETAILS=detailed \
    -e RUN_LOCAL=true \
    -e VALIDATE_ALL_CODEBASE=true \
    -e VALIDATE_JAVASCRIPT_STANDARD=true \
    -e VALIDATE_JSON=true \
    -v "$REPO_ROOT_DIR":/tmp/lint \
    github/super-linter
