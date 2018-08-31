FROM node:10.9-jessie

RUN echo "deb http://ftp.uk.debian.org/debian jessie-backports main" >> /etc/apt/sources.list.d/backports.list \
 && apt-get update && apt-get install -y ffmpeg \
 && rm -rf /var/lib/apt/lists/*

COPY package.json /node/

RUN cd /node && npm install

COPY index.js /node/
COPY Audio/sensors--MW2_Sensors_Online.m4a /node/Uploads/

WORKDIR /node

CMD ["/usr/local/bin/node", "index.js"]