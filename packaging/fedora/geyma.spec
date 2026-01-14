Name:           geyma
Version:        0.1.0
Release:        1%{?dist}
Summary:        Modern file manager
License:        LicenseRef-NotSpecified
URL:            https://github.com/chris/LibreFiles
Source0:        %{name}-%{version}.tar.gz

BuildArch:      noarch

Requires:       python3
Requires:       python3-pyside6
Recommends:     python3-keyring

%description
Geyma is a deliberate, local-first file manager built with Python and PySide6.

%prep
%autosetup -n %{name}-%{version}

%build
# Pure Python package; no build steps required.

%install
mkdir -p %{buildroot}%{python3_sitelib}
cp -a geyma %{buildroot}%{python3_sitelib}/

install -Dpm0755 packaging/fedora/geyma %{buildroot}%{_bindir}/geyma
install -Dpm0644 geyma.desktop %{buildroot}%{_datadir}/applications/geyma.desktop
install -Dpm0644 assets/geyma.svg %{buildroot}%{_datadir}/icons/hicolor/scalable/apps/geyma.svg
install -Dpm0644 assets/geyma.png %{buildroot}%{_datadir}/icons/hicolor/512x512/apps/geyma.png

%files
%{python3_sitelib}/geyma
%{_bindir}/geyma
%{_datadir}/applications/geyma.desktop
%{_datadir}/icons/hicolor/scalable/apps/geyma.svg
%{_datadir}/icons/hicolor/512x512/apps/geyma.png

%changelog
* Wed Jan 14 2026 Chris <chris@example.com> - 0.1.0-1
- Initial Fedora packaging
