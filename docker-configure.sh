#!/bin/sh

cat <<EOF > /app/config.json
{
  "token" : "${TOKEN}",
  "owner": "${OWNER_ID}",
  "listenbrainzAccount" : "${LISTENBRAINZ_ACCOUNT}",
  "gitapi": "${GIT_API}",
  "sharkeyInstance": "${SHARKEY_INSTANCE}",
  "radioURL": "${RADIO_URL}",
  "radioName": "${RADIO_NAME}",
  "commandDefaults": {
    "nowplaying": {
      "lobotomized": ${LOBOTOMIZED},
      "useSonglink": ${USE_SONGLINK},
      "useItunes": ${USE_ITUNES}
    },
    "pat": {
      "speed": ${PAT_SPEED}
    },
    "lastlistened": {
      "historyAmount": ${HISTORY_AMOUNT}
    }
  }
}
EOF

exec "$@"
