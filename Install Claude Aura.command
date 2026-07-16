#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd -P)"
"$ROOT/macos/install.sh"
printf '\nPress Return to close.'
IFS= read -r _

