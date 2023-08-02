#!/bin/sh
#cd "$(dirname "$(readlink -fm "$0")")" # does not work on MacOS
cd "$(dirname -- "$0")"
npm install
echo $'\n\x1b[32mIf that seemed like it worked, \x1b[1myou don'"'t need to "$'\x1b[22mrun '"$0"$' again\x1b[m unless you update.\x1b[m'
