import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as clc from 'cli-color';
import * as bodyParser from 'body-parser';
const log4js = require('log4js');
log4js.configure({
  appenders: { cheese: { type: 'file', filename: 'cheese.log' } },
  categories: { default: { appenders: ['cheese'], level: 'all' } },
});
const logger = log4js.getLogger('cheese');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
  app.enableCors();
  const apiPrefix = process.env.API_PREFIX ?? '/api/v1';
  const port = process.env.PORT ?? 3000;

  app.setGlobalPrefix(apiPrefix);

  const options = new DocumentBuilder()
    .setTitle('JCerts API')
    .setDescription('API for JCerts Project')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api', app, document);

  const server = await app.listen(port);
  //server.setTimeout(600000);
  //server.setTimeout(600000, () => {

  server.setTimeout(1800000, () => {
    console.log('Socket is destroyed due to timeout');
    logger.info('main: server.setTimeout: Socket is destroyed due to timeout');
  });

  console.log(
    `🚀  launched from pad ${clc.black.bgGreen(port)}, mission ${clc.black.bgGreen(apiPrefix)}`,
  );
}
bootstrap();
