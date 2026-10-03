#!/bin/bash
# Liga (ou reinicia) o site e o sistema da Igreja Palavra Viva como serviço do Linux.
cd "$(dirname "$0")"
systemctl --user stop ipv-escalas 2>/dev/null
systemctl --user reset-failed ipv-escalas 2>/dev/null
systemd-run --user --unit=ipv-escalas --working-directory="$PWD" -p Restart=always "$(which node)" server.js >/dev/null
sleep 2
if systemctl --user is-active --quiet ipv-escalas; then
  IP=$(hostname -I | awk '{print $1}')
  echo "No ar!  Computador: http://localhost:3005   Celular: http://$IP:3005"
else
  echo "Não subiu. Veja o erro com:  journalctl --user -u ipv-escalas -n 30"
fi
