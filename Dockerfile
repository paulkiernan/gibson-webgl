FROM node:argon
MAINTAINER hi@paulynomial.com

RUN npm install -g gulp

# Define working directory.
RUN mkdir /gibson
COPY . /gibson
WORKDIR /gibson

RUN rm -rf /gibson/dist
RUN npm install

RUN gulp web-prod

ENV HOSTNAME 0.0.0.0
ENV port 8080

EXPOSE 8080

# Define default command.
CMD ["./server.js"]
