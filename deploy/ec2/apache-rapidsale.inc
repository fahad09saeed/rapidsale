# RapidSale reverse proxy — included from the existing *:443 vhost for the server IP.
# Order matters: most specific paths first.
ProxyPass        /rapidsale/api/ws ws://127.0.0.1:8081/api/ws
ProxyPassReverse /rapidsale/api/ws ws://127.0.0.1:8081/api/ws
ProxyPass        /rapidsale/api/ http://127.0.0.1:8081/api/
ProxyPassReverse /rapidsale/api/ http://127.0.0.1:8081/api/
ProxyPass        /rapidsale/uploads/ http://127.0.0.1:8081/uploads/
ProxyPassReverse /rapidsale/uploads/ http://127.0.0.1:8081/uploads/
ProxyPass        /rapidsale http://127.0.0.1:3001/rapidsale
ProxyPassReverse /rapidsale http://127.0.0.1:3001/rapidsale
<Location /rapidsale/api/>
    LimitRequestBody 10485760
</Location>
