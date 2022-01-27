### Pre-requisite
MongoDBCompass 
Installation: [MongoDB installation](https://www.mongodb.com/try/download/compass?tck=docs_compass&_ga=2.181768612.24741299.1642734553-42212813.1637736123)</br>
Video Guide: [Video Guide](https://www.youtube.com/watch?v=IC_ik7wE6eM)
                
RabbitMQ       
Installation: [RabbitMQ installation](https://www.rabbitmq.com/)</br>
Video Guide: [Video Guide](https://www.youtube.com/watch?v=V9DWKbalbWQ&t=162s)
                
### dotenv

create a `.env` file under root dir with following variables:

```bash
PORT= # e.g. 3000
API_PREFIX= # e.g. "/api/v1"

#Rabbit MQ
RABBITMQ_CONN_STRING="amqp://guest:guest@localhost:5672/hello"
RABBITMQ_Q_NAME="jcert-root-message"
# DB
MONGO_URL= # e.g. "mongodb://localhost/jcerts-backend"

# Passport-JWT
JWT_SEC= # e.g. "kepler-jwt-secret"

# Mailer
AWS_ACCESS_KEY_ID= #
AWS_SECRET_ACCESS_KEY= # AWS key for SES
BASEURL= # link to the host in the email, e.g. "http://localhost:3000"

# Smart Contracts
PROVIDER_HTTP="http://54.169.128.3:7545"
INFURA_VERSION="v3"
INFURA_ID= # Infura project ID
#Possible values for PROVIDER_HTTP "https://rinkeby.infura.io/v3/xxxxxxx" or "http://203.126.250.77:8545"

# OTP Required
OTP_REQUIRED_SIGN_IN = false
OTP_REQUIRED_SIGN_UP = true
OTP_REQUIRED_SIGNING = true
OTP_REQUIRED_NOAISSUE = true

# Wallet
WALLET_PRIV = "fc60507f016e4eb53d1dccb6703b2248e8f712acc9a4a4d87f853193dc5e6127"
WALLET_ADDR = "0x7c1c6aB0F33702682F5E6AAB589D97784a342f76"
VALUE = "0.5"
GAS_PRICE_PREMIUM_PCT="10"
GAS_LIMIT="70000"
GAS_LIMIT_DOCSTORE="1500000"
ISSUEDOC_NETWORK = "rinkeby"
DOCSTORE_FACTORY="0x50873f995174F00Fa38959eBD5bF72Fa49bb45dD"

# ABI
DocStoreABI = [{"inputs":[{"internalType":"string","name":"_name","type":"string"},{"internalType":"address","name":"_mappingAddress","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"document","type":"bytes32"}],"name":"DocumentIssued","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"document","type":"bytes32"}],"name":"DocumentRevoked","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"constant":true,"inputs":[],"name":"docStoreMapping","outputs":[{"internalType":"contract DocumentStoreMapping","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"documentIssued","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"documentRevoked","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"documentSigned","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"documentSigner","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"isOwner","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"renounceOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"version","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"bytes32","name":"document","type":"bytes32"}],"name":"issue","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"bytes32[]","name":"documents","type":"bytes32[]"}],"name":"bulkIssue","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"bytes32","name":"document","type":"bytes32"}],"name":"getIssuedBlock","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"bytes32","name":"document","type":"bytes32"}],"name":"isIssued","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"bytes32","name":"document","type":"bytes32"},{"internalType":"uint256","name":"blockNumber","type":"uint256"}],"name":"isIssuedBefore","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"bytes32","name":"document","type":"bytes32"}],"name":"revoke","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"bytes32[]","name":"documents","type":"bytes32[]"}],"name":"bulkRevoke","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"bytes32","name":"document","type":"bytes32"}],"name":"isRevoked","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"internalType":"bytes32","name":"document","type":"bytes32"},{"internalType":"uint256","name":"blockNumber","type":"uint256"}],"name":"isRevokedBefore","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"bytes32","name":"document","type":"bytes32"},{"internalType":"address","name":"_signer","type":"address"}],"name":"allowSigner","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"bytes32","name":"document","type":"bytes32"}],"name":"sign","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]


DocStoreFactoryABI = [{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"contract DocumentStore","name":"newInstance","type":"address"}],"name":"DocStoreDeployed","type":"event"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"assets","outputs":[{"internalType":"contract DocumentStore","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"count","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"mappingAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"string","name":"name","type":"string"}],"name":"deployDocStore","outputs":[{"internalType":"contract DocumentStore","name":"","type":"address"}],"payable":false,"stateMutability":"nonpayable","type":"function"}]


DocStoreMappingABI = [{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"bytes32","name":"","type":"bytes32"}],"name":"mappings","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"signer","type":"address"},{"internalType":"bytes32","name":"document","type":"bytes32"},{"internalType":"address","name":"docStore","type":"address"}],"name":"setMapping","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]
```

#Application Error Notification
AdminEmail="kumar@argentra.com";

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo_text.svg" width="320" alt="Nest Logo" /></a>
</p>

[travis-image]: https://api.travis-ci.org/nestjs/nest.svg?branch=master
[travis-url]: https://travis-ci.org/nestjs/nest
[linux-image]: https://img.shields.io/travis/nestjs/nest/master.svg?label=linux
[linux-url]: https://travis-ci.org/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="blank">Node.js</a> framework for building efficient and scalable server-side applications, heavily inspired by <a href="https://angular.io" target="blank">Angular</a>.</p>
   
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ yarn && yarn build
```

## Running the app

```bash
# development
$ yarn start

# watch mode
$ yarn start:dev

# production mode
$ yarn start:prod
```

## Test

```bash
# unit tests
$ yarn test

# e2e tests
$ yarn test:e2e

# test coverage
$ yarn test:cov
```

## Environment Variables

| Environment Variables | Purpose                                         | Value                                    |
| --------------------- |:-----------------------------------------------:|:----------------------------------------:|
| PORT                  | To specify the port number used to run or operate on local environment | if not specified, default value : "3000" |
| API_PREFIX            | Extra path | if not specified, default value : "api/v1" |
| MONGO_URL             | To state the URL that connects to MongoDB | current value : "mongodb://localhost/jedsign-api"           |
| JWT_SEC               | The secret (symmetric) or PEM-encoded public key (asymmetric) for verifying the token's signature | if not specified, default value : 'jedsign-api-jwt-secret' |
| AWS_ACCESS_KEY_ID     | Specifies an AWS access key associated with an IAM user or role | - |
| AWS_SECRET_ACCESS_KEY | Specifies the secret key associated with the access key. This is essentially the "password" for the access key | - |
| BASEURL               | Base URL for account activation email | if not specified, default value : "http://localhost:3000" |
| PROVIDER_HTTP         | The link to connect to the blockchain | current value : "http://54.169.128.3:7545" |
| INFURA_VERSION        | Infura Version | current value : "v3" |
| INFURA_ID             | Infura Token Id | - |
| CRYPTO_KEY            | A string of data that is used to lock or unlock cryptographic functions, including authentication, authorization and encryption | if not specified, default value : '50ae298be1123b4f50ae298be1123b4f' |

## OpenAPI (Swagger) Documentation

Built with https://docs.nestjs.com/recipes/swagger

Available at /api

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).
