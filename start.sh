#!/bin/sh
set -e

echo "Running database migrations..."
node --import tsx/esm scripts/migrate.ts

echo "Starting server..."
exec node --enable-source-maps ./dist/index.mjs
