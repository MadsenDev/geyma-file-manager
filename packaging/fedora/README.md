# Fedora RPM build (local)

This builds a local RPM for Geyma on Fedora. It does not publish to any repo.

## Dependencies

```bash
sudo dnf install rpm-build python3-pyside6 python3-keyring
```

## Build

```bash
VERSION=0.1.0
NAME=geyma
ROOT="${HOME}/rpmbuild"

mkdir -p "${ROOT}"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
git archive --format=tar.gz --prefix="${NAME}-${VERSION}/" -o "${NAME}-${VERSION}.tar.gz" HEAD
cp "${NAME}-${VERSION}.tar.gz" "${ROOT}/SOURCES/"
cp packaging/fedora/geyma.spec "${ROOT}/SPECS/"

rpmbuild -ba "${ROOT}/SPECS/geyma.spec"
```

## Install

```bash
sudo dnf install "${ROOT}/RPMS/noarch/geyma-${VERSION}-1"*.rpm
```
