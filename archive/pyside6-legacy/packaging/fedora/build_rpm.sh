#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
spec_file="${repo_root}/packaging/fedora/geyma.spec"

parsed_name="$(awk '$1 == "Name:" { print $2; exit }' "${spec_file}")"
parsed_version="$(awk '$1 == "Version:" { print $2; exit }' "${spec_file}")"

NAME="${NAME:-$parsed_name}"
VERSION="${VERSION:-$parsed_version}"
ROOT="${RPMBUILD_ROOT:-${HOME}/rpmbuild}"

tarball="${NAME}-${VERSION}.tar.gz"

mkdir -p "${ROOT}"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
git -C "${repo_root}" archive --format=tar.gz --prefix="${NAME}-${VERSION}/" -o "${tarball}" HEAD
cp "${repo_root}/${tarball}" "${ROOT}/SOURCES/"
cp "${spec_file}" "${ROOT}/SPECS/"

rpmbuild -ba "${ROOT}/SPECS/$(basename "${spec_file}")"

echo "RPMs in: ${ROOT}/RPMS"
