FROM node:24-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

COPY . /app
WORKDIR /app

RUN npm i -g pnpm
RUN pnpm i

COPY docker-configure.sh /docker-configure.sh
RUN chmod +x /docker-configure.sh
ENTRYPOINT ["/docker-configure.sh"]

CMD [ "pnpm", "run", "start" ]
