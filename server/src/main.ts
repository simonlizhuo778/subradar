import 'reflect-metadata';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  // 单容器部署:同一个端口同时提供前端静态文件与 /api 接口
  // 默认读取仓库里的 web/dist(本地开发 & Docker 镜像内路径一致)
  const webDist = process.env.WEB_DIST ?? join(__dirname, '..', '..', 'web', 'dist');
  app.useStaticAssets(webDist);
  // 前端是单页应用,非 /api 的 GET 请求一律回退到 index.html
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isApi = req.path === '/api' || req.path.startsWith('/api/');
    if (req.method !== 'GET' || isApi || !req.accepts('html')) {
      next();
      return;
    }
    res.sendFile(join(webDist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  const config = new DocumentBuilder()
    .setTitle('SubRadar API')
    .setDescription('订阅雷达 —— API 文档(后续手机 App 直接复用)')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 SubRadar 运行于 http://localhost:${port}(页面 + /api 同一端口)`);
  console.log(`📚 Swagger 文档:http://localhost:${port}/api/docs`);
}

bootstrap();
