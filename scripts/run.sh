#!/bin/bash

set -eux

REPO_ROOT_DIR=$(git rev-parse --show-toplevel)

docker build -t gibson-webgl:latest "$REPO_ROOT_DIR"

docker run \
    --rm \
    -t gibson-webgl:latest
