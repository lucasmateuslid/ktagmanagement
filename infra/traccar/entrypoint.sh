#!/bin/sh
# K-Tag Manager — Traccar entrypoint
# Substitui variáveis de ambiente no template antes de iniciar o servidor.
set -e

CONFIG_TMPL="/opt/traccar/conf/traccar.xml.tmpl"
CONFIG_OUT="/opt/traccar/conf/traccar.xml"

# Valida variáveis obrigatórias
: "${POSTGRES_PASSWORD:?Variável POSTGRES_PASSWORD é obrigatória}"

echo "[traccar] Gerando configuração a partir do template..."

# Substitui somente as variáveis que conhecemos — evita sobrescrever
# qualquer ${...} interno do Java/Traccar por acidente.
envsubst '${POSTGRES_PASSWORD} ${INTERNAL_SECRET} ${BACKEND_URL}' \
  < "$CONFIG_TMPL" \
  > "$CONFIG_OUT"

echo "[traccar] Configuração gerada em $CONFIG_OUT"
echo "[traccar] Iniciando Traccar v$(cat /opt/traccar/VERSION 2>/dev/null || echo '6.x')..."

JAVA_BIN="/opt/traccar/jre/bin/java"

exec "$JAVA_BIN" \
  -Xms256m \
  -Xmx512m \
  -Djava.net.preferIPv4Stack=true \
  -jar /opt/traccar/tracker-server.jar \
  "$CONFIG_OUT"
