ARG HA_VERSION=2026.11.1

FROM ghcr.io/home-assistant/home-assistant:${HA_VERSION} AS ha

FROM --platform=$BUILDPLATFORM node:24.22.1-bookworm AS build
WORKDIR /src
ENV HUSKY=0 CI=true
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
COPY --from=ha /usr/local/lib/python3.14/site-packages/hass_frontend/static/translations /tmp/ha-translations
RUN python3 redesign/scripts/prepare-translations.py --from /tmp/ha-translations
ENV NODE_OPTIONS=--max-old-space-size=6144
RUN ./node_modules/.bin/gulp build-app

FROM ha
RUN rm -rf /usr/local/lib/python3.14/site-packages/hass_frontend
COPY --from=build /src/hass_frontend /usr/local/lib/python3.14/site-packages/hass_frontend
