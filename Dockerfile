FROM node:15.14.0-alpine AS builder
# For bcrypt
RUN apk --update --no-cache add --virtual native-deps \ 
 g++ gcc libgcc libstdc++ linux-headers autoconf automake make nasm python \
 openssh krb5 krb5-libs krb5-dev git wget openssl ca-certificates && \
 npm install --quiet node-gyp -g
RUN npm rebuild bcrypt --build-from-source
RUN wget -qO- "https://github.com/dustinblackman/phantomized/releases/download/2.1.1a/dockerized-phantomjs.tar.gz" | tar xz -C / \ 
    && npm config set user 0 \
    && npm install -g phantomjs-prebuilt
RUN apk add --update --no-cache ttf-dejavu ttf-droid ttf-freefont ttf-liberation ttf-ubuntu-font-family

WORKDIR /api
COPY ./package.json ./
RUN yarn
COPY . .
RUN yarn build

FROM node:15.14.0-alpine
WORKDIR /api
COPY --from=builder /api ./
EXPOSE 3000
CMD ["yarn", "start:prod"]