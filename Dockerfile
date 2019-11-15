FROM node:lts AS development

ARG UID=1000
ARG GID=1000
RUN \
  usermod --uid ${UID} node && groupmod --gid ${GID} node \
  && mkdir /srv/app && chown node:node /srv/app

USER node

WORKDIR /srv/app

COPY --chown=node:node package*.json ./

RUN npm install --quiet

FROM node:lts-slim AS production

ARG UID=1000
ARG GID=1000
RUN \
  usermod --uid ${UID} node && groupmod --gid ${GID} node \
  && mkdir /srv/app && chown node:node /srv/app

USER node

WORKDIR /srv/app

COPY --from=development --chown=root:root /srv/app/node_modules ./node_modules

COPY . .

EXPOSE 5555

CMD ["node", "main.js"]