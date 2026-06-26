# Traccar GPS Server — imagem customizada para K-Tag Manager
#
# Base: imagem oficial traccar/traccar (Ubuntu + Java 17 + tracker-server.jar)
# Customização: suporte a envsubst para injeção de variáveis no traccar.xml
#
# Não expor a porta 8082 externamente — somente rede Docker interna (K-Tag Backend).
# Expor apenas as portas TCP dos protocolos GPS necessários.

FROM traccar/traccar:6

USER root

# gettext fornece envsubst — imagem base é Alpine, usa apk
RUN apk add --no-cache gettext

# Template de configuração (variáveis substituídas pelo entrypoint)
COPY traccar.xml.tmpl /opt/traccar/conf/traccar.xml.tmpl

# Entrypoint customizado
COPY entrypoint.sh /opt/traccar/entrypoint.sh
RUN chmod +x /opt/traccar/entrypoint.sh

# Portas da API interna + protocolos GPS
EXPOSE 8082 5001 5020 5023 5027 5055

ENTRYPOINT ["/opt/traccar/entrypoint.sh"]
