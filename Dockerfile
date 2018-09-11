FROM registry.codethat.rocks:5000/discord-soundboard/base

COPY package.json /node/

RUN cd /node && npm install

COPY Audio/sensors--MW2_Sensors_Online.m4a /node/Uploads/mechwarrior/
COPY config/ /node/config/
COPY src/ /node/
COPY public/ /node/public/

WORKDIR /node

CMD ["/usr/local/bin/node", "--use_strict", "index.js"]
