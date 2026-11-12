#!/bin/bash

# Cria o link em /usr/bin (mesmo comportamento do script padrão).
if type update-alternatives 2>/dev/null >&1; then
    if [ -L '/usr/bin/openfy' -a -e '/usr/bin/openfy' -a "`readlink '/usr/bin/openfy'`" != '/etc/alternatives/openfy' ]; then
        rm -f '/usr/bin/openfy'
    fi
    update-alternatives --install '/usr/bin/openfy' 'openfy' '/opt/Openfy/openfy' 100 || ln -sf '/opt/Openfy/openfy' '/usr/bin/openfy'
else
    ln -sf '/opt/Openfy/openfy' '/usr/bin/openfy'
fi

# O teste de user namespaces roda como root e costuma passar, mas no Ubuntu 24.04+
# o AppArmor bloqueia user namespaces para apps abertos pela sessão gráfica. Nesse
# caso o Chromium usa o helper SUID, que precisa ser root com modo 4755, senão aborta.
chown root:root '/opt/Openfy/chrome-sandbox' || true
chmod 4755 '/opt/Openfy/chrome-sandbox' || true

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi
