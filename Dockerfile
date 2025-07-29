FROM node:24-alpine

RUN apk add --no-cache \
		python3 \
		py3-pip \
		openssl \
		pkgconf \
		cairo-dev \
		pango-dev \
		jpeg-dev \
		giflib-dev \
		librsvg-dev \
		build-base \
		gcompat

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN npm install --global pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
COPY patches ./patches
RUN pnpm i

COPY . .

COPY docker-configure.sh /docker-configure.sh
RUN chmod +x /docker-configure.sh

ENTRYPOINT ["/docker-configure.sh"]
CMD ["pnpm", "run", "start"]
