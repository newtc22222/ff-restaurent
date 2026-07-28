#!/bin/sh
set -eu

npm run storage:migrate:gcs -- --apply
npm run storage:migrate:gcs -- --verify
