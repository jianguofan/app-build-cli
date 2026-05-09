import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WinstonLogger } from './common/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new WinstonLogger(),
  });

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS 配置
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // 全局前缀
  app.setGlobalPrefix('api');

  // Swagger 配置
  const config = new DocumentBuilder()
    .setTitle('App Build Platform API')
    .setDescription('移动端 App 自动化构建与发布平台')
    .setVersion('1.0')
    .addTag('auth', '认证管理')
    .addTag('builds', '构建任务')
    .addTag('publishes', '发布管理')
    .addTag('config', '系统配置')
    .addTag('health', '健康检查')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const winstonLogger = new WinstonLogger();
  winstonLogger.log(`🚀 Application is running on: http://localhost:${port}/api`);
  winstonLogger.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
  winstonLogger.log(`📊 Health check: http://localhost:${port}/api/health`);
}

bootstrap();
