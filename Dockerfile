FROM registry.codethat.rocks/soundboard/base

COPY package.json /node/

RUN cd /node && npm install

COPY config/ /node/config/
COPY src/ /node/
COPY public/ /node/public/

WORKDIR /node

CMD ["/usr/local/bin/node", "index.js"]
