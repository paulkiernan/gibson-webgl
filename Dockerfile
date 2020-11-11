FROM node:lts-slim
MAINTAINER hi@paulynomial.com

WORKDIR /gibson

RUN npm install -g gulp
COPY package.json .
RUN npm install

COPY . /gibson

RUN gulp buildProd

ENV HOSTNAME 0.0.0.0
ENV port 8080

EXPOSE 8080

# Define default command.
CMD ["./server.js"]
