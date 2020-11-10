FROM node:lts-slim
MAINTAINER hi@paulynomial.com

RUN npm install -g gulp

# Define working directory.
COPY . /gibson
WORKDIR /gibson

RUN npm install

RUN gulp web-prod

ENV HOSTNAME 0.0.0.0
ENV port 8080

EXPOSE 8080

# Define default command.
CMD ["./server.js"]
