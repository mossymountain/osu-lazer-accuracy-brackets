#!/bin/sh
cd "$(dirname "$(readlink -fm "$0")")"
exec npm install
