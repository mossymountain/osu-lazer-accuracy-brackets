#!/bin/bash
set -eu
index="$(dirname "$(readlink -fm "$0")")/index.js"
cmd=(node "${index}")
if [[ $# -gt 0 ]];then
	cmd+=("$@")
fi
realm_found=0
for arg in "$@";do
	if [[ "${arg}" =~ .*[.]realm$ ]];then
		realm_found=1
		break
	fi
done
if ((realm_found==0));then
	realm="${HOME}/.local/share/osu/client.realm"
	if [[ -f "${realm}" ]];then
		cmd+=("${realm}")
	else
		cmd+=(--help)
		"${cmd[@]}"
		printf '\nNo such file: \x1b[1;33m%q\x1b[m\n' "${realm}"
		printf '(Please manually provide your osu!lazer \x1b[1;33mclient.realm\x1b[m file location)\n'
		exit 1;
	fi >&2
fi
exec "${cmd[@]}"
